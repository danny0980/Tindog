import type { Color, GameStatus } from '../types/chess'

export type Mood =
  | 'calm'
  | 'thinking'
  | 'confident'
  | 'dominating'
  | 'worried'
  | 'desperate'
  | 'tense'
  | 'check'
  | 'victory'
  | 'defeat'
  | 'draw'

export interface MoodInput {
  color: Color
  status: GameStatus
  /** White-POV centipawns, if an evaluation is available. */
  evalCp: number | null
  isTurn: boolean
  thinking: boolean
  lowTime: boolean
}

/** Maps game state to an avatar expression. */
export function deriveMood({ color, status, evalCp, isTurn, thinking, lowTime }: MoodInput): Mood {
  if (status.kind === 'over') {
    const r = status.result
    if (r.kind === 'draw') return 'draw'
    return r.winner === color ? 'victory' : 'defeat'
  }
  if (status.inCheck && isTurn) return 'check'
  if (thinking) return 'thinking'
  if (lowTime) return 'tense'
  if (evalCp === null) return 'calm'
  const advantage = color === 'w' ? evalCp : -evalCp
  if (advantage > 350) return 'dominating'
  if (advantage > 120) return 'confident'
  if (advantage < -350) return 'desperate'
  if (advantage < -120) return 'worried'
  return 'calm'
}

/** 0–1 "tension" used to drive the adaptive soundtrack. */
export function gameTension(status: GameStatus, evalCp: number | null, lowTime: boolean): number {
  if (status.kind === 'over') return 0.1
  let tension = 0.2
  if (evalCp !== null) tension += Math.min(0.4, Math.abs(evalCp) / 1000)
  if (status.inCheck) tension += 0.3
  if (lowTime) tension += 0.35
  return Math.min(1, tension)
}
