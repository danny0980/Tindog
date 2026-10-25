// Seasons: six weeks each, each with a theme from history (the Pharaohs, the
// Vikings, the Samurai…). The season's era earns bonus XP, and the free season
// pass pays out coins, potions, frames, an aura and a title as season XP
// accumulates. Pure and unit-tested; the calendar is the player's local date.
import type { ClassicEraId } from '../data/classic/roster'
import type { PotionId } from '../types/rpg'
import { dayNumber, localDateKey } from '../utils/date'

export const SEASON_DAYS = 42
/** Season 1 began on Monday 5 January 2026. */
export const SEASON_EPOCH = '2026-01-05'
export const PASS_TIERS = 30
export const XP_PER_TIER = 250
/** Bonus XP (percent) for games against the season's era. */
export const SEASON_ERA_BONUS = 50

export interface SeasonTheme {
  id: string
  name: string
  tagline: string
  era: ClassicEraId
  /** Art pack board and piece set that set the season's look. */
  board: string
  pieces: string
  from: string
  to: string
  glow: string
  /** Background art for the season banner. */
  backdrop: string
}

export const SEASON_THEMES: readonly SeasonTheme[] = [
  { id: 'pharaohs', name: 'Season of the Pharaohs', tagline: 'Sand, gold and the long shadow of the pyramids.', era: 'ancient', board: 'papyrus-gold', pieces: 'lapis', from: '#1e3a8a', to: '#f59e0b', glow: 'rgba(245,158,11,.55)', backdrop: 'backgrounds/arena-egyptian-pyramid.webp' },
  { id: 'vikings', name: 'Season of the Vikings', tagline: 'Longships, runes and winters that never end.', era: 'medieval', board: 'viking-age', pieces: 'valkyrie', from: '#334155', to: '#93c5fd', glow: 'rgba(147,197,253,.5)', backdrop: 'backgrounds/arena-viking-longhall.webp' },
  { id: 'samurai', name: 'Season of the Samurai', tagline: 'Lacquer, steel and the way of the sword.', era: 'east', board: 'bamboo-gold', pieces: 'oriental-dynasty', from: '#7f1d1d', to: '#fca5a5', glow: 'rgba(248,113,113,.5)', backdrop: 'backgrounds/arena-samurai-dojo.webp' },
  { id: 'rome', name: 'Season of Rome', tagline: 'Legions, laurels and the roar of the Colosseum.', era: 'classical', board: 'royal-gold', pieces: 'gilded', from: '#7c2d12', to: '#fde68a', glow: 'rgba(253,230,138,.55)', backdrop: 'backgrounds/arena-roman-colosseum.webp' },
  { id: 'sail', name: 'Season of Sails', tagline: 'Brass, salt and uncharted seas.', era: 'sail', board: 'storm-sea', pieces: 'brass', from: '#134e4a', to: '#5eead4', glow: 'rgba(45,212,191,.5)', backdrop: 'backgrounds/arena-pirate-cove.webp' },
  { id: 'babylon', name: 'Season of Babylon', tagline: 'Ziggurats, lions and the first laws.', era: 'ancient', board: 'mayan-civilization', pieces: 'terracotta', from: '#78350f', to: '#fdba74', glow: 'rgba(251,146,60,.5)', backdrop: 'backgrounds/arena-babylon-temple.webp' },
  { id: 'enlightenment', name: 'Season of Revolution', tagline: 'Powdered wigs, cannon smoke and new ideas.', era: 'enlightenment', board: 'imperial-velvet', pieces: 'imperial', from: '#1e3a8a', to: '#fca5a5', glow: 'rgba(252,165,165,.5)', backdrop: 'backgrounds/chrono-realm.webp' },
  { id: 'cosmos', name: 'Season of the Cosmos', tagline: 'Starlight, science and the edge of time.', era: 'science', board: 'nebula', pieces: 'galactic', from: '#312e81', to: '#a5b4fc', glow: 'rgba(165,180,252,.55)', backdrop: 'backgrounds/arena-cosmic-observatory.webp' },
]

export interface SeasonInfo {
  /** 0-based season index since the epoch (Season 1 = index 0). */
  index: number
  id: string
  number: number
  theme: SeasonTheme
  start: string
  end: string
  /** Whole days left, today included. */
  daysLeft: number
}

const addDays = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number)
  return localDateKey(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days))
}

export function seasonFor(date: Date = new Date()): SeasonInfo {
  const today = localDateKey(date)
  const index = Math.max(0, Math.floor((dayNumber(today) - dayNumber(SEASON_EPOCH)) / SEASON_DAYS))
  const start = addDays(SEASON_EPOCH, index * SEASON_DAYS)
  const end = addDays(start, SEASON_DAYS - 1)
  const theme = SEASON_THEMES[index % SEASON_THEMES.length]!
  return { index, id: `S${index + 1}`, number: index + 1, theme, start, end, daysLeft: dayNumber(end) - dayNumber(today) + 1 }
}

export type PassReward =
  | { kind: 'coins'; amount: number }
  | { kind: 'potion'; id: PotionId; count: number }
  | { kind: 'frame'; id: string }
  | { kind: 'aura'; id: string }
  | { kind: 'title'; id: string; name: string }

/** The reward on pass tier `tier` (1-based) in season `index`. */
export function passReward(index: number, tier: number): PassReward {
  const theme = SEASON_THEMES[index % SEASON_THEMES.length]!
  if (tier === 10) return { kind: 'frame', id: `season-${index}` }
  if (tier === 20) return { kind: 'aura', id: index % 2 === 0 ? 'ember-aura' : 'starlight-aura' }
  if (tier === PASS_TIERS) return { kind: 'title', id: `season-champion-${index}`, name: `Champion of the ${theme.name.replace(/^Season of (the )?/, '')}` }
  if (tier % 5 === 0) return { kind: 'coins', amount: 300 + tier * 10 }
  if (tier % 3 === 0) {
    const potions: PotionId[] = ['time-elixir', 'purge-potion', 'ward-tonic']
    return { kind: 'potion', id: potions[(tier / 3) % potions.length]!, count: 1 }
  }
  return { kind: 'coins', amount: 60 + tier * 5 }
}

/** Pass tiers reached with `seasonXp` (0–PASS_TIERS). */
export const tiersReached = (seasonXp: number): number => Math.min(PASS_TIERS, Math.floor(Math.max(0, seasonXp) / XP_PER_TIER))

export function passRewardLabel(r: PassReward): string {
  if (r.kind === 'coins') return `${r.amount} coins`
  if (r.kind === 'potion') return `${r.count}× potion`
  if (r.kind === 'frame') return 'Season frame'
  if (r.kind === 'aura') return 'Board aura'
  return `Title: ${r.name}`
}
