import { useState, useCallback, useEffect } from 'react'
import SearchView from './components/SearchView.jsx'
import VisitForm from './components/VisitForm.jsx'
import VisitList from './components/VisitList.jsx'
import Settings from './components/Settings.jsx'
import { flush as flushSync } from './sync/syncService.js'

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
)
const IconList = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className={`toast ${msg.show ? 'show' : ''} ${msg.type || ''}`}>
      {msg.text}
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('search')
  const [pendingBusiness, setPendingBusiness] = useState(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('vfl-anthropic-key') || '')
  const [placesApiKey, setPlacesApiKey] = useState(() => localStorage.getItem('vfl-google-places-key') || '')
  const [toast, setToast] = useState(null)
  const toastTimer = { current: null }

  const showToast = useCallback((text, type = 'success') => {
    clearTimeout(toastTimer.current)
    setToast({ text, type, show: true })
    toastTimer.current = setTimeout(() => {
      setToast(t => t ? { ...t, show: false } : null)
    }, 2200)
  }, [])

  useEffect(() => {
    const onOnline = () => { flushSync().catch(() => {}) }
    window.addEventListener('online', onOnline)
    if (navigator.onLine) onOnline()
    return () => window.removeEventListener('online', onOnline)
  }, [])

  const saveApiKey = useCallback((key) => {
    setApiKey(key)
    localStorage.setItem('vfl-anthropic-key', key)
  }, [])

  const savePlacesApiKey = useCallback((key) => {
    setPlacesApiKey(key)
    localStorage.setItem('vfl-google-places-key', key)
  }, [])

  const handleBusinessSelect = useCallback((business) => {
    setPendingBusiness(business)
    setView('form')
  }, [])

  const handleVisitSaved = useCallback(() => {
    setPendingBusiness(null)
    setView('visits')
    showToast('Visit saved!', 'success')
  }, [showToast])

  const handleCancel = useCallback(() => {
    setPendingBusiness(null)
    setView('search')
  }, [])

  const isFormView = view === 'form'

  return (
    <div className="app">
      <Toast msg={toast} />

      {isFormView ? (
        <VisitForm
          business={pendingBusiness}
          apiKey={apiKey}
          onSaved={handleVisitSaved}
          onCancel={handleCancel}
          showToast={showToast}
        />
      ) : (
        <>
          <div className="view">
            {view === 'search' && (
              <SearchView onSelectBusiness={handleBusinessSelect} placesApiKey={placesApiKey} />
            )}
            {view === 'visits' && (
              <VisitList showToast={showToast} />
            )}
            {view === 'settings' && (
              <Settings
                apiKey={apiKey} onSaveApiKey={saveApiKey}
                placesApiKey={placesApiKey} onSavePlacesApiKey={savePlacesApiKey}
                showToast={showToast}
              />
            )}
          </div>

          <nav className="nav-bar">
            <button className={`nav-btn ${view === 'search' ? 'active' : ''}`} onClick={() => setView('search')}>
              <IconSearch />
              Find & Log
            </button>
            <button className={`nav-btn ${view === 'visits' ? 'active' : ''}`} onClick={() => setView('visits')}>
              <IconList />
              My Visits
            </button>
            <button className={`nav-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
              <IconSettings />
              Settings
            </button>
          </nav>
        </>
      )}
    </div>
  )
}
