import { Chess, type Move } from 'chess.js'
import { PIECE_VALUES } from '../constants/game'
import type { Square } from '../types/chess'
import type { OpponentProfile, SearchResult, StyleWeights } from '../types/engine'
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

/** Material left hanging: the moved piece can be taken and is worth more than what it captured. */
function sacrificeValue(after: Chess, move: Move): number {
  if (move.piece === 'k') return 0
  const opponent = move.color === 'w' ? 'b' : 'w'
  if (!after.isAttacked(move.to, opponent)) return 0
  const given = PIECE_VALUES[move.piece]
  const taken = move.captured ? PIECE_VALUES[move.captured] : 0
  return Math.max(0, given - taken)
}

/** Number of valuable enemy pieces (minor or better, or the king) the moved piece now attacks. */
function forkTargets(after: Chess, move: Move): number {
  const opponent = move.color === 'w' ? 'b' : 'w'
  let targets = 0
  for (const row of after.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== opponent) continue
      if (cell.type === 'p') continue
      if (cell.type !== 'k' && PIECE_VALUES[cell.type] < 3) continue
      if (after.attackers(cell.square, move.color).includes(move.to)) targets += 1
    }
  }
  return targets
}

/** Pawn advancing on the files around the enemy king (a pawn storm). */
function isPawnStorm(move: Move, enemyKing: Square | undefined): boolean {
  if (move.piece !== 'p' || !enemyKing) return false
  const [file] = coords(move.to)
  const [kingFile] = coords(enemyKing)
  return Math.abs(file - kingFile) <= 2
}

/** Pawn landing on a square defended by one of our own pawns (a healthy chain). */
function supportedByPawn(after: Chess, move: Move): boolean {
  if (move.piece !== 'p') return false
  return after.attackers(move.to, move.color).some((sq) => after.get(sq)?.type === 'p')
}

/** Distance travelled by a sliding piece, 0–1 (long diagonals score highest). */
function longRangeValue(move: Move): number {
  if (move.piece !== 'b' && move.piece !== 'r' && move.piece !== 'q') return 0
  return chebyshev(move.from, move.to) / 7
}

/** Style score of one candidate move from the mover's perspective. `rank` is its MultiPV index (0 = best). */
function styleScore(fen: string, uci: string, w: StyleWeights, rank: number, lines: number): number {
  const parsed = parseUciMove(uci)
  if (!parsed) return 0
  const chess = new Chess(fen)
  const mover = chess.turn()
  const fullMove = Number(fen.split(' ')[5] ?? 1)
  let move: Move
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
  if (move.captured && PIECE_VALUES[move.captured] === PIECE_VALUES[move.piece]) score += w.trade
  if (CENTER.has(move.to)) score += w.center
  else if (EXTENDED_CENTER.has(move.to)) score += w.center * 0.4
  if ((move.piece === 'n' || move.piece === 'b') && fromRank === backRank && fullMove <= 15) score += w.development
  if (move.piece === 'q' && fullMove <= 8) score += w.earlyQueen
  if (w.sacrifice) score += (Math.min(3, sacrificeValue(chess, move)) / 3) * w.sacrifice
  if (w.fork) score += Math.max(0, forkTargets(chess, move) - 1) * w.fork
  if (w.creativity && lines > 1) score += (rank / (lines - 1)) * w.creativity
  if (w.pawnStorm && isPawnStorm(move, enemyKing)) score += w.pawnStorm * (0.5 + Math.max(0, advance) * 3)
  if (w.pawnStructure && supportedByPawn(chess, move)) score += w.pawnStructure
  if (w.longRange) score += longRangeValue(move) * w.longRange
  return score
}

/**
 * Chooses the engine's move according to a style. The engine supplies several
 * principal variations (MultiPV); every candidate within the tolerance window
 * is re-ranked by style features, so an attacking style really does prefer
 * the king hunt among sound options.
 */
export function chooseMove(
  fen: string,
  result: SearchResult,
  profile: Pick<OpponentProfile, 'weights' | 'toleranceCp' | 'noise'>,
  random: () => number = Math.random,
): string {
  const weights = profile.weights
  if (!weights || result.lines.length === 0) return result.bestMove

  const scored = result.lines
    .filter((line) => line.pv[0])
    .map((line, rank) => ({ move: line.pv[0] as string, cp: scoreToCp(line.score), rank }))
  const top = Math.max(...scored.map((c) => c.cp))
  // Never pass up a forced mate.
  if (top >= 9000) return scored.find((c) => c.cp === top)?.move ?? result.bestMove

  const candidates = scored.filter((c) => c.cp >= top - profile.toleranceCp)
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
      styleScore(fen, candidate.move, weights, candidate.rank, scored.length) +
      (random() * 2 - 1) * profile.noise
    if (value > bestValue) {
      bestValue = value
      best = candidate
    }
  }
  return best?.move ?? result.bestMove
}

/**
 * Next move from an opening repertoire, if the game so far matches a line
 * (lines are SAN from the initial position). Returns SAN or null.
 */
export function repertoireMove(history: readonly string[], repertoire: readonly string[] | undefined, random: () => number = Math.random): string | null {
  if (!repertoire?.length) return null
  const options: string[] = []
  for (const line of repertoire) {
    const moves = line.split(' ')
    if (moves.length <= history.length) continue
    if (history.every((san, i) => moves[i] === san)) {
      const next = moves[history.length]
      if (next) options.push(next)
    }
  }
  if (options.length === 0) return null
  return options[Math.floor(random() * options.length)] ?? null
}
