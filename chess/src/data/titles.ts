// Noble ranks (from your rating) and feat titles (from what you have done).
import type { PlayerProfile } from '../types/profile'
import type { TitleDef } from '../types/rpg'
import { journeyStore } from '../journey/journeyStore'
import { LEVEL_TITLES, levelInfo } from '../journey/xp'

export interface TitleContext {
  profile: PlayerProfile
  /** Best Endless Gauntlet streak. */
  gauntletBest: number
}

/** Noble ranks by peak rating, lowest first. */
export const NOBLE_RANKS: ReadonlyArray<TitleDef & { minElo: number }> = [
  { id: 'squire', name: 'Squire', kind: 'rank', minElo: 0, description: 'Every journey starts with a pawn move.' },
  { id: 'knight', name: 'Knight', kind: 'rank', minElo: 1400, description: 'Reach a peak rating of 1400.' },
  { id: 'baron', name: 'Baron', kind: 'rank', minElo: 1600, description: 'Reach a peak rating of 1600.' },
  { id: 'count', name: 'Count', kind: 'rank', minElo: 1800, description: 'Reach a peak rating of 1800.' },
  { id: 'duke', name: 'Duke', kind: 'rank', minElo: 2000, description: 'Reach a peak rating of 2000.' },
  { id: 'archduke', name: 'Archduke', kind: 'rank', minElo: 2200, description: 'Reach a peak rating of 2200.' },
]

export const FEAT_TITLES: ReadonlyArray<TitleDef & { earned: (ctx: TitleContext) => boolean }> = [
  { id: 'slayer-of-chronos', name: 'Slayer of Chronos', kind: 'feat', description: 'Clear the Historical Legends realm.', earned: ({ profile }) => profile.campaign.realmsCleared.includes('chronicle') },
  { id: 'mythbreaker', name: 'the Mythbreaker', kind: 'feat', description: 'Clear the Mythology & Fantasy realm.', earned: ({ profile }) => profile.campaign.realmsCleared.includes('mythic') },
  { id: 'grandmaster-of-shadows', name: 'Grandmaster of Shadows', kind: 'feat', description: 'Clear the Age of Discovery & Blades realm.', earned: ({ profile }) => profile.campaign.realmsCleared.includes('discovery') },
  { id: 'ghost-in-the-machine', name: 'Ghost in the Machine', kind: 'feat', description: 'Clear the Cyberpunk & Dystopia realm.', earned: ({ profile }) => profile.campaign.realmsCleared.includes('cyber') },
  { id: 'lord-of-the-cosmos', name: 'Lord of the Cosmos', kind: 'feat', description: 'Clear the Cosmic Pantheon.', earned: ({ profile }) => profile.campaign.realmsCleared.includes('cosmic') },
  { id: 'master-of-history', name: 'Master of History', kind: 'feat', description: 'Defeat every Chronos legend.', earned: ({ profile }) => Boolean(profile.achievements['master-of-time']) },
  { id: 'iron-monarch', name: 'the Iron Monarch', kind: 'feat', description: 'Clear a realm in Ironman mode.', earned: ({ profile }) => profile.ironman.realmsConquered.length > 0 },
  { id: 'gauntlet-champion', name: 'Gauntlet Champion', kind: 'feat', description: 'Win 5 battles in a row in the Endless Gauntlet.', earned: ({ gauntletBest }) => gauntletBest >= 5 },
  { id: 'tournament-victor', name: 'Tournament Victor', kind: 'feat', description: 'Win a daily tournament.', earned: ({ profile }) => profile.tournamentsWon > 0 },
  { id: 'relic-keeper', name: 'Relic Keeper', kind: 'feat', description: 'Own five relics.', earned: ({ profile }) => profile.campaign.relics.length >= 5 },
  { id: 'bounty-hunter', name: 'Bounty Hunter', kind: 'feat', description: 'Complete five bounty contracts.', earned: ({ profile }) => profile.feats.bountiesCompleted >= 5 },
  { id: 'alchemist', name: 'the Alchemist', kind: 'feat', description: 'Drink ten battle potions.', earned: ({ profile }) => profile.feats.potionsDrunk >= 10 },
  { id: 'brilliant-mind', name: 'Brilliant Mind', kind: 'feat', description: 'Play five brilliant moves (in analysed games).', earned: ({ profile }) => profile.matches.reduce((n, m) => n + (m.analysis?.brilliant ?? 0), 0) >= 5 },
]

type FeatTitle = TitleDef & { earned: (ctx: TitleContext) => boolean }

/** Journey titles: one per level milestone (kept for good after a prestige), and those won on the Journey. */
export function journeyTitles(): FeatTitle[] {
  const j = journeyStore.get()
  const level = levelInfo(j.xp).level
  return [
    ...LEVEL_TITLES.filter((t) => t.level > 1).map((t) => ({ id: t.id, name: t.name, kind: 'feat' as const, description: `Reach level ${t.level} on your Journey.`, earned: () => j.prestige > 0 || level >= t.level })),
    ...j.titles.map((t) => ({ id: t.id, name: t.name, kind: 'feat' as const, description: 'Won on your Journey.', earned: () => true })),
  ]
}

/** Every feat title, the Journey's included. */
export const allFeatTitles = (): FeatTitle[] => [...FEAT_TITLES, ...journeyTitles()]

/** Your noble rank from your peak rating. */
export function nobleRank(peakElo: number): TitleDef {
  let rank: TitleDef = NOBLE_RANKS[0] ?? { id: 'squire', name: 'Squire', kind: 'rank', description: '' }
  for (const r of NOBLE_RANKS) if (peakElo >= r.minElo) rank = r
  return rank
}

/** The next noble rank and the rating it needs (null at the top). */
export function nextRank(peakElo: number): { rank: TitleDef; elo: number } | null {
  const next = NOBLE_RANKS.find((r) => r.minElo > peakElo)
  return next ? { rank: next, elo: next.minElo } : null
}

export const earnedTitles = (ctx: TitleContext): TitleDef[] => [
  nobleRank(ctx.profile.peakElo),
  ...allFeatTitles().filter((t) => t.earned(ctx)),
]

/** The title shown on your card: your chosen feat title if still earned, else your rank. */
export function displayTitle(ctx: TitleContext): TitleDef {
  const chosen = ctx.profile.title ? allFeatTitles().find((t) => t.id === ctx.profile.title && t.earned(ctx)) : undefined
  return chosen ?? nobleRank(ctx.profile.peakElo)
}

/** Noble rank for a leaderboard rating (other players / bosses). */
export const rankForElo = (elo: number): string => nobleRank(elo).name
