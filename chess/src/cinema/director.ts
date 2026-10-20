// The cinematic camera's director: decides which moves deserve a shot
// (checkmate, promotion, a big capture, a check) and how it is framed. Pure
// and unit-tested; <CinemaStage> plays the shot it returns.
import type { Color, Move, Square } from '../types/chess'

export type CinematicMode = 'off' | 'key' | 'all'

export type ShotKind = 'mate' | 'promotion' | 'capture' | 'check'

export interface Shot {
  /** Changes for every new shot (the ply it belongs to), so a stage replays it. */
  id: string
  kind: ShotKind
  /** The square the camera frames. */
  focus: Square
  /** Where the action came from (drawn as a streak), if any. */
  from: Square | null
  /** Total length, including the snap back. */
  duration: number
  /** How far the camera pushes in (1 = no zoom). */
  zoom: number
  /** Tilt back (degrees, around the x axis) and a slight roll (around z). */
  tilt: number
  roll: number
  /** Piece animation time while the shot runs (slow motion). */
  slowMo: number
  caption: string | null
}

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const
const NAME = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' } as const

/** Whatever a shot needs to know about the move just played. */
export type ShotMove = Pick<Move, 'color' | 'from' | 'to' | 'piece' | 'san'> & { captured?: Move['captured']; promotion?: Move['promotion'] }

export interface ShotContext {
  mode: CinematicMode
  /** Index of the move in the game (0 = first move): makes the shot id and drives the cooldown. */
  ply: number
  /** Ply of the last shot played, or null. */
  lastShotPly: number | null
  mate: boolean
  check: boolean
  /** Square of the king that is checked or mated. */
  king: Square | null
}

/** Minimum plies between two ordinary shots, so the camera never gets in the way. */
export const COOLDOWN = 3

/** A roll that leans toward the action, so shots don't all look the same. */
const lean = (from: Square, to: Square): number => Math.sign(to.charCodeAt(0) - from.charCodeAt(0)) * 2.5

/** The shot for `move`, or null when it doesn't deserve one in this mode. */
export function directShot(move: ShotMove, ctx: ShotContext): Shot | null {
  if (ctx.mode === 'off') return null
  const id = `${ctx.ply}:${move.from}${move.to}`
  const base = { id, from: move.from, roll: lean(move.from, move.to) }

  // Checkmate always gets the big shot (on the king).
  if (ctx.mate && ctx.king) return { ...base, kind: 'mate', focus: ctx.king, duration: 2600, zoom: 1.55, tilt: 18, slowMo: 900, caption: 'Checkmate' }

  const rested = ctx.lastShotPly === null || ctx.ply - ctx.lastShotPly >= COOLDOWN
  if (move.promotion) return { ...base, kind: 'promotion', focus: move.to, duration: 1500, zoom: 1.4, tilt: 14, slowMo: 650, caption: `${NAME[move.promotion]}!` }

  const taken = move.captured ? VALUE[move.captured] : 0
  // A queen falls (always), or — in "all" — any capture that wins material.
  const bigCapture = move.captured === 'q' || (ctx.mode === 'all' && taken >= 3 && taken >= VALUE[move.piece])
  if (move.captured && bigCapture && (rested || move.captured === 'q')) {
    return { ...base, kind: 'capture', focus: move.to, duration: move.captured === 'q' ? 1300 : 1000, zoom: move.captured === 'q' ? 1.35 : 1.25, tilt: 12, slowMo: 550, caption: `${NAME[move.captured]} falls` }
  }

  if (ctx.mode === 'all' && ctx.check && ctx.king && rested) return { ...base, kind: 'check', focus: ctx.king, duration: 800, zoom: 1.15, tilt: 8, slowMo: 400, caption: null }
  return null
}

/** Where on the board (in %) the camera points, for a given orientation. */
export function focusPoint(square: Square, orientation: Color): { x: number; y: number } {
  const file = 'abcdefgh'.indexOf(square[0] ?? 'a')
  const rank = Number(square[1]) - 1
  const col = orientation === 'w' ? file : 7 - file
  const row = orientation === 'w' ? 7 - rank : rank
  return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 }
}

/** How far past the board's edge (in % of the frame) the camera may pan, so edge squares clear the letterbox. */
export const OVERSCAN = 12

/**
 * How far (in % of the board) the camera slides to bring a point at `v` toward
 * the centre at zoom `z`: all the way when it can, but never more than a thin
 * strip (OVERSCAN) past the board's edge.
 */
export function pull(v: number, z: number): number {
  const limit = 50 * (z - 1) + OVERSCAN
  return Math.max(-limit, Math.min(limit, (50 - v) * z))
}

/**
 * Camera keyframes for a shot: push in and tilt (with the focus kept near the
 * middle of the frame), hold in slow motion, then snap back to the board.
 */
export function shotKeyframes(shot: Shot, orientation: Color): Keyframe[] {
  const { x, y } = focusPoint(shot.focus, orientation)
  const tx = pull(x, shot.zoom)
  const ty = pull(y, shot.zoom)
  const at = (zoom: number, tilt: number, roll: number, k: number) => `translate3d(${(tx * k).toFixed(2)}%, ${(ty * k).toFixed(2)}%, 0) scale(${zoom.toFixed(3)}) rotateX(${tilt.toFixed(1)}deg) rotateZ(${roll.toFixed(1)}deg)`
  const hold = shot.zoom + 0.04
  return [
    { transform: at(1, 0, 0, 0), offset: 0, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    { transform: at(shot.zoom, shot.tilt, shot.roll, 1), offset: 0.28, easing: 'linear' },
    { transform: at(hold, shot.tilt + 2, shot.roll * 1.2, 1), offset: 0.78, easing: 'cubic-bezier(0.6, 0, 0.3, 1)' },
    { transform: at(1, 0, 0, 0), offset: 1 },
  ]
}

/** The king of the side to move in a FEN (the one a check or mate is against). */
export function kingToMove(fen: string): Square | null {
  const [placement = '', turn = 'w'] = fen.split(' ')
  const king = turn === 'w' ? 'K' : 'k'
  const rows = placement.split('/')
  for (let r = 0; r < rows.length; r++) {
    let file = 0
    for (const ch of rows[r] ?? '') {
      if (/\d/.test(ch)) file += Number(ch)
      else {
        if (ch === king) return `${'abcdefgh'[file]}${8 - r}` as Square
        file += 1
      }
    }
  }
  return null
}

/** Every move's shot (or null), with the cooldown applied in order. Checks and mates come from the SAN. */
export function shotsFor(history: ReadonlyArray<ShotMove & { after: string }>, mode: CinematicMode): Array<Shot | null> {
  let lastShotPly: number | null = null
  return history.map((m, ply) => {
    const mate = m.san.endsWith('#')
    const check = mate || m.san.endsWith('+')
    const shot = directShot(m, { mode, ply, lastShotPly, mate, check, king: check ? kingToMove(m.after) : null })
    if (shot) lastShotPly = ply
    return shot
  })
}

/** Where the focus lands on screen (in % of the stage) at the height of the shot. */
export function focusOnScreen(shot: Shot, orientation: Color): { x: number; y: number } {
  const { x, y } = focusPoint(shot.focus, orientation)
  const land = (v: number) => 50 + (v - 50) * shot.zoom + pull(v, shot.zoom)
  return { x: land(x), y: land(y) }
}
