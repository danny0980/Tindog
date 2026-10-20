// Living pieces: which pieces on the board are reacting to the position.
//   tremble — a king in check;
//   fork    — a knight attacking two or more big targets (king, queen, rook);
//   charged — a pawn one step from promotion; warm — two steps away.
// Pure and unit-tested; the board turns these into animations.
import { Chess } from 'chess.js'
import type { Square } from '../types/chess'

export type PieceState = 'tremble' | 'fork' | 'charged' | 'warm'

const FILES = 'abcdefgh'
const KNIGHT_JUMPS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
]
const BIG = new Set(['k', 'q', 'r'])

const at = (file: number, rank: number): Square | null => (file >= 0 && file < 8 && rank >= 1 && rank <= 8 ? (`${FILES[file]}${rank}` as Square) : null)

export function pieceStates(fen: string): Map<Square, PieceState> {
  const out = new Map<Square, PieceState>()
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return out
  }
  const board = chess.board()
  const turn = chess.turn()
  for (const row of board) {
    for (const p of row) {
      if (!p) continue
      const file = FILES.indexOf(p.square[0] ?? 'a')
      const rank = Number(p.square[1])
      if (p.type === 'p') {
        const toGo = p.color === 'w' ? 8 - rank : rank - 1
        if (toGo === 1) out.set(p.square, 'charged')
        else if (toGo === 2) out.set(p.square, 'warm')
      } else if (p.type === 'n') {
        const targets = KNIGHT_JUMPS.map(([df, dr]) => at(file + df, rank + dr))
          .map((sq) => (sq ? chess.get(sq) : undefined))
          .filter((t) => t && t.color !== p.color && BIG.has(t.type))
        if (targets.length >= 2) out.set(p.square, 'fork')
      } else if (p.type === 'k' && p.color === turn && chess.inCheck()) {
        out.set(p.square, 'tremble')
      }
    }
  }
  return out
}
