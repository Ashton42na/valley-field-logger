export async function scanBusinessCard(base64, mimeType, apiKey) {
  if (!apiKey?.trim()) throw new Error('No Anthropic API key — add it in Settings')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          {
            type: 'text',
            text: `Extract information from this business card. Return ONLY a valid JSON object with these exact keys (empty string if not found):
{"companyName":"","contactName":"","contactTitle":"","phone":"","email":"","website":"","address":""}
No markdown, no explanation — just the JSON object.`
          }
        ]
      }]
    })
  })

  if (!res.ok) {
    let msg = `API error ${res.status}`
    try { const b = await res.json(); msg = b.error?.message || msg } catch {}
    throw new Error(msg)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text?.trim() || '{}'
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Could not parse card data — try a clearer photo')
  }
}

export async function cleanupVoiceNote(rawText, apiKey) {
  if (!apiKey?.trim()) throw new Error('No Anthropic API key — add it in Settings')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are cleaning up a voice note from a field sales rep. Your job:
- Fix grammar and punctuation
- Remove filler words (um, uh, like, you know, basically, literally, so yeah, etc.)
- Fix obvious speech-to-text errors
- Keep every fact, name, number, product, and detail exactly as stated — do not add, invent, or remove information
- Return ONLY the cleaned note text — no intro, no explanation, no quotes

Voice note to clean:
${rawText}`
      }]
    })
  })

  if (!res.ok) {
    let msg = `API error ${res.status}`
    try {
      const body = await res.json()
      msg = body.error?.message || msg
    } catch {}
    throw new Error(msg)
  }

  const data = await res.json()
  return data.content?.[0]?.text?.trim() || rawText
}
