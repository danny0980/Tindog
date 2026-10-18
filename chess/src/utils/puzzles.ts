import { PUZZLES } from '../data/puzzles'
import type { Puzzle } from '../types/puzzle'
import { dayNumber, localDateKey } from './date'

export const DAILY_PUZZLE_COUNT = 3

/** Today's puzzles — deterministic per local date, cycling through the bank. */
export function getDailyPuzzles(dateKey: string = localDateKey()): Puzzle[] {
  if (PUZZLES.length === 0) return []
  const day = dayNumber(dateKey)
  const out: Puzzle[] = []
  for (let k = 0; k < Math.min(DAILY_PUZZLE_COUNT, PUZZLES.length); k += 1) {
    const puzzle = PUZZLES[(day * DAILY_PUZZLE_COUNT + k) % PUZZLES.length]
    if (puzzle) out.push(puzzle)
  }
  return out
}
