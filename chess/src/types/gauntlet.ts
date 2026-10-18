import type { BossId } from './campaign'
import type { Outcome } from './chess'
import type { TacticId } from './spells'

/** Temporary run-long rewards picked after each victory. */
export type BoonId = 'time-cache' | 'tempo' | 'emp' | 'tactic' | 'shield'

export interface GauntletBoons {
  /** Extra Fischer increment for the rest of the run (ms). */
  incrementMs: number
  /** Next battle(s) with the boss searching shallower. */
  empBattles: number
  /** Tactics granted for the next battle. */
  tactics: TacticId[]
  /** Free takebacks for the next battle (Gauntlet otherwise forbids undo). */
  shields: number
}

export interface GauntletBattleLog {
  bossId: BossId
  name: string
  elo: number
  outcome: Outcome
  /** Time used from the bank in that battle (ms). */
  usedMs: number
}

export type GauntletPhase =
  /** Ready to fight the next boss. */
  | 'ready'
  /** A battle is on the board. */
  | 'battle'
  /** Won: choose one boon. */
  | 'boon'
  /** The app was closed mid-battle; resume with a penalty or abandon. */
  | 'interrupted'
  /** Run ended. */
  | 'over'

export interface GauntletRun {
  id: string
  seed: number
  startedAt: string
  phase: GauntletPhase
  /** Battles started so far (the current/next battle is `round`). */
  round: number
  defeated: number
  streak: number
  bestStreak: number
  score: number
  /** Your clock, carried from battle to battle (ms). */
  bankMs: number
  boons: GauntletBoons
  /** Boss lined up for the current/next battle. */
  bossId: BossId | null
  /** Bank at the start of the current battle (for the time-used tally). */
  battleStartBankMs: number
  offeredBoons: BoonId[]
  log: GauntletBattleLog[]
  /** Coins paid out when the run ended. */
  coins: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  score: number
  defeated: number
  bestStreak: number
  date: string
  /** Noble rank or feat title shown beside the name. */
  title?: string
}

export interface GauntletRecord {
  bestScore: number
  bestDefeated: number
  bestStreak: number
  runs: number
  /** Local top 10. */
  leaderboard: LeaderboardEntry[]
}

export interface GauntletState {
  version: 1
  run: GauntletRun | null
  record: GauntletRecord
}
