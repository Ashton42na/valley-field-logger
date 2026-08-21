const DAY_MS = 24 * 60 * 60 * 1000
const SKIP_WINDOW_MS = 90 * DAY_MS
const DEDUPE_WINDOW_MS = 15 * 60 * 1000

export const OUTCOME_LABELS = {
  'left-info': 'Left Info',
  'spoke-to-owner': 'Spoke to Owner',
  'gatekeeper-only': 'Gatekeeper Only',
  'requested-callback': 'Requested Callback',
  'not-interested': 'Not Interested'
}

export const STATUS_META = {
  'visited':        { label: 'Visited',        cls: 'badge-visited' },
  'followed-up':    { label: 'Followed Up',    cls: 'badge-followed-up' },
  'meeting-set':    { label: 'Meeting Set',    cls: 'badge-meeting-set' },
  'not-interested': { label: 'Not Interested', cls: 'badge-not-interested' },
  'call-back':      { label: 'Call Back',      cls: 'badge-call-back' }
}

export function toDayKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatRelativeDays(timestamp) {
  if (!timestamp) return ''
  const days = Math.round((Date.now() - timestamp) / DAY_MS)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.round(days / 7)} wk ago`
  return `${Math.round(days / 30)} mo ago`
}

export function normalizeLocalVisit(v) {
  return {
    id: v.id,
    visitUid: v.visitUid || null,
    source: 'local',
    isYou: true,
    userName: 'You',
    timestamp: v.timestamp,
    companyName: v.companyName || '',
    status: v.status || '',
    temperature: v.temperature || '',
    outcome: v.outcome || '',
    contactName: v.contactName || '',
    contactTitle: v.contactTitle || '',
    email: v.email || '',
    phone: v.phone || '',
    notes: v.notes || '',
    voiceNote: v.voiceNote || '',
    followUpDate: v.followUpDate || '',
    placeId: v.placeId || ''
  }
}

export function normalizeTeamVisit(t, youUserName) {
  const captured = t.capturedAt ? new Date(t.capturedAt).getTime() : 0
  const userName = (t.userName || '').trim()
  const isYou = !!(youUserName && userName && userName.toLowerCase() === youUserName.toLowerCase())
  return {
    id: 'team-' + (t.capturedAt || '') + '-' + userName,
    visitUid: t.visitUid || null,
    source: 'team',
    isYou,
    userName: isYou ? 'You' : (userName || 'Teammate'),
    timestamp: captured,
    companyName: t.companyName || '',
    status: t.status || '',
    temperature: t.temperature || '',
    outcome: t.outcome || '',
    contactName: t.contactName || '',
    contactTitle: t.contactTitle || '',
    email: t.email || '',
    phone: t.phone || '',
    notes: t.notes || '',
    voiceNote: t.voiceNote || '',
    followUpDate: t.followUpDate || '',
    placeId: t.placeId || ''
  }
}

export function mergeVisitHistories(localVisits, teamVisits, youUserName) {
  const rows = (localVisits || []).map(normalizeLocalVisit)
  for (const t of teamVisits || []) {
    const n = normalizeTeamVisit(t, youUserName)
    const dup = rows.some(r => {
      if (r.visitUid && n.visitUid && r.visitUid === n.visitUid) return true
      if (r.source !== 'local') return false
      if (!r.timestamp || !n.timestamp) return false
      return Math.abs(r.timestamp - n.timestamp) < DEDUPE_WINDOW_MS
    })
    if (!dup) rows.push(n)
  }
  rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  return rows
}

/**
 * @returns {{ count: number, tone: 'due'|'skip'|'today'|'prior', last: object|null, teamOnly: boolean }}
 */
export function applyCompanySnapshot(visits, company) {
  if (!company || !visits?.length) return visits || []
  const last = visits[0]
  if (!last.status && company.lastVisitStatus) last.status = company.lastVisitStatus
  if (!last.temperature && company.currentLeadTemperature) last.temperature = company.currentLeadTemperature
  return visits
}

export function summarizeHistory(visits) {
  const list = visits || []
  const count = list.length
  if (count === 0) {
    return { count: 0, tone: null, last: null, teamOnly: false, lastContact: null }
  }
  const last = list[0]
  const todayKey = toDayKey(new Date())
  const lastDay = last.timestamp ? toDayKey(last.timestamp) : ''
  let tone = 'prior'
  if (lastDay === todayKey) {
    tone = 'today'
  } else if (last.followUpDate && last.followUpDate <= todayKey) {
    tone = 'due'
  } else if (last.status === 'not-interested' && last.timestamp && (Date.now() - last.timestamp) <= SKIP_WINDOW_MS) {
    tone = 'skip'
  }
  const lastContact = list.find(v => v.contactName) || null
  const teamOnly = list.every(v => v.source === 'team')
  return { count, tone, last, teamOnly, lastContact }
}

export function pillLabel(summary) {
  if (!summary || !summary.count) return ''
  if (summary.tone === 'due') return `Due · ${summary.count}`
  if (summary.tone === 'skip') return `Skip · ${summary.count}`
  if (summary.tone === 'today') return 'Today'
  return String(summary.count)
}

export function nearbyRank(summary) {
  if (!summary || !summary.count) return 1
  if (summary.tone === 'due') return 0
  if (summary.tone === 'today' || summary.tone === 'skip') return 3
  return 2
}
