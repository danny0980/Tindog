import { Chess } from 'chess.js'
import { PERSONALITIES, PIECE_VALUES, type PersonalityWeights } from '../constants/game'
import type { Personality, Square } from '../types/chess'
import type { DifficultyConfig, SearchResult } from '../types/engine'
import { parseUciMove } from '../utils/chess'
import { scoreToCp } from './scoring'

const FILES = 'abcdefgh'
const coords = (square: Square): [number, number] => [FILES.indexOf(square[0] ?? 'a'), Number(square[1]) - 1]
const chebyshev = (a: Square, b: Square): number => {
  const [ax, ay] = coords(a)
  const [bx, by] = coords(b)
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}
const CENTER = new Set(['d4', 'e4', 'd5', 'e5'])
const EXTENDED_CENTER = new Set(['c3', 'd3', 'e3', 'f3', 'c4', 'f4', 'c5', 'f5', 'c6', 'd6', 'e6', 'f6'])

/** Style score of a single candidate move from the perspective of the mover. */
function styleScore(fen: string, uci: string, w: PersonalityWeights): number {
  const parsed = parseUciMove(uci)
  if (!parsed) return 0
  const chess = new Chess(fen)
  const mover = chess.turn()
  const fullMove = Number(fen.split(' ')[5] ?? 1)
  let move
  try {
    move = chess.move(parsed)
  } catch {
    return 0
  }
  const enemyKing = chess.findPiece({ type: 'k', color: mover === 'w' ? 'b' : 'w' })[0]
  const ownKing = chess.findPiece({ type: 'k', color: mover })[0]
  const [, fromRank] = coords(move.from)
  const [, toRank] = coords(move.to)
  const advance = (mover === 'w' ? toRank - fromRank : fromRank - toRank) / 7
  const capturedValue = move.captured ? PIECE_VALUES[move.captured] : 0
  const isCheck = chess.inCheck()
  const isCastle = move.isKingsideCastle() || move.isQueensideCastle()
  const backRank = mover === 'w' ? 0 : 7

  let score = 0
  if (isCheck) score += w.check
  score += capturedValue * w.capture
  if (isCheck || move.captured) score += w.forcing
  else score += w.quiet
  if (enemyKing) score += ((7 - chebyshev(move.to, enemyKing)) / 7) * w.kingPressure
  score += advance * w.advance
  if (isCastle) score += w.castle
  if (ownKing && move.piece !== 'k' && chebyshev(move.to, ownKing) <= 1) score += w.kingShelter
  if (move.captured && Math.abs(PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece]) <= 0) score += w.trade
  if (CENTER.has(move.to)) score += w.center
  else if (EXTENDED_CENTER.has(move.to)) score += w.center * 0.4
  if ((move.piece === 'n' || move.piece === 'b') && fromRank === backRank && fullMove <= 15) score += w.development
  if (move.piece === 'q' && fullMove <= 8) score += w.earlyQueen
  return score
}

/**
 * Chooses the engine's move according to its personality. The engine supplies
 * several principal variations (MultiPV); every candidate within the
 * difficulty's tolerance window is re-ranked by style features, so an
 * "Aggressive Attacker" really does prefer the king hunt among sound options.
 */
export function chooseMove(
  fen: string,
  result: SearchResult,
  personality: Personality,
  config: DifficultyConfig,
  random: () => number = Math.random,
): string {
  const weights = PERSONALITIES.find((p) => p.id === personality)?.weights ?? null
  if (!weights || result.lines.length === 0) return result.bestMove

  const scored = result.lines
    .filter((line) => line.pv[0])
    .map((line) => ({ move: line.pv[0] as string, cp: scoreToCp(line.score) }))
  const top = Math.max(...scored.map((c) => c.cp))
  // Never pass up a forced mate, and never walk into one if avoidable.
  if (top >= 9000) return scored.find((c) => c.cp === top)?.move ?? result.bestMove

  const candidates = scored.filter((c) => c.cp >= top - config.toleranceCp)
  // The skill-limited best move stays in the pool so lower levels remain beatable.
  if (!candidates.some((c) => c.move === result.bestMove)) {
    const fromLines = scored.find((c) => c.move === result.bestMove)
    if (fromLines) candidates.push(fromLines)
  }

  let best = candidates[0]
  let bestValue = -Infinity
  for (const candidate of candidates) {
    const value =
      ((candidate.cp - top) / 100) * weights.evaluation +
      styleScore(fen, candidate.move, weights) +
      (random() * 2 - 1) * config.noise
    if (value > bestValue) {
      bestValue = value
      best = candidate
    }
  }
  return best?.move ?? result.bestMove
}
