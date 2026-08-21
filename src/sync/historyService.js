import { getHistoryCache, putHistoryCache } from '../db/db.js'
import { getFieldLoggerKey, looksLikeFieldLoggerKey, getSyncBaseUrl } from './syncService.js'
import { historyCacheKey } from '../utils/placeMatch.js'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_BATCH = 20

function isValidHttpsUrl(v) {
  if (!v) return false
  try {
    const u = new URL(v)
    if (u.protocol === 'https:') return true
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true
    return false
  } catch { return false }
}

/** Team overlay uses the same tracker URL + Field Logger Key as visit ingest. No portal URL. */
export function teamHistoryConfigured() {
  return isValidHttpsUrl(getSyncBaseUrl()) && looksLikeFieldLoggerKey(getFieldLoggerKey())
}

function emptyTeam() {
  return { match: 'none', visits: [], youUserName: '', company: null, error: false }
}

function normalizePayload(data) {
  return {
    match: data?.match === 'exact' ? 'exact' : 'none',
    visits: Array.isArray(data?.visits) ? data.visits : [],
    youUserName: data?.youUserName || '',
    company: data?.company || null,
    error: false
  }
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

async function trackerFetch(path, { method = 'GET', body, signal } = {}) {
  const base = getSyncBaseUrl()
  const key = getFieldLoggerKey()
  if (!isValidHttpsUrl(base) || !looksLikeFieldLoggerKey(key)) return null
  const url = base.replace(/\/+$/, '') + path
  const res = await fetch(url, {
    method,
    headers: {
      'X-FIELD-LOGGER-KEY': key,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal
  })
  if (!res.ok) return { error: true }
  return res.json()
}

/**
 * Fetch team history for one place. Never throws — network/auth failures return empty.
 * Writes the cache on success (including match:none, so we do not re-hit misses all day).
 */
export async function fetchTeamHistory(place, { signal } = {}) {
  if (!teamHistoryConfigured()) return emptyTeam()
  const params = new URLSearchParams()
  if (place.name) params.set('name', place.name)
  if (place.address) params.set('address', place.address)
  if (place.phone) params.set('phone', place.phone)
  try {
    const data = await trackerFetch('/api/visits/history?' + params.toString(), { signal })
    if (!data || data.error) return { ...emptyTeam(), error: true }
    const payload = normalizePayload(data)
    await putHistoryCache(historyCacheKey(place), payload)
    return payload
  } catch {
    return { ...emptyTeam(), error: true }
  }
}

/**
 * Batch lookup for search / Nearby cards (max 20). Caches each place. Never throws.
 */
export async function fetchTeamHistoryBatch(places, { signal } = {}) {
  if (!teamHistoryConfigured() || !places?.length) return { youUserName: '', results: [] }
  const slice = places.slice(0, MAX_BATCH)
  try {
    const data = await trackerFetch('/api/visits/history-batch', {
      method: 'POST',
      body: {
        places: slice.map(p => ({
          placeId: p.placeId || '',
          name: p.name || '',
          address: p.address || '',
          phone: p.phone || ''
        }))
      },
      signal
    })
    if (!data || data.error) return { youUserName: '', results: [], error: true }
    const youUserName = data.youUserName || ''
    const results = Array.isArray(data.results) ? data.results : []
    for (let i = 0; i < results.length; i++) {
      const place = slice[i]
      const payload = normalizePayload({ ...results[i], youUserName })
      if (place) await putHistoryCache(historyCacheKey(place), payload)
    }
    return { youUserName, results: results.map((r, i) => ({ place: slice[i], team: normalizePayload({ ...r, youUserName }) })) }
  } catch {
    return { youUserName: '', results: [], error: true }
  }
}

/**
 * Local-first: return cached team rows immediately, then refresh in the background.
 */
export async function loadTeamHistory(place, { onRefresh } = {}) {
  const cached = await readTeamHistoryCache(place, { allowStale: true })
  const needsFetch = teamHistoryConfigured() && (!cached || cached.stale)
  if (needsFetch) {
    fetchTeamHistory(place).then(fresh => {
      if (fresh?.error) return
      if (onRefresh) onRefresh(fresh)
    }).catch(() => {})
  }
  return cached || emptyTeam()
}
