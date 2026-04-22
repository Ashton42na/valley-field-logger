import { useState } from 'react'
import { addVisit } from '../db/db.js'
import VoiceNote from './VoiceNote.jsx'

const STATUSES = [
  { key: 'visited', label: 'Visited', emoji: '✅', cls: 'active-visited' },
  { key: 'followed-up', label: 'Followed Up', emoji: '📱', cls: 'active-followed-up' },
  { key: 'meeting-set', label: 'Meeting Set', emoji: '📅', cls: 'active-meeting-set' },
  { key: 'not-interested', label: 'Not Interested', emoji: '🚫', cls: 'active-not-interested' },
  { key: 'call-back', label: 'Call Back', emoji: '↩️', cls: 'active-call-back' }
]

const INDUSTRIES = [
  'Technology / Electronics',
  'Office / Professional Services',
  'Healthcare',
  'Finance / Banking',
  'Food & Beverage',
  'Retail',
  'Education',
  'Hospitality',
  'Automotive',
  'Manufacturing / Industrial',
  'Construction / Trades',
  'Legal / Accounting',
  'Marketing / Media',
  'Nonprofit / Government',
  'Other'
]

const IconChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const IconSave = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
)

export default function VisitForm({ business, apiKey, onSaved, onCancel, showToast }) {
  const b = business || {}
  const [form, setForm] = useState({
    companyName: b.name || '',
    address: b.address || '',
    phone: b.phone || '',
    website: b.website || '',
    industry: b.industry || '',
    contactName: '',
    status: 'visited',
    notes: '',
    voiceNote: '',
    lat: b.lat || null,
    lon: b.lon || null
  })
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => {
    const val = typeof e === 'string' ? e : e.target.value
    setForm(f => ({ ...f, [field]: val }))
  }

  const handleSave = async () => {
    if (!form.companyName.trim()) {
      showToast('Company name is required', 'error')
      return
    }
    setSaving(true)
    try {
      await addVisit(form)
      onSaved()
    } catch (e) {
      showToast('Failed to save: ' + e.message, 'error')
      setSaving(false)
    }
  }

  return (
    <div className="app" style={{ overflow: 'hidden' }}>
      <div className="back-header">
        <button className="back-btn" onClick={onCancel}>
          <IconChevronLeft />
          Back
        </button>
        <span className="back-header-title">Log Visit</span>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ height: 38, fontSize: 14, padding: '0 16px' }}
        >
          {saving
            ? <span className="spinner" style={{ borderColor: 'rgba(5,9,5,0.3)', borderTopColor: '#050905' }} />
            : <><IconSave />Save</>}
        </button>
      </div>

      <div className="view">
        <div className="view-inner" style={{ paddingBottom: 32 }}>

          {/* Business info */}
          <p className="section-title" style={{ marginTop: 16 }}>Business Info</p>

          <div className="form-group">
            <label className="form-label">Company Name *</label>
            <input
              className="form-input"
              value={form.companyName}
              onChange={set('companyName')}
              placeholder="Company name"
              autoCapitalize="words"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              className="form-input"
              value={form.address}
              onChange={set('address')}
              placeholder="Street address"
              autoCapitalize="words"
            />
          </div>

          <div className="input-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="(555) 000-0000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Website</label>
              <input
                className="form-input"
                type="url"
                value={form.website}
                onChange={set('website')}
                placeholder="example.com"
                autoCapitalize="none"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Industry</label>
            <select className="form-select" value={form.industry} onChange={set('industry')}>
              <option value="">Select industry…</option>
              {INDUSTRIES.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Contact Name</label>
            <input
              className="form-input"
              value={form.contactName}
              onChange={set('contactName')}
              placeholder="Person you spoke with"
              autoCapitalize="words"
            />
          </div>

          <div className="divider" />

          {/* Status */}
          <p className="section-title">Visit Status</p>
          <div className="status-grid">
            {STATUSES.map(s => (
              <button
                key={s.key}
                className={`status-chip ${form.status === s.key ? s.cls : ''}`}
                onClick={() => setForm(f => ({ ...f, status: s.key }))}
              >
                <span>{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>

          <div className="divider" />

          {/* Notes */}
          <p className="section-title">Notes</p>
          <div className="form-group">
            <textarea
              className="form-textarea"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Add any notes about this visit…"
              rows={3}
            />
          </div>

          {/* Voice note */}
          <VoiceNote
            value={form.voiceNote}
            onChange={(v) => setForm(f => ({ ...f, voiceNote: v }))}
            apiKey={apiKey}
            showToast={showToast}
          />

          <div style={{ height: 24 }} />
        </div>
      </div>
    </div>
  )
}
