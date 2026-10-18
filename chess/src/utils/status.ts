import type { GameStatus } from '../types/chess'
import { colorName, describeResult } from './chess'

export type StatusTone = 'neutral' | 'success' | 'danger'

/** Compact one-line status used by the thumb dock. */
export function statusSummary(status: GameStatus, opts: { aiThinking: boolean; isLive: boolean; engineLoading: boolean; opponentName?: string }): {
  title: string
  detail: string
  tone: StatusTone
} {
  if (!opts.isLive) return { title: 'Time machine', detail: 'Reviewing an earlier position', tone: 'neutral' }
  if (status.kind === 'over') {
    const { title, detail } = describeResult(status.result)
    return { title, detail, tone: status.result.kind === 'draw' ? 'neutral' : 'success' }
  }
  if (opts.engineLoading) return { title: `Summoning ${opts.opponentName ?? 'Stockfish'}…`, detail: 'Preparing the engine', tone: 'neutral' }
  if (status.inCheck) return { title: 'Check!', detail: `${colorName(status.turn)} must escape`, tone: 'danger' }
  return {
    title: `${colorName(status.turn)} to move`,
    detail: opts.aiThinking ? `${opts.opponentName ?? 'Stockfish'} is thinking…` : 'Your move',
    tone: 'neutral',
  }
}
