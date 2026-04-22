const OUTCOME_LABELS = {
  'left-info': 'Left Info',
  'spoke-to-owner': 'Spoke to Owner',
  'gatekeeper-only': 'Gatekeeper Only',
  'requested-callback': 'Requested Callback',
  'not-interested': 'Not Interested'
}

export function exportVisitsToCSV(visits, filename) {
  const headers = [
    'Date', 'Time', 'Company Name', 'Address', 'Phone', 'Website',
    'Industry', 'Contact Name', 'Contact Title', 'Email', 'Status', 'Temperature', 'Outcome', 'Follow-up Date', 'Notes', 'Voice Note'
  ]

  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`

  const rows = visits.map(v => {
    const d = new Date(v.timestamp)
    return [
      d.toLocaleDateString('en-US'),
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      v.companyName,
      v.address,
      v.phone,
      v.website,
      v.industry,
      v.contactName,
      v.contactTitle || '',
      v.email || '',
      v.status,
      v.temperature ? v.temperature.charAt(0).toUpperCase() + v.temperature.slice(1) : '',
      OUTCOME_LABELS[v.outcome] || v.outcome || '',
      v.followUpDate || '',
      v.notes,
      v.voiceNote
    ].map(esc).join(',')
  })

  const csv = [headers.map(esc).join(','), ...rows].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `valley-visits-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
