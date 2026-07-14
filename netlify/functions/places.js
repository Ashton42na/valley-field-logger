const PLACES_BASE = 'https://places.googleapis.com/v1'

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.types',
  'places.primaryTypeDisplayName',
  'places.location'
].join(',')

const OPS = {
  searchText: 'places:searchText',
  searchNearby: 'places:searchNearby'
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: { message: 'Method not allowed' } }) }
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  console.log('[places] GOOGLE_PLACES_API_KEY defined:', Boolean(apiKey), apiKey ? `(length ${apiKey.length})` : '')
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: { message: 'Server is missing GOOGLE_PLACES_API_KEY.' } }) }
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Invalid JSON body.' } }) }
  }

  const { op, ...requestBody } = payload
  const path = OPS[op]
  if (!path) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Unknown or missing "op".' } }) }
  }

  const url = `${PLACES_BASE}/${path}`
  console.log('[places] calling URL:', url)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    })
    const body = await res.text()
    if (!res.ok) {
      console.log('[places] Google error response:', res.status, body)
    }
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body
    }
  } catch (e) {
    console.log('[places] fetch to Google failed:', e.message)
    return { statusCode: 502, body: JSON.stringify({ error: { message: 'Failed to reach Google Places API.' } }) }
  }
}
