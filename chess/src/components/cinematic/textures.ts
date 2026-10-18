// Procedural textures for the intro, painted once into offscreen canvases:
// a varnished maple & walnut board with real wood grain, the obsidian & lava
// realm board (plus its emissive lava map for bloom), and lit piece sprites.
// No image assets — everything is generated from seeded value noise.
import type { PieceColor, PieceType } from './timeline'

/** World size covered by a board texture: 8 squares plus a 0.45-square frame. */
export const BOARD_EXTENT = 8.9
export const FRAME = 0.45

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D canvas is unavailable')
  return ctx
}

// ── Seeded value noise ──────────────────────────────────────────────────────

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const smooth = (t: number): number => t * t * (3 - 2 * t)

export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
}

const fbm = (x: number, y: number, seed: number): number =>
  valueNoise(x, y, seed) * 0.6 + valueNoise(x * 2.1, y * 2.1, seed + 7) * 0.28 + valueNoise(x * 4.3, y * 4.3, seed + 13) * 0.12

// ── Boards ──────────────────────────────────────────────────────────────────

type Rgb = readonly [number, number, number]
const MAPLE: Rgb = [226, 192, 140]
const MAPLE_DARK: Rgb = [188, 146, 92]
const WALNUT: Rgb = [112, 70, 40]
const WALNUT_DARK: Rgb = [66, 38, 20]
const FRAME_WOOD: Rgb = [58, 32, 18]
const FRAME_DARK: Rgb = [30, 16, 8]

/** Which region of the texture a pixel falls in: frame, or the square (file, rank) it belongs to. */
function cellAt(px: number, py: number, size: number): { frame: boolean; file: number; rank: number; u: number; v: number } {
  const wx = (px / size) * BOARD_EXTENT - FRAME
  const wy = (py / size) * BOARD_EXTENT - FRAME
  const frame = wx < 0 || wy < 0 || wx >= 8 || wy >= 8
  const file = Math.floor(wx)
  // Texture row 0 is the far edge (rank 8).
  const rank = 7 - Math.floor(wy)
  return { frame, file, rank, u: wx - file, v: wy - Math.floor(wy) }
}

const mix = (a: Rgb, b: Rgb, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Varnished maple / walnut board: growth rings warped by noise, grain direction alternating per square. */
export function classicBoardTexture(size: number): HTMLCanvasElement {
  const c = makeCanvas(size, size)
  const ctx = context(c)
  const img = ctx.createImageData(size, size)
  const data = img.data
  const scale = BOARD_EXTENT / size
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const cell = cellAt(px, py, size)
      const wx = px * scale
      const wy = py * scale
      let rgb: [number, number, number]
      if (cell.frame) {
        // Frame: dark walnut whose grain runs along each edge, darker toward the outside.
        const bx = wx - FRAME
        const by = wy - FRAME
        const side = bx < 0 || bx >= 8
        const g = side ? fbm(wx * 9, wy * 0.6, 3) : fbm(wx * 0.6, wy * 9, 3)
        const rings = 0.5 + 0.5 * Math.sin((side ? wx : wy) * 38 + g * 5)
        const edge = Math.min(Math.abs(bx < 0 ? bx : bx - 8), Math.abs(by < 0 ? by : by - 8))
        const outer = side ? Math.min(1, Math.abs(bx < 0 ? bx + FRAME : bx - 8 - FRAME) / FRAME) : Math.min(1, Math.abs(by < 0 ? by + FRAME : by - 8 - FRAME) / FRAME)
        rgb = mix(FRAME_DARK, FRAME_WOOD, (0.3 + rings * 0.35 + g * 0.2) * (0.55 + 0.45 * outer) + (edge < 0.05 ? 0.2 : 0))
      } else {
        const light = (cell.file + cell.rank) % 2 === 1
        const seed = cell.file * 17 + cell.rank * 31
        // Alternate grain direction like a hand-made board.
        const along = (cell.file + cell.rank) % 4 < 2
        const a = along ? cell.u : cell.v
        const b = along ? cell.v : cell.u
        const warp = fbm(a * 2.4, b * 0.7, seed) * 2.6
        const rings = 0.5 + 0.5 * Math.sin((b * 22 + warp * 6) * (light ? 1 : 1.25))
        const fine = valueNoise(a * 3, b * 140, seed + 5)
        const t = Math.min(1, rings * 0.55 + fine * 0.35 + warp * 0.08)
        rgb = light ? mix(MAPLE, MAPLE_DARK, t) : mix(WALNUT, WALNUT_DARK, t)
      }
      const i = (py * size + px) * 4
      data[i] = rgb[0]
      data[i + 1] = rgb[1]
      data[i + 2] = rgb[2]
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const cell = size / BOARD_EXTENT
  const inset = FRAME * cell
  // Brass inlay around the playing surface and fine joints between squares.
  ctx.strokeStyle = 'rgba(214,170,90,0.85)'
  ctx.lineWidth = Math.max(1.5, cell * 0.035)
  ctx.strokeRect(inset - cell * 0.06, inset - cell * 0.06, cell * 8 + cell * 0.12, cell * 8 + cell * 0.12)
  ctx.strokeStyle = 'rgba(30,16,8,0.35)'
  ctx.lineWidth = 1
  for (let i = 1; i < 8; i++) {
    ctx.beginPath()
    ctx.moveTo(inset + i * cell, inset)
    ctx.lineTo(inset + i * cell, inset + 8 * cell)
    ctx.moveTo(inset, inset + i * cell)
    ctx.lineTo(inset + 8 * cell, inset + i * cell)
    ctx.stroke()
  }
  // Varnish: a soft sheen across the surface.
  const sheen = ctx.createLinearGradient(0, 0, size, size)
  sheen.addColorStop(0, 'rgba(255,240,210,0.10)')
  sheen.addColorStop(0.5, 'rgba(255,240,210,0)')
  sheen.addColorStop(1, 'rgba(0,0,0,0.12)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, size, size)
  return c
}

/**
 * The Chronos realm board: glossy obsidian and cracked basalt squares with
 * lava seams. Returns the colour texture and an emissive map (lava only)
 * used for bloom and the pulsing glow.
 */
export function realmBoardTextures(size: number): { color: HTMLCanvasElement; emissive: HTMLCanvasElement } {
  const color = makeCanvas(size, size)
  const emissive = makeCanvas(size, size)
  const ctx = context(color)
  const ectx = context(emissive)
  const img = ctx.createImageData(size, size)
  const glow = ectx.createImageData(size, size)
  const data = img.data
  const gdata = glow.data
  const scale = BOARD_EXTENT / size
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const cell = cellAt(px, py, size)
      const wx = px * scale
      const wy = py * scale
      const n = fbm(wx * 1.6, wy * 1.6, 41)
      const ridge = 1 - Math.abs(fbm(wx * 2.2, wy * 2.2, 77) * 2 - 1)
      let rgb: [number, number, number]
      let lava = 0
      if (cell.frame) {
        rgb = mix([14, 10, 16], [40, 22, 30], n)
        lava = ridge > 0.965 ? (ridge - 0.965) / 0.035 : 0
      } else if ((cell.file + cell.rank) % 2 === 1) {
        // Cracked basalt with lava seams.
        rgb = mix([62, 40, 36], [96, 62, 50], n)
        lava = ridge > 0.9 ? (ridge - 0.9) / 0.1 : 0
      } else {
        // Polished obsidian with violet sheen veins.
        const vein = ridge > 0.94 ? (ridge - 0.94) / 0.06 : 0
        rgb = mix([12, 10, 18], [34, 24, 52], n * 0.6 + vein * 0.8)
      }
      const i = (py * size + px) * 4
      const hot = Math.min(1, lava * 1.4)
      data[i] = rgb[0] + (255 - rgb[0]) * hot
      data[i + 1] = rgb[1] + (140 - rgb[1]) * hot * hot
      data[i + 2] = rgb[2] * (1 - hot)
      data[i + 3] = 255
      gdata[i] = 255
      gdata[i + 1] = 90 + 120 * hot
      gdata[i + 2] = 20
      gdata[i + 3] = Math.round(255 * Math.min(1, lava * 1.8))
    }
  }
  ctx.putImageData(img, 0, 0)
  ectx.putImageData(glow, 0, 0)
  // Rune-etched frame: glowing glyphs along each edge.
  const cell = size / BOARD_EXTENT
  const inset = FRAME * cell
  ectx.fillStyle = 'rgba(120,200,255,0.9)'
  ectx.font = `${Math.round(cell * 0.32)}px serif`
  ectx.textAlign = 'center'
  ectx.textBaseline = 'middle'
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'
  for (let i = 0; i < 16; i++) {
    const r = runes[i % runes.length] ?? 'ᚠ'
    const along = inset + (i + 0.5) * (cell / 2)
    ectx.fillText(r, along, inset / 2)
    ectx.fillText(r, along, size - inset / 2)
    ectx.fillText(r, inset / 2, along)
    ectx.fillText(r, size - inset / 2, along)
  }
  ctx.drawImage(emissive, 0, 0)
  return { color, emissive }
}

// ── Piece sprites ───────────────────────────────────────────────────────────

/** Relative piece heights (world units) — the king towers, pawns are squat. */
export const PIECE_HEIGHT: Readonly<Record<PieceType, number>> = { k: 1.12, q: 1.02, b: 0.9, n: 0.86, r: 0.76, p: 0.66 }

const GLYPH: Readonly<Record<PieceType, string>> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
/** Text presentation selector: keeps ♟ from rendering as an emoji on phones. */
const TEXT_VS = '︎'

export type SpriteStyle = 'classic' | 'realm'
export const SPRITE_SIZE = 160

/**
 * A lit piece sprite: bevel shadow, material gradient (ivory / ebony, or
 * radiant crystal / obsidian), specular highlight and — in the realm — an
 * emissive rune glow.
 */
export function pieceSprite(type: PieceType, color: PieceColor, style: SpriteStyle): HTMLCanvasElement {
  const s = SPRITE_SIZE
  const c = makeCanvas(s, s)
  const ctx = context(c)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${Math.round(s * 0.92)}px "Segoe UI Symbol", "Noto Sans Symbols 2", "Apple Symbols", "DejaVu Sans", serif`
  const glyph = GLYPH[type] + TEXT_VS
  const baseY = s * 0.94

  if (style === 'realm') {
    ctx.shadowColor = color === 'w' ? 'rgba(110,220,255,0.95)' : 'rgba(255,70,30,0.95)'
    ctx.shadowBlur = s * 0.12
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = s * 0.05
    ctx.shadowOffsetX = s * 0.02
    ctx.shadowOffsetY = s * 0.03
  }
  const fill = ctx.createLinearGradient(s * 0.2, 0, s * 0.8, s)
  if (style === 'classic') {
    if (color === 'w') {
      fill.addColorStop(0, '#fff8e8')
      fill.addColorStop(0.55, '#ead6ae')
      fill.addColorStop(1, '#b8986a')
    } else {
      fill.addColorStop(0, '#5a3a26')
      fill.addColorStop(0.5, '#2a170c')
      fill.addColorStop(1, '#120904')
    }
  } else if (color === 'w') {
    fill.addColorStop(0, '#ffffff')
    fill.addColorStop(0.45, '#bdefff')
    fill.addColorStop(1, '#e9c46a')
  } else {
    fill.addColorStop(0, '#3b2a4a')
    fill.addColorStop(0.5, '#120a16')
    fill.addColorStop(1, '#ff5a1f')
  }
  ctx.fillStyle = fill
  ctx.fillText(glyph, s / 2, baseY)
  ctx.shadowColor = 'transparent'

  // Specular highlight from the key light (top-left), clipped to the piece.
  ctx.globalCompositeOperation = 'source-atop'
  const spec = ctx.createRadialGradient(s * 0.36, s * 0.3, 0, s * 0.36, s * 0.3, s * 0.45)
  spec.addColorStop(0, style === 'realm' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.45)')
  spec.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = spec
  ctx.fillRect(0, 0, s, s)
  // Rim light on the shadow side.
  const rim = ctx.createLinearGradient(s, 0, s * 0.55, 0)
  rim.addColorStop(0, style === 'realm' ? (color === 'w' ? 'rgba(120,220,255,0.6)' : 'rgba(255,90,30,0.6)') : 'rgba(255,200,140,0.18)')
  rim.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, s, s)
  ctx.globalCompositeOperation = 'source-over'
  return c
}
