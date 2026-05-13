import {
  getPendingSyncVisits,
  markVisitSynced,
  markVisitSyncFailed
} from '../db/db.js'

const STORAGE_BASE_URL = 'vfl-sync-base-url'
const STORAGE_API_KEY  = 'vfl-sync-api-key'
const STORAGE_DEVICE_ID = 'vfl-device-id'
const STORAGE_LAST_RESULT = 'vfl-sync-last-result'

let inFlight = false
let listeners = new Set()

export function getSyncBaseUrl() { return localStorage.getItem(STORAGE_BASE_URL) || '' }
export function setSyncBaseUrl(v) { localStorage.setItem(STORAGE_BASE_URL, (v || '').trim()) }
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

function getDeviceId() {
  let id = localStorage.getItem(STORAGE_DEVICE_ID)
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || ('d-' + Date.now().toString(36))
    localStorage.setItem(STORAGE_DEVICE_ID, id)
  }
  return id
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
  let detail = ''
  try { detail = (await res.text()).slice(0, 200) } catch {}
  return { ok: false, error: `HTTP ${res.status}${detail ? ': ' + detail : ''}` }
}

/**
 * Walk pending rows and POST each. Marks rows synced or failed.
 * Returns a summary { sent, failed, skipped, error? }.
 */
export async function flush() {
  if (inFlight) return { sent: 0, failed: 0, skipped: 0, busy: true }
  const baseUrl = getSyncBaseUrl()
  const apiKey  = getSyncApiKey()
  if (!baseUrl || !apiKey) {
    const result = { sent: 0, failed: 0, skipped: 0, error: 'Sync URL and API key required', at: Date.now() }
    setLastResult(result)
    return result
  }

  inFlight = true
  let sent = 0, failed = 0
  try {
    const pending = await getPendingSyncVisits()
    for (const v of pending) {
      try {
        const r = await postOne(baseUrl, apiKey, v)
        if (r.ok) { await markVisitSynced(v.id); sent++ }
        else      { await markVisitSyncFailed(v.id, r.error); failed++ }
      } catch (e) {
        await markVisitSyncFailed(v.id, e.message || 'Network error')
        failed++
      }
    }
    const result = { sent, failed, skipped: 0, at: Date.now() }
    setLastResult(result)
    return result
  } finally {
    inFlight = false
  }
}
