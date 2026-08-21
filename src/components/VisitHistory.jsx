import { useState } from 'react'
import {
  OUTCOME_LABELS,
  STATUS_META,
  formatRelativeDays,
  summarizeHistory
} from '../utils/visitHistory.js'

const TEMP_COLORS = { cold: 'var(--blue)', warm: 'var(--yellow)', hot: 'var(--red)' }

function formatVisitDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatusBadge({ status }) {
  if (!status) return null
  const meta = STATUS_META[status] || { label: status, cls: 'badge-unknown' }
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>
}

function HistoryRow({ visit }) {
  const [open, setOpen] = useState(false)
  const excerpt = (visit.notes || visit.voiceNote || '').trim()
  const hasBody = !!(visit.notes || visit.voiceNote)

  return (
    <div className={`history-row ${open ? 'open' : ''}`} onClick={() => hasBody && setOpen(o => !o)}>
      <div className="history-row-top">
        <span className="history-date">{formatVisitDate(visit.timestamp)}</span>
        <StatusBadge status={visit.status} />
        {visit.temperature && (
          <span className="history-temp">
            <span className="temp-dot" style={{ background: TEMP_COLORS[visit.temperature] || 'var(--text3)' }} />
            {visit.temperature.charAt(0).toUpperCase() + visit.temperature.slice(1)}
          </span>
        )}
        {visit.outcome && (
          <span className="history-outcome">{OUTCOME_LABELS[visit.outcome] || visit.outcome}</span>
        )}
        <span className="history-who">{visit.userName || (visit.isYou ? 'You' : '')}</span>
      </div>
      {(visit.contactName || excerpt) && (
        <div className="history-row-sub">
          {visit.contactName && (
            <span className="history-contact">
              {visit.contactName}{visit.contactTitle ? ` · ${visit.contactTitle}` : ''}
            </span>
          )}
          {excerpt && (
            <span className="history-excerpt">
              {open ? '' : (excerpt.length > 90 ? excerpt.slice(0, 90) + '…' : excerpt)}
            </span>
          )}
        </div>
      )}
      {open && hasBody && (
        <div className="history-row-body">
          {visit.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{visit.notes}</p>}
          {visit.voiceNote && (
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text2)' }}>
              Voice: {visit.voiceNote}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function VisitHistory({ visits, onReuseContact }) {
  const [showAll, setShowAll] = useState(false)
  const summary = summarizeHistory(visits)
  if (!summary.count) return null

  const last = summary.last
  const visible = showAll ? visits : visits.slice(0, 3)
  const lastContact = summary.lastContact
  const canReuse = !!(lastContact && onReuseContact && (
    lastContact.contactName || lastContact.email || lastContact.contactTitle
  ))

  const briefingBits = []
  if (last?.timestamp) briefingBits.push('Last here ' + formatVisitDate(last.timestamp))
  if (last?.outcome) briefingBits.push(OUTCOME_LABELS[last.outcome] || last.outcome)
  if (last?.temperature) briefingBits.push(last.temperature.charAt(0).toUpperCase() + last.temperature.slice(1))
  if (lastContact?.contactName) briefingBits.push(lastContact.contactName)

  return (
    <div className="history-section">
      <div className="history-section-header">
        <span className="history-section-title">Previous visits · {summary.count}</span>
        {last?.timestamp && (
          <span className="history-section-meta">Last: {formatRelativeDays(last.timestamp)}</span>
        )}
      </div>

      {summary.tone === 'due' && last?.followUpDate && (
        <div className="history-banner due">
          Follow-up promised for {last.followUpDate}
        </div>
      )}
      {summary.tone === 'skip' && (
        <div className="history-banner skip">
          Marked not interested {formatRelativeDays(last.timestamp)} — knocking again will burn this door
        </div>
      )}

      {briefingBits.length > 0 && (
        <div className="history-briefing">
          <span>{briefingBits.join(' · ')}</span>
          {canReuse && (
            <button
              type="button"
              className="history-reuse-btn"
              onClick={() => onReuseContact({
                contactName: lastContact.contactName || '',
                contactTitle: lastContact.contactTitle || '',
                email: lastContact.email || '',
                phone: lastContact.phone || ''
              })}
            >
              Reuse last contact
            </button>
          )}
        </div>
      )}

      <div className="history-list">
        {visible.map(v => (
          <HistoryRow key={v.id} visit={v} />
        ))}
      </div>
      {visits.length > 3 && (
        <button
          type="button"
          className="history-show-all"
          onClick={() => setShowAll(s => !s)}
        >
          {showAll ? 'Show less' : `Show all ${visits.length}`}
        </button>
      )}
    </div>
  )
}
