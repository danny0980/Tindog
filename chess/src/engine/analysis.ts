import { Chess } from 'chess.js'
import { PIECE_VALUES } from '../constants/game'
import type { GameAnalysis, MoveAnalysis, MoveClassification, PositionEval } from '../types/analysis'
import type { Color, Move } from '../types/chess'
import type { SearchResult } from '../types/engine'
import { parseUciMove } from '../utils/chess'
import { getCachedEval, setCachedEval } from './evalCache'
import { MATE_CP, lineToEval, winChance } from './scoring'

export const CLASSIFICATIONS: ReadonlyArray<MoveClassification> = [
  'brilliant',
  'best',
  'excellent',
  'good',
  'book',
  'forced',
  'inaccuracy',
  'mistake',
  'blunder',
]

/** Exact evaluation for finished positions — no engine needed. */
export function terminalEval(fen: string): PositionEval | null {
  const chess = new Chess(fen)
  if (chess.isCheckmate()) return { cp: chess.turn() === 'w' ? -MATE_CP : MATE_CP, mate: null, bestMove: null, depth: 99 }
  if (chess.isDraw()) return { cp: 0, mate: null, bestMove: null, depth: 99 }
  return null
}

export type PositionSearch = (fen: string) => Promise<SearchResult>

/** Evaluates one position (White POV), consulting the shared cache first. */
export async function evaluatePosition(fen: string, depth: number, search: PositionSearch): Promise<PositionEval> {
  const terminal = terminalEval(fen)
  if (terminal) return terminal
  const cached = getCachedEval(fen, depth)
  if (cached) return cached
  const result = await search(fen)
  const turn: Color = fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const evaluation = lineToEval(result.lines[0], turn, result.bestMove === '(none)' ? null : result.bestMove)
  setCachedEval(fen, evaluation)
  return evaluation
}

function isSacrifice(move: Move): boolean {
  if (move.piece === 'p' || move.piece === 'k') return false
  const given = PIECE_VALUES[move.piece]
  const taken = move.captured ? PIECE_VALUES[move.captured] : 0
  if (given - taken < 2) return false
  const after = new Chess(move.after)
  const opponent: Color = move.color === 'w' ? 'b' : 'w'
  if (!after.isAttacked(move.to, opponent)) return false
  // A defended piece attacked only by higher-value pieces isn't really en prise.
  const attackers = after.attackers(move.to, opponent)
  return attackers.some((sq) => {
    const piece = after.get(sq)
    return piece !== undefined && PIECE_VALUES[piece.type] <= given
  })
}

const uciOf = (move: Move): string => `${move.from}${move.to}${move.promotion ?? ''}`

/** Per-move accuracy (Lichess formula) from the drop in winning chances. */
const moveAccuracy = (loss: number): number => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669))

export function classifyMoves(history: readonly Move[], evals: readonly PositionEval[], bookPly: number): GameAnalysis {
  const emptyCounts = (): Record<MoveClassification, number> =>
    Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0])) as Record<MoveClassification, number>
  const counts: Record<Color, Record<MoveClassification, number>> = { w: emptyCounts(), b: emptyCounts() }
  const accuracies: Record<Color, number[]> = { w: [], b: [] }
  const moves: MoveAnalysis[] = []

  history.forEach((move, index) => {
    const before = evals[index]
    const after = evals[index + 1]
    if (!before || !after) return
    const sign = move.color === 'w' ? 1 : -1
    const wcBefore = winChance(sign * before.cp)
    const wcAfter = winChance(sign * after.cp)
    const loss = Math.max(0, wcBefore - wcAfter)
    const isBest = before.bestMove !== null && uciOf(move) === before.bestMove
    const legalMoves = new Chess(move.before).moves().length

    let classification: MoveClassification
    if (index + 1 <= bookPly) classification = 'book'
    else if (legalMoves === 1) classification = 'forced'
    else if ((isBest || loss < 1) && wcAfter >= 50 && wcBefore < 95 && isSacrifice(move)) classification = 'brilliant'
    else if (isBest || loss < 1) classification = 'best'
    else if (loss < 2.5) classification = 'excellent'
    else if (loss < 5) classification = 'good'
    else if (loss < 10) classification = 'inaccuracy'
    else if (loss < 15) classification = 'mistake'
    else classification = 'blunder'

    let bestMoveSan: string | null = null
    if (!isBest && before.bestMove && (classification === 'inaccuracy' || classification === 'mistake' || classification === 'blunder')) {
      const parsed = parseUciMove(before.bestMove)
      if (parsed) {
        try {
          bestMoveSan = new Chess(move.before).move(parsed).san
        } catch {
          bestMoveSan = null
        }
      }
    }

    counts[move.color][classification] += 1
    if (classification !== 'book' && classification !== 'forced') accuracies[move.color].push(moveAccuracy(loss))
    moves.push({
      ply: index + 1,
      san: move.san,
      color: move.color,
      classification,
      evalBefore: before,
      evalAfter: after,
      winChanceLoss: loss,
      bestMoveSan,
    })
  })

  const mean = (values: number[]): number => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 100)
  return { moves, evals: [...evals], accuracy: { w: mean(accuracies.w), b: mean(accuracies.b) }, counts }
}
