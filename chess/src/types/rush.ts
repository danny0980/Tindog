import type { MoveClassification } from './analysis'

export type RushPhase = 'ready' | 'playing' | 'over'

export type RushEndReason = 'timeout' | 'mated' | 'quit'

export interface ScorePopup {
  id: number
  points: number
  label: string
  tone: 'great' | 'good' | 'bad' | 'bonus'
}

export interface RushStats {
  moves: number
  perfectMoves: number
  captures: number
  bestCombo: number
  roundsWon: number
}

export interface RushMoveScore {
  points: number
  quality: MoveClassification
  combo: number
  /** Milliseconds added to (or removed from) the countdown. */
  timeDeltaMs: number
  labels: string[]
}

export interface RushRecord {
  bestScore: number
  bestRound: number
  runs: number
  totalScore: number
}
