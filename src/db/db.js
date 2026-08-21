import { openDB } from 'idb'
import { visitMatchesPlace, namesMatch, normAddressKey } from '../utils/placeMatch.js'

const DB_NAME = 'valley-field-logger'
const DB_VERSION = 3

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('visits', { keyPath: 'id', autoIncrement: true })
        store.createIndex('timestamp', 'timestamp')
        store.createIndex('status', 'status')
      }
      if (oldVersion < 2) {
        const store = tx.objectStore('visits')
        if (!store.indexNames.contains('syncStatus')) {
          store.createIndex('syncStatus', 'syncStatus')
        }
        // Backfill sync fields on existing rows so they enter the queue
        let cursor = await store.openCursor()
        while (cursor) {
          const v = cursor.value
          let changed = false
          if (!v.visitUid) { v.visitUid = generateUid(); changed = true }
          if (!v.syncStatus) { v.syncStatus = 'pending'; changed = true }
          if (changed) await cursor.update(v)
          cursor = await cursor.continue()
        }
      }
      if (oldVersion < 3) {
        const store = tx.objectStore('visits')
        if (!store.indexNames.contains('placeId')) {
          store.createIndex('placeId', 'placeId')
        }
        if (!store.indexNames.contains('companyName')) {
          store.createIndex('companyName', 'companyName')
        }
        if (!db.objectStoreNames.contains('historyCache')) {
          db.createObjectStore('historyCache', { keyPath: 'cacheKey' })
        }
      }
    }
  })
}

function generateUid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for older browsers
  return 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

export async function addVisit(visit) {
  const db = await getDB()
  const now = Date.now()
  const enriched = {
    ...visit,
    visitUid: visit.visitUid || generateUid(),
    timestamp: visit.timestamp || now,
    syncStatus: 'pending',
    syncedAt: null,
    syncError: null
  }
  return db.add('visits', enriched)
}

export async function updateVisit(id, changes) {
  const db = await getDB()
  const existing = await db.get('visits', id)
  return db.put('visits', { ...existing, ...changes, updatedAt: Date.now() })
}

export async function getAllVisits() {
  const db = await getDB()
  const visits = await db.getAll('visits')
  return visits.sort((a, b) => b.timestamp - a.timestamp)
}

export async function deleteVisit(id) {
  const db = await getDB()
  return db.delete('visits', id)
}

export async function getVisit(id) {
  const db = await getDB()
  return db.get('visits', id)
}

export async function getPendingSyncVisits() {
  const db = await getDB()
  return db.getAllFromIndex('visits', 'syncStatus', 'pending')
}

export async function countPendingSync() {
  const db = await getDB()
  return db.countFromIndex('visits', 'syncStatus', 'pending')
}

export async function markVisitSynced(id) {
  const db = await getDB()
  const v = await db.get('visits', id)
  if (!v) return
  v.syncStatus = 'sent'
  v.syncedAt = Date.now()
  v.syncError = null
  v.syncAttempts = 0
  v.nextRetryAt = null
  return db.put('visits', v)
}

export async function markVisitSyncRetry(id, error, attempts, nextRetryAt) {
  const db = await getDB()
  const v = await db.get('visits', id)
  if (!v) return
  v.syncStatus = 'pending'
  v.syncError = error || 'Unknown error'
  v.syncAttempts = attempts
  v.nextRetryAt = nextRetryAt
  return db.put('visits', v)
}

export async function markVisitSyncFailed(id, error, attempts) {
  const db = await getDB()
  const v = await db.get('visits', id)
  if (!v) return
  v.syncStatus = 'failed'
  v.syncError = error || 'Unknown error'
  if (typeof attempts === 'number') v.syncAttempts = attempts
  v.nextRetryAt = null
  return db.put('visits', v)
}

export async function resetFailedToPending() {
  const db = await getDB()
  const failed = await db.getAllFromIndex('visits', 'syncStatus', 'failed')
  const tx = db.transaction('visits', 'readwrite')
  for (const v of failed) {
    v.syncStatus = 'pending'
    v.syncError = null
    v.syncAttempts = 0
    v.nextRetryAt = null
    await tx.store.put(v)
  }
  await tx.done
}

function doorKey(v) {
  if (v.placeId) return 'pid:' + v.placeId
  if (typeof v.lat === 'number' && typeof v.lon === 'number') {
    return 'geo:' + v.lat.toFixed(4) + ',' + v.lon.toFixed(4)
  }
  const addr = normAddressKey(v.address)
  if (addr) return 'a:' + addr
  return 'name'
}

export function selectVisitsForPlace(all, place) {
  const list = all || []
  const placeIsBareName = !place?.placeId && !place?.address && !place?.phone && typeof place?.lat !== 'number'
  let matched
  if (placeIsBareName) {
    const named = list.filter(v => namesMatch(v.companyName, place.name))
    const keys = new Set(named.map(doorKey))
    matched = keys.size === 1 ? named : []
  } else {
    matched = list.filter(v => visitMatchesPlace(v, place).matched)
  }
  matched.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  return matched
}

export async function getVisitsForPlace(place) {
  const all = await getAllVisits()
  const matched = selectVisitsForPlace(all, place)
  const backfillIds = []
  if (place?.placeId) {
    for (const v of matched) {
      if (v.placeId) continue
      const conf = visitMatchesPlace(v, place).confidence
      if (conf === 'geo' || conf === 'addr' || conf === 'phone-and-addr') backfillIds.push(v.id)
    }
  }
  if (backfillIds.length && place?.placeId) {
    await backfillPlaceId(backfillIds, place.placeId)
    for (const v of matched) {
      if (!v.placeId) v.placeId = place.placeId
    }
  }
  return matched
}

export async function backfillPlaceId(ids, placeId) {
  if (!placeId || !ids?.length) return
  const db = await getDB()
  const tx = db.transaction('visits', 'readwrite')
  for (const id of ids) {
    const v = await tx.store.get(id)
    if (v && !v.placeId) {
      v.placeId = placeId
      await tx.store.put(v)
    }
  }
  await tx.done
}

export async function getHistoryCache(cacheKey) {
  if (!cacheKey) return null
  const db = await getDB()
  return db.get('historyCache', cacheKey)
}

export async function putHistoryCache(cacheKey, payload) {
  if (!cacheKey) return
  const db = await getDB()
  return db.put('historyCache', { cacheKey, fetchedAt: Date.now(), ...payload })
}
