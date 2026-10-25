// Player level, level titles and prestige. Every game, puzzle and lesson earns
// XP; fifty levels make a full journey, after which you may start again from
// level 1 with a prestige crown (and opponents who play a little stronger).
// Pure and unit-tested.

export const MAX_LEVEL = 50
export const MAX_PRESTIGE = 10
/** Each prestige makes your character opponents play this much stronger (Elo). */
export const PRESTIGE_ELO = 40
/** Coins paid when you prestige. */
export const PRESTIGE_COINS = 2000

/** XP needed to go from `level` to the next one. */
export const xpToNext = (level: number): number => 100 + (Math.max(1, level) - 1) * 20

/** Total XP needed to reach `level` from level 1. */
export function xpForLevel(level: number): number {
  let total = 0
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) total += xpToNext(l)
  return total
}

export interface LevelInfo {
  level: number
  /** XP earned inside the current level. */
  into: number
  /** XP the current level needs (0 at the top). */
  need: number
  /** 0–1 progress through the current level. */
  fraction: number
  maxed: boolean
}

export function levelInfo(xp: number): LevelInfo {
  let level = 1
  let rest = Math.max(0, Math.floor(xp))
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level)
    level += 1
  }
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, into: 0, need: 0, fraction: 1, maxed: true }
  const need = xpToNext(level)
  return { level, into: rest, need, fraction: rest / need, maxed: false }
}

export interface LevelTitle {
  id: string
  level: number
  name: string
}

/** Titles earned by level; they join the feat titles you can wear on your card. */
export const LEVEL_TITLES: readonly LevelTitle[] = [
  { id: 'lvl-apprentice', level: 1, name: 'Apprentice' },
  { id: 'lvl-strategist', level: 5, name: 'Strategist' },
  { id: 'lvl-tactician', level: 10, name: 'Tactician' },
  { id: 'lvl-commander', level: 15, name: 'Commander' },
  { id: 'lvl-warlord', level: 20, name: 'Warlord' },
  { id: 'lvl-general', level: 25, name: 'General' },
  { id: 'lvl-marshal', level: 30, name: 'Marshal' },
  { id: 'lvl-emperor', level: 35, name: 'Emperor' },
  { id: 'lvl-grandmaster', level: 40, name: 'Grandmaster of Ages' },
  { id: 'lvl-living-legend', level: 45, name: 'Living Legend' },
  { id: 'lvl-lord-of-time', level: 50, name: 'Lord of Time' },
]

/** The highest level title reached (prestige keeps every title you ever earned). */
export function levelTitle(level: number): LevelTitle {
  let best = LEVEL_TITLES[0]!
  for (const t of LEVEL_TITLES) if (level >= t.level) best = t
  return best
}

export const nextLevelTitle = (level: number): LevelTitle | null => LEVEL_TITLES.find((t) => t.level > level) ?? null

/** Roman numerals for prestige crowns (I–X). */
export function roman(n: number): string {
  const table: Array<[number, string]> = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  let rest = Math.max(0, Math.floor(n))
  for (const [v, s] of table) while (rest >= v) {
    out += s
    rest -= v
  }
  return out
}

export interface XpInput {
  outcome: 'win' | 'loss' | 'draw' | null
  /** Your rating and the opponent's (when known). */
  elo?: number
  opponentElo?: number | null
  /** The first finished game of the day. */
  firstOfDay?: boolean
  /** Base XP for activities that aren't games (puzzles, lessons, runs). */
  base?: number
}

/** XP for one finished activity, before skill and prestige bonuses. */
export function baseXp(input: XpInput): number {
  if (input.base !== undefined) return Math.max(0, Math.round(input.base))
  let xp = 25
  if (input.outcome === 'win') xp += 35
  else if (input.outcome === 'draw') xp += 15
  // Beating (or holding) someone stronger is worth more.
  if (input.outcome !== 'loss' && input.opponentElo && input.elo) xp += Math.max(0, Math.min(30, Math.round((input.opponentElo - input.elo) / 10)))
  if (input.firstOfDay) xp += 50
  return xp
}

/** XP after percentage bonuses (skills, prestige, season focus). */
export const withBonus = (xp: number, percent: number): number => Math.round(xp * (1 + Math.max(0, percent) / 100))
