import { useState, useCallback, useEffect } from 'react'
import { getAllVisits, countPendingSync, resetFailedToPending } from '../db/db.js'
import { exportVisitsToCSV } from '../utils/csvExport.js'
import {
  getSyncBaseUrl, setSyncBaseUrl,
  getSyncApiKey, setSyncApiKey,
  getLastResult, subscribe, flush as flushSync,
  getSyncLog, clearSyncLog
} from '../sync/syncService.js'

const IconKey = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
)

const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

export default function Settings({ apiKey, onSaveApiKey, placesApiKey, onSavePlacesApiKey, showToast }) {
  const [draft, setDraft] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)
  const changed = draft !== apiKey

  const [placesDraft, setPlacesDraft] = useState(placesApiKey)
  const [showPlacesKey, setShowPlacesKey] = useState(false)
  const placesChanged = placesDraft !== placesApiKey

  const handleSave = () => {
    onSaveApiKey(draft.trim())
    showToast('API key saved', 'success')
  }

  const handlePlacesSave = () => {
    onSavePlacesApiKey(placesDraft.trim())
    showToast('Places API key saved', 'success')
  }

  const handleExportAll = useCallback(async () => {
    try {
      const all = await getAllVisits()
      if (all.length === 0) { showToast('No visits to export', 'error'); return }
      exportVisitsToCSV(all)
      showToast(`Exported ${all.length} visit${all.length === 1 ? '' : 's'}`, 'success')
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error')
    }
  }, [showToast])

  // Sync settings
  const [syncUrlDraft, setSyncUrlDraft] = useState(getSyncBaseUrl())
  const [syncKeyDraft, setSyncKeyDraft] = useState(getSyncApiKey())
  const [showSyncKey, setShowSyncKey] = useState(false)
  const [syncPending, setSyncPending] = useState(0)
  const [syncLast, setSyncLast] = useState(getLastResult())
  const [syncing, setSyncing] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [syncLog, setSyncLog] = useState(() => getSyncLog())

  const refreshPending = useCallback(async () => {
    try { setSyncPending(await countPendingSync()) } catch {}
  }, [])

  const refreshLog = useCallback(() => { setSyncLog(getSyncLog()) }, [])

  useEffect(() => {
    refreshPending()
    const unsub = subscribe((r) => { setSyncLast(r); refreshPending(); refreshLog() })
    return unsub
  }, [refreshPending, refreshLog])

  const syncUrlChanged = syncUrlDraft !== getSyncBaseUrl()
  const syncKeyChanged = syncKeyDraft !== getSyncApiKey()

  const handleSaveSyncUrl = () => {
    try {
      setSyncBaseUrl(syncUrlDraft.trim())
      setSyncUrlDraft(getSyncBaseUrl())
      showToast('Sync URL saved', 'success')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }
  const handleSaveSyncKey = () => {
    setSyncApiKey(syncKeyDraft.trim())
    setSyncKeyDraft(getSyncApiKey())
    showToast('Sync API key saved', 'success')
  }
  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      await resetFailedToPending()
      const r = await flushSync()
      if (r.busy)         showToast('Sync queued — runs after current sync', 'success')
      else if (r.error)   showToast(r.error, 'error')
      else if (r.failed)  showToast(`Synced ${r.sent}, ${r.failed} failed${r.retried ? `, ${r.retried} retrying` : ''}`, 'error')
      else if (r.retried) showToast(`Synced ${r.sent}, ${r.retried} will retry`, 'success')
      else if (r.sent)    showToast(`Synced ${r.sent} visit${r.sent === 1 ? '' : 's'}`, 'success')
      else                showToast('Nothing to sync', 'success')
      await refreshPending()
    } catch (e) {
      showToast('Sync failed: ' + e.message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="view-inner">
      <div style={{ paddingTop: 16, marginBottom: 20 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Settings</span>
      </div>

      {/* About */}
      <div className="about-logo">
        <svg width="56" height="56" viewBox="0 0 192 192" fill="none" style={{ borderRadius: 12 }}>
          <rect width="192" height="192" rx="40" fill="#111118"/>
          <path d="M96 28C73.9 28 56 45.9 56 68c0 32.5 40 96 40 96s40-63.5 40-96c0-22.1-17.9-40-40-40z" fill="#4ade80"/>
          <circle cx="96" cy="68" r="14" fill="#111118"/>
        </svg>
        <h2>Valley Field Logger</h2>
        <p>Valley Techlogic · v1.0.0</p>
      </div>

      {/* Anthropic API key */}
      <p className="section-title" style={{ marginBottom: 10 }}>AI Notes Cleanup</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="settings-row">
          <div className="settings-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconKey /> Anthropic API Key
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="form-input"
              type={showKey ? 'text' : 'password'}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              style={{ fontFamily: showKey ? 'monospace' : 'inherit', fontSize: 14, flex: 1 }}
            />
            <button
              className="btn btn-icon"
              onClick={() => setShowKey(v => !v)}
              aria-label={showKey ? 'Hide key' : 'Show key'}
              style={{ flexShrink: 0 }}
            >
              {showKey
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          {changed && (
            <button className="btn btn-primary btn-full" onClick={handleSave} style={{ height: 44 }}>
              <IconCheck />
              Save Key
            </button>
          )}
          {apiKey && !changed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--green)' }}>
              <IconCheck /> Key saved
            </div>
          )}
          <p className="settings-hint">
            Used only for the "Clean with AI" button on voice notes. Your key is stored locally on this device only.
            Get a key at console.anthropic.com.
          </p>
        </div>
      </div>

      {/* Data */}
      <p className="section-title" style={{ marginBottom: 10 }}>Data</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="settings-row">
          <div className="settings-label">Storage</div>
          <p className="settings-hint" style={{ marginTop: 0, marginBottom: 12 }}>
            Visits are saved locally on this device. When sync is configured below, new visits also upload to the central tracker.
          </p>
          <button className="btn btn-secondary btn-full" onClick={handleExportAll} style={{ height: 44, fontSize: 14 }}>
            <IconDownload />
            Export All Visits as CSV
          </button>
        </div>
      </div>

      {/* Sync */}
      <p className="section-title" style={{ marginBottom: 10 }}>Sync to Tracker</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="settings-row">
          <div className="settings-label">Tracker URL</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="form-input"
              type="url"
              value={syncUrlDraft}
              onChange={e => setSyncUrlDraft(e.target.value)}
              placeholder="https://tracker.example.com"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              style={{ fontSize: 14, flex: 1 }}
            />
          </div>
          {syncUrlChanged && (
            <button className="btn btn-primary btn-full" onClick={handleSaveSyncUrl} style={{ height: 44, marginBottom: 12 }}>
              <IconCheck /> Save URL
            </button>
          )}

          <div className="settings-label" style={{ marginTop: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconKey /> API Key</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="form-input"
              type={showSyncKey ? 'text' : 'password'}
              value={syncKeyDraft}
              onChange={e => setSyncKeyDraft(e.target.value)}
              placeholder="X-API-KEY value"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              style={{ fontFamily: showSyncKey ? 'monospace' : 'inherit', fontSize: 14, flex: 1 }}
            />
            <button
              className="btn btn-icon"
              onClick={() => setShowSyncKey(v => !v)}
              aria-label={showSyncKey ? 'Hide key' : 'Show key'}
              style={{ flexShrink: 0 }}
            >
              {showSyncKey
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          {syncKeyChanged && (
            <button className="btn btn-primary btn-full" onClick={handleSaveSyncKey} style={{ height: 44, marginBottom: 12 }}>
              <IconCheck /> Save Key
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0', fontSize: 13, color: 'var(--text2)' }}>
            <span>Pending: <strong>{syncPending}</strong></span>
            <span>
              {syncLast?.error
                ? <span style={{ color: 'var(--red)' }}>Last: {syncLast.error}</span>
                : syncLast
                  ? <span>Last: sent {syncLast.sent}{syncLast.failed ? `, ${syncLast.failed} failed` : ''}{syncLast.retried ? `, ${syncLast.retried} retrying` : ''}</span>
                  : <span>Never synced</span>}
            </span>
          </div>
          <button
            className="btn btn-secondary btn-full"
            onClick={handleSyncNow}
            disabled={syncing}
            style={{ height: 44, fontSize: 14 }}
          >
            {syncing
              ? <span className="spinner" style={{ borderColor: 'rgba(96,99,122,0.3)', borderTopColor: 'var(--text2)' }} />
              : 'Sync Now'}
          </button>
          <button
            className="btn btn-secondary btn-full"
            onClick={() => { setSyncLog(getSyncLog()); setShowLogModal(true) }}
            style={{ height: 40, fontSize: 13, marginTop: 8 }}
          >
            View Sync Log
          </button>
          <p className="settings-hint">
            Visits also sync automatically after save and when the device comes back online.
            Configure the tracker URL and API key issued for this device.
          </p>
        </div>
      </div>

      {/* Sync Log Modal */}
      {showLogModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowLogModal(false) }}
        >
          <div style={{
            background: 'var(--card)',
            borderRadius: '16px 16px 0 0',
            width: '100%', maxWidth: 560,
            maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 16px 12px',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Sync Log</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {syncLog.length > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ height: 32, fontSize: 12, padding: '0 12px' }}
                    onClick={() => { clearSyncLog(); setSyncLog([]) }}
                  >
                    Clear
                  </button>
                )}
                <button
                  className="btn btn-icon"
                  onClick={() => setShowLogModal(false)}
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 18, height: 18 }}>
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', padding: '12px 16px 24px', flex: 1 }}>
              {syncLog.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 14, marginTop: 24 }}>
                  No sync events recorded yet.
                </p>
              ) : (
                syncLog.map((entry, i) => {
                  const d = new Date(entry.at)
                  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  return (
                    <div key={i} style={{
                      borderBottom: i < syncLog.length - 1 ? '1px solid var(--border)' : 'none',
                      paddingBottom: 12, marginBottom: 12
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{dateStr} {timeStr}</span>
                        <span style={{ fontSize: 12 }}>
                          {entry.sent > 0 && (
                            <span style={{ color: 'var(--green)', marginRight: 8 }}>↑ Sent: {entry.sent}</span>
                          )}
                          {entry.failed > 0 && (
                            <span style={{ color: 'var(--red)', marginRight: 8 }}>✗ Failed: {entry.failed}</span>
                          )}
                          {entry.retried > 0 && (
                            <span style={{ color: 'var(--text2)' }}>↻ Retrying: {entry.retried}</span>
                          )}
                          {entry.sent === 0 && entry.failed === 0 && !entry.retried && !entry.error && (
                            <span style={{ color: 'var(--text2)' }}>Nothing to sync</span>
                          )}
                        </span>
                      </div>
                      {entry.error && (
                        <p style={{ fontSize: 12, color: 'var(--red)', margin: '2px 0 4px' }}>{entry.error}</p>
                      )}
                      {entry.visits && entry.visits.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {entry.visits.map((v, j) => (
                            <div key={j} style={{
                              fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                              color: v.outcome === 'sent' ? 'var(--text)' : v.outcome === 'retry' ? 'var(--orange, #f97316)' : 'var(--red)',
                              padding: '2px 0'
                            }}>
                              <span style={{ opacity: 0.5 }}>{v.outcome === 'sent' ? '↑' : v.outcome === 'retry' ? '↻' : '✗'}</span>
                              <span style={{ flex: 1 }}>{v.name}</span>
                              {v.error && <span style={{ opacity: 0.7, fontSize: 11 }}>{v.error}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Google Places API key */}
      <p className="section-title" style={{ marginBottom: 10 }}>Business Search</p>
      <div className="card" style={{ marginBottom: 32 }}>
        <div className="settings-row">
          <div className="settings-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconKey /> Google Places API Key
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="form-input"
              type={showPlacesKey ? 'text' : 'password'}
              value={placesDraft}
              onChange={e => setPlacesDraft(e.target.value)}
              placeholder="AIza…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              style={{ fontFamily: showPlacesKey ? 'monospace' : 'inherit', fontSize: 14, flex: 1 }}
            />
            <button
              className="btn btn-icon"
              onClick={() => setShowPlacesKey(v => !v)}
              aria-label={showPlacesKey ? 'Hide key' : 'Show key'}
              style={{ flexShrink: 0 }}
            >
              {showPlacesKey
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          {placesChanged && (
            <button className="btn btn-primary btn-full" onClick={handlePlacesSave} style={{ height: 44 }}>
              <IconCheck />
              Save Key
            </button>
          )}
          {placesApiKey && !placesChanged && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--green)' }}>
              <IconCheck /> Key saved
            </div>
          )}
          <p className="settings-hint">
            Powers name search (Text Search) and GPS nearby search (Nearby Search). Key stored locally on this device only.
            Get a key at console.cloud.google.com — enable "Places API (New)" and restrict it to this site.
          </p>
        </div>
      </div>
    </div>
  )
}
