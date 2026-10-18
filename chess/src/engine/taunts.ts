// Taunt analyzer: turns "what just happened on the board" into at most one
// prioritized, mood-tagged reaction for the opponent character. Pure.
import { Chess } from 'chess.js'
import { PIECE_VALUES } from '../constants/game'
import type { Color, Move, PieceSymbol } from '../types/chess'
import type { TauntEvent } from '../types/taunts'

export const PIECE_NAMES: Readonly<Record<PieceSymbol, string>> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

/** Eval swing (opponent's point of view, centipawns) that counts as a blunder / brilliancy. */
export const SWING_CP = 250

export interface TauntContext {
  mover: 'human' | 'boss'
  move: Move
  /** Position after the move. */
  fen: string
  humanColor: Color
  /** Change in the opponent's evaluation caused by this move (null if unknown). */
  evalSwingCp: number | null
  /** Ply number of this move (1-based). */
  ply: number
}

const ev = (kind: TauntEvent['kind'], mood: TauntEvent['mood'], priority: number, vars: Record<string, string> = {}): TauntEvent => ({ kind, mood, priority, vars })

/** Moved piece left en prise: attacked by the opponent and either undefended or attacked by something cheaper. */
function isHanging(fen: string, square: Move['to'], piece: PieceSymbol, owner: Color): boolean {
  const chess = new Chess(fen)
  const enemy: Color = owner === 'w' ? 'b' : 'w'
  const attackers = chess.attackers(square, enemy)
  if (attackers.length === 0) return false
  if (chess.attackers(square, owner).length === 0) return true
  return attackers.some((sq) => {
    const p = chess.get(sq)
    return p !== undefined && PIECE_VALUES[p.type] < PIECE_VALUES[piece]
  })
}

/** The single most interesting reaction to a move, or null when nothing notable happened. */
export function analyzeTaunt(ctx: TauntContext): TauntEvent | null {
  const { move, mover } = ctx
  const found: TauntEvent[] = []
  const square = move.to
  let fenOk = true
  try {
    new Chess(ctx.fen)
  } catch {
    fenOk = false
  }

  if (mover === 'human') {
    if (move.captured === 'q') found.push(ev('queen-lost', 'angry', 95))
    else if (move.piece === 'q' && fenOk && isHanging(ctx.fen, square, 'q', move.color)) found.push(ev('queen-sacrifice', 'shocked', 90, { square }))
    if (ctx.evalSwingCp !== null && ctx.evalSwingCp >= SWING_CP) found.push(ev('blunder', 'smug', 85))
    if (ctx.evalSwingCp !== null && ctx.evalSwingCp <= -SWING_CP) found.push(ev('brilliance', 'shocked', 84))
    if (move.promotion) found.push(ev('player-promotes', 'shocked', 80, { square }))
    if (move.captured === 'r') found.push(ev('big-capture', 'angry', 70, { piece: PIECE_NAMES.r }))
    if (move.captured === 'b' || move.captured === 'n') found.push(ev('big-capture', 'angry', 40, { piece: PIECE_NAMES[move.captured] }))
    if (move.san.includes('+') || move.san.includes('#')) found.push(ev('in-check', 'tense', 60))
    if (move.flags.includes('x') || move.flags.includes('z')) found.push(ev('tactic-used', 'shocked', 75))
    const midgame = ctx.fen.split(' ')[0]?.toLowerCase().includes('q') ?? false
    const homeRank = move.color === 'w' ? '1' : '8'
    if (move.piece === 'k' && !move.flags.includes('k') && !move.flags.includes('q') && midgame && !square.endsWith(homeRank) && ctx.ply < 60)
      found.push(ev('king-walk', 'smug', 55, { square }))
    if ((move.flags.includes('k') || move.flags.includes('q')) && ctx.ply <= 12) found.push(ev('early-castle', 'calm', 20))
  } else {
    if (move.captured === 'q') found.push(ev('queen-won', 'smug', 95))
    if (move.promotion) found.push(ev('boss-promotes', 'smug', 80, { square }))
    if (move.captured === 'r') found.push(ev('lost-major', 'smug', 65, { piece: PIECE_NAMES.r, square }))
    if (move.san.includes('+') || move.san.includes('#')) found.push(ev('check-given', 'smug', 60))
    if (move.captured === 'b' || move.captured === 'n') found.push(ev('lost-major', 'smug', 35, { piece: PIECE_NAMES[move.captured], square }))
  }

  return found.sort((a, b) => b.priority - a.priority)[0] ?? null
}
