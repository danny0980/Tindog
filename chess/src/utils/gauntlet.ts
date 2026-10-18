// Endless Gauntlet rules — pure functions, so the run logic is unit-tested.
//  - One time bank (your clock) carries across back-to-back boss battles.
//  - A win restores part of the time you spent and offers a boon; a draw keeps
//    the run alive without a restore; a loss (or flag) ends it.
//  - Bosses scale with the round, drawn from all 100 campaign characters.
import { TACTIC_IDS, hashSeed, seededRandom } from '../data/spells'
import type { Boss, BossId } from '../types/campaign'
import type { Outcome } from '../types/chess'
import type { BoonId, GauntletBoons, GauntletRecord, GauntletRun, GauntletState, LeaderboardEntry } from '../types/gauntlet'
import type { TacticId } from '../types/spells'

export const START_BANK_MS = 5 * 60_000
export const MAX_BANK_MS = 15 * 60_000
/** Bosses get a fixed, generous clock — the bank is the player's "health". */
export const BOSS_CLOCK_MS = 10 * 60_000
export const BASE_INCREMENT_MS = 2_000
/** Share of the time spent in a battle that a win gives back, plus a flat bonus. */
export const RESTORE_SHARE = 0.35
export const RESTORE_FLAT_MS = 15_000
export const INTERRUPT_PENALTY_MS = 60_000
export const LEADERBOARD_SIZE = 10
export const BOON_IDS: readonly BoonId[] = ['time-cache', 'tempo', 'emp', 'tactic', 'shield']

export const BOONS: Readonly<Record<BoonId, { name: string; description: string }>> = {
  'time-cache': { name: 'Time Cache', description: '+60 seconds in your bank right now.' },
  tempo: { name: 'Tempo', description: '+1 second increment per move for the rest of the run.' },
  emp: { name: 'EMP Burst', description: 'Next boss searches 2 plies shallower and thinks faster.' },
  tactic: { name: 'Tactics Cache', description: 'Start the next battle with a random tactic card.' },
  shield: { name: 'Aegis', description: 'One free takeback in the next battle (Gauntlet otherwise forbids undo).' },
}

export const createGauntletRecord = (): GauntletRecord => ({ bestScore: 0, bestDefeated: 0, bestStreak: 0, runs: 0, leaderboard: [] })
export const createGauntletState = (): GauntletState => ({ version: 1, run: null, record: createGauntletRecord() })

const NO_BOONS: GauntletBoons = { incrementMs: 0, empBattles: 0, tactics: [], shields: 0 }

/** Target opponent rating for a round: 800, +110 per round, capped at 2800. */
export const targetElo = (round: number): number => Math.min(2800, 800 + (Math.max(1, round) - 1) * 110)

export function startRun(now: Date, seed: number = hashSeed(now.toISOString())): GauntletRun {
  return {
    id: `${now.getTime().toString(36)}-${(seed % 46656).toString(36)}`,
    seed,
    startedAt: now.toISOString(),
    phase: 'ready',
    round: 1,
    defeated: 0,
    streak: 0,
    bestStreak: 0,
    score: 0,
    bankMs: START_BANK_MS,
    boons: NO_BOONS,
    bossId: null,
    battleStartBankMs: START_BANK_MS,
    offeredBoons: [],
    log: [],
    coins: 0,
  }
}

/**
 * Chooses the boss for a round: the closest ratings to the target among
 * characters not yet faced this run (ties broken by the run's seed).
 */
export function pickBoss(candidates: readonly Boss[], run: Pick<GauntletRun, 'round' | 'seed' | 'log'>): Boss | null {
  const faced = new Set<BossId>(run.log.map((l) => l.bossId))
  const pool = candidates.filter((b) => !faced.has(b.id))
  if (pool.length === 0) return null
  const target = targetElo(run.round)
  const best = Math.min(...pool.map((b) => Math.abs(b.elo - target)))
  const closest = pool.filter((b) => Math.abs(b.elo - target) <= best + 50)
  const rng = seededRandom(run.seed + run.round * 7919)
  return closest[Math.floor(rng() * closest.length)] ?? null
}

/** Realms whose rosters may hold this round's boss (load them before picking). */
export const realmsForRound = (round: number, ranges: ReadonlyArray<{ id: string; eloRange: readonly [number, number] }>): string[] => {
  const t = targetElo(round)
  return ranges.filter((r) => t >= r.eloRange[0] - 150 && t <= r.eloRange[1] + 150).map((r) => r.id)
}

export const beginBattle = (run: GauntletRun, boss: Boss): GauntletRun => ({ ...run, phase: 'battle', bossId: boss.id, battleStartBankMs: run.bankMs })

export interface BattleResolution {
  run: GauntletRun
  restoredMs: number
  scoreGained: number
  ended: boolean
}

/** Applies a battle result. `remainingMs` is your clock when the game ended. */
export function resolveBattle(run: GauntletRun, boss: Pick<Boss, 'id' | 'name' | 'elo'>, outcome: Outcome, remainingMs: number): BattleResolution {
  const usedMs = Math.max(0, run.battleStartBankMs - remainingMs)
  const log = [...run.log, { bossId: boss.id, name: boss.name, elo: boss.elo, outcome, usedMs }]
  // Battle boons are spent; run-long ones (increment) stay.
  const boons: GauntletBoons = { ...run.boons, empBattles: Math.max(0, run.boons.empBattles - 1), tactics: [], shields: 0 }
  if (outcome === 'loss') {
    return { run: { ...run, phase: 'over', log, boons, bankMs: Math.max(0, remainingMs), streak: 0 }, restoredMs: 0, scoreGained: 0, ended: true }
  }
  if (outcome === 'draw') {
    const scoreGained = Math.round(boss.elo / 4)
    return {
      run: { ...run, phase: 'ready', round: run.round + 1, log, boons, bankMs: remainingMs, streak: 0, score: run.score + scoreGained, bossId: null },
      restoredMs: 0,
      scoreGained,
      ended: false,
    }
  }
  const restoredMs = Math.round(usedMs * RESTORE_SHARE + RESTORE_FLAT_MS)
  const bankMs = Math.min(MAX_BANK_MS, remainingMs + restoredMs)
  const streak = run.streak + 1
  const scoreGained = Math.round(boss.elo * (1 + 0.1 * (streak - 1))) + Math.floor(remainingMs / 1000)
  const offeredBoons = dealBoons(run.seed, run.round)
  return {
    run: {
      ...run,
      phase: 'boon',
      round: run.round + 1,
      defeated: run.defeated + 1,
      streak,
      bestStreak: Math.max(run.bestStreak, streak),
      score: run.score + scoreGained,
      bankMs,
      boons,
      bossId: null,
      offeredBoons,
      log,
    },
    restoredMs: bankMs - remainingMs,
    scoreGained,
    ended: false,
  }
}

/** Three of the five boons, reproducible from the run seed and round. */
export function dealBoons(seed: number, round: number): BoonId[] {
  const rng = seededRandom(seed ^ (round * 2654435761))
  const pool = [...BOON_IDS]
  const out: BoonId[] = []
  while (out.length < 3 && pool.length > 0) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0] as BoonId)
  return out
}

/** Applies the chosen boon and readies the next battle. */
export function chooseBoon(run: GauntletRun, boon: BoonId): GauntletRun {
  if (run.phase !== 'boon' || !run.offeredBoons.includes(boon)) return run
  const b = run.boons
  const rng = seededRandom(run.seed + run.round * 104729)
  const tactic: TacticId = TACTIC_IDS.filter((t) => t !== 'chronos-hourglass' && t !== 'second-wind')[Math.floor(rng() * 4)] ?? 'katana-blade'
  const boons: GauntletBoons =
    boon === 'tempo'
      ? { ...b, incrementMs: b.incrementMs + 1_000 }
      : boon === 'emp'
        ? { ...b, empBattles: b.empBattles + 1 }
        : boon === 'tactic'
          ? { ...b, tactics: [...b.tactics, tactic] }
          : boon === 'shield'
            ? { ...b, shields: b.shields + 1 }
            : b
  return {
    ...run,
    phase: 'ready',
    offeredBoons: [],
    boons,
    bankMs: boon === 'time-cache' ? Math.min(MAX_BANK_MS, run.bankMs + 60_000) : run.bankMs,
  }
}

/** The app closed mid-battle: resume the same boss with a time penalty. */
export const resumeInterrupted = (run: GauntletRun): GauntletRun =>
  run.phase === 'interrupted' ? { ...run, phase: 'ready', bankMs: Math.max(30_000, run.battleStartBankMs - INTERRUPT_PENALTY_MS) } : run

export const abandonRun = (run: GauntletRun): GauntletRun => ({ ...run, phase: 'over' })

/** Coins for a finished run. */
export const runCoins = (score: number): number => Math.min(300, Math.floor(score / 50))

export function insertLeaderboard(board: readonly LeaderboardEntry[], entry: LeaderboardEntry, size = LEADERBOARD_SIZE): LeaderboardEntry[] {
  return [...board.filter((e) => e.id !== entry.id), entry].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date)).slice(0, size)
}

/** Books a finished run into the personal record and local leaderboard. */
export function recordRun(record: GauntletRecord, run: GauntletRun, name: string, now: Date, title?: string): GauntletRecord {
  const entry: LeaderboardEntry = { id: run.id, name, score: run.score, defeated: run.defeated, bestStreak: run.bestStreak, date: now.toISOString(), ...(title ? { title } : {}) }
  return {
    bestScore: Math.max(record.bestScore, run.score),
    bestDefeated: Math.max(record.bestDefeated, run.defeated),
    bestStreak: Math.max(record.bestStreak, run.bestStreak),
    runs: record.runs + 1,
    leaderboard: run.score > 0 ? insertLeaderboard(record.leaderboard, entry) : record.leaderboard,
  }
}
