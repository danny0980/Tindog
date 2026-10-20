// Automatic highlight reels: picks the best moments of a game and lays them
// out as a ≤ 30-second film (title card, the moments in slow motion, the
// final position). Pure and unit-tested; reelRenderer draws a frame of it.
import { Chess } from 'chess.js'
import type { MoveClassification } from '../types/analysis'
import type { Color, Move, Square } from '../types/chess'
import { kingToMove } from './director'

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const
const NAME = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' } as const

export type ReelMove = Pick<Move, 'color' | 'from' | 'to' | 'piece' | 'san' | 'before' | 'after'> & { captured?: Move['captured']; promotion?: Move['promotion'] }

export interface Moment {
  ply: number
  move: ReelMove
  title: string
  score: number
}

/** Was this capture a sacrifice: a bigger piece taking a smaller one onto a square the enemy attacks? */
function isSacrifice(m: ReelMove): boolean {
  if (!m.captured || VALUE[m.piece] < 3 || VALUE[m.piece] < VALUE[m.captured] + 2) return false
  try {
    const after = new Chess(m.after)
    return after.isAttacked(m.to, m.color === 'w' ? 'b' : 'w')
  } catch {
    return false
  }
}

/** Every move's highlight value and title (0 = nothing to show). */
export function scoreMove(m: ReelMove, ply: number, classification: MoveClassification | null = null): Moment {
  let score = 0
  let title = m.san
  const after = new Chess(m.after)
  if (after.isCheckmate()) return { ply, move: m, title: 'Checkmate!', score: 100 }
  if (m.promotion) {
    score += 40
    title = `Promotion to ${NAME[m.promotion]}`
  }
  if (m.captured) {
    score += VALUE[m.captured] * 7
    if (isSacrifice(m)) {
      score += 30
      title = `${NAME[m.piece]} sacrifice!`
    } else if (!m.promotion) title = `${NAME[m.piece]} takes ${NAME[m.captured]}`
  }
  if (after.inCheck()) {
    score += 8
    if (score === 8) title = 'Check!'
  }
  if (classification === 'brilliant') {
    score += 45
    title = `Brilliant: ${m.san}`
  } else if (classification === 'best' && score > 0) score += 6
  return { ply, move: m, title, score }
}

/** Up to `max` moments worth showing, in the order they happened. The mate is always kept. */
export function pickHighlights(history: readonly ReelMove[], classes: ReadonlyArray<MoveClassification | null> = [], max = 5): Moment[] {
  const scored = history.map((m, i) => scoreMove(m, i, classes[i] ?? null)).filter((s) => s.score >= 8)
  // Two moments back to back read as one: keep the better of any pair within a ply.
  const chosen: Moment[] = []
  for (const s of [...scored].sort((a, b) => b.score - a.score)) {
    if (chosen.length >= max) break
    if (chosen.some((c) => Math.abs(c.ply - s.ply) <= 1)) continue
    chosen.push(s)
  }
  return chosen.sort((a, b) => a.ply - b.ply)
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export const TITLE_MS = 2500
export const MOMENT_MS = 4200
export const END_MS = 3500
export const MAX_REEL_MS = 30_000

export interface ReelInfo {
  white: string
  black: string
  /** "1–0", "0–1", "½–½" or "" while unfinished. */
  result: string
  /** Final position, shown on the end card. */
  finalFen: string
  /** The side whose view the film takes. */
  orientation: Color
}

export type ReelFrame =
  | { scene: 'title'; progress: number }
  | { scene: 'moment'; index: number; fen: string; move: ReelMove; title: string; progress: number; slide: number; zoom: number; focus: Square }
  | { scene: 'end'; fen: string; progress: number }

export const reelLength = (moments: readonly Moment[]): number => Math.min(MAX_REEL_MS, TITLE_MS + moments.length * MOMENT_MS + END_MS)

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t))

/** What the film shows `ms` into the reel. */
export function reelFrame(moments: readonly Moment[], info: ReelInfo, ms: number): ReelFrame {
  if (ms < TITLE_MS) return { scene: 'title', progress: clamp01(ms / TITLE_MS) }
  const into = ms - TITLE_MS
  const index = Math.floor(into / MOMENT_MS)
  const m = moments[index]
  if (m) {
    const local = (into - index * MOMENT_MS) / MOMENT_MS
    // 0–0.2: camera eases in on the position before; 0.2–0.62: the move slides in slow motion; then hold.
    const slide = ease(clamp01((local - 0.2) / 0.42))
    const zoom = 1 + 0.2 * ease(clamp01(local / 0.25)) - 0.08 * ease(clamp01((local - 0.85) / 0.15))
    return { scene: 'moment', index, fen: slide >= 1 ? m.move.after : m.move.before, move: m.move, title: m.title, progress: local, slide, zoom, focus: (m.score >= 100 ? kingToMove(m.move.after) : null) ?? m.move.to }
  }
  const end = into - moments.length * MOMENT_MS
  return { scene: 'end', fen: info.finalFen, progress: clamp01(end / END_MS) }
}
