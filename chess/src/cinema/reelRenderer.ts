// Draws one frame of a highlight reel on a 2D canvas (preview and video
// export use the same code). The board, pieces and captions are all drawn
// here, so the recording never depends on the page's DOM.
import { type Moment, type ReelFrame, type ReelInfo, reelFrame } from './highlights'
import { focusPoint } from './director'

export interface ReelLook {
  light: string
  dark: string
  accent: string
  /** The board's own pieces as images ("wK" …); glyphs are the fallback. */
  pieces?: Readonly<Record<string, CanvasImageSource>>
}

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const FONT = '"Segoe UI Symbol", "Noto Sans Symbols2", "Noto Sans Symbols", "DejaVu Sans", "Apple Symbols", serif'

/** The last solid colour in a CSS background (themes end their gradients with one). */
export function solidOf(css: unknown, fallback: string): string {
  if (typeof css !== 'string') return fallback
  const all = css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)
  return all?.[all.length - 1] ?? fallback
}

/** Pieces of a FEN as [square index 0–63 (a8 = 0), letter]. */
export function fenPieces(fen: string): Array<{ i: number; p: string }> {
  const out: Array<{ i: number; p: string }> = []
  const rows = (fen.split(' ')[0] ?? '').split('/')
  rows.forEach((row, r) => {
    let f = 0
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch)
      else {
        out.push({ i: r * 8 + f, p: ch })
        f += 1
      }
    }
  })
  return out
}

const sqIndex = (sq: string): number => (8 - Number(sq[1])) * 8 + 'abcdefgh'.indexOf(sq[0] ?? 'a')

function drawPiece(ctx: CanvasRenderingContext2D, letter: string, cx: number, cy: number, cell: number, alpha = 1, images?: ReelLook['pieces']) {
  const white = letter === letter.toUpperCase()
  ctx.globalAlpha = alpha
  const img = images?.[`${white ? 'w' : 'b'}${letter.toUpperCase()}`]
  if (img) {
    const s = cell * 0.92
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = cell * 0.1
    ctx.shadowOffsetY = cell * 0.05
    ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s)
    ctx.shadowColor = 'transparent'
    ctx.globalAlpha = 1
    return
  }
  ctx.font = `${Math.round(cell * 0.82)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(1, cell * 0.045)
  ctx.strokeStyle = white ? '#111827' : '#f8fafc'
  ctx.fillStyle = white ? '#f8fafc' : '#111827'
  const g = GLYPH[letter.toLowerCase()] ?? '?'
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = cell * 0.12
  ctx.shadowOffsetY = cell * 0.04
  ctx.fillText(g, cx, cy + cell * 0.04)
  ctx.shadowColor = 'transparent'
  ctx.strokeText(g, cx, cy + cell * 0.04)
  ctx.globalAlpha = 1
}

function drawBoard(ctx: CanvasRenderingContext2D, x0: number, y0: number, size: number, look: ReelLook, flip: boolean, fen: string, frame: ReelFrame | null) {
  const cell = size / 8
  const at = (i: number) => {
    const r = Math.floor(i / 8)
    const f = i % 8
    const col = flip ? 7 - f : f
    const row = flip ? 7 - r : r
    return { x: x0 + col * cell, y: y0 + row * cell }
  }
  for (let i = 0; i < 64; i++) {
    const { x, y } = at(i)
    ctx.fillStyle = (Math.floor(i / 8) + (i % 8)) % 2 === 0 ? look.light : look.dark
    ctx.fillRect(x, y, cell + 0.5, cell + 0.5)
  }
  const moving = frame?.scene === 'moment' && frame.slide < 1 ? frame.move : null
  if (frame?.scene === 'moment') {
    // The move's trail.
    for (const sq of [frame.move.from, frame.move.to]) {
      const { x, y } = at(sqIndex(sq))
      ctx.fillStyle = 'rgba(250, 204, 21, 0.35)'
      ctx.fillRect(x, y, cell, cell)
    }
  }
  for (const { i, p } of fenPieces(fen)) {
    if (moving && i === sqIndex(moving.from)) continue
    const { x, y } = at(i)
    // The victim fades as the attacker arrives.
    const alpha = moving && i === sqIndex(moving.to) && frame?.scene === 'moment' ? 1 - frame.slide : 1
    drawPiece(ctx, p, x + cell / 2, y + cell / 2, cell, alpha, look.pieces)
  }
  if (moving && frame?.scene === 'moment') {
    const a = at(sqIndex(moving.from))
    const b = at(sqIndex(moving.to))
    const t = frame.slide
    const letter = moving.color === 'w' ? moving.piece.toUpperCase() : moving.piece
    const lift = Math.sin(t * Math.PI) * cell * 0.25
    drawPiece(ctx, letter, a.x + (b.x - a.x) * t + cell / 2, a.y + (b.y - a.y) * t + cell / 2 - lift, cell * (1 + 0.12 * Math.sin(t * Math.PI)), 1, look.pieces)
  }
}

function caption(ctx: CanvasRenderingContext2D, w: number, y: number, text: string, size: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.font = `800 ${Math.round(size)}px "Inter", "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, y)
  ctx.globalAlpha = 1
}

const fade = (p: number): number => Math.min(1, p * 5, (1 - p) * 5)

/** Draws the reel `ms` in. */
export function drawReel(ctx: CanvasRenderingContext2D, w: number, h: number, moments: readonly Moment[], info: ReelInfo, look: ReelLook, ms: number): void {
  const frame = reelFrame(moments, info, ms)
  const bg = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h / 2, Math.max(w, h) * 0.75)
  bg.addColorStop(0, '#1e293b')
  bg.addColorStop(1, '#020617')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  const unit = Math.min(w, h)
  const size = unit * 0.68
  const x0 = (w - size) / 2
  const y0 = (h - size) / 2
  const flip = info.orientation === 'b'

  if (frame.scene === 'title') {
    const a = fade(frame.progress)
    caption(ctx, w, h * 0.38, 'CHRONOS CHESS', unit * 0.035, look.accent, a)
    caption(ctx, w, h * 0.5, `${info.white}  vs  ${info.black}`, unit * 0.06, '#f8fafc', a)
    caption(ctx, w, h * 0.6, `${moments.length} highlight${moments.length === 1 ? '' : 's'}${info.result ? ` · ${info.result}` : ''}`, unit * 0.032, '#94a3b8', a)
    return
  }

  ctx.save()
  if (frame.scene === 'moment') {
    const f = focusPoint(frame.focus, info.orientation)
    const fx = x0 + (f.x / 100) * size
    const fy = y0 + (f.y / 100) * size
    // Push in toward the action, keeping it near the middle.
    ctx.translate(w / 2 + (fx - w / 2) * 0.35, h / 2 + (fy - h / 2) * 0.35)
    ctx.scale(frame.zoom, frame.zoom)
    ctx.translate(-(w / 2 + (fx - w / 2) * 0.35), -(h / 2 + (fy - h / 2) * 0.35))
  }
  drawBoard(ctx, x0, y0, size, look, flip, frame.fen, frame)
  ctx.restore()

  // Letterbox and captions.
  const bar = h * 0.085
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, bar)
  ctx.fillRect(0, h - bar, w, bar)
  if (frame.scene === 'moment') {
    const a = Math.min(1, fade(frame.progress) * 1.5)
    caption(ctx, w, bar / 2, `${frame.index + 1} / ${moments.length}  ·  move ${Math.floor((moments[frame.index]?.ply ?? 0) / 2) + 1}`, unit * 0.026, '#94a3b8', a)
    caption(ctx, w, h - bar / 2, `${frame.title}  ${frame.move.san}`, unit * 0.04, look.accent, a)
  } else {
    const a = fade(frame.progress)
    caption(ctx, w, bar / 2, info.result || 'Unfinished', unit * 0.04, '#f8fafc', a)
    caption(ctx, w, h - bar / 2, 'Chronos Chess', unit * 0.03, look.accent, a)
  }
}
