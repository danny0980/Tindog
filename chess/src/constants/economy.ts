import type { Difficulty } from '../types/chess'

export const WIN_REWARD: Readonly<Record<Difficulty, number>> = {
  beginner: 15,
  intermediate: 30,
  advanced: 60,
  expert: 120,
}

/** Fraction of the win reward granted for a draw. */
export const DRAW_REWARD_FACTOR = 0.4
export const LOSS_REWARD = 5

export const PUZZLE_REWARD: Readonly<Record<2 | 3, number>> = { 2: 20, 3: 35 }
/** Reward multiplier when a hint was used or a wrong move was played. */
export const PUZZLE_ASSISTED_FACTOR = 0.5

export const MAX_MATCH_HISTORY = 60
export const MAX_ELO_HISTORY = 200
