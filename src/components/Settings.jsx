import { useState } from 'react'

const IconKey = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
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

export default function Settings({ apiKey, onSaveApiKey, showToast }) {
  const [draft, setDraft] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)
  const changed = draft !== apiKey

  const handleSave = () => {
    onSaveApiKey(draft.trim())
    showToast('API key saved', 'success')
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
      <p className="section-title" style={{ marginBottom: 10 }}>AI Voice Cleanup</p>
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
          <p className="settings-hint" style={{ marginTop: 0 }}>
            All visit data is saved locally on this device using IndexedDB. Nothing is uploaded to any server.
            Use the Export CSV button in My Visits to back up or import into your CRM.
          </p>
        </div>
      </div>

      {/* GPS / Search */}
      <p className="section-title" style={{ marginBottom: 10 }}>Business Search</p>
      <div className="card" style={{ marginBottom: 32 }}>
        <div className="settings-row">
          <div className="settings-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconInfo /> Data Sources
            </span>
          </div>
          <p className="settings-hint" style={{ marginTop: 0 }}>
            Business search uses OpenStreetMap (Nominatim) and the Overpass API — both free and open-source.
            Coverage is excellent in most US cities. For full business details, edit fields manually after selecting.
          </p>
        </div>
      </div>
    </div>
  )
}
