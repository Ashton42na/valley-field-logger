import { openDB } from 'idb'

const DB_NAME = 'valley-field-logger'
const DB_VERSION = 1

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('visits', { keyPath: 'id', autoIncrement: true })
      store.createIndex('timestamp', 'timestamp')
      store.createIndex('status', 'status')
    }
  })
}

export async function addVisit(visit) {
  const db = await getDB()
  return db.add('visits', { ...visit, timestamp: Date.now() })
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
