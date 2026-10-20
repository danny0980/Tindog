// Monthly ranked seasons: tiers from your rating, a soft reset toward 1500
// when a new month begins, and each player's final standing kept in their
// season history. Pure helpers; the Store keeps the data.

export interface Tier {
  id: string
  name: string
  min: number
}

/** Highest first. */
export const TIERS: readonly Tier[] = [
  { id: 'legend', name: 'Legend', min: 2000 },
  { id: 'diamond', name: 'Diamond', min: 1800 },
  { id: 'platinum', name: 'Platinum', min: 1600 },
  { id: 'gold', name: 'Gold', min: 1400 },
  { id: 'silver', name: 'Silver', min: 1200 },
  { id: 'bronze', name: 'Bronze', min: 0 },
]

export const tierFor = (rating: number): Tier => TIERS.find((t) => rating >= t.min) ?? TIERS[TIERS.length - 1]!

/** The season a moment belongs to: "2026-10" (UTC month). */
export const seasonOf = (ms: number): string => new Date(ms).toISOString().slice(0, 7)

/** When a season ends (the first moment of the next UTC month). */
export function seasonEnd(season: string): number {
  const [y, m] = season.split('-').map(Number)
  return Date.UTC(y ?? 1970, m ?? 1, 1)
}

/** New season: ratings move a quarter of the way back toward 1500. */
export const softReset = (rating: number): number => Math.round(1500 + (rating - 1500) * 0.75)

export interface SeasonRow {
  games: number
  wins: number
  peak: number
}

export interface SeasonResult {
  season: string
  rating: number
  tier: string
  rank: number
  games: number
}
