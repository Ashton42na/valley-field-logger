import { useState, useRef } from 'react'
import { addVisit } from '../db/db.js'
import { flush as flushSync } from '../sync/syncService.js'
import VoiceNote from './VoiceNote.jsx'
import { scanBusinessCard } from '../utils/anthropic.js'

const STATUSES = [
  { key: 'visited', label: 'Visited', emoji: '✅', cls: 'active-visited' },
  { key: 'followed-up', label: 'Followed Up', emoji: '📱', cls: 'active-followed-up' },
  { key: 'meeting-set', label: 'Meeting Set', emoji: '📅', cls: 'active-meeting-set' },
  { key: 'not-interested', label: 'Not Interested', emoji: '🚫', cls: 'active-not-interested' },
  { key: 'call-back', label: 'Call Back', emoji: '↩️', cls: 'active-call-back' }
]

const TEMPS = [
  { key: 'cold', label: 'Cold', dotColor: 'var(--blue)', activeCls: 'temp-cold' },
  { key: 'warm', label: 'Warm', dotColor: 'var(--yellow)', activeCls: 'temp-warm' },
  { key: 'hot',  label: 'Hot',  dotColor: 'var(--red)',   activeCls: 'temp-hot'  }
]

const OUTCOMES = [
  { key: 'left-info',          label: 'Left Info' },
  { key: 'spoke-to-owner',     label: 'Spoke to Owner' },
  { key: 'gatekeeper-only',    label: 'Gatekeeper Only' },
  { key: 'requested-callback', label: 'Requested Callback' },
  { key: 'not-interested',     label: 'Not Interested' }
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
const IconCamera = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
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
    contactTitle: '',
    email: '',
    status: 'visited',
    temperature: '',
    outcome: '',
    followUpDate: '',
    notes: '',
    voiceNote: '',
    lat: b.lat || null,
    lon: b.lon || null
  })
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const fileInputRef = useRef(null)

  const set = (field) => (e) => {
    const val = typeof e === 'string' ? e : e.target.value
    setForm(f => ({ ...f, [field]: val }))
  }

  const handleScanCard = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!apiKey) {
      showToast('Add your Anthropic API key in Settings to scan cards', 'error')
      return
    }

    setScanning(true)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const base64 = dataUrl.split(',')[1]
      const mimeType = file.type || 'image/jpeg'
      const extracted = await scanBusinessCard(base64, mimeType, apiKey)

      setForm(f => ({
        ...f,
        ...(extracted.companyName  && { companyName:   extracted.companyName }),
        ...(extracted.contactName  && { contactName:   extracted.contactName }),
        ...(extracted.contactTitle && { contactTitle:  extracted.contactTitle }),
        ...(extracted.phone        && { phone:         extracted.phone }),
        ...(extracted.email        && { email:         extracted.email }),
        ...(extracted.website      && { website:       extracted.website }),
        ...(extracted.address      && { address:       extracted.address })
      }))
      showToast('Card scanned — review and confirm fields', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setScanning(false)
    }
  }

  const handleSave = async () => {
    if (!form.companyName.trim()) {
      showToast('Company name is required', 'error')
      return
    }
    setSaving(true)
    try {
      await addVisit(form)
      flushSync().catch(() => {})
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
            <p className="section-title" style={{ margin: 0 }}>Business Info</p>
            <button
              className="btn btn-icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              title="Scan business card"
              style={{ width: 36, height: 36 }}
            >
              {scanning
                ? <span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(96,99,122,0.3)', borderTopColor: 'var(--text2)' }} />
                : <IconCamera />}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleScanCard}
          />

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

          <div className="input-row">
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
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                className="form-input"
                value={form.contactTitle}
                onChange={set('contactTitle')}
                placeholder="Job title"
                autoCapitalize="words"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="email@example.com"
              autoCapitalize="none"
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

          {/* Lead temperature */}
          <p className="section-title">Lead Temperature</p>
          <div className="temp-row">
            {TEMPS.map(t => (
              <button
                key={t.key}
                className={`temp-chip ${form.temperature === t.key ? t.activeCls : ''}`}
                onClick={() => setForm(f => ({ ...f, temperature: f.temperature === t.key ? '' : t.key }))}
              >
                <span className="temp-dot" style={{ background: t.dotColor }} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Visit outcome */}
          <p className="section-title">Visit Outcome</p>
          <div className="outcome-grid">
            {OUTCOMES.map(o => (
              <button
                key={o.key}
                className={`outcome-chip ${form.outcome === o.key ? 'active' : ''}`}
                onClick={() => setForm(f => ({ ...f, outcome: f.outcome === o.key ? '' : o.key }))}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Follow-up date */}
          <div className="form-group">
            <label className="form-label">Follow-up Date</label>
            <input
              className="form-input"
              type="date"
              value={form.followUpDate}
              onChange={set('followUpDate')}
            />
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
