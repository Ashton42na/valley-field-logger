export function joinAddress({ address1, address2, city, state, zip } = {}) {
  const cityStateZip = [city, state, zip].filter(Boolean).join(' ')
  const parts = [address1, address2, cityStateZip].filter(Boolean)
  return parts.join(', ')
}

export function structuredAddressFrom(source = {}) {
  return {
    address1: source.address1 || '',
    address2: source.address2 || '',
    city: source.city || '',
    state: source.state || '',
    zip: source.zip || ''
  }
}

export function assignNonEmptyStructured(target, source = {}) {
  const parts = structuredAddressFrom(source)
  for (const key of ['address1', 'address2', 'city', 'state', 'zip']) {
    if (parts[key]) target[key] = parts[key]
  }
  return target
}

function hasStructuredAddress(source = {}) {
  return !!(source.address1 || source.address2 || source.city || source.state || source.zip)
}

export function parsePlaceComponents(components) {
  if (!Array.isArray(components)) return {}
  let streetNumber, route, subpremise, city, state, zip
  for (const c of components) {
    const types = c.types || []
    const longText = c.longText || c.long_name || ''
    const shortText = c.shortText || c.short_name || ''
    if (types.includes('street_number')) streetNumber = longText
    else if (types.includes('route')) route = longText
    else if (types.includes('subpremise')) subpremise = longText
    else if (types.includes('locality')) city = longText
    else if (types.includes('administrative_area_level_1')) state = shortText
    else if (types.includes('postal_code')) zip = longText
  }
  const address1 = [streetNumber, route].filter(Boolean).join(' ')
  return {
    address1: address1 || '',
    address2: subpremise || '',
    city: city || '',
    state: state || '',
    zip: zip || ''
  }
}

export function addressFieldsFromExtracted(extracted = {}) {
  const out = {}
  if (extracted.address) out.address = extracted.address
  if (hasStructuredAddress(extracted)) Object.assign(out, structuredAddressFrom(extracted))
  return out
}
