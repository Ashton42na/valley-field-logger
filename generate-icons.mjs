// Run with: node generate-icons.mjs
// Generates public/icon-192.png and public/icon-512.png from the SVG using canvas
// Requires: npm install canvas (dev only)

import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

function drawIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const s = size / 192

  // Background
  ctx.fillStyle = '#090910'
  roundRect(ctx, 0, 0, size, size, 40 * s)
  ctx.fill()

  // Pin body
  ctx.fillStyle = '#4ade80'
  ctx.beginPath()
  const cx = 96 * s, pinTop = 28 * s
  const r = 40 * s
  ctx.arc(cx, (68) * s, r, Math.PI, 0)
  ctx.quadraticCurveTo(cx + r, 90 * s, cx, 164 * s)
  ctx.quadraticCurveTo(cx - r, 90 * s, cx - r, 68 * s)
  ctx.arc(cx, 68 * s, r, Math.PI, 0)
  ctx.fill()

  // Inner circle
  ctx.fillStyle = '#090910'
  ctx.beginPath()
  ctx.arc(cx, 68 * s, 14 * s, 0, Math.PI * 2)
  ctx.fill()

  return canvas.toBuffer('image/png')
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

try {
  writeFileSync(resolve(__dir, 'public/icon-192.png'), drawIcon(192))
  writeFileSync(resolve(__dir, 'public/icon-512.png'), drawIcon(512))
  console.log('Icons generated: public/icon-192.png, public/icon-512.png')
} catch (e) {
  console.error('Icon generation failed:', e.message)
  console.log('You can skip this — the app works without PNG icons in dev mode.')
}
