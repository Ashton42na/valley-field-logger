import { useState, useRef, useCallback } from 'react'
import { searchByName, findNearby, formatDist } from '../utils/places.js'

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
)
const IconGPS = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
    <circle cx="12" cy="12" r="9" strokeDasharray="2 2" opacity="0.4"/>
  </svg>
)
const IconMapPin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
)
const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 22V12h6v10"/>
    <path d="M9 7h.01M12 7h.01M15 7h.01"/>
  </svg>
)

function BizCard({ biz, onSelect }) {
  return (
    <div className="biz-card" onClick={() => onSelect(biz)}>
      <div className="biz-name">{biz.name}</div>
      <div className="biz-meta">
        {biz.address && <span>{biz.address}</span>}
        {biz.distMeters != null && (
          <span className="biz-dist">{formatDist(biz.distMeters)}</span>
        )}
      </div>
      {biz.industry && biz.industry !== 'Business' && (
        <div style={{ marginTop: 4 }}>
          <span className="biz-industry">{biz.industry}</span>
        </div>
      )}
    </div>
  )
}

export default function SearchView({ onSelectBusiness }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(null)
  const debounceRef = useRef(null)

  const handleQueryChange = useCallback((e) => {
    const val = e.target.value
    setQuery(val)
    setError(null)

    clearTimeout(debounceRef.current)
    if (!val.trim()) {
      setResults([])
      setMode(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setMode('name')
      try {
        const res = await searchByName(val)
        setResults(res)
        if (res.length === 0) setError('No results found. Try a different search or use GPS.')
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }, 600)
  }, [])

  const handleGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setGpsLoading(true)
    setError(null)
    setResults([])
    setQuery('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setMode('gps')
        try {
          const res = await findNearby(latitude, longitude)
          setResults(res)
          if (res.length === 0) setError('No businesses found nearby. Try searching by name instead.')
        } catch (e) {
          setError(e.message)
        } finally {
          setGpsLoading(false)
        }
      },
      (err) => {
        setGpsLoading(false)
        setError(`Location error: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const handleManualEntry = useCallback(() => {
    onSelectBusiness({
      placeId: '',
      name: query.trim(),
      address: '',
      phone: '',
      website: '',
      industry: '',
      lat: null,
      lon: null
    })
  }, [query, onSelectBusiness])

  const isSearching = loading || gpsLoading

  return (
    <div className="view-inner">
      <div style={{ paddingTop: 16, paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Find a Business</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
          Search by name or find nearby businesses
        </p>

        <div className="search-bar">
          <div className="search-input-wrap">
            <IconSearch />
            <input
              className="search-input"
              type="search"
              placeholder="Business name…"
              value={query}
              onChange={handleQueryChange}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleGPS}
            disabled={gpsLoading}
            style={{ padding: '0 14px', gap: 6 }}
          >
            {gpsLoading
              ? <span className="spinner" style={{ borderColor: 'rgba(96,99,122,0.3)', borderTopColor: 'var(--text2)' }} />
              : <IconGPS />}
            {!gpsLoading && <span style={{ fontSize: 13 }}>Nearby</span>}
          </button>
        </div>

        {query.trim() && !isSearching && (
          <button
            className="btn btn-ghost btn-full"
            onClick={handleManualEntry}
            style={{ marginBottom: 12, fontSize: 14 }}
          >
            <IconPlus />
            Log visit for "{query.trim()}"
          </button>
        )}
      </div>

      {isSearching && (
        <div className="loading-row">
          <span className="spinner" />
          {gpsLoading ? 'Finding nearby businesses…' : 'Searching…'}
        </div>
      )}

      {error && !isSearching && (
        <div className="error-msg">{error}</div>
      )}

      {!isSearching && results.length > 0 && (
        <>
          <p className="section-title">
            {mode === 'gps' ? `${results.length} nearby businesses` : `${results.length} results`}
          </p>
          <div className="card" style={{ marginBottom: 16 }}>
            {results.map(biz => (
              <BizCard key={biz.placeId} biz={biz} onSelect={onSelectBusiness} />
            ))}
          </div>
        </>
      )}

      {!isSearching && results.length === 0 && !error && !query && (
        <div className="empty-state">
          <IconMapPin />
          <h3>Ready to log a visit</h3>
          <p>Search for a business by name, or tap Nearby to find businesses around you</p>
        </div>
      )}
    </div>
  )
}
