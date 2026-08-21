// Location identity for visit history. Prefer Google placeId; fall back to geo+name, then
// name+phone/address. Uncertain matches return false — never attach another door's history.

export const GEO_MATCH_METERS = 75

export function normCompanyName(n) {
  if (!n || typeof n !== 'string') return ''
  let lower = n.trim().toLowerCase()
  const suffixes = [
    ', inc', ' inc', ', inc.', ' inc.', ', llc', ' llc', ', ltd', ' ltd',
    ' co', ' company', ' corp', ' corporation', ' group', ' holdings',
    ' solutions', ' systems', ' services'
  ]
  for (const s of suffixes) {
    if (lower.endsWith(s)) lower = lower.slice(0, -s.length)
  }
  return lower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).join(' ')
}

export function normPhone(p) {
  if (!p || typeof p !== 'string') return ''
  return p.replace(/\D/g, '')
}

export function normAddressKey(addr) {
  if (!addr || typeof addr !== 'string') return ''
  return addr.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).join(' ')
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export function namesMatch(a, b) {
  const na = normCompanyName(a)
  const nb = normCompanyName(b)
  return !!na && na === nb
}

export function phonesMatch(a, b) {
  const pa = normPhone(a)
  const pb = normPhone(b)
  return !!pa && pa === pb
}

export function addressesMatch(a, b) {
  const ka = normAddressKey(a)
  const kb = normAddressKey(b)
  if (!ka || !kb) return false
  if (ka === kb) return true
  // Google formattedAddress vs a stored street line: require a real street-sized key.
  if (ka.length >= 8 && kb.includes(ka)) return true
  if (kb.length >= 8 && ka.includes(kb)) return true
  return false
}

function hasGeo(obj) {
  return obj && typeof obj.lat === 'number' && typeof obj.lon === 'number'
}

/**
 * Does this stored visit belong to this search/form place?
 * @returns {{ matched: boolean, confidence?: string }}
 */
export function visitMatchesPlace(visit, place) {
  if (!visit || !place) return { matched: false }

  const vPid = visit.placeId || ''
  const pPid = place.placeId || ''
  if (vPid && pPid) {
    return vPid === pPid ? { matched: true, confidence: 'placeId' } : { matched: false }
  }

  if (!namesMatch(visit.companyName, place.name)) return { matched: false }

  if (hasGeo(visit) && hasGeo(place)) {
    const d = haversine(visit.lat, visit.lon, place.lat, place.lon)
    if (d <= GEO_MATCH_METERS) return { matched: true, confidence: 'geo' }
    return { matched: false }
  }

  const addrOk = addressesMatch(visit.address, place.address)
  const phoneOk = phonesMatch(visit.phone, place.phone)
  if (addrOk && phoneOk) return { matched: true, confidence: 'phone-and-addr' }
  if (addrOk) return { matched: true, confidence: 'addr' }
  if (phoneOk) return { matched: true, confidence: 'phone' }

  // Manual "Log visit for {name}" with no other identity: only match if every
  // name-hit collapses to one door. Callers that pass a bare name use
  // clusterNameOnlyMatches() instead of treating every name hit as this door.
  const placeIsBareName = !pPid && !place.address && !place.phone && !hasGeo(place)
  if (placeIsBareName && !vPid && !visit.address && !visit.phone && !hasGeo(visit)) {
    return { matched: true, confidence: 'name-only' }
  }

  return { matched: false }
}

export function historyCacheKey(place) {
  if (place?.placeId) return 'pid:' + place.placeId
  return [
    'n:' + normCompanyName(place?.name),
    'a:' + normAddressKey(place?.address),
    'p:' + normPhone(place?.phone)
  ].join('|')
}
