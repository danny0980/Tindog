// Blindfold Vanishing Chess: every piece fades from view a few moves after
// it last moved, and the fade gets quicker as the game goes on, until you
// are playing almost blind. Rules are ordinary chess; this only decides what
// the board shows. Pure and unit-tested.
import { Chess, type Square } from 'chess.js'

/** Plies a piece stays visible after it moves, early in the game … */
export const VISIBLE_START = 10
/** … shrinking by one every SHRINK_EVERY plies, down to this. */
export const VISIBLE_MIN = 3
export const SHRINK_EVERY = 6
/** Plies over which a piece fades out. */
const FADE = 2
/** Peeks (show everything for a moment) per game. */
export const PEEKS = 3

/** How long (plies) a piece stays visible at this point of the game. */
export const visibleFor = (ply: number): number => Math.max(VISIBLE_MIN, VISIBLE_START - Math.floor(ply / SHRINK_EVERY))

/**
 * For every occupied square, the ply its piece last moved (0 = never: it has
 * been there since the start). Castling moves the rook too; en passant removes
 * the taken pawn.
 */
export function lastMoved(startFen: string, ucis: readonly string[]): Map<Square, number> {
  const chess = new Chess(startFen)
  const out = new Map<Square, number>()
  for (const row of chess.board()) for (const p of row) if (p) out.set(p.square, 0)
  ucis.forEach((uci, i) => {
    let m
    try {
      m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) })
    } catch {
      return
    }
    const ply = i + 1
    out.delete(m.from)
    out.set(m.to, ply)
    if (m.flags.includes('e')) out.delete(`${m.to[0]}${m.from[1]}` as Square)
    if (m.flags.includes('k') || m.flags.includes('q')) {
      const rank = m.color === 'w' ? '1' : '8'
      const [rookFrom, rookTo] = m.flags.includes('k') ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`]
      out.delete(rookFrom as Square)
      out.set(rookTo as Square, ply)
    }
  })
  return out
}

/** Opacity of each occupied square's piece now (1 = fully visible, 0 = vanished). */
export function vanishMask(startFen: string, ucis: readonly string[]): Record<string, number> {
  const now = ucis.length
  const window = visibleFor(now)
  const out: Record<string, number> = {}
  for (const [sq, moved] of lastMoved(startFen, ucis)) {
    const left = moved + window - now
    out[sq] = Math.max(0, Math.min(1, left / FADE))
  }
  return out
}

/** How many pieces are invisible now (for the status line). */
export const hiddenCount = (mask: Readonly<Record<string, number>>): number => Object.values(mask).filter((o) => o === 0).length
