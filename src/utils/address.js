export function joinAddress({ address1, address2, city, state, zip, address } = {}) {
  const cityStateZip = [city, state, zip].filter(Boolean).join(' ')
  const parts = [address1, address2, cityStateZip].filter(Boolean)
  if (parts.length) return parts.join(', ')
  return (address || '').trim()
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
  return {
    ...(extracted.address && { address: extracted.address }),
    ...(extracted.address1 && { address1: extracted.address1 }),
    ...(extracted.address2 && { address2: extracted.address2 }),
    ...(extracted.city && { city: extracted.city }),
    ...(extracted.state && { state: extracted.state }),
    ...(extracted.zip && { zip: extracted.zip })
  }
}
