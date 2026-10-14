// Dev-only fixtures for screenshots. Loaded only when VITE_MOCK_DATA === '1'
// (e.g. `VITE_MOCK_DATA=1 npm run dev`); production builds never import this file.

const DAY_MS = 24 * 60 * 60 * 1000

function ago(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

function dayKeyAgo(days) {
  const d = new Date(Date.now() - days * DAY_MS)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function place(id, name, address1, city, zip, phone, industry, offset) {
  return {
    placeId: 'mock-' + id,
    name,
    address: `${address1}, ${city}, CA ${zip}, USA`,
    address1,
    address2: '',
    city,
    state: 'CA',
    zip,
    phone,
    website: '',
    industry,
    offset // [dLat, dLon] from the user's position, for Nearby
  }
}

// Nearby: plain, prior, due and cleared-not-a-fit cards show; recent + not-a-fit are hidden.
const NEARBY = [
  place('sierra-dental', 'Sierra Vista Dental Group', '1420 W Shaw Ave', 'Fresno', '93711', '(559) 555-0141', 'Healthcare', [0.0006, 0.0004]),
  place('tower-coffee', 'Tower District Coffee Co', '1180 N Wishon Ave', 'Fresno', '93728', '(559) 555-0172', 'Food & Beverage', [-0.0009, 0.0011]),
  place('blackstone-auto', 'Blackstone Auto Repair', '4655 N Blackstone Ave', 'Fresno', '93726', '(559) 555-0119', 'Automotive', [0.0018, -0.0012]),
  place('palm-bluffs', 'Palm Bluffs Accounting', '7550 N Palm Ave', 'Fresno', '93711', '(559) 555-0188', 'Legal / Accounting', [-0.0021, -0.0017]),
  place('herndon-insurance', 'Herndon Insurance Partners', '320 W Herndon Ave', 'Fresno', '93650', '(559) 555-0133', 'Finance / Banking', [0.0028, 0.0022]),
  place('fig-garden', 'Fig Garden Realty', '5082 N Palm Ave', 'Fresno', '93704', '(559) 555-0164', 'Real Estate', [0.0010, -0.0025]),
  place('shaw-law', 'Shaw Avenue Law Office', '2491 W Shaw Ave', 'Fresno', '93711', '(559) 555-0157', 'Legal', [-0.0031, 0.0009])
]

// Name search for "Clovis": both pills, amber only, red only, plain.
const CLOVIS = [
  place('clovis-dental', 'Clovis Family Dental', '845 Pollasky Ave', 'Clovis', '93612', '(559) 555-0201', 'Healthcare', [0, 0]),
  place('clovis-tire', 'Clovis Tire & Brake', '1031 Shaw Ave', 'Clovis', '93612', '(559) 555-0214', 'Automotive', [0, 0]),
  place('clovis-vet', 'Clovis Veterinary Hospital', '2260 Herndon Ave', 'Clovis', '93611', '(559) 555-0226', 'Healthcare', [0, 0]),
  place('clovis-hardware', 'Clovis Ace Hardware', '590 W Bullard Ave', 'Clovis', '93612', '(559) 555-0239', 'Retail', [0, 0]),
  place('clovis-title', 'Old Town Clovis Title Co', '410 Clovis Ave', 'Clovis', '93612', '(559) 555-0245', 'Real Estate', [0, 0])
]

function teamVisit(days, userName, outcome, extra = {}) {
  return { capturedAt: ago(days), userName, contactName: '', notes: '', outcome, ...extra }
}

// Team history by placeId. Built per call so "days ago" stays relative to now.
function teamVisitsFor(placeId) {
  switch (placeId) {
    case 'mock-blackstone-auto':
      return [teamVisit(140, 'Jordan Reyes', 'left-info')]
    case 'mock-palm-bluffs':
      // Not a fit, then a later positive visit clears it.
      return [
        teamVisit(95, 'Sam Ortiz', 'spoke-to-owner', { contactName: 'Dana Whitfield' }),
        teamVisit(280, 'Jordan Reyes', 'not-a-fit')
      ]
    case 'mock-herndon-insurance':
      return [teamVisit(75, 'Sam Ortiz', 'requested-callback', { followUpDate: dayKeyAgo(5) })]
    case 'mock-fig-garden':
      return [teamVisit(21, 'Jordan Reyes', 'gatekeeper-only')]
    case 'mock-shaw-law':
      return [teamVisit(160, 'Sam Ortiz', 'not-a-fit', { notes: 'In-house IT — not a fit at this time' })]
    case 'mock-clovis-dental':
      return [teamVisit(30, 'Jordan Reyes', 'not-a-fit', { contactName: 'Dr. Patel' })]
    case 'mock-clovis-tire':
      return [teamVisit(12, 'Sam Ortiz', 'left-info')]
    case 'mock-clovis-vet':
      return [teamVisit(210, 'Jordan Reyes', 'not-a-fit')]
    case 'mock-clovis-title':
      return [teamVisit(180, 'Sam Ortiz', 'spoke-to-owner')]
    default:
      return []
  }
}

function toPlace({ offset, ...p }, lat, lon) {
  if (lat == null || lon == null) return p
  return { ...p, lat: lat + offset[0], lon: lon + offset[1] }
}

export function mockFindNearby(lat, lon) {
  return NEARBY.map(p => toPlace(p, lat, lon))
}

export function mockSearchByName(query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  return [...CLOVIS, ...NEARBY]
    .filter(p => p.name.toLowerCase().includes(q))
    .map(p => toPlace(p, 36.8252, -119.7029))
}

export function mockTeamHistory(place) {
  const visits = teamVisitsFor(place?.placeId || '')
  return {
    match: visits.length ? 'exact' : 'none',
    visits,
    youUserName: 'Rory',
    company: null,
    error: false
  }
}

export function mockTeamHistoryBatch(places) {
  return {
    youUserName: 'Rory',
    results: (places || []).map(p => ({ place: p, team: mockTeamHistory(p) }))
  }
}
