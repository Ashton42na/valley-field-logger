const PLACES_PROXY = '/.netlify/functions/places'

export async function searchByName(query) {
  const res = await fetch(PLACES_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'searchText', textQuery: query, regionCode: 'US', languageCode: 'en', maxResultCount: 10 })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Search failed.')
  }
  const data = await res.json()
  return (data.places || []).map(mapPlace)
}

export async function findNearby(lat, lon, radiusMeters = 100) {
  const res = await fetch(PLACES_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      op: 'searchNearby',
      locationRestriction: { circle: { center: { latitude: lat, longitude: lon }, radius: radiusMeters } },
      languageCode: 'en',
      maxResultCount: 20
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Nearby search failed.')
  }
  const data = await res.json()
  return (data.places || [])
    .map(p => ({ ...mapPlace(p), distMeters: p.location ? haversine(lat, lon, p.location.latitude, p.location.longitude) : null }))
    .sort((a, b) => (a.distMeters ?? 9999) - (b.distMeters ?? 9999))
}

function mapPlace(p) {
  return {
    placeId: p.id || '',
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    phone: p.nationalPhoneNumber || '',
    website: p.websiteUri || '',
    industry: mapIndustry(p.types || [], p.primaryTypeDisplayName?.text),
    lat: p.location?.latitude ?? null,
    lon: p.location?.longitude ?? null
  }
}

function mapIndustry(types, primaryDisplay) {
  const t = types.join(' ')
  if (/hospital|doctor|dentist|pharmacy|health|medical/.test(t)) return 'Healthcare'
  if (/bank|finance|atm|insurance/.test(t)) return 'Finance / Banking'
  if (/restaurant|cafe|bar|food|meal/.test(t)) return 'Food & Beverage'
  if (/school|university|college|education/.test(t)) return 'Education'
  if (/lodging|hotel|motel/.test(t)) return 'Hospitality'
  if (/car_dealer|car_repair|car_wash|auto_/.test(t)) return 'Automotive'
  if (/electronics|computer/.test(t)) return 'Technology / Electronics'
  if (/real_estate/.test(t)) return 'Real Estate'
  if (/lawyer|legal/.test(t)) return 'Legal'
  if (/store|shop/.test(t)) return 'Retail'
  if (/office|corporate|professional/.test(t)) return 'Office / Professional Services'
  return primaryDisplay || 'Business'
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export function formatDist(meters) {
  if (!meters && meters !== 0) return ''
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1609.34).toFixed(1)}mi`
}
