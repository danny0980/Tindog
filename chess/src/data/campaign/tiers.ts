// Campaign difficulty tiers: the same bosses, tuned weaker or stronger, with
// rewards to match. The best tier you have beaten each boss on is recorded.
import type { OpponentProfile } from '../../types/engine'

export type TierId = 'story' | 'normal' | 'heroic' | 'legendary'

export interface TierDef {
  id: TierId
  name: string
  description: string
  /** Rank for "best tier beaten" comparisons. */
  rank: number
  /** Multiplier on campaign coin rewards. */
  rewardFactor: number
  /** Engine strength changes (applied on top of the boss's archetype profile). */
  skill: number
  depth: number
  /** Centipawns of tolerance added (+) / removed (−): how readily the boss picks a weaker move. */
  tolerance: number
}

export const TIERS: Readonly<Record<TierId, TierDef>> = {
  story: { id: 'story', name: 'Story', description: 'Bosses play gently — enjoy the tale. Rewards ×0.5.', rank: 0, rewardFactor: 0.5, skill: -5, depth: -3, tolerance: 60 },
  normal: { id: 'normal', name: 'Normal', description: 'Every boss as designed.', rank: 1, rewardFactor: 1, skill: 0, depth: 0, tolerance: 0 },
  heroic: { id: 'heroic', name: 'Heroic', description: 'Sharper, deeper bosses. Rewards ×1.5.', rank: 2, rewardFactor: 1.5, skill: 3, depth: 2, tolerance: -15 },
  legendary: { id: 'legendary', name: 'Legendary', description: 'Bosses at full strength, no mercy. Rewards ×2.5.', rank: 3, rewardFactor: 2.5, skill: 8, depth: 4, tolerance: -40 },
}

export const TIER_IDS = Object.keys(TIERS) as TierId[]

export const isTierId = (v: unknown): v is TierId => typeof v === 'string' && (TIER_IDS as readonly string[]).includes(v)

/** A boss profile tuned for a tier. */
export function applyTier(profile: OpponentProfile, tier: TierId): OpponentProfile {
  const t = TIERS[tier]
  if (t.id === 'normal') return profile
  return {
    ...profile,
    skillLevel: Math.max(0, Math.min(20, profile.skillLevel + t.skill)),
    depth: Math.max(1, profile.depth + t.depth),
    toleranceCp: Math.max(0, profile.toleranceCp + t.tolerance),
  }
}

/** The better of two tiers (for the per-boss record). */
export const bestTier = (a: TierId | undefined, b: TierId): TierId => (a && TIERS[a].rank >= TIERS[b].rank ? a : b)
