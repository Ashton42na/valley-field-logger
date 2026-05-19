import {
  getPendingSyncVisits,
  getVisit,
  markVisitSynced,
  markVisitSyncRetry,
  markVisitSyncFailed
} from '../db/db.js'

const STORAGE_BASE_URL = 'vfl-sync-base-url'
const STORAGE_API_KEY  = 'vfl-sync-api-key'
const STORAGE_DEVICE_ID = 'vfl-device-id'
const STORAGE_LAST_RESULT = 'vfl-sync-last-result'
const STORAGE_SYNC_LOG = 'vfl-sync-log'
const MAX_LOG_ENTRIES = 100
const MAX_SYNC_ATTEMPTS = 5
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS  = 5 * 60 * 1000
const DEFAULT_FLUSH_DEBOUNCE_MS = 500

let inFlight = false
let pendingRerun = false
let flushTimer = null
let listeners = new Set()

function isValidSyncUrl(v) {
  if (!v) return false
  try {
    const u = new URL(v)
    if (u.protocol === 'https:') return true
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true
    return false
  } catch { return false }
}

export function getSyncBaseUrl() { return localStorage.getItem(STORAGE_BASE_URL) || '' }
export function setSyncBaseUrl(v) {
  const trimmed = (v || '').trim()
  if (trimmed && !isValidSyncUrl(trimmed)) {
    throw new Error('Sync URL must use https:// (or http://localhost for dev)')
  }
  localStorage.setItem(STORAGE_BASE_URL, trimmed)
}
export function getSyncApiKey()  { return localStorage.getItem(STORAGE_API_KEY)  || '' }
export function setSyncApiKey(v) { localStorage.setItem(STORAGE_API_KEY, (v || '').trim()) }

export function getLastResult() {
  try { return JSON.parse(localStorage.getItem(STORAGE_LAST_RESULT) || 'null') }
  catch { return null }
}

function setLastResult(result) {
  localStorage.setItem(STORAGE_LAST_RESULT, JSON.stringify(result))
  listeners.forEach(l => { try { l(result) } catch {} })
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getSyncLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_SYNC_LOG) || '[]') }
  catch { return [] }
}

export function clearSyncLog() {
  localStorage.setItem(STORAGE_SYNC_LOG, '[]')
}

function appendSyncLog(entry) {
  const log = getSyncLog()
  log.unshift(entry)
  if (log.length > MAX_LOG_ENTRIES) log.length = MAX_LOG_ENTRIES
  localStorage.setItem(STORAGE_SYNC_LOG, JSON.stringify(log))
}

function getDeviceId() {
  let id = localStorage.getItem(STORAGE_DEVICE_ID)
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) || ('d-' + Date.now().toString(36))
    localStorage.setItem(STORAGE_DEVICE_ID, id)
  }
  return id
}

function backoffMs(attempts) {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempts - 1)), MAX_BACKOFF_MS)
}

// Tracker is user-configured and untrusted — sanitize any error body before
// we persist it to localStorage or render it. Strip control chars, cap length,
// and redact the API key in case the server echoes it back.
function sanitizeError(text, apiKey) {
  if (!text) return ''
  let s = String(text).replace(/[\x00-\x1F\x7F]+/g, ' ').slice(0, 80)
  if (apiKey && apiKey.length >= 8) {
    s = s.split(apiKey).join('[redacted]')
  }
  return s.trim()
}

// Wire format consumed downstream by AuditITClone's FieldVisitMatchLogic. Field-value
// contracts that must stay aligned with that consumer (changes here require a paired
// change in QACommandControl/Program.cs around the PUT /api/companies/{id} validation
// block and FieldVisitMatchLogic.ApplyVisitMetadata):
//   status      ∈ STATUSES in VisitForm.jsx     → Company.LastVisitStatus
//   temperature ∈ TEMPS    in VisitForm.jsx     → Company.CurrentLeadTemperature
//   outcome     (free text from OUTCOMES list)  → appended to the Activity Notes
//   notes + voiceNote                           → Activity Notes body
//   email + contactName/contactTitle + phone    → Contact resolve-or-create
function buildPayload(v) {
  return {
    visitUid: v.visitUid,
    deviceId: getDeviceId(),
    capturedAt: v.timestamp ? new Date(v.timestamp).toISOString() : null,
    updatedAt:  v.updatedAt ? new Date(v.updatedAt).toISOString() : null,
    companyName: v.companyName || '',
    address: v.address || null,
    phone: v.phone || null,
    website: v.website || null,
    industry: v.industry || null,
    contactName: v.contactName || null,
    contactTitle: v.contactTitle || null,
    email: v.email || null,
    status: v.status || null,
    temperature: v.temperature || null,
    outcome: v.outcome || null,
    followUpDate: v.followUpDate || null,
    notes: v.notes || null,
    voiceNote: v.voiceNote || null,
    lat: typeof v.lat === 'number' ? v.lat : null,
    lon: typeof v.lon === 'number' ? v.lon : null
  }
}

async function postOne(baseUrl, apiKey, visit) {
  const url = baseUrl.replace(/\/+$/, '') + '/api/visits'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey
    },
    body: JSON.stringify(buildPayload(visit))
  })
  // 200 OK or 409 (duplicate) both count as "delivered"
  if (res.ok || res.status === 409) return { ok: true }
  // Don't persist server text on auth failures — the response may echo the key.
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: `HTTP ${res.status}` }
  }
  let detail = ''
  try { detail = sanitizeError(await res.text(), apiKey) } catch {}
  return { ok: false, error: `HTTP ${res.status}${detail ? ': ' + detail : ''}` }
}

/**
 * Debounced flush. Use this for triggers that can fire in bursts (per-save,
 * online events) to coalesce them into a single flush.
 */
export function scheduleFlush(delay = DEFAULT_FLUSH_DEBOUNCE_MS) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush().catch(() => {})
  }, delay)
}

/**
 * Walk pending rows and POST each. Marks rows synced, scheduled for retry,
 * or permanently failed. Returns a summary { sent, failed, skipped, busy?, error? }.
 */
export async function flush() {
  if (inFlight) {
    // Another flush is mid-flight. Schedule one more after it completes so
    // newly-saved or newly-reset rows don't get stranded on a stale snapshot.
    pendingRerun = true
    return { sent: 0, failed: 0, skipped: 0, busy: true }
  }
  const baseUrl = getSyncBaseUrl()
  const apiKey  = getSyncApiKey()
  if (!baseUrl || !apiKey) {
    const result = { sent: 0, failed: 0, skipped: 0, error: 'Sync URL and API key required', at: Date.now() }
    setLastResult(result)
    return result
  }

  inFlight = true
  let sent = 0, failed = 0, skipped = 0
  const visitLog = []
  try {
    const pending = await getPendingSyncVisits()
    const now = Date.now()
    for (const snap of pending) {
      // Re-fetch so we POST the user's latest edits, not the stale snapshot.
      const v = await getVisit(snap.id)
      if (!v || v.syncStatus !== 'pending') continue
      // Honor backoff window.
      if (v.nextRetryAt && v.nextRetryAt > now) {
        skipped++
        continue
      }
      const label = v.companyName || v.address || v.visitUid
      const attempts = (v.syncAttempts || 0) + 1
      try {
        const r = await postOne(baseUrl, apiKey, v)
        if (r.ok) {
          await markVisitSynced(v.id)
          sent++
          visitLog.push({ uid: v.visitUid, name: label, outcome: 'sent' })
        } else if (attempts >= MAX_SYNC_ATTEMPTS) {
          await markVisitSyncFailed(v.id, r.error, attempts)
          failed++
          visitLog.push({ uid: v.visitUid, name: label, outcome: 'failed', error: r.error })
        } else {
          await markVisitSyncRetry(v.id, r.error, attempts, now + backoffMs(attempts))
          failed++
          visitLog.push({ uid: v.visitUid, name: label, outcome: 'retry', error: r.error })
        }
      } catch (e) {
        const msg = e.message || 'Network error'
        if (attempts >= MAX_SYNC_ATTEMPTS) {
          await markVisitSyncFailed(v.id, msg, attempts)
          failed++
          visitLog.push({ uid: v.visitUid, name: label, outcome: 'failed', error: msg })
        } else {
          await markVisitSyncRetry(v.id, msg, attempts, now + backoffMs(attempts))
          failed++
          visitLog.push({ uid: v.visitUid, name: label, outcome: 'retry', error: msg })
        }
      }
    }
    const result = { sent, failed, skipped, at: Date.now() }
    if (visitLog.length > 0) {
      appendSyncLog({ at: result.at, sent, failed, error: null, visits: visitLog })
    }
    setLastResult(result)
    return result
  } finally {
    inFlight = false
    if (pendingRerun) {
      pendingRerun = false
      scheduleFlush(100)
    }
  }
}
