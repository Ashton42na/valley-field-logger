import { getHistoryCache, putHistoryCache } from '../db/db.js'
import { getFieldLoggerKey, looksLikeFieldLoggerKey } from './syncService.js'
import { historyCacheKey } from '../utils/placeMatch.js'

const STORAGE_PORTAL_URL = 'vfl-portal-url'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function isValidHttpsUrl(v) {
  if (!v) return false
  try {
    const u = new URL(v)
    if (u.protocol === 'https:') return true
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true
    return false
  } catch { return false }
}

export function getPortalUrl() { return (localStorage.getItem(STORAGE_PORTAL_URL) || '').trim() }

export function setPortalUrl(v) {
  const trimmed = (v || '').trim()
  if (!trimmed) {
    localStorage.removeItem(STORAGE_PORTAL_URL)
    return
  }
  if (!isValidHttpsUrl(trimmed)) {
    throw new Error('Portal URL must use https:// (or http://localhost for dev)')
  }
  localStorage.setItem(STORAGE_PORTAL_URL, trimmed.replace(/\/+$/, ''))
}

export function portalHistoryConfigured() {
  return isValidHttpsUrl(getPortalUrl()) && looksLikeFieldLoggerKey(getFieldLoggerKey())
}

function emptyTeam() {
  return { match: 'none', visits: [], youUserName: '', company: null, error: false }
}

/**
 * Cached team history if still fresh. Does not hit the network.
 */
export async function readTeamHistoryCache(place, { allowStale = true } = {}) {
  const row = await getHistoryCache(historyCacheKey(place))
  if (!row || !row.fetchedAt) return null
  const stale = Date.now() - row.fetchedAt > CACHE_TTL_MS
  if (stale && !allowStale) return null
  return { ...row, stale }
}

/**
 * Fetch team history for one place. Never throws — network/auth failures return empty.
 * Writes the cache on success (including match:none, so we do not re-hit misses all day).
 */
export async function fetchTeamHistory(place, { signal } = {}) {
  const base = getPortalUrl()
  const key = getFieldLoggerKey()
  if (!isValidHttpsUrl(base) || !looksLikeFieldLoggerKey(key)) return emptyTeam()

  const url = new URL(base.replace(/\/+$/, '') + '/api/field-logger/visit-history')
  if (place.placeId) url.searchParams.set('placeId', place.placeId)
  if (place.name) url.searchParams.set('name', place.name)
  if (place.address) url.searchParams.set('address', place.address)
  if (place.phone) url.searchParams.set('phone', place.phone)
  if (typeof place.lat === 'number') url.searchParams.set('lat', String(place.lat))
  if (typeof place.lon === 'number') url.searchParams.set('lon', String(place.lon))

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'X-FIELD-LOGGER-KEY': key },
      signal
    })
    if (!res.ok) return { ...emptyTeam(), error: true }
    const data = await res.json()
    const payload = {
      match: data.match === 'exact' ? 'exact' : 'none',
      visits: Array.isArray(data.visits) ? data.visits : [],
      youUserName: data.youUserName || '',
      company: data.company || null,
      error: false
    }
    await putHistoryCache(historyCacheKey(place), payload)
    return payload
  } catch {
    return { ...emptyTeam(), error: true }
  }
}

/**
 * Local-first: return cached team rows immediately, then refresh in the background.
 */
export async function loadTeamHistory(place, { onRefresh } = {}) {
  const cached = await readTeamHistoryCache(place, { allowStale: true })
  const needsFetch = portalHistoryConfigured() && (!cached || cached.stale)
  if (needsFetch) {
    fetchTeamHistory(place).then(fresh => {
      if (fresh?.error) return
      if (onRefresh) onRefresh(fresh)
    }).catch(() => {})
  }
  return cached || emptyTeam()
}
