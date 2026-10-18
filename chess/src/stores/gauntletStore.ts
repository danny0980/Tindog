import { isBossId } from '../data/campaign/realms'
import { TACTIC_IDS } from '../data/spells'
import type { BossId } from '../types/campaign'
import type { BoonId, GauntletBattleLog, GauntletPhase, GauntletRecord, GauntletRun, GauntletState, LeaderboardEntry } from '../types/gauntlet'
import type { TacticId } from '../types/spells'
import { BOON_IDS, createGauntletState } from '../utils/gauntlet'
import { createPersistentStore } from '../utils/store'
import { arrayOf, asRecord, isRecord, num, oneOf, str } from '../utils/validate'
import { sanitizeEntry } from '../services/leaderboard'

export const GAUNTLET_KEY = 'chess-arena:gauntlet:v1'

const isBoon = (v: unknown): v is BoonId => typeof v === 'string' && (BOON_IDS as readonly string[]).includes(v)
const isTactic = (v: unknown): v is TacticId => typeof v === 'string' && (TACTIC_IDS as readonly string[]).includes(v)
const isOutcome = (v: unknown): v is GauntletBattleLog['outcome'] => v === 'win' || v === 'loss' || v === 'draw'

function sanitizeLog(v: unknown): GauntletBattleLog | null {
  if (!isRecord(v) || !isBossId(v.bossId) || !isOutcome(v.outcome)) return null
  return { bossId: v.bossId, name: str(v.name, 'Boss'), elo: num(v.elo, 800, 0, 4000), outcome: v.outcome, usedMs: num(v.usedMs, 0, 0) }
}

function sanitizeRun(raw: unknown): GauntletRun | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null
  const b = asRecord(raw.boons)
  const phase = oneOf<GauntletPhase>(raw.phase, ['ready', 'battle', 'boon', 'interrupted', 'over'], 'ready')
  const bossId: BossId | null = isBossId(raw.bossId) ? raw.bossId : null
  return {
    id: raw.id,
    seed: num(raw.seed, 1, 0),
    startedAt: str(raw.startedAt, new Date(0).toISOString()),
    // A battle can't survive a reload (games aren't persisted): offer resume-with-penalty instead.
    phase: phase === 'battle' ? 'interrupted' : phase,
    round: num(raw.round, 1, 1),
    defeated: num(raw.defeated, 0, 0),
    streak: num(raw.streak, 0, 0),
    bestStreak: num(raw.bestStreak, 0, 0),
    score: num(raw.score, 0, 0),
    bankMs: num(raw.bankMs, 0, 0, 60 * 60_000),
    boons: {
      incrementMs: num(b.incrementMs, 0, 0, 30_000),
      empBattles: num(b.empBattles, 0, 0, 10),
      tactics: arrayOf(b.tactics, isTactic),
      shields: num(b.shields, 0, 0, 10),
    },
    bossId,
    battleStartBankMs: num(raw.battleStartBankMs, 0, 0, 60 * 60_000),
    offeredBoons: arrayOf(raw.offeredBoons, isBoon),
    log: (Array.isArray(raw.log) ? raw.log : []).map(sanitizeLog).filter((l): l is GauntletBattleLog => l !== null),
    coins: num(raw.coins, 0, 0),
  }
}

function sanitizeRecord(raw: unknown): GauntletRecord {
  const r = asRecord(raw)
  return {
    bestScore: num(r.bestScore, 0, 0),
    bestDefeated: num(r.bestDefeated, 0, 0),
    bestStreak: num(r.bestStreak, 0, 0),
    runs: num(r.runs, 0, 0),
    leaderboard: (Array.isArray(r.leaderboard) ? r.leaderboard : []).map(sanitizeEntry).filter((e): e is LeaderboardEntry => e !== null).slice(0, 10),
  }
}

export function sanitizeGauntlet(raw: unknown): GauntletState {
  if (!isRecord(raw)) return createGauntletState()
  const run = sanitizeRun(raw.run)
  return { version: 1, run: run && run.phase === 'interrupted' && run.bossId === null ? { ...run, phase: 'ready' } : run, record: sanitizeRecord(raw.record) }
}

export const gauntletStore = createPersistentStore<GauntletState>(GAUNTLET_KEY, sanitizeGauntlet, { backupKey: `${GAUNTLET_KEY}:backup` })
