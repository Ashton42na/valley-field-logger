// Generates minimal valid PNG icons using only Node built-ins (no extra deps)
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'

function crc32(buf) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    return c
  })
  let c = 0xFFFFFFFF
  for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function makePNG(size) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  // bytes 10-12: 0 (compression, filter, interlace)

  // Build pixel data: dark bg (#090910) with green pin centered
  const rows = []
  const cx = size / 2, cy = size * 0.44
  const pinR = size * 0.22, pinBot = size * 0.82
  const dotR = size * 0.08
  const cornerR = size * 0.2

  for (let y = 0; y < size; y++) {
    const row = [0] // filter byte: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Rounded corner mask
      let inCorner = true
      const corners = [[cornerR, cornerR], [size - cornerR, cornerR], [cornerR, size - cornerR], [size - cornerR, size - cornerR]]
      for (const [cx2, cy2] of corners) {
        if (x < cx2 && y < cy2) { inCorner = Math.hypot(x - cx2, y - cy2) <= cornerR; break }
        if (x > size - cornerR && y < cornerR) { inCorner = Math.hypot(x - (size - cornerR), y - cornerR) <= cornerR; break }
        if (x < cornerR && y > size - cornerR) { inCorner = Math.hypot(x - cornerR, y - (size - cornerR)) <= cornerR; break }
        if (x > size - cornerR && y > size - cornerR) { inCorner = Math.hypot(x - (size - cornerR), y - (size - cornerR)) <= cornerR; break }
        inCorner = true; break
      }
      if (!inCorner) { row.push(9, 9, 16); continue }

      // Pin shape: circle top + triangle bottom
      const inCircle = dist <= pinR && y <= cy
      const belowCenter = y > cy
      const pinAngle = belowCenter ? Math.atan2(Math.abs(dx), y - cy) : null
      const inTriangle = belowCenter && y <= pinBot && pinAngle !== null && pinAngle < Math.atan2(pinR, 0) && Math.abs(dx) < (pinBot - y) * (pinR / (pinBot - cy))

      if ((inCircle || inTriangle) && !(Math.sqrt(dx * dx + (y - cy) * (y - cy)) < dotR)) {
        row.push(0x4a, 0xde, 0x80) // green #4ade80
      } else {
        row.push(9, 9, 16) // dark #090910
      }
    }
    rows.push(Buffer.from(row))
  }

  const raw = Buffer.concat(rows)
  const compressed = deflateSync(raw, { level: 9 })

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', makePNG(192))
writeFileSync('public/icon-512.png', makePNG(512))
console.log('✓ Icons created: public/icon-192.png, public/icon-512.png')
