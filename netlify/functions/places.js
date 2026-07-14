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

  try {
    const res = await fetch(`${PLACES_BASE}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK
      },
      body: JSON.stringify(requestBody)
    })
    const body = await res.text()
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body
    }
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: { message: 'Failed to reach Google Places API.' } }) }
  }
}
