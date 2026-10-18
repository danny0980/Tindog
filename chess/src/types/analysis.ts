import type { Color } from './chess'

export type MoveClassification =
  | 'book'
  | 'brilliant'
  | 'best'
  | 'excellent'
  | 'good'
  | 'forced'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'

/** Evaluation normalised to White's point of view. */
export interface PositionEval {
  /** Centipawns for White; mates are mapped to ±(10000 - distance). */
  cp: number
  /** Signed mate distance for White (positive = White mates), or null. */
  mate: number | null
  bestMove: string | null
  depth: number
}

export interface MoveAnalysis {
  ply: number
  san: string
  color: Color
  classification: MoveClassification
  evalBefore: PositionEval
  evalAfter: PositionEval
  /** Drop in the mover's winning chances (0–100). */
  winChanceLoss: number
  /** Engine's preferred move in SAN, when different from the move played. */
  bestMoveSan: string | null
}

export interface GameAnalysis {
  moves: MoveAnalysis[]
  /** Evaluation of every position (index = ply, 0 = start). */
  evals: PositionEval[]
  accuracy: Record<Color, number>
  counts: Record<Color, Record<MoveClassification, number>>
}

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'running'; progress: number; partial: PositionEval[] }
  | { status: 'done'; analysis: GameAnalysis }
  | { status: 'error'; message: string }
