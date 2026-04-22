import { useState, useEffect, useCallback } from 'react'
import { getAllVisits, deleteVisit } from '../db/db.js'
import { exportVisitsToCSV } from '../utils/csvExport.js'

const STATUS_META = {
  'visited':        { label: 'Visited',        cls: 'badge-visited',        emoji: '✅' },
  'followed-up':    { label: 'Followed Up',     cls: 'badge-followed-up',    emoji: '📱' },
  'meeting-set':    { label: 'Meeting Set',     cls: 'badge-meeting-set',    emoji: '📅' },
  'not-interested': { label: 'Not Interested',  cls: 'badge-not-interested', emoji: '🚫' },
  'call-back':      { label: 'Call Back',       cls: 'badge-call-back',      emoji: '↩️' }
}

const FILTERS = ['All', 'Visited', 'Followed Up', 'Meeting Set', 'Not Interested', 'Call Back']
const FILTER_KEYS = {
  'All': null, 'Visited': 'visited', 'Followed Up': 'followed-up',
  'Meeting Set': 'meeting-set', 'Not Interested': 'not-interested', 'Call Back': 'call-back'
}

const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
  </svg>
)
const IconChevron = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ width: 16, height: 16, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const IconClipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
  </svg>
)

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: 'badge-unknown', emoji: '•' }
  return <span className={`badge ${meta.cls}`}>{meta.emoji} {meta.label}</span>
}

function VisitItem({ visit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const date = new Date(visit.timestamp)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const handleDelete = () => {
    if (!confirming) { setConfirming(true); return }
    onDelete(visit.id)
  }

  return (
    <div className={`visit-item ${expanded ? 'expanded' : ''}`}>
      <div onClick={() => setExpanded(e => !e)}>
        <div className="visit-item-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="visit-company">{visit.companyName || 'Unknown Business'}</div>
            <div className="visit-meta">
              <span>{dateStr} · {timeStr}</span>
              {visit.address && <span>{visit.address.split(',')[0]}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <StatusBadge status={visit.status} />
            <IconChevron open={expanded} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="visit-detail">
          {visit.contactName && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Contact</span>
              <span>{visit.contactName}</span>
            </div>
          )}
          {visit.industry && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Industry</span>
              <span>{visit.industry}</span>
            </div>
          )}
          {visit.phone && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Phone</span>
              <a href={`tel:${visit.phone}`} style={{ color: 'var(--blue)' }}>{visit.phone}</a>
            </div>
          )}
          {visit.website && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Website</span>
              <a
                href={visit.website.startsWith('http') ? visit.website : `https://${visit.website}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--blue)', wordBreak: 'break-all' }}
              >
                {visit.website}
              </a>
            </div>
          )}
          {visit.notes && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Notes</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{visit.notes}</span>
            </div>
          )}
          {visit.voiceNote && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Voice</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{visit.voiceNote}</span>
            </div>
          )}

          <div className="visit-detail-actions">
            <button
              className="btn btn-danger"
              style={{ height: 38, fontSize: 13, padding: '0 14px' }}
              onClick={handleDelete}
            >
              <IconTrash />
              {confirming ? 'Confirm delete' : 'Delete'}
            </button>
            {confirming && (
              <button
                className="btn btn-ghost"
                style={{ height: 38, fontSize: 13 }}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function VisitList({ showToast }) {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getAllVisits()
      setVisits(all)
    } catch (e) {
      showToast('Failed to load visits', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteVisit(id)
      setVisits(v => v.filter(x => x.id !== id))
      showToast('Visit deleted', 'success')
    } catch (e) {
      showToast('Delete failed', 'error')
    }
  }, [showToast])

  const handleExport = useCallback(() => {
    const toExport = filter === 'All' ? visits : visits.filter(v => v.status === FILTER_KEYS[filter])
    if (toExport.length === 0) {
      showToast('No visits to export', 'error')
      return
    }
    try {
      exportVisitsToCSV(toExport)
      showToast(`Exported ${toExport.length} visit${toExport.length === 1 ? '' : 's'}`, 'success')
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error')
    }
  }, [visits, filter, showToast])

  const filtered = filter === 'All'
    ? visits
    : visits.filter(v => v.status === FILTER_KEYS[filter])

  return (
    <div className="view-inner">
      <div style={{ paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>My Visits</span>
          <button className="btn btn-secondary" onClick={handleExport} style={{ height: 40, fontSize: 13, padding: '0 14px', gap: 6 }}>
            <IconDownload />
            Export CSV
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
          {visits.length} total visit{visits.length !== 1 ? 's' : ''}
        </p>

        <div className="chip-row">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-chip ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="loading-row">
          <span className="spinner" />
          Loading visits…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <IconClipboard />
          <h3>{filter === 'All' ? 'No visits yet' : `No "${filter}" visits`}</h3>
          <p>{filter === 'All'
            ? 'Log your first visit from the Find & Log tab'
            : 'Try a different filter'}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          {filtered.map(v => (
            <VisitItem key={v.id} visit={v} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
