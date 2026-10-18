import type { MoveClassification } from '../types/analysis'
import type { Difficulty } from '../types/chess'

export const RUSH_START_MS = 120_000
export const RUSH_ROUND_BONUS_MS = 30_000
export const RUSH_MAX_TIME_MS = 300_000

/** Opponent strength escalates every round won. */
export const RUSH_LEVELS: ReadonlyArray<{ difficulty: Difficulty; skillLevel: number; depth: number; moveTimeMs: number }> = [
  { difficulty: 'beginner', skillLevel: 0, depth: 8, moveTimeMs: 250 },
  { difficulty: 'intermediate', skillLevel: 5, depth: 9, moveTimeMs: 300 },
  { difficulty: 'advanced', skillLevel: 11, depth: 10, moveTimeMs: 350 },
  { difficulty: 'expert', skillLevel: 17, depth: 11, moveTimeMs: 400 },
]

export const RUSH_QUALITY_MULTIPLIER: Readonly<Record<MoveClassification, number>> = {
  brilliant: 2.5,
  best: 2,
  excellent: 1.6,
  good: 1.2,
  book: 1.2,
  forced: 1,
  inaccuracy: 0.6,
  mistake: 0.3,
  blunder: 0,
}

export const RUSH_SPEED_TIERS: ReadonlyArray<{ maxMs: number; multiplier: number; label: string }> = [
  { maxMs: 2_000, multiplier: 3, label: 'LIGHTNING' },
  { maxMs: 4_000, multiplier: 2, label: 'FAST' },
  { maxMs: 8_000, multiplier: 1.5, label: 'QUICK' },
]

export const RUSH_MATE_BONUS = 1500
/** Score needed per coin earned at the end of a run. */
export const RUSH_POINTS_PER_COIN = 200
export const RUSH_MAX_COINS = 200
