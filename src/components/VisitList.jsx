import { useState, useEffect, useCallback, useMemo } from 'react'
import { getAllVisits, deleteVisit } from '../db/db.js'
import { exportVisitsToCSV } from '../utils/csvExport.js'

const STATUS_META = {
  'visited':        { label: 'Visited',        cls: 'badge-visited',        emoji: '✅' },
  'followed-up':    { label: 'Followed Up',     cls: 'badge-followed-up',    emoji: '📱' },
  'meeting-set':    { label: 'Meeting Set',     cls: 'badge-meeting-set',    emoji: '📅' },
  'not-interested': { label: 'Not Interested',  cls: 'badge-not-interested', emoji: '🚫' },
  'call-back':      { label: 'Call Back',       cls: 'badge-call-back',      emoji: '↩️' }
}

const OUTCOME_LABELS = {
  'left-info':          'Left Info',
  'spoke-to-owner':     'Spoke to Owner',
  'gatekeeper-only':    'Gatekeeper Only',
  'requested-callback': 'Requested Callback',
  'not-interested':     'Not Interested'
}

const TEMP_COLORS = { cold: 'var(--blue)', warm: 'var(--yellow)', hot: 'var(--red)' }

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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ width: 14, height: 14, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const IconClipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
  </svg>
)
const IconChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
)

function toDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toDayLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const todayKey = toDayKey(new Date())
  const yest = new Date(); yest.setDate(yest.getDate() - 1)
  if (key === todayKey) return 'Today'
  if (key === toDayKey(yest)) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function groupByDay(visits) {
  const map = new Map()
  for (const v of visits) {
    const key = toDayKey(new Date(v.timestamp))
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(v)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, visits]) => ({ key, label: toDayLabel(key), visits }))
}

function formatFollowUpDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, cls: 'badge-unknown', emoji: '•' }
  return <span className={`badge ${meta.cls}`}>{meta.emoji} {meta.label}</span>
}

function VisitItem({ visit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const timeStr = new Date(visit.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

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
              <span>{timeStr}</span>
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
              <span>{visit.contactName}{visit.contactTitle ? ` · ${visit.contactTitle}` : ''}</span>
            </div>
          )}
          {visit.email && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Email</span>
              <a href={`mailto:${visit.email}`} style={{ color: 'var(--blue)', wordBreak: 'break-all' }}>{visit.email}</a>
            </div>
          )}
          {visit.industry && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Industry</span>
              <span>{visit.industry}</span>
            </div>
          )}
          {visit.temperature && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Temp</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: TEMP_COLORS[visit.temperature], flexShrink: 0 }} />
                {visit.temperature.charAt(0).toUpperCase() + visit.temperature.slice(1)}
              </span>
            </div>
          )}
          {visit.outcome && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Outcome</span>
              <span>{OUTCOME_LABELS[visit.outcome] || visit.outcome}</span>
            </div>
          )}
          {visit.followUpDate && (
            <div className="visit-detail-row">
              <span className="visit-detail-label">Follow-up</span>
              <span>{new Date(visit.followUpDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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

function DayGroup({ group, onDelete, onExport }) {
  const [open, setOpen] = useState(group.key === toDayKey(new Date()))

  return (
    <div className="day-group">
      <div className="day-group-header" onClick={() => setOpen(o => !o)}>
        <IconChevron open={open} />
        <span className="day-group-label">{group.label}</span>
        <span className="day-group-count">{group.visits.length}</span>
        <div
          className="day-export-btn"
          role="button"
          title={`Export ${group.label}`}
          onClick={e => { e.stopPropagation(); onExport(group.visits, group.key) }}
        >
          <IconDownload />
        </div>
      </div>
      {open && (
        <div className="card" style={{ marginBottom: 0 }}>
          {group.visits.map(v => (
            <VisitItem key={v.id} visit={v} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryView({ visits, onClose }) {
  const todayKey = toDayKey(new Date())
  const todayVisits = useMemo(() => visits.filter(v => toDayKey(new Date(v.timestamp)) === todayKey), [visits, todayKey])

  const temps = useMemo(() => {
    const t = { hot: 0, warm: 0, cold: 0, none: 0 }
    todayVisits.forEach(v => { t[v.temperature || 'none']++ })
    return t
  }, [todayVisits])

  const outcomes = useMemo(() => {
    const o = {}
    todayVisits.forEach(v => { if (v.outcome) o[v.outcome] = (o[v.outcome] || 0) + 1 })
    return o
  }, [todayVisits])

  const upcomingByDate = useMemo(() => {
    const map = {}
    visits.forEach(v => {
      if (v.followUpDate && v.followUpDate >= todayKey) {
        if (!map[v.followUpDate]) map[v.followUpDate] = []
        map[v.followUpDate].push(v.companyName || 'Unknown')
      }
    })
    return map
  }, [visits, todayKey])

  const upcomingDates = Object.keys(upcomingByDate).sort()

  const tempRows = [
    { key: 'hot',  label: 'Hot',  color: 'var(--red)' },
    { key: 'warm', label: 'Warm', color: 'var(--yellow)' },
    { key: 'cold', label: 'Cold', color: 'var(--blue)' }
  ]

  return (
    <div className="view-inner">
      <div style={{ paddingTop: 16, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Today's Summary</span>
        <button className="btn btn-ghost" onClick={onClose} style={{ height: 36, fontSize: 14, padding: '0 14px' }}>
          Done
        </button>
      </div>

      {todayVisits.length === 0 ? (
        <div className="empty-state">
          <IconClipboard />
          <h3>No visits today</h3>
          <p>Log your first visit from the Find &amp; Log tab</p>
        </div>
      ) : (
        <>
          <div className="summary-hero">
            <span className="summary-hero-num">{todayVisits.length}</span>
            <span className="summary-hero-label">visit{todayVisits.length !== 1 ? 's' : ''} today</span>
          </div>

          <p className="section-title" style={{ marginBottom: 10 }}>Lead Temperature</p>
          <div className="card" style={{ marginBottom: 16 }}>
            {tempRows.map(t => temps[t.key] > 0 && (
              <div key={t.key} className="summary-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                  {t.label}
                </span>
                <span className="summary-count">{temps[t.key]}</span>
              </div>
            ))}
            {temps.none > 0 && (
              <div className="summary-row">
                <span style={{ color: 'var(--text3)' }}>Not rated</span>
                <span className="summary-count" style={{ color: 'var(--text3)' }}>{temps.none}</span>
              </div>
            )}
          </div>

          {Object.keys(outcomes).length > 0 && (
            <>
              <p className="section-title" style={{ marginBottom: 10 }}>Visit Outcomes</p>
              <div className="card" style={{ marginBottom: 16 }}>
                {Object.entries(outcomes).map(([key, count]) => (
                  <div key={key} className="summary-row">
                    <span>{OUTCOME_LABELS[key] || key}</span>
                    <span className="summary-count">{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {upcomingDates.length > 0 && (
            <>
              <p className="section-title" style={{ marginBottom: 10 }}>Upcoming Follow-ups</p>
              <div className="card" style={{ marginBottom: 24 }}>
                {upcomingDates.map(date => (
                  <div key={date} className="summary-row" style={{ alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--green)', fontWeight: 600, minWidth: 76, flexShrink: 0 }}>
                      {formatFollowUpDate(date)}
                    </span>
                    <span style={{ color: 'var(--text2)' }}>{upcomingByDate[date].join(', ')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function VisitList({ showToast }) {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [showSummary, setShowSummary] = useState(false)

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

  const handleDayExport = useCallback((dayVisits, dateKey) => {
    try {
      exportVisitsToCSV(dayVisits, `valley-visits-${dateKey}.csv`)
      showToast(`Exported ${dayVisits.length} visit${dayVisits.length === 1 ? '' : 's'}`, 'success')
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error')
    }
  }, [showToast])

  const filtered = useMemo(() =>
    filter === 'All' ? visits : visits.filter(v => v.status === FILTER_KEYS[filter]),
    [visits, filter]
  )

  const groups = useMemo(() => groupByDay(filtered), [filtered])

  if (showSummary) {
    return <SummaryView visits={visits} onClose={() => setShowSummary(false)} />
  }

  return (
    <div className="view-inner">
      <div style={{ paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>My Visits</span>
          <button
            className="btn btn-secondary"
            onClick={() => setShowSummary(true)}
            style={{ height: 36, fontSize: 13, padding: '0 12px', gap: 6 }}
          >
            <IconChart />
            Today
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

      {!loading && groups.length > 0 && (
        <div style={{ paddingBottom: 16 }}>
          {groups.map(group => (
            <DayGroup key={group.key} group={group} onDelete={handleDelete} onExport={handleDayExport} />
          ))}
        </div>
      )}
    </div>
  )
}
