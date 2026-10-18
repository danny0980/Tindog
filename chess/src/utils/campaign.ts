// Pure Grand Campaign bookkeeping: unlock rules, star ratings, rewards,
// relics and achievements. No React, no storage — easy to test.
import { BOARD_THEMES, PIECE_SETS } from '../constants/themes'
import { BOSSES_PER_REALM, GRAND_REALMS, getGrandRealm } from '../data/campaign/realms'
import { BANNER_PAR_FACTOR, FAE_GOLD_FACTOR, getRelic, relicSlots } from '../data/campaign/relics'
import { isHiddenBossId, parentsOf } from '../data/campaign/paths'
import { type TierId, bestTier } from '../data/campaign/tiers'
import type { Boss, BossId, BossRecord, CampaignProgress, GrandRealmId, RelicDef, RelicId, StarCount } from '../types/campaign'
import type { Outcome } from '../types/chess'
import type { AchievementDef, PlayerProfile } from '../types/profile'
import { grant } from './progression'

export const createCampaignProgress = (): CampaignProgress => ({ bosses: {}, relics: [], equipped: [], realmsCleared: [] })

const EMPTY_RECORD: BossRecord = { stars: 0, wins: 0, losses: 0, draws: 0, bestMoves: null, firstClear: null }
export const bossRecord = (progress: CampaignProgress, id: BossId): BossRecord => progress.bosses[id] ?? EMPTY_RECORD

// ── Unlocks ──────────────────────────────────────────────────────────────────

/** The first realm is always open; each later realm opens when the previous overlord falls. */
export function isRealmUnlocked(realm: GrandRealmId, progress: CampaignProgress): boolean {
  const order = getGrandRealm(realm).order
  if (order === 0) return true
  const previous = GRAND_REALMS[order - 1]
  return previous ? progress.realmsCleared.includes(previous.id) : false
}

/**
 * Bosses unlock along their realm's roads: a node opens when ANY node leading
 * to it is conquered, so each zone's fork lets you pick a branch (see paths.ts).
 * A hidden node opens once it is revealed.
 */
export function isBossUnlocked(boss: Boss, roster: readonly Boss[], progress: CampaignProgress): boolean {
  if (!isRealmUnlocked(boss.realm, progress)) return false
  if (boss.hidden) return isEchoRevealed(roster, progress)
  const parents = parentsOf(boss.index)
  if (parents.length === 0) return true
  return parents.some((i) => {
    const parent = roster[i]
    return parent ? Boolean(bossRecord(progress, parent.id).firstClear) : false
  })
}

/** Next boss to fight in a realm (first open, undefeated node), or null when every open node is conquered. */
export const nextBoss = (roster: readonly Boss[], progress: CampaignProgress): Boss | null =>
  roster.find((b) => !bossRecord(progress, b.id).firstClear && isBossUnlocked(b, roster, progress)) ?? null

/** A realm's hidden Echo appears once every one of its nodes — both branches of every fork — is conquered. */
export const isEchoRevealed = (roster: readonly Boss[], progress: CampaignProgress): boolean =>
  roster.length > 0 && roster.every((b) => b.hidden || Boolean(bossRecord(progress, b.id).firstClear))

// ── Counters ─────────────────────────────────────────────────────────────────

/** Records of the realm's regular nodes (hidden Echoes are a bonus, outside the realm's count). */
const records = (progress: CampaignProgress, realm?: GrandRealmId) =>
  (Object.entries(progress.bosses) as [BossId, BossRecord][]).filter(([id]) => !isHiddenBossId(id) && (!realm || id.startsWith(`${realm}.`))).map(([, r]) => r)

export const clearedCount = (progress: CampaignProgress, realm?: GrandRealmId): number => records(progress, realm).filter((r) => r.firstClear).length
export const starCount = (progress: CampaignProgress, realm?: GrandRealmId): number => records(progress, realm).reduce((sum, r) => sum + r.stars, 0)
export const maxStars = (realm?: GrandRealmId): number => (realm ? BOSSES_PER_REALM : BOSSES_PER_REALM * GRAND_REALMS.length) * 3

// ── Stars ────────────────────────────────────────────────────────────────────

/** Effective three-star target, including the Black Prince's Banner. */
export const starTarget = (par: number, relics: readonly RelicId[]): number => (relics.includes('black-prince-banner') ? Math.round(par * BANNER_PAR_FACTOR) : par)
export const twoStarTarget = (par: number, relics: readonly RelicId[]): number => Math.round(starTarget(par, relics) * 1.6)

/**
 * Move-efficiency rating for a victory: ★★★ within par, ★★ within 1.6× par,
 * ★ otherwise. An unshielded takeback caps the rating at one star.
 */
export function starsFor(won: boolean, humanMoves: number, par: number, clean: boolean, relics: readonly RelicId[]): StarCount {
  if (!won) return 0
  if (!clean) return 1
  if (humanMoves <= starTarget(par, relics)) return 3
  if (humanMoves <= twoStarTarget(par, relics)) return 2
  return 1
}

// ── Relics ───────────────────────────────────────────────────────────────────

/** Equip or unequip a relic; refused when it isn't owned, is passive or all slots are full. */
export function toggleRelic(progress: CampaignProgress, id: RelicId): CampaignProgress {
  if (progress.equipped.includes(id)) return { ...progress, equipped: progress.equipped.filter((r) => r !== id) }
  if (!progress.relics.includes(id) || getRelic(id).scope === 'passive') return progress
  if (progress.equipped.length >= relicSlots(progress.relics)) return progress
  return { ...progress, equipped: [...progress.equipped, id] }
}

// ── Results ──────────────────────────────────────────────────────────────────

export interface BossBattleInput {
  outcome: Outcome
  /** Your moves played in the game. */
  humanMoves: number
  /** False when an unshielded takeback was used. */
  clean: boolean
  /** Relics in effect for this battle. */
  relics: readonly RelicId[]
  /** Coin multiplier (parley choices, mutators, difficulty tier, Ironman). */
  rewardFactor?: number
  /** Difficulty tier the battle was fought on (recorded on a win). */
  tier?: TierId
}

export interface BossResult {
  profile: PlayerProfile
  stars: StarCount
  previousStars: StarCount
  coins: number
  firstClear: boolean
  relic: RelicDef | null
  realmCleared: GrandRealmId | null
  /** Cosmetics unlocked by clearing a realm. */
  rewards: string[]
  unlocked: AchievementDef[]
}

export const STAR_BONUS = 15

export function applyBossResult(profile: PlayerProfile, boss: Boss, input: BossBattleInput, now: Date = new Date()): BossResult {
  const nowIso = now.toISOString()
  const progress = profile.campaign
  const before = bossRecord(progress, boss.id)
  const won = input.outcome === 'win'
  const stars = starsFor(won, input.humanMoves, boss.par, input.clean, input.relics)
  const firstClear = won && !before.firstClear
  const best = Math.max(before.stars, stars) as StarCount

  const record: BossRecord = {
    stars: best,
    wins: before.wins + (won ? 1 : 0),
    losses: before.losses + (input.outcome === 'loss' ? 1 : 0),
    draws: before.draws + (input.outcome === 'draw' ? 1 : 0),
    bestMoves: won ? Math.min(before.bestMoves ?? Number.POSITIVE_INFINITY, input.humanMoves) : before.bestMoves,
    firstClear: before.firstClear ?? (won ? nowIso : null),
    ...(won ? { bestTier: bestTier(before.bestTier, input.tier ?? 'normal') } : before.bestTier ? { bestTier: before.bestTier } : {}),
  }

  const base = won ? (firstClear ? boss.rewards.first : boss.rewards.repeat) : 0
  const starBonus = (best - before.stars) * STAR_BONUS
  const coins = Math.round((base + starBonus) * (won && input.relics.includes('fae-gold') ? FAE_GOLD_FACTOR : 1) * (input.rewardFactor ?? 1))

  const relic = firstClear && boss.relic && !progress.relics.includes(boss.relic) ? getRelic(boss.relic) : null
  const realmCleared = firstClear && boss.rank === 'overlord' && !progress.realmsCleared.includes(boss.realm) ? boss.realm : null

  const rewards: string[] = []
  let unlockedThemes = profile.unlockedThemes
  let unlockedPieceSets = profile.unlockedPieceSets
  if (realmCleared) {
    for (const theme of BOARD_THEMES.filter((t) => t.campaignUnlock === realmCleared && !unlockedThemes.includes(t.id))) {
      unlockedThemes = [...unlockedThemes, theme.id]
      rewards.push(theme.name)
    }
    for (const set of PIECE_SETS.filter((p) => p.campaignUnlock === realmCleared && !unlockedPieceSets.includes(p.id))) {
      unlockedPieceSets = [...unlockedPieceSets, set.id]
      rewards.push(set.name)
    }
  }

  const relics = relic ? [...progress.relics, relic.id] : progress.relics
  // A newly earned relic slides straight into a free slot.
  const equipped = relic && relic.scope !== 'passive' && progress.equipped.length < relicSlots(relics) ? [...progress.equipped, relic.id] : progress.equipped
  const campaign: CampaignProgress = {
    bosses: { ...progress.bosses, [boss.id]: record },
    relics,
    equipped,
    realmsCleared: realmCleared ? [...progress.realmsCleared, realmCleared] : progress.realmsCleared,
  }

  const next: PlayerProfile = {
    ...profile,
    coins: profile.coins + coins,
    totalCoinsEarned: profile.totalCoinsEarned + coins,
    unlockedThemes,
    unlockedPieceSets,
    campaign,
  }

  const ids: string[] = []
  if (won) ids.push('first-conquest')
  if (realmCleared) ids.push(getGrandRealm(realmCleared).completionAchievement)
  if (relics.length >= 5) ids.push('relic-hunter')
  if (records(campaign).filter((r) => r.stars === 3).length >= 10) ids.push('three-star-general')
  if (starCount(campaign) >= maxStars()) ids.push('flawless-conqueror')
  const granted = grant(next, ids, nowIso)
  return { profile: granted.profile, stars, previousStars: before.stars, coins, firstClear, relic, realmCleared, rewards, unlocked: granted.unlocked }
}
