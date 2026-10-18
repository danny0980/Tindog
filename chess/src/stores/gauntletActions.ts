// Gauntlet side effects: run state transitions, coin payout, local records and
// (when configured) global leaderboard submission.
import { globalLeaderboard } from '../services/leaderboard'
import type { Boss } from '../types/campaign'
import type { Outcome } from '../types/chess'
import type { BoonId, GauntletRun } from '../types/gauntlet'
import { abandonRun, beginBattle, chooseBoon, recordRun, resolveBattle, resumeInterrupted, runCoins, startRun } from '../utils/gauntlet'
import { gauntletStore } from './gauntletStore'
import { profileStore } from './profileStore'
import { showToast } from './toastStore'

export interface GauntletSummary {
  bossName: string
  outcome: Outcome
  restoredMs: number
  scoreGained: number
  score: number
  defeated: number
  ended: boolean
  coins: number
  newBest: boolean
}

const setRun = (fn: (run: GauntletRun) => GauntletRun) =>
  gauntletStore.set((s) => (s.run ? { ...s, run: fn(s.run) } : s))

export const startGauntletRun = (now: Date = new Date()) => gauntletStore.set((s) => ({ ...s, run: startRun(now) }))
export const pickGauntletBoon = (boon: BoonId) => setRun((run) => chooseBoon(run, boon))
export const resumeGauntletRun = () => setRun(resumeInterrupted)
export const beginGauntletBattle = (boss: Boss) => setRun((run) => beginBattle(run, boss))
export const clearGauntletRun = () => gauntletStore.set((s) => ({ ...s, run: null }))

/** Ends the run (abandon / forfeit) and books it. */
export function endGauntletRun(): void {
  const run = gauntletStore.get().run
  if (!run || run.phase === 'over') return
  closeRun(abandonRun(run))
}

function closeRun(run: GauntletRun): { coins: number; newBest: boolean } {
  const state = gauntletStore.get()
  const coins = runCoins(run.score)
  const newBest = run.score > state.record.bestScore
  const profile = profileStore.get()
  const now = new Date()
  gauntletStore.set({ ...state, run: { ...run, phase: 'over', coins }, record: recordRun(state.record, run, profile.name, now) })
  if (coins > 0) profileStore.set((p) => ({ ...p, coins: p.coins + coins, totalCoinsEarned: p.totalCoinsEarned + coins }))
  if (globalLeaderboard && run.score > 0) {
    globalLeaderboard
      .submit({ id: run.id, name: profile.name, score: run.score, defeated: run.defeated, bestStreak: run.bestStreak, date: now.toISOString() })
      .catch(() => showToast('warning', 'Leaderboard offline', 'Your run is saved locally; the global board could not be reached.'))
  }
  return { coins, newBest }
}

/** Books a finished Gauntlet battle. Returns what the game-over screen should show. */
export function finishGauntletBattle(boss: Pick<Boss, 'id' | 'name' | 'elo'>, outcome: Outcome, remainingMs: number): GauntletSummary | null {
  const run = gauntletStore.get().run
  if (!run || run.phase !== 'battle' || run.bossId !== boss.id) return null
  const r = resolveBattle(run, boss, outcome, remainingMs)
  let coins = 0
  let newBest = false
  if (r.ended) ({ coins, newBest } = closeRun(r.run))
  else gauntletStore.set((s) => ({ ...s, run: r.run }))
  return {
    bossName: boss.name,
    outcome,
    restoredMs: r.restoredMs,
    scoreGained: r.scoreGained,
    score: r.run.score,
    defeated: r.run.defeated,
    ended: r.ended,
    coins,
    newBest,
  }
}
