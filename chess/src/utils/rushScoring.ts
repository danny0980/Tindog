import { PIECE_VALUES } from '../constants/game'
import { RUSH_QUALITY_MULTIPLIER, RUSH_SPEED_TIERS } from '../constants/rush'
import { winChance } from '../engine/scoring'
import type { MoveClassification } from '../types/analysis'
import type { Move } from '../types/chess'
import type { RushMoveScore } from '../types/rush'

export interface RushMoveInput {
  move: Move
  /** How long the player took, in ms. */
  thinkMs: number
  /** Player-POV evaluation before and after the move (centipawns). */
  beforeCp: number
  afterCp: number
  /** Combo streak before this move. */
  combo: number
  round: number
}

export function classifyLoss(loss: number): MoveClassification {
  if (loss < 1) return 'best'
  if (loss < 2.5) return 'excellent'
  if (loss < 5) return 'good'
  if (loss < 10) return 'inaccuracy'
  if (loss < 15) return 'mistake'
  return 'blunder'
}

/**
 * Arcade scoring: base points (plus capture/check bonuses) × move quality ×
 * speed tier × combo × round. Strong moves also add time; blunders cost time
 * and break the combo.
 */
export function scoreRushMove({ move, thinkMs, beforeCp, afterCp, combo, round }: RushMoveInput): RushMoveScore {
  const loss = Math.max(0, winChance(beforeCp) - winChance(afterCp))
  const quality = classifyLoss(loss)
  const solid = quality === 'best' || quality === 'excellent' || quality === 'good'
  const nextCombo = solid ? combo + 1 : 0
  const speed = RUSH_SPEED_TIERS.find((tier) => thinkMs <= tier.maxMs)
  const speedMultiplier = speed?.multiplier ?? 1
  const comboMultiplier = 1 + Math.min(nextCombo, 8) * 0.25
  const roundMultiplier = 1 + (round - 1) * 0.25

  const givesCheck = move.san.includes('+') || move.san.includes('#')
  const base = 100 + (move.captured ? PIECE_VALUES[move.captured] * 40 : 0) + (givesCheck ? 60 : 0)
  const points = Math.round(base * RUSH_QUALITY_MULTIPLIER[quality] * speedMultiplier * comboMultiplier * roundMultiplier)

  let timeDeltaMs = 0
  if (quality === 'best' || quality === 'excellent') timeDeltaMs = speed?.label === 'LIGHTNING' ? 5000 : 3000
  else if (quality === 'mistake') timeDeltaMs = -2000
  else if (quality === 'blunder') timeDeltaMs = -5000

  const labels: string[] = []
  if (speed && solid) labels.push(`${speed.label} ×${speedMultiplier}`)
  if (nextCombo >= 2) labels.push(`COMBO ×${comboMultiplier.toFixed(2).replace(/\.?0+$/, '')}`)
  return { points, quality, combo: nextCombo, timeDeltaMs, labels }
}
