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
  // Share of the border where channel c beats both others clearly (a lit or vignetted screen still counts).
  m.dominated = (c) => samples.filter((s) => s[c] - Math.max(...[0, 1, 2].filter((k) => k !== c).map((k) => s[k])) > 50).length / samples.length
  return m
}

/**
 * Makes the background transparent.
 *  - A green / blue / red screen is keyed everywhere by "how much that channel
 *    sticks out" (so gaps inside a crown clear too), its soft drop-shadow goes
 *    with it, and the colour spill is removed from the piece edges.
 *  - Any other flat colour (white, grey, beige …) is removed only where it is
 *    connected to the border (flood fill), so a white piece on a white
 *    background keeps its inside.
 */
export function keyBackground(img) {
  const { width, height, data } = img
  const border = borderColor(img)
  const [br, bg, bb, ba] = border
  if (ba < 32) {
    // Already transparent: nothing to key, the pieces are ready to cut.
    let clear = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] < 128) clear += 1
    return { keyed: clear / (data.length / 4), background: 'transparent' }
  }
  const chans = [br, bg, bb]
  const max = Math.max(...chans)
  const dominant = chans.indexOf(max)
  const others = [0, 1, 2].filter((c) => c !== dominant)
  // A screen: the border is mostly one strongly dominant channel (lighting gradients allowed).
  const screen = max - Math.max(chans[others[0]], chans[others[1]]) > 70 && border.dominated(dominant) >= 0.7
  let keyed = 0
  if (screen) {
    for (let i = 0; i < data.length; i += 4) {
      const d = data[i + dominant]
      const o = Math.max(data[i + others[0]], data[i + others[1]])
      const k = d - o
      const alpha = k <= 20 ? 1 : k >= 60 ? 0 : 1 - (k - 20) / 40
      // Spill suppression: the screen colour may not exceed the other channels on the piece.
      if (alpha > 0 && d > o) data[i + dominant] = o + Math.max(0, (d - o) * (1 - alpha) * 0.2)
      const a = Math.round(data[i + 3] * alpha)
      if (a < 255) keyed += 1
      data[i + 3] = a
    }
    return { keyed: keyed / (width * height), background: ['red', 'green', 'blue'][dominant] }
  }
  // A border of many colours (a board, a scene) has no background to remove.
  if (border.uniform < 0.7) return { keyed: 0, background: 'none' }
  const dist = (p) => Math.abs(data[p * 4] - br) + Math.abs(data[p * 4 + 1] - bg) + Math.abs(data[p * 4 + 2] - bb)
  const seen = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  const push = (p) => {
    if (seen[p] || dist(p) > 60) return
    seen[p] = 1
    queue[tail++] = p
  }
  for (let x = 0; x < width; x++) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (head < tail) {
    const p = queue[head++]
    const x = p % width
    if (x > 0) push(p - 1)
    if (x < width - 1) push(p + 1)
    if (p >= width) push(p - width)
    if (p < width * (height - 1)) push(p + width)
  }
  for (let p = 0; p < width * height; p++) {
    if (!seen[p]) continue
    const d = dist(p)
    const alpha = d <= 25 ? 0 : (d - 25) / 35
    data[p * 4 + 3] = Math.round(data[p * 4 + 3] * alpha)
    keyed += 1
  }
  return { keyed: keyed / (width * height), background: 'flat' }
}

// ── Finding pieces ──────────────────────────────────────────────────────────

const boxOf = (blobs) => ({
  minX: Math.min(...blobs.map((b) => b.minX)),
  minY: Math.min(...blobs.map((b) => b.minY)),
  maxX: Math.max(...blobs.map((b) => b.maxX)),
  maxY: Math.max(...blobs.map((b) => b.maxY)),
  area: blobs.reduce((s, b) => s + b.area, 0),
})

/** Recomputes a blob's box and area from the pixels it owns. */
function refit(img, owner, blob) {
  let minX = img.width
  let minY = img.height
  let maxX = -1
  let maxY = -1
  let area = 0
  for (let y = blob.minY; y <= blob.maxY; y++) {
    for (let x = blob.minX; x <= blob.maxX; x++) {
      if (owner[y * img.width + x] !== blob.id) continue
      area += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  Object.assign(blob, { minX, minY, maxX, maxY, area })
}

/**
 * Cuts a blob that holds two (or more) touching pieces in two, at the
 * thinnest point of its silhouette (between two pieces' bases or bodies).
 * `axis` 'x' cuts with a vertical line, 'y' with a horizontal one.
 */
function splitBlob(img, owner, blob, nextId, axis) {
  const { width } = img
  const lo = axis === 'x' ? blob.minX : blob.minY
  const hi = axis === 'x' ? blob.maxX : blob.maxY
  const profile = new Float64Array(hi - lo + 1)
  for (let y = blob.minY; y <= blob.maxY; y++) {
    for (let x = blob.minX; x <= blob.maxX; x++) if (owner[y * width + x] === blob.id) profile[(axis === 'x' ? x : y) - lo] += 1
  }
  // The thinnest (smoothed) slice in the middle half — that is where two pieces meet.
  const n = profile.length
  const r = Math.max(1, Math.round(n * 0.01))
  let cut = -1
  let best = Infinity
  for (let i = Math.floor(n * 0.2); i <= Math.ceil(n * 0.8); i++) {
    let s = 0
    for (let k = -r; k <= r; k++) s += profile[Math.min(n - 1, Math.max(0, i + k))]
    // Prefer cuts nearer the middle when equally thin.
    s *= 1 + Math.abs(i / n - 0.5) * 0.3
    if (s < best) {
      best = s
      cut = i
    }
  }
  if (cut < 0) return null
  const part = { ...blob, id: nextId }
  for (let y = blob.minY; y <= blob.maxY; y++) {
    for (let x = blob.minX; x <= blob.maxX; x++) {
      const p = y * width + x
      if (owner[p] === blob.id && (axis === 'x' ? x : y) - lo > cut) owner[p] = nextId
    }
  }
  refit(img, owner, blob)
  refit(img, owner, part)
  return part.area > 0 && blob.area > 0 ? part : null
}

/**
 * Cuts a row of k touching pieces into k, each cut at the thinnest column
 * near where an evenly spaced cut would fall. Returns the new parts.
 */
function splitBlobInto(img, owner, blob, k, nextId) {
  const { width } = img
  const w = blob.maxX - blob.minX + 1
  const profile = new Float64Array(w)
  for (let y = blob.minY; y <= blob.maxY; y++) for (let x = blob.minX; x <= blob.maxX; x++) if (owner[y * width + x] === blob.id) profile[x - blob.minX] += 1
  const r = Math.max(1, Math.round(w * 0.005))
  const smooth = (i) => {
    let s = 0
    for (let d = -r; d <= r; d++) s += profile[Math.min(w - 1, Math.max(0, i + d))]
    return s
  }
  const cuts = []
  for (let j = 1; j < k; j++) {
    const ideal = (j * w) / k
    const reach = (w / k) * 0.35
    let best = Math.round(ideal)
    let bestScore = Infinity
    for (let i = Math.max(1, Math.round(ideal - reach)); i <= Math.min(w - 2, Math.round(ideal + reach)); i++) {
      const score = smooth(i) * (1 + (Math.abs(i - ideal) / reach) * 0.25)
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    }
    cuts.push(best)
  }
  const parts = cuts.map((_, j) => ({ ...blob, id: nextId + j }))
  for (let y = blob.minY; y <= blob.maxY; y++) {
    for (let x = blob.minX; x <= blob.maxX; x++) {
      const p = y * width + x
      if (owner[p] !== blob.id) continue
      const slot = cuts.filter((c) => x - blob.minX > c).length
      if (slot > 0) owner[p] = nextId + slot - 1
    }
  }
  refit(img, owner, blob)
  for (const part of parts) refit(img, owner, part)
  return parts.filter((part) => part.area > 0)
}

/**
 * How many pieces each blob holds, so that they add up to `expect`: the piece
 * width that explains every blob's width best (a clump of 3 is ~3 pieces wide).
 */
function piecesPerBlob(blobs, expect) {
  const widths = blobs.map((b) => b.maxX - b.minX + 1)
  let best = null
  let bestErr = Infinity
  for (const wb of widths) {
    for (let k = 1; k <= expect; k++) {
      const unit = wb / k
      const counts = widths.map((x) => Math.max(1, Math.round(x / unit)))
      if (counts.reduce((a, b) => a + b, 0) !== expect) continue
      const err = widths.reduce((e, x, i) => e + (x / unit - counts[i]) ** 2, 0)
      if (err < bestErr) {
        bestErr = err
        best = counts
      }
    }
  }
  return best
}

const median = (v) => [...v].sort((a, b) => a - b)[v.length >> 1] ?? 0

/**
 * Finds the pieces: connected opaque blobs (8-neighbour); detached bits of a
 * piece (a king's cross, a queen's beads) are joined to it, specks and text
 * dropped, and pieces that touch each other are cut apart until there are
 * `expect` of them. Returns { blobs: [{ id, minX … maxY, area }], owner }
 * where owner[pixel] is the id of the blob it belongs to (or -1).
 */
export function findBlobs(img, { alphaMin = 128, expect = 12 } = {}) {
  const { width, height, data } = img
  const label = new Int32Array(width * height).fill(-1)
  const queue = new Int32Array(width * height)
  const comps = []
  for (let start = 0; start < width * height; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < alphaMin) continue
    const id = comps.length
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
    comps.push({ comps: [id], minX, minY, maxX, maxY, area })
  }
  // Drop specks, then attach small fragments to the piece they sit on or under.
  let list = comps.filter((b) => b.area >= width * height * 0.0002)
  const gap = Math.max(2, Math.round(Math.min(width, height) * 0.01))
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue
        const big = list[i]
        const frag = list[j]
        // Only a fragment (much smaller) is attached — two real pieces are never glued together.
        if (frag.area > big.area * 0.35) continue
        const overlapX = Math.min(big.maxX, frag.maxX) - Math.max(big.minX, frag.minX)
        const overlapY = Math.min(big.maxY, frag.maxY) - Math.max(big.minY, frag.minY)
        if (overlapX > (frag.maxX - frag.minX) * 0.5 && overlapY > -gap) {
          list[i] = { comps: [...big.comps, ...frag.comps], ...boxOf([big, frag]) }
          list.splice(j, 1)
          merged = true
          break outer
        }
      }
    }
  }
  // Sparkles, captions and stray marks are far smaller than the real pieces.
  const typical = median([...list].sort((a, b) => b.area - a.area).slice(0, expect).map((b) => b.area))
  list = list.filter((b) => b.area >= typical * 0.15)
  const owner = new Int32Array(width * height).fill(-1)
  const blobs = list.map((b, id) => {
    const set = new Set(b.comps)
    for (let y = b.minY; y <= b.maxY; y++) for (let x = b.minX; x <= b.maxX; x++) if (set.has(label[y * width + x])) owner[y * width + x] = id
    return { id, minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, area: b.area }
  })
  // Rows that touch: a blob about twice as tall as the others is two pieces stacked — cut it across.
  for (const b of [...blobs]) {
    const medH = median(blobs.map((o) => o.maxY - o.minY + 1))
    if (blobs.length < expect && (b.maxY - b.minY + 1) > medH * 1.6) {
      const part = splitBlob(img, owner, b, blobs.length, 'y')
      if (part) blobs.push(part)
    }
  }
  // Pieces that touch side by side: share the missing pieces out by width and cut each clump.
  if (blobs.length < expect) {
    const counts = piecesPerBlob(blobs, expect)
    if (counts) for (const [i, b] of [...blobs].entries()) if ((counts[i] ?? 1) > 1) blobs.push(...splitBlobInto(img, owner, b, counts[i], blobs.length))
  }
  // Anything still missing: cut the widest / tallest blob at its thinnest point.
  for (let guard = 0; blobs.length < expect && guard < expect * 2; guard++) {
    const medW = median(blobs.map((b) => b.maxX - b.minX + 1))
    const medH = median(blobs.map((b) => b.maxY - b.minY + 1))
    let pick = null
    let pickScore = 0
    let axis = 'x'
    for (const b of blobs) {
      // A single chess piece is taller than it is wide; a pair side by side is not.
      const sx = (b.maxX - b.minX + 1) / medW + (b.maxX - b.minX + 1) / (b.maxY - b.minY + 1)
      const sy = ((b.maxY - b.minY + 1) / medH) * 1.1
      const s = Math.max(sx, sy)
      if (s > pickScore) {
        pickScore = s
        pick = b
        axis = sx >= sy ? 'x' : 'y'
      }
    }
    if (!pick) break
    const part = splitBlob(img, owner, pick, blobs.length, axis)
    if (!part) break
    blobs.push(part)
  }
  return { blobs, owner }
}

// ── Recognising pieces ──────────────────────────────────────────────────────

/** Silhouette features of one blob: size, brightness, lopsidedness, top width. */
export function features(img, blob, owner) {
  const { width, data } = img
  const w = blob.maxX - blob.minX + 1
  const h = blob.maxY - blob.minY + 1
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
      if (owner[p] !== blob.id) continue
      const i = p * 4
      lum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      n += 1
      if (left < 0) left = x
      right = x
      // Mirror test around the blob's centre line.
      const mx = blob.minX + blob.maxX - x
      asymN += 1
      if (owner[y * width + mx] !== blob.id) asym += 1
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
  // Pieces drawn all the same height lose the strongest clue (pawn short, king tall): trust the order more.
  const prior = H.every((x) => x === 0.5) ? 1 : 0.35
  let best = null
  let bestScore = -Infinity
  for (const perm of permutations(6)) {
    // perm[k] = which piece gets type TYPES[k]
    let score = 0
    for (let k = 0; k < 6; k++) {
      score += fit(perm[k], TYPES[k])
      if (order[perm[k]] === TYPES[k]) score += prior // the sheet's own order wins near-ties
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
  const { blobs, owner } = findBlobs(img)
  if (blobs.length < 12) return { error: `found ${blobs.length} pieces, need 12` }
  // A full 32-piece sheet (or extra decorations): keep the 12 biggest silhouettes… only when that is exact.
  let pool = [...blobs.keys()]
  if (pool.length > 12) pool = pool.sort((a, b) => blobs[b].area - blobs[a].area).slice(0, 12)
  const seq = spatialOrder(blobs).filter((i) => pool.includes(i))
  const feats = blobs.map((b) => features(img, b, owner))
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
  // One canvas for the whole set, as tall as the tallest piece, so every piece stands on one floor.
  // Smaller pieces are enlarged towards it — still smaller than the king, but big enough to
  // read on a phone (a pawn half a king's height ends up at ~3/4).
  const used = Object.values(chosen).map((i) => blobs[i])
  const pad = Math.max(1, Math.round(Math.min(img.width, img.height) * 0.003))
  const maxH = Math.max(...used.map((b) => b.maxY - b.minY + 1)) + pad * 2
  const plans = Object.entries(chosen).map(([code, i]) => {
    const b = blobs[i]
    const w = b.maxX - b.minX + 1 + pad * 2
    const h = b.maxY - b.minY + 1 + pad * 2
    const scale = (maxH * (0.5 + 0.5 * (h / maxH))) / h
    return { code, b, w, h, scale }
  })
  const size = Math.ceil(Math.max(maxH * 1.02, ...plans.map((q) => q.w * q.scale)))
  const pieces = {}
  for (const { code, b, w, h, scale } of plans) {
    // The piece alone (premultiplied, so its soft rim scales cleanly): its own pixels plus its anti-aliased edge.
    const crop = new Float32Array(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = b.minX - pad + x
        const sy = b.minY - pad + y
        if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue
        const p = sy * img.width + sx
        if (owner[p] !== b.id && (owner[p] !== -1 || img.data[p * 4 + 3] >= 128)) continue
        const al = img.data[p * 4 + 3] / 255
        const o = (y * w + x) * 4
        crop[o] = img.data[p * 4] * al
        crop[o + 1] = img.data[p * 4 + 1] * al
        crop[o + 2] = img.data[p * 4 + 2] * al
        crop[o + 3] = al
      }
    }
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const ox = Math.floor((size - tw) / 2)
    const oy = size - th - Math.floor(size * 0.01)
    const out = new Uint8ClampedArray(size * size * 4)
    const at = (x, y, c) => crop[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + c]
    for (let y = 0; y < th; y++) {
      const fy = Math.max(0, (y + 0.5) / scale - 0.5)
      const y0 = Math.floor(fy)
      const dy = fy - y0
      for (let x = 0; x < tw; x++) {
        const fx = Math.max(0, (x + 0.5) / scale - 0.5)
        const x0 = Math.floor(fx)
        const dx = fx - x0
        const px = [0, 0, 0, 0]
        for (let c = 0; c < 4; c++) {
          px[c] = (at(x0, y0, c) * (1 - dx) + at(x0 + 1, y0, c) * dx) * (1 - dy) + (at(x0, y0 + 1, c) * (1 - dx) + at(x0 + 1, y0 + 1, c) * dx) * dy
        }
        const di = ((oy + y) * size + (ox + x)) * 4
        if (px[3] <= 0) continue
        out[di] = px[0] / px[3]
        out[di + 1] = px[1] / px[3]
        out[di + 2] = px[2] / px[3]
        out[di + 3] = px[3] * 255
      }
    }
    pieces[code] = { width: size, height: size, data: out }
  }
  return { pieces, method, note: `${blobs.length} pieces found on a ${key.background} background, matched by ${method}` }
}
