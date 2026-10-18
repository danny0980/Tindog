// Cuts AI-generated piece sprite sheets into 12 clean, transparent piece
// images — no fixed grid needed:
//   1. decode the PNG (pure Node: zlib only),
//   2. key out the background (green-screen or any flat colour) and remove colour spill,
//   3. find every piece as a connected blob (detached bits like crosses are merged),
//   4. split the pieces into the light (White) and dark (Black) army by brightness,
//   5. recognise each piece by its silhouette: pawn = smallest, king = tallest,
//      queen = next, knight = the lopsided one, rook = flat wide top, bishop = the rest,
//   6. write wK.png … bP.png, all on one shared canvas size so a pawn stays
//      smaller than a king, bottom-aligned and centred.
import { deflateSync, inflateSync } from 'node:zlib'

// ── PNG codec (8-bit, non-interlaced; the format image generators produce) ───

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Decodes a PNG into { width, height, data: RGBA bytes }, or throws with a reason. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let pos = 8
  let width = 0
  let height = 0
  let depth = 0
  let type = 0
  let interlace = 0
  let palette = null
  let trns = null
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const kind = buf.toString('ascii', pos + 4, pos + 8)
    const body = buf.subarray(pos + 8, pos + 8 + len)
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      depth = body[8]
      type = body[9]
      interlace = body[12]
    } else if (kind === 'PLTE') palette = body
    else if (kind === 'tRNS') trns = body
    else if (kind === 'IDAT') idat.push(body)
    else if (kind === 'IEND') break
    pos += 12 + len
  }
  if (interlace) throw new Error('interlaced PNGs are not supported')
  if (depth !== 8 && depth !== 16) throw new Error(`${depth}-bit PNGs are not supported`)
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]
  if (!channels) throw new Error(`PNG colour type ${type} is not supported`)
  const bpp = (channels * depth) / 8
  const stride = width * bpp
  const raw = inflateSync(Buffer.concat(idat))
  const px = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const dst = y * stride
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0
      const b = y > 0 ? px[dst - stride + x] : 0
      const c = x >= bpp && y > 0 ? px[dst - stride + x - bpp] : 0
      let v = raw[src + x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[dst + x] = v & 0xff
    }
  }
  const data = new Uint8ClampedArray(width * height * 4)
  const step = depth / 8
  for (let i = 0; i < width * height; i++) {
    const o = i * bpp
    const get = (ch) => px[o + ch * step]
    let r
    let g
    let b
    let al = 255
    if (type === 2 || type === 6) {
      r = get(0)
      g = get(1)
      b = get(2)
      if (type === 6) al = get(3)
    } else if (type === 0 || type === 4) {
      r = g = b = get(0)
      if (type === 4) al = get(1)
    } else {
      const idx = px[o]
      r = palette?.[idx * 3] ?? 0
      g = palette?.[idx * 3 + 1] ?? 0
      b = palette?.[idx * 3 + 2] ?? 0
      al = trns && idx < trns.length ? trns[idx] : 255
    }
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = al
  }
  return { width, height, data }
}

/** Encodes RGBA pixels as a PNG. */
export function encodePng({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1)
  }
  const chunk = (kind, body) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(body.length, 0)
    head.write(kind, 4, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0)
    return Buffer.concat([head, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// ── Background keying ───────────────────────────────────────────────────────

/** The background colour: the median of the image border (or transparent). */
export function borderColor(img) {
  const { width, height, data } = img
  const samples = []
  const take = (x, y) => {
    const i = (y * width + x) * 4
    samples.push([data[i], data[i + 1], data[i + 2], data[i + 3]])
  }
  const stepX = Math.max(1, Math.floor(width / 64))
  const stepY = Math.max(1, Math.floor(height / 64))
  for (let x = 0; x < width; x += stepX) {
    take(x, 0)
    take(x, height - 1)
  }
  for (let y = 0; y < height; y += stepY) {
    take(0, y)
    take(width - 1, y)
  }
  const median = (k) => samples.map((s) => s[k]).sort((a, b) => a - b)[samples.length >> 1]
  const m = [median(0), median(1), median(2), median(3)]
  // How much of the border is that one colour (a screen is uniform; a board's edge is not).
  const near = samples.filter((s) => Math.abs(s[0] - m[0]) + Math.abs(s[1] - m[1]) + Math.abs(s[2] - m[2]) < 60).length
  m.uniform = near / samples.length
  return m
}

/**
 * Makes the background transparent. A saturated screen colour (green, blue,
 * magenta …) is keyed by "how much of that channel sticks out" — which also
 * cleans the soft fringe — and its spill is removed from the piece edges.
 * Any other flat colour is keyed by colour distance.
 */
export function keyBackground(img) {
  const { data } = img
  const border = borderColor(img)
  const [br, bg, bb, ba] = border
  if (ba < 32) {
    // Already transparent: nothing to key, the pieces are ready to cut.
    let clear = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] < 128) clear += 1
    return { keyed: clear / (data.length / 4), background: 'transparent' }
  }
  // A border of many colours (a board, a scene) has no background to remove.
  if (border.uniform < 0.7) return { keyed: 0, background: 'none' }
  const chans = [br, bg, bb]
  const max = Math.max(...chans)
  const dominant = chans.indexOf(max)
  const others = [0, 1, 2].filter((c) => c !== dominant)
  const screen = max - Math.max(chans[others[0]], chans[others[1]]) > 80
  let keyed = 0
  for (let i = 0; i < data.length; i += 4) {
    let alpha
    if (screen) {
      const d = data[i + dominant]
      const o = Math.max(data[i + others[0]], data[i + others[1]])
      const k = d - o
      alpha = k <= 25 ? 1 : k >= 80 ? 0 : 1 - (k - 25) / 55
      // Spill suppression: the screen colour may not exceed the other channels on the piece.
      if (alpha > 0 && d > o) data[i + dominant] = o + Math.max(0, (d - o) * (1 - alpha) * 0.3)
    } else {
      const dist = Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb)
      alpha = dist <= 30 ? 0 : dist >= 90 ? 1 : (dist - 30) / 60
    }
    const a = Math.round(data[i + 3] * alpha)
    if (a < 255) keyed += 1
    data[i + 3] = a
  }
  return { keyed: keyed / (data.length / 4), background: screen ? ['red', 'green', 'blue'][dominant] : 'flat' }
}

// ── Finding pieces ──────────────────────────────────────────────────────────

/** Connected opaque blobs (8-neighbour), with nearby fragments merged. */
export function findBlobs(img, { alphaMin = 128 } = {}) {
  const { width, height, data } = img
  const label = new Int32Array(width * height).fill(-1)
  const queue = new Int32Array(width * height)
  const blobs = []
  for (let start = 0; start < width * height; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < alphaMin) continue
    const id = blobs.length
    let head = 0
    let tail = 0
    queue[tail++] = start
    label[start] = id
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let area = 0
    while (head < tail) {
      const p = queue[head++]
      const x = p % width
      const y = (p - x) / width
      area += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const q = ny * width + nx
          if (label[q] === -1 && data[q * 4 + 3] >= alphaMin) {
            label[q] = id
            queue[tail++] = q
          }
        }
      }
    }
    blobs.push({ ids: [id], minX, minY, maxX, maxY, area })
  }
  // Drop specks, then merge fragments that touch or nearly touch (a king's cross, a queen's beads).
  const minArea = width * height * 0.0004
  let list = blobs.filter((b) => b.area >= minArea)
  const gap = Math.max(2, Math.round(Math.min(width, height) * 0.006))
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
        const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
        // Stacked parts of one piece overlap horizontally and nearly touch vertically.
        if (overlapX > Math.min(a.maxX - a.minX, b.maxX - b.minX) * 0.3 && overlapY > -gap) {
          list[i] = { ids: [...a.ids, ...b.ids], minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY), area: a.area + b.area }
          list.splice(j, 1)
          merged = true
          break outer
        }
      }
    }
  }
  // Fragments far smaller than a real piece (sparkles, text) are not pieces.
  const biggest = Math.max(0, ...list.map((b) => b.area))
  list = list.filter((b) => b.area >= biggest * 0.06)
  return { blobs: list, label }
}

// ── Recognising pieces ──────────────────────────────────────────────────────

/** Silhouette features of one blob: size, brightness, lopsidedness, top width. */
export function features(img, blob, label) {
  const { width, data } = img
  const w = blob.maxX - blob.minX + 1
  const h = blob.maxY - blob.minY + 1
  const ids = new Set(blob.ids)
  let lum = 0
  let n = 0
  let asym = 0
  let asymN = 0
  const rowWidth = new Int32Array(h)
  for (let y = blob.minY; y <= blob.maxY; y++) {
    let left = -1
    let right = -1
    for (let x = blob.minX; x <= blob.maxX; x++) {
      const p = y * width + x
      if (!ids.has(label[p])) continue
      const i = p * 4
      lum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      n += 1
      if (left < 0) left = x
      right = x
      // Mirror test around the blob's centre line.
      const mx = blob.minX + blob.maxX - x
      asymN += 1
      if (!ids.has(label[y * width + mx])) asym += 1
    }
    if (left >= 0) rowWidth[y - blob.minY] = right - left + 1
  }
  const maxRow = Math.max(1, ...rowWidth)
  // Width of the upper part of the piece (crown / battlements / mitre / head).
  const band = (from, to) => {
    let m = 0
    for (let r = Math.floor(h * from); r < Math.max(Math.floor(h * from) + 1, Math.floor(h * to)); r++) m = Math.max(m, rowWidth[r] ?? 0)
    return m / maxRow
  }
  return { w, h, area: n, lum: n ? lum / n : 0, asym: asymN ? asym / asymN : 0, topWidth: band(0, 0.12), headWidth: band(0.1, 0.35) }
}

const TYPES = ['K', 'Q', 'R', 'B', 'N', 'P']

/** Every ordering of 0…n-1 (6! = 720 for one army — cheap to try them all). */
function permutations(n) {
  if (n <= 1) return [[0]]
  const out = []
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)])
  return out
}

/**
 * Assigns the 6 piece types of one army from their silhouettes. `feats` are in
 * the sheet's reading order; `order` is the order the sheet was asked to use
 * (K Q R B N P), which only breaks near-ties. Returns { type → index } and how
 * sure it is, or null unless there are exactly 6 pieces.
 */
export function recognise(feats, order = 'KQRBNP') {
  if (feats.length !== 6) return null
  // Each feature scaled 0…1 within the army (all 0.5 when they barely differ).
  const scale = (key, minSpread) => {
    const v = feats.map((f) => f[key])
    const lo = Math.min(...v)
    const hi = Math.max(...v)
    return v.map((x) => (hi - lo > Math.abs(hi) * minSpread ? (x - lo) / (hi - lo) : 0.5))
  }
  const H = scale('h', 0.08)
  const A = scale('area', 0.1)
  const asym = scale('asym', 0.5)
  const top = scale('topWidth', 0.15)
  const head = scale('headWidth', 0.15)
  const wide = feats.map((f) => f.w / f.h)
  const lo = Math.min(...wide)
  const hi = Math.max(...wide)
  const W = wide.map((x) => (hi - lo > 0.05 ? (x - lo) / (hi - lo) : 0.5))
  /** How much piece i looks like each type. */
  const fit = (i, t) => {
    switch (t) {
      case 'K': return 2 * H[i] + (1 - top[i]) + head[i] + W[i] * 0.5 // tallest, a narrow cross over a broad crown
      case 'Q': return 1.5 * (1 - Math.abs(H[i] - 0.85) * 2) + (1 - Math.abs(top[i] - 0.6) * 1.5) + head[i] // tall, spiky crown
      case 'R': return 2.5 * top[i] + (1 - asym[i]) // flat, wide battlements
      case 'B': return (1 - top[i]) + 1.5 * (1 - head[i]) + (1 - W[i]) + 0.5 * (1 - asym[i]) // pointed mitre, slim
      case 'N': return 4 * asym[i] // the only lopsided piece
      default: return 2 * (1 - H[i]) + (1 - A[i]) + (1 - head[i]) // smallest, a small round head
    }
  }
  let best = null
  let bestScore = -Infinity
  for (const perm of permutations(6)) {
    // perm[k] = which piece gets type TYPES[k]
    let score = 0
    for (let k = 0; k < 6; k++) {
      score += fit(perm[k], TYPES[k])
      if (order[perm[k]] === TYPES[k]) score += 0.35 // the sheet's own order wins near-ties
    }
    if (score > bestScore) {
      bestScore = score
      best = perm
    }
  }
  if (!best) return null
  const result = {}
  TYPES.forEach((t, k) => (result[t] = best[k]))
  return result
}

/** Reading order fallback: rows top → bottom, then left → right; first half White. */
function spatialOrder(blobs) {
  const sorted = [...blobs.keys()].sort((a, b) => blobs[a].minY + blobs[a].maxY - (blobs[b].minY + blobs[b].maxY))
  const rows = []
  for (const i of sorted) {
    const b = blobs[i]
    const cy = (b.minY + b.maxY) / 2
    const row = rows.find((r) => Math.abs(r.cy - cy) < (b.maxY - b.minY) * 0.5)
    if (row) row.items.push(i)
    else rows.push({ cy, items: [i] })
  }
  return rows.flatMap((r) => r.items.sort((a, b) => blobs[a].minX - blobs[b].minX))
}

/**
 * Slices a sprite sheet image into the 12 pieces. Returns
 * { pieces: { wK: img, … }, method, note } or { error } when it can't.
 */
export function sliceSheet(img, { order = 'KQRBNP' } = {}) {
  const key = keyBackground(img)
  if (key.keyed < 0.15) return { error: 'no background to remove (this looks like a board or a picture, not a sheet of pieces)' }
  const { blobs, label } = findBlobs(img)
  if (blobs.length < 12) return { error: `found ${blobs.length} pieces, need 12` }
  // A full 32-piece sheet (or extra decorations): keep the 12 biggest silhouettes… only when that is exact.
  let pool = [...blobs.keys()]
  if (pool.length > 12) pool = pool.sort((a, b) => blobs[b].area - blobs[a].area).slice(0, 12)
  const seq = spatialOrder(blobs).filter((i) => pool.includes(i))
  const feats = blobs.map((b) => features(img, b, label))
  // Armies by brightness: the darker six are Black (each kept in reading order).
  const byLum = [...seq].sort((a, b) => feats[a].lum - feats[b].lum)
  const dark = new Set(byLum.slice(0, 6))
  const gapLum = feats[byLum[6]].lum - feats[byLum[5]].lum
  const armies = gapLum > 25 ? { w: seq.filter((i) => !dark.has(i)), b: seq.filter((i) => dark.has(i)) } : { w: seq.slice(0, 6), b: seq.slice(6) }
  const chosen = {}
  for (const color of ['w', 'b']) {
    const ids = armies[color]
    const map = recognise(ids.map((i) => feats[i]), order)
    if (!map) return { error: 'could not split the pieces into two armies of six' }
    for (const t of TYPES) chosen[`${color}${t}`] = ids[map[t]]
  }
  const method = gapLum > 25 ? 'silhouette and colour' : 'silhouette and sheet order'
  // One canvas size for the whole set: pieces keep their relative heights.
  const used = Object.values(chosen).map((i) => blobs[i])
  const maxW = Math.max(...used.map((b) => b.maxX - b.minX + 1))
  const maxH = Math.max(...used.map((b) => b.maxY - b.minY + 1))
  const size = Math.ceil(Math.max(maxW, maxH) * 1.1)
  const pieces = {}
  for (const [code, i] of Object.entries(chosen)) {
    const b = blobs[i]
    const ids = new Set(b.ids)
    const out = new Uint8ClampedArray(size * size * 4)
    const w = b.maxX - b.minX + 1
    const h = b.maxY - b.minY + 1
    const ox = Math.floor((size - w) / 2)
    const oy = size - h - Math.floor(size * 0.04)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = b.minX + x
        const sy = b.minY + y
        const p = sy * img.width + sx
        // Keep this blob's pixels plus the soft (low-alpha) edge pixels next to it.
        if (!ids.has(label[p]) && img.data[p * 4 + 3] >= 128) continue
        const si = p * 4
        const di = ((oy + y) * size + (ox + x)) * 4
        out[di] = img.data[si]
        out[di + 1] = img.data[si + 1]
        out[di + 2] = img.data[si + 2]
        out[di + 3] = img.data[si + 3]
      }
    }
    pieces[code] = { width: size, height: size, data: out }
  }
  return { pieces, method, note: `${blobs.length} pieces found on a ${key.background} background, matched by ${method}` }
}
