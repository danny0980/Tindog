// Single entry point for every Chronos Chess character and setting:
//   data/eras/   — historical epochs + legends (Historical Timeline campaign)
//   data/realms/ — fantasy realms + legends (Fantasy Realm campaign)
//   data/campaigns.ts — chapter order of each campaign
import type { OpponentProfile } from '../types/engine'
import type { CampaignId, Epoch, EpochId, Legend, LegendId, LegendStrength } from '../types/legend'
import { getCampaign } from './campaigns'
import { HISTORICAL_EPOCHS } from './eras/epochs'
import { HISTORICAL_LEGENDS } from './eras/legends'
import { FANTASY_REALMS } from './realms/realms'
import { FANTASY_LEGENDS } from './realms/legends'

export { CAMPAIGNS, getCampaign } from './campaigns'

export const EPOCHS: ReadonlyArray<Epoch> = [...HISTORICAL_EPOCHS, ...FANTASY_REALMS]
export const LEGENDS: ReadonlyArray<Legend> = [...HISTORICAL_LEGENDS, ...FANTASY_LEGENDS]

export const getLegend = (id: LegendId): Legend => LEGENDS.find((l) => l.id === id) ?? (LEGENDS[0] as Legend)
export const getEpoch = (id: EpochId): Epoch => EPOCHS.find((e) => e.id === id) ?? (EPOCHS[0] as Epoch)
export const LEGEND_IDS: readonly LegendId[] = LEGENDS.map((l) => l.id)
export const EPOCH_IDS: readonly EpochId[] = EPOCHS.map((e) => e.id)

/** Legends of one campaign in chapter order. */
export function campaignLegends(campaign: CampaignId): Legend[] {
  return getCampaign(campaign).chapters.map((id) => getLegend(id))
}

/** A legend can be challenged once every earlier chapter of *its own* campaign is defeated. */
export function isLegendUnlocked(id: LegendId, defeated: Partial<Record<LegendId, string>>): boolean {
  const chapters = getCampaign(getLegend(id).campaign).chapters
  const index = chapters.indexOf(id)
  return chapters.slice(0, Math.max(0, index)).every((prev) => Boolean(defeated[prev]))
}

/** The next chapter to play in a campaign (first unlocked & undefeated), or null when complete. */
export function nextChapter(campaign: CampaignId, defeated: Partial<Record<LegendId, string>>): Legend | null {
  return campaignLegends(campaign).find((l) => !defeated[l.id]) ?? null
}

export const isCampaignComplete = (campaign: CampaignId, defeated: Partial<Record<LegendId, string>>): boolean =>
  getCampaign(campaign).chapters.every((id) => Boolean(defeated[id]))

// ── Free-play strength scaling ───────────────────────────────────────────────

export const LEGEND_STRENGTHS: ReadonlyArray<{
  id: LegendStrength
  label: string
  description: string
  /** Added to the legend's rating for Elo. */
  eloOffset: number
  /** Multiplier on rematch coin rewards. */
  rewardFactor: number
}> = [
  { id: 'novice', label: 'Novice', description: 'Same style, gentler strength', eloOffset: -350, rewardFactor: 0.5 },
  { id: 'authentic', label: 'Authentic', description: 'The legend as met in the campaign', eloOffset: 0, rewardFactor: 1 },
  { id: 'mythic', label: 'Mythic', description: 'Full strength, deeper and sharper', eloOffset: 200, rewardFactor: 1.5 },
]

export const strengthInfo = (strength: LegendStrength) =>
  LEGEND_STRENGTHS.find((s) => s.id === strength) ?? (LEGEND_STRENGTHS[1] as (typeof LEGEND_STRENGTHS)[number])

/**
 * Scales a legend's engine profile without touching its style weights or
 * repertoire, so a Novice Napoleon still attacks — he just misses more.
 */
export function applyStrength(profile: OpponentProfile, strength: LegendStrength): OpponentProfile {
  if (strength === 'novice') {
    return {
      ...profile,
      skillLevel: Math.max(0, profile.skillLevel - 7),
      depth: Math.max(4, profile.depth - 4),
      moveTimeMs: Math.round(profile.moveTimeMs * 0.6),
      toleranceCp: Math.round(profile.toleranceCp * 1.7 + 40),
      noise: profile.noise + 0.35,
    }
  }
  if (strength === 'mythic') {
    return {
      ...profile,
      skillLevel: 20,
      depth: profile.depth + 4,
      moveTimeMs: Math.round(profile.moveTimeMs * 1.4),
      toleranceCp: Math.max(10, Math.round(profile.toleranceCp * 0.6)),
      noise: profile.noise * 0.5,
    }
  }
  return profile
}

export const legendElo = (legend: Legend, strength: LegendStrength): number => legend.elo + strengthInfo(strength).eloOffset

// ── Display helpers ──────────────────────────────────────────────────────────

/** "50 BCE", "AD 1687", or the realm's age for fantasy settings. */
export function epochLabel(epoch: Epoch): string {
  if (epoch.year === null) return epoch.span
  return epoch.year < 0 ? `${Math.abs(epoch.year)} BCE` : `AD ${epoch.year}`
}

/** Caption for the jump between two timeline stops (forward, backward, or between realms). */
export function jumpLabel(from: Epoch, to: Epoch): string {
  if (from.year === null || to.year === null) return 'through the veil'
  const gap = to.year - from.year
  return gap >= 0 ? `+${gap.toLocaleString()} yrs` : `${Math.abs(gap).toLocaleString()} yrs back`
}
