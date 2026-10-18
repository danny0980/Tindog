import type { PositionEval } from '../types/analysis'
import type { Color } from '../types/chess'
import type { EngineLine, EngineScore } from '../types/engine'

export const MATE_CP = 10_000

/** Converts a side-to-move score to a single centipawn number (mates ≈ ±10000). */
export function scoreToCp(score: EngineScore): number {
  if (score.type === 'cp') return score.value
  if (score.value === 0) return -MATE_CP
  return Math.sign(score.value) * (MATE_CP - Math.abs(score.value) * 10)
}

/** Normalises an engine line (side-to-move POV) to a White-POV evaluation. */
export function lineToEval(line: EngineLine | undefined, turn: Color, bestMove: string | null): PositionEval {
  if (!line) return { cp: 0, mate: null, bestMove, depth: 0 }
  const sign = turn === 'w' ? 1 : -1
  const mate = line.score.type === 'mate' && line.score.value !== 0 ? sign * line.score.value : null
  return { cp: sign * scoreToCp(line.score), mate, bestMove, depth: line.depth }
}

/** Lichess-style winning chances (0–100) for the side the cp value favours. */
export function winChance(cp: number): number {
  const clamped = Math.max(-1500, Math.min(1500, cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1)
}

/** Human-readable evaluation (White POV), e.g. "+1.3", "-0.4", "M3", "-M2". */
export function formatEval(evaluation: PositionEval): string {
  if (evaluation.mate !== null && evaluation.mate !== 0) return `${evaluation.mate < 0 ? '-' : ''}M${Math.abs(evaluation.mate)}`
  if (Math.abs(evaluation.cp) >= MATE_CP - 100) return evaluation.cp > 0 ? '1-0' : '0-1'
  const pawns = evaluation.cp / 100
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`
}

/** Fraction (0–1) of the eval bar that belongs to White. */
export function evalBarFraction(evaluation: PositionEval): number {
  return winChance(evaluation.cp) / 100
}
