const NOMINATIM = 'https://nominatim.openstreetmap.org'
const OVERPASS = 'https://overpass-api.de/api/interpreter'
const UA = 'ValleyFieldLogger/1.0 (ashton@valleytechlogic.com)'

export async function searchByName(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    limit: '10',
    countrycodes: 'us'
  })
  const res = await fetch(`${NOMINATIM}/search?${params}`, {
    headers: { 'Accept-Language': 'en-US', 'User-Agent': UA }
  })
  if (!res.ok) throw new Error('Search failed — check your connection')
  const results = await res.json()

  return results.map(r => ({
    placeId: String(r.place_id),
    name: r.namedetails?.name || r.display_name.split(',')[0].trim(),
    address: formatNominatimAddress(r.address),
    phone: r.extratags?.phone || r.extratags?.['contact:phone'] || '',
    website: r.extratags?.website || r.extratags?.['contact:website'] || '',
    industry: guessIndustry(r.type, r.category, r.extratags),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon)
  }))
}

export async function findNearby(lat, lon, radiusMeters = 800) {
  const query = `
[out:json][timeout:20];
(
  node["name"]["shop"](around:${radiusMeters},${lat},${lon});
  node["name"]["office"](around:${radiusMeters},${lat},${lon});
  node["name"]["amenity"~"^(restaurant|cafe|bar|bank|clinic|pharmacy|dentist|doctor|hospital|school|college|hotel|motel|car_wash|car_repair|fuel)$"](around:${radiusMeters},${lat},${lon});
  node["name"]["craft"](around:${radiusMeters},${lat},${lon});
  node["name"]["healthcare"](around:${radiusMeters},${lat},${lon});
  node["name"]["industrial"](around:${radiusMeters},${lat},${lon});
  way["name"]["shop"](around:${radiusMeters},${lat},${lon});
  way["name"]["office"](around:${radiusMeters},${lat},${lon});
  way["name"]["amenity"~"^(restaurant|cafe|bar|bank|clinic|pharmacy|dentist|hospital|school|hotel)$"](around:${radiusMeters},${lat},${lon});
);
out center 30;
`
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: `data=${encodeURIComponent(query)}`
  })
  if (!res.ok) throw new Error('Nearby search failed — check your connection')
  const data = await res.json()

  const seen = new Set()
  return data.elements
    .filter(e => e.tags?.name)
    .map(e => {
      const lat2 = e.lat ?? e.center?.lat
      const lon2 = e.lon ?? e.center?.lon
      return {
        placeId: `osm-${e.type}-${e.id}`,
        name: e.tags.name,
        address: formatOverpassAddress(e.tags),
        phone: e.tags.phone || e.tags['contact:phone'] || '',
        website: e.tags.website || e.tags['contact:website'] || '',
        industry: guessIndustryFromTags(e.tags),
        lat: lat2,
        lon: lon2,
        distMeters: lat2 && lon2 ? haversine(lat, lon, lat2, lon2) : null
      }
    })
    .filter(b => {
      if (seen.has(b.name)) return false
      seen.add(b.name)
      return true
    })
    .sort((a, b) => (a.distMeters ?? 9999) - (b.distMeters ?? 9999))
}

function formatNominatimAddress(addr) {
  if (!addr) return ''
  const street = addr.house_number && addr.road
    ? `${addr.house_number} ${addr.road}`
    : addr.road || ''
  const city = addr.city || addr.town || addr.village || addr.hamlet || ''
  const parts = [street, city, addr.state, addr.postcode].filter(Boolean)
  return parts.join(', ')
}

function formatOverpassAddress(tags) {
  const num = tags['addr:housenumber'] || ''
  const street = tags['addr:street'] || ''
  const city = tags['addr:city'] || ''
  const state = tags['addr:state'] || ''
  const zip = tags['addr:postcode'] || ''
  const line1 = [num, street].filter(Boolean).join(' ')
  return [line1, city, state, zip].filter(Boolean).join(', ')
}

function guessIndustry(type, category, extratags) {
  const shopType = extratags?.shop
  const amenity = extratags?.amenity
  const office = extratags?.office
  return _categoryMap(type, category, shopType, amenity, office)
}

function guessIndustryFromTags(tags) {
  return _categoryMap(tags.amenity, tags.shop || tags.craft, tags.shop, tags.amenity, tags.office)
}

function _categoryMap(type, category, shop, amenity, office) {
  if (office) return 'Office / Professional Services'
  if (shop === 'electronics' || shop === 'computer') return 'Technology / Electronics'
  if (shop === 'car' || shop === 'car_repair') return 'Automotive'
  if (amenity === 'bank' || amenity === 'atm') return 'Finance / Banking'
  if (amenity === 'clinic' || amenity === 'dentist' || amenity === 'doctor' || amenity === 'pharmacy' || amenity === 'hospital') return 'Healthcare'
  if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'bar' || amenity === 'fast_food') return 'Food & Beverage'
  if (amenity === 'school' || amenity === 'college' || amenity === 'university') return 'Education'
  if (amenity === 'hotel' || amenity === 'motel') return 'Hospitality'
  if (amenity === 'fuel' || amenity === 'car_wash' || amenity === 'car_repair') return 'Automotive'
  if (shop) return 'Retail'
  if (type === 'industrial' || category === 'industrial') return 'Manufacturing / Industrial'
  return 'Business'
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
