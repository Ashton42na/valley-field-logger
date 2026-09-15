import { useState, useRef, useEffect } from 'react'
import { addVisit, getVisitsForPlace } from '../db/db.js'
import { scheduleFlush } from '../sync/syncService.js'
import VoiceNote from './VoiceNote.jsx'
import VisitHistory from './VisitHistory.jsx'
import { scanBusinessCard, downscaleImageFile } from '../utils/companyAi.js'
import { applyCompanySnapshot, mergeVisitHistories } from '../utils/visitHistory.js'
import { loadTeamHistory, teamHistoryConfigured } from '../sync/historyService.js'
import { searchByName } from '../utils/places.js'
import { namesMatch, phonesMatch } from '../utils/placeMatch.js'
import { joinAddress, addressFieldsFromExtracted, structuredAddressFrom } from '../utils/address.js'

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

function toDatetimeLocal(date) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const NOTE_TEMPLATES = [
  'Left marketing materials with front desk',
  'Outsources IT — potential opportunity',
  'In-house IT — not a fit at this time',
  'Corporate IT — decisions made at HQ',
  'Spoke with owner/decision maker',
  'Not interested at this time',
]

async function pickUniquePlace(results, extracted) {
  if (!Array.isArray(results) || results.length === 0) return null
  const phone = extracted.phone || ''
  const phoneHits = phone ? results.filter(p => phonesMatch(phone, p.phone)) : []
  if (phoneHits.length === 1) return phoneHits[0]
  const name = (extracted.companyName || '').trim()
  if (!name) return null
  const nameHits = results.filter(p => namesMatch(name, p.name))
  if (nameHits.length === 1) return nameHits[0]
  return null
}

async function matchCardToPlace(extracted) {
  const name = (extracted.companyName || '').trim()
  const phone = extracted.phone || ''
  if (!name && !phone) return null
  try {
    if (name) {
      const byName = await pickUniquePlace(await searchByName(name), extracted)
      if (byName) return byName
    }
    if (phone) {
      const byPhone = await pickUniquePlace(await searchByName(phone), extracted)
      if (byPhone) return byPhone
    }
  } catch {
    // Places is a confirm, not a requirement — card OCR still fills the form.
  }
  return null
}

export default function VisitForm({ business, aiEnabled, onSaved, onCancel, showToast }) {
  const b = business || {}
  const [form, setForm] = useState({
    companyName: b.name || '',
    address: b.address || '',
    address1: b.address1 != null ? b.address1 : (b.address || ''),
    address2: b.address2 || '',
    city: b.city || '',
    state: b.state || '',
    zip: b.zip || '',
    phone: b.phone || '',
    website: b.website || '',
    industry: b.industry || '',
    contactName: '',
    contactTitle: '',
    email: '',
    visitedAt: toDatetimeLocal(new Date()),
    status: 'visited',
    temperature: '',
    outcome: '',
    followUpDate: '',
    notes: '',
    voiceNote: '',
    lat: typeof b.lat === 'number' ? b.lat : null,
    lon: typeof b.lon === 'number' ? b.lon : null,
    placeId: b.placeId || ''
  })
  const [historyVisits, setHistoryVisits] = useState([])
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [notesFocused, setNotesFocused] = useState(false)
  const fileInputRef = useRef(null)
  const notesRef = useRef(null)
  const notesBlurTimer = useRef(null)

  const handleNotesFocus = () => {
    clearTimeout(notesBlurTimer.current)
    setNotesFocused(true)
  }
  const handleNotesBlur = () => {
    notesBlurTimer.current = setTimeout(() => setNotesFocused(false), 200)
  }
  const insertTemplate = (text) => {
    clearTimeout(notesBlurTimer.current)
    setForm(f => ({ ...f, notes: f.notes ? f.notes + ' ' + text : text }))
    requestAnimationFrame(() => {
      notesRef.current?.focus()
      setNotesFocused(true)
    })
  }

  const set = (field) => (e) => {
    const val = typeof e === 'string' ? e : e.target.value
    setForm(f => {
      const next = { ...f, [field]: val }
      if (field === 'address1' || field === 'address2' || field === 'city' || field === 'state' || field === 'zip') {
        next.address = joinAddress(next)
      }
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    const place = {
      placeId: b.placeId || '',
      name: b.name || '',
      address: b.address || '',
      phone: b.phone || '',
      lat: typeof b.lat === 'number' ? b.lat : null,
      lon: typeof b.lon === 'number' ? b.lon : null
    }
    ;(async () => {
      const local = await getVisitsForPlace(place)
      const team = teamHistoryConfigured()
        ? await loadTeamHistory(place, {
            onRefresh: (fresh) => {
              if (cancelled) return
              setHistoryVisits(applyCompanySnapshot(
                mergeVisitHistories(local, fresh.visits, fresh.youUserName),
                fresh.company
              ))
            }
          })
        : { visits: [], youUserName: '' }
      if (cancelled) return
      setHistoryVisits(applyCompanySnapshot(
        mergeVisitHistories(local, team.visits, team.youUserName),
        team.company
      ))
    })().catch(() => {})
    return () => { cancelled = true }
  }, [b.placeId, b.name, b.address, b.phone])

  const handleReuseContact = (c) => {
    setForm(f => ({
      ...f,
      contactName: c.contactName || f.contactName,
      contactTitle: c.contactTitle || f.contactTitle,
      email: c.email || f.email,
      phone: f.phone?.trim() ? f.phone : (c.phone || f.phone)
    }))
  }

  const handleScanCard = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!aiEnabled) {
      showToast('Paste your Field Logger Key in Settings to scan cards', 'error')
      return
    }

    setScanning(true)
    try {
      const { base64, mimeType } = await downscaleImageFile(file)
      const extracted = await scanBusinessCard(base64, mimeType)
      const place = await matchCardToPlace(extracted)

      setForm(f => {
        const next = {
          ...f,
          ...(extracted.companyName  && { companyName:   extracted.companyName }),
          ...(extracted.contactName  && { contactName:   extracted.contactName }),
          ...(extracted.contactTitle && { contactTitle:  extracted.contactTitle }),
          ...(extracted.phone        && { phone:         extracted.phone }),
          ...(extracted.email        && { email:         extracted.email }),
          ...(extracted.website      && { website:       extracted.website }),
          ...addressFieldsFromExtracted(extracted)
        }
        // OCR may still send only the one-line `address`. Prefer that over leftover Places
        // structured fields from the previous pick; a unique Places match below overwrites.
        const extractedStructured = !!(extracted.address1 || extracted.address2 || extracted.city || extracted.state || extracted.zip)
        if (!extractedStructured && extracted.address) {
          next.address1 = extracted.address
          next.address2 = ''
          next.city = ''
          next.state = ''
          next.zip = ''
        }
        if (place) {
          next.placeId = place.placeId || next.placeId
          if (typeof place.lat === 'number') next.lat = place.lat
          if (typeof place.lon === 'number') next.lon = place.lon
          if (place.website && !next.website) next.website = place.website
          if (place.phone && !next.phone) next.phone = place.phone
          const placeParts = structuredAddressFrom(place)
          const placeHasParts = !!(placeParts.address1 || placeParts.address2 || placeParts.city || placeParts.state || placeParts.zip)
          if (placeHasParts) Object.assign(next, placeParts)
          next.address = joinAddress(next) || place.address || ''
        } else {
          next.address = joinAddress(next) || next.address
        }
        return next
      })
      showToast(place
        ? 'Card scanned — address filled from Google Places. Review and confirm.'
        : 'Card scanned — review and confirm fields', 'success')
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
      await addVisit({ ...form, address: joinAddress(form) || form.address || '', timestamp: new Date(form.visitedAt).getTime() })
      scheduleFlush()
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

          {/* Visit date & time */}
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Visit Date &amp; Time</label>
            <input
              className="form-input"
              type="datetime-local"
              value={form.visitedAt}
              onChange={set('visitedAt')}
            />
          </div>

          {/* Business info */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 }}>
            <p className="section-title" style={{ margin: 0 }}>Business Info</p>
            <button
              className="btn btn-icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning || !aiEnabled}
              title={aiEnabled ? 'Scan business card' : 'Paste your Field Logger Key in Settings to scan cards'}
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
            <label className="form-label">Address 1</label>
            <input
              className="form-input"
              value={form.address1}
              onChange={set('address1')}
              placeholder="Street address"
              autoCapitalize="words"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Address 2</label>
            <input
              className="form-input"
              value={form.address2}
              onChange={set('address2')}
              placeholder="Suite, unit"
              autoCapitalize="words"
            />
          </div>
          <div className="input-row" style={{ gridTemplateColumns: '2fr 0.7fr 1fr' }}>
            <div className="form-group">
              <label className="form-label">City</label>
              <input
                className="form-input"
                value={form.city}
                onChange={set('city')}
                placeholder="City"
                autoCapitalize="words"
              />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input
                className="form-input"
                value={form.state}
                onChange={set('state')}
                placeholder="CA"
                maxLength={2}
                autoCapitalize="characters"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Zip</label>
              <input
                className="form-input"
                value={form.zip}
                onChange={set('zip')}
                placeholder="93727"
                inputMode="numeric"
              />
            </div>
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
            {notesFocused && (
              <div className="note-templates">
                {NOTE_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="note-template-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertTemplate(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={notesRef}
              className="form-textarea"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Add any notes about this visit…"
              rows={3}
              onFocus={handleNotesFocus}
              onBlur={handleNotesBlur}
            />
          </div>

          {/* Voice note */}
          <VoiceNote
            value={form.voiceNote}
            onChange={(v) => setForm(f => ({ ...f, voiceNote: v }))}
            aiEnabled={aiEnabled}
            showToast={showToast}
          />

          <VisitHistory
            visits={historyVisits}
            onReuseContact={handleReuseContact}
          />

          <div style={{ height: 24 }} />
        </div>
      </div>
    </div>
  )
}
