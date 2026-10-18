// Which visual effects each square of the board carries (pure, unit-tested).
// The board renders these as layers under the pieces: animated status tiles,
// the selection aura, last-move trail, check / mate pulses and capture flashes.
import type { Square } from '../../types/chess'

/** Animated status tiles. frost / snow / glue / stuck come from battle rules; lava, poison and void are ready for any rule that wants them. */
export type TileKind = 'frost' | 'snow' | 'glue' | 'stuck' | 'lava' | 'poison' | 'void'

export const TILE_KINDS: readonly TileKind[] = ['frost', 'snow', 'glue', 'stuck', 'lava', 'poison', 'void']

export interface SquareVfx {
  tile?: TileKind
  selected?: boolean
  lastFrom?: boolean
  lastTo?: boolean
  check?: boolean
  mate?: boolean
}

export interface BoardVfxInput {
  selected: Square | null
  lastMove: { from: string; to: string } | null
  /** The king in check (or mated), if any. */
  kingInDanger: Square | null
  mate: boolean
  /** Status tiles; when two land on one square the later kind in TILE_KINDS wins (void over lava over frost …). */
  tiles: Partial<Record<TileKind, readonly Square[]>>
}

const SQUARE = /^[a-h][1-8]$/
const isSquare = (s: string): s is Square => SQUARE.test(s)

/** Every square that carries at least one effect, with its effects. */
export function boardVfx(input: BoardVfxInput): Map<Square, SquareVfx> {
  const out = new Map<Square, SquareVfx>()
  const at = (sq: string): SquareVfx | null => {
    if (!isSquare(sq)) return null
    let v = out.get(sq)
    if (!v) {
      v = {}
      out.set(sq, v)
    }
    return v
  }
  for (const kind of TILE_KINDS) for (const sq of input.tiles[kind] ?? []) {
    const v = at(sq)
    if (v) v.tile = kind
  }
  if (input.lastMove) {
    const from = at(input.lastMove.from)
    const to = at(input.lastMove.to)
    if (from) from.lastFrom = true
    if (to) to.lastTo = true
  }
  if (input.selected) {
    const v = at(input.selected)
    if (v) v.selected = true
  }
  if (input.kingInDanger) {
    const v = at(input.kingInDanger)
    if (v) {
      v.check = !input.mate
      v.mate = input.mate
    }
  }
  return out
}

/** Pieces on the board part of a FEN, by colour. */
function pieceCount(fen: string): { w: number; b: number } {
  const board = fen.split(' ')[0] ?? ''
  let w = 0
  let b = 0
  for (const ch of board) {
    if (/[PNBRQK]/.test(ch)) w += 1
    else if (/[pnbrqk]/.test(ch)) b += 1
  }
  return { w, b }
}

/**
 * The square where a capture just happened, when the position went from
 * `prevFen` to `fen` by `lastMove` taking exactly one piece (en passant
 * included). Undoing, jumping through history or loading a new game is not a
 * capture.
 */
export function captureSquare(prevFen: string | null, fen: string, lastMove: { from: string; to: string } | null): Square | null {
  if (!prevFen || !lastMove || prevFen === fen || !isSquare(lastMove.to)) return null
  const before = pieceCount(prevFen)
  const after = pieceCount(fen)
  const mover = (fen.split(' ')[1] ?? 'w') === 'w' ? 'b' : 'w'
  const victim = mover === 'w' ? 'b' : 'w'
  // Exactly one enemy piece gone, and the mover's army unchanged (promotions keep the count).
  if (before[victim] - after[victim] !== 1 || before[mover] !== after[mover]) return null
  // The previous position must be the one before this move: it was the mover's turn.
  if ((prevFen.split(' ')[1] ?? '') !== mover) return null
  return lastMove.to
}
