import { getSyncBaseUrl, getFieldLoggerKey, looksLikeFieldLoggerKey } from '../sync/syncService.js'

function sanitizeError(text, secret) {
  if (!text) return ''
  let s = String(text).replace(/[\x00-\x1F\x7F]+/g, ' ').slice(0, 80)
  if (secret && secret.length >= 8) s = s.split(secret).join('[redacted]')
  return s.trim()
}

function baseUrl() {
  return (getSyncBaseUrl() || '').replace(/\/+$/, '')
}

function authHeaders(extra = {}) {
  const key = getFieldLoggerKey()
  return { ...extra, 'X-FIELD-LOGGER-KEY': key }
}

async function readError(res, secret) {
  let code = ''
  let msg = `HTTP ${res.status}`
  try {
    const body = await res.json()
    if (body?.code) code = body.code
    if (body?.message) msg = body.message
  } catch {
    try { msg = sanitizeError(await res.text(), secret) || msg } catch {}
  }
  if (res.status === 401 || res.status === 403) return 'Field Logger Key required — paste the full flk_ key from the portal'
  if (code === 'ai_not_configured' || res.status === 503) return 'Company AI is not configured'
  if (code === 'ai_rate_limited' || res.status === 429) return 'Too many AI requests — try again in a minute'
  if (code === 'ai_upstream' || res.status === 502) return 'AI failed — try again'
  return sanitizeError(msg, secret) || 'AI request failed'
}

export async function getAiStatus() {
  if (!looksLikeFieldLoggerKey(getFieldLoggerKey())) {
    return { enabled: false, reason: 'no-key' }
  }
  const url = baseUrl()
  if (!url) return { enabled: false, reason: 'no-url' }
  try {
    const res = await fetch(url + '/api/ai/status', { headers: authHeaders() })
    if (res.status === 401 || res.status === 403) return { enabled: false, reason: 'auth' }
    if (!res.ok) return { enabled: false, reason: 'unavailable' }
    const data = await res.json()
    return { enabled: !!data.enabled, model: data.model || null }
  } catch {
    return { enabled: false, reason: 'offline' }
  }
}

export async function cleanupVoiceNote(rawText) {
  const key = getFieldLoggerKey()
  if (!looksLikeFieldLoggerKey(key)) {
    throw new Error('Paste your Field Logger Key in Settings to use AI')
  }
  const res = await fetch(baseUrl() + '/api/ai/cleanup', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ text: rawText })
  })
  if (!res.ok) throw new Error(await readError(res, key))
  const data = await res.json()
  return (data.text || rawText).trim()
}

export async function scanBusinessCard(base64, mimeType) {
  const key = getFieldLoggerKey()
  if (!looksLikeFieldLoggerKey(key)) {
    throw new Error('Paste your Field Logger Key in Settings to use AI')
  }
  const res = await fetch(baseUrl() + '/api/ai/scan-card', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ imageBase64: base64, mimeType })
  })
  if (!res.ok) throw new Error(await readError(res, key))
  return await res.json()
}

export function downscaleImageFile(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      const mimeType = 'image/jpeg'
      const dataUrl = canvas.toDataURL(mimeType, quality)
      resolve({ base64: dataUrl.split(',')[1], mimeType })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}
