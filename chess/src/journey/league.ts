// Weekly leagues: Bronze, Silver, Gold and Diamond. Each week you race 19
// characters from history for league points (the XP you earn that week). The
// top five move up a league, the bottom five move down. The rivals are the
// game's own characters, not other players: their scores grow through the
// week along a deterministic curve, so the table is the same every time you
// look at it. Pure and unit-tested.
import { CLASSIC_ROSTER } from '../data/classic/roster'
import { hashSeed, seededRandom } from '../data/spells'

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'diamond'
export const LEAGUE_TIERS: readonly LeagueTier[] = ['bronze', 'silver', 'gold', 'diamond']
export const LEAGUE_SIZE = 20
export const PROMOTE = 5
export const DEMOTE = 5

export const LEAGUE_INFO: Readonly<Record<LeagueTier, { name: string; color: string; pace: number }>> = {
  bronze: { name: 'Bronze League', color: '#d97706', pace: 260 },
  silver: { name: 'Silver League', color: '#cbd5e1', pace: 520 },
  gold: { name: 'Gold League', color: '#facc15', pace: 900 },
  diamond: { name: 'Diamond League', color: '#7dd3fc', pace: 1400 },
}

/** The Monday that starts the local week of `date`, as YYYY-MM-DD. */
export function weekKey(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const back = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - back)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** How far through the week `date` is (0 at Monday 00:00, 1 at the end of Sunday). */
export function weekProgress(date: Date = new Date()): number {
  const [y, m, d] = weekKey(date).split('-').map(Number)
  const start = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime()
  return Math.min(1, Math.max(0, (date.getTime() - start) / (7 * 86_400_000)))
}

export interface LeagueRow {
  key: string
  name: string
  /** Classic character id (for the portrait), or null for you. */
  classicId: string | null
  points: number
  you: boolean
}

/** This week's 19 rivals for a league (the same all week). */
export function rivals(week: string, tier: LeagueTier): Array<{ classicId: string; name: string; target: number }> {
  const rng = seededRandom(hashSeed(`league:${week}:${tier}`))
  const pool = [...CLASSIC_ROSTER]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = pool[i]!
    pool[i] = pool[j]!
    pool[j] = t
  }
  const pace = LEAGUE_INFO[tier].pace
  return pool.slice(0, LEAGUE_SIZE - 1).map((c) => ({ classicId: c.id, name: c.name, target: Math.round(pace * (0.35 + rng() * 1.3)) }))
}

/** A rival's points at `progress` through the week: steady play with a weekend push. */
export function rivalPoints(target: number, progress: number, seed: number): number {
  const p = Math.min(1, Math.max(0, progress))
  const wobble = 0.92 + (seededRandom(seed)() * 0.16)
  return Math.round(target * Math.min(1, Math.pow(p, 0.85) * wobble))
}

export function standings(week: string, tier: LeagueTier, myPoints: number, myName: string, progress: number): LeagueRow[] {
  const rows: LeagueRow[] = rivals(week, tier).map((r) => ({
    key: `classic:${r.classicId}`,
    name: r.name,
    classicId: r.classicId,
    points: rivalPoints(r.target, progress, hashSeed(`${week}:${r.classicId}`)),
    you: false,
  }))
  rows.push({ key: 'you', name: myName || 'You', classicId: null, points: Math.max(0, Math.round(myPoints)), you: true })
  // Ties go to you: you earned them in person.
  return rows.sort((a, b) => b.points - a.points || (a.you ? -1 : b.you ? 1 : 0))
}

export type LeagueMove = 'up' | 'down' | 'stay'

export function moveFor(tier: LeagueTier, rank: number): LeagueMove {
  const i = LEAGUE_TIERS.indexOf(tier)
  if (rank <= PROMOTE && i < LEAGUE_TIERS.length - 1) return 'up'
  if (rank > LEAGUE_SIZE - DEMOTE && i > 0) return 'down'
  return 'stay'
}

export function nextTier(tier: LeagueTier, move: LeagueMove): LeagueTier {
  const i = LEAGUE_TIERS.indexOf(tier)
  if (move === 'up') return LEAGUE_TIERS[Math.min(LEAGUE_TIERS.length - 1, i + 1)]!
  if (move === 'down') return LEAGUE_TIERS[Math.max(0, i - 1)]!
  return tier
}

/** Coins for a final weekly rank (the league you finished in scales them). */
export function leagueCoins(tier: LeagueTier, rank: number): number {
  const base = rank === 1 ? 500 : rank === 2 ? 320 : rank === 3 ? 220 : rank <= 10 ? 100 : 40
  return Math.round(base * (1 + LEAGUE_TIERS.indexOf(tier) * 0.5))
}

export interface LeagueResult {
  week: string
  tier: LeagueTier
  rank: number
  points: number
  move: LeagueMove
  coins: number
}

/** Closes a finished week: final rank, promotion or demotion, and the prize. */
export function settleWeek(week: string, tier: LeagueTier, points: number, name: string): LeagueResult {
  const table = standings(week, tier, points, name, 1)
  const rank = table.findIndex((r) => r.you) + 1
  // A week you didn't play at all keeps you where you were.
  const move = points <= 0 ? 'stay' : moveFor(tier, rank)
  return { week, tier, rank, points, move, coins: points > 0 ? leagueCoins(tier, rank) : 0 }
}
