// Cosmetics the Journey hands out: avatar frames (a ring around your portrait)
// and board auras (a glow and drifting motes around the board). Some are
// fixed; season frames are made from each season's colours.
import { SEASON_THEMES } from './season'

export interface FrameDef {
  id: string
  name: string
  /** Two colours of the ring and the glow. */
  from: string
  to: string
  glow: string
  /** Where it comes from (shown in the wardrobe). */
  source: string
  /** Animated shimmer for the rarest frames. */
  shimmer?: boolean
}

export interface AuraDef {
  id: string
  name: string
  color: string
  /** Motes drifting around the board edge. */
  motes: 'embers' | 'stars' | 'snow' | 'petals' | 'sparks' | 'none'
  source: string
}

const FIXED_FRAMES: readonly FrameDef[] = [
  { id: 'bronze-ring', name: 'Bronze Ring', from: '#b45309', to: '#fcd34d', glow: 'rgba(217,119,6,.45)', source: 'Daily chest' },
  { id: 'silver-ring', name: 'Silver Ring', from: '#94a3b8', to: '#f8fafc', glow: 'rgba(203,213,225,.45)', source: 'Daily chest' },
  { id: 'golden-laurel', name: 'Golden Laurel', from: '#f59e0b', to: '#fef3c7', glow: 'rgba(251,191,36,.6)', source: 'Daily chest (rare)', shimmer: true },
  { id: 'obsidian-ring', name: 'Obsidian Ring', from: '#0f172a', to: '#7c3aed', glow: 'rgba(124,58,237,.55)', source: 'Rotating shop' },
  { id: 'phoenix-ring', name: 'Phoenix Ring', from: '#dc2626', to: '#fbbf24', glow: 'rgba(239,68,68,.6)', source: 'Rotating shop', shimmer: true },
  { id: 'tide-ring', name: 'Tide Ring', from: '#0e7490', to: '#a5f3fc', glow: 'rgba(34,211,238,.5)', source: 'Rotating shop' },
  { id: 'jade-ring', name: 'Jade Ring', from: '#047857', to: '#a7f3d0', glow: 'rgba(16,185,129,.5)', source: 'Rotating shop' },
  { id: 'nemesis-ring', name: 'Nemesis Bane', from: '#7f1d1d', to: '#f87171', glow: 'rgba(248,113,113,.55)', source: 'Defeat your nemesis' },
  { id: 'story-ring', name: 'Keeper’s Ring', from: '#1e3a8a', to: '#fde68a', glow: 'rgba(253,230,138,.55)', source: 'Finish the story', shimmer: true },
  { id: 'founder-ring', name: 'Founder’s Hourglass', from: '#78350f', to: '#fde047', glow: 'rgba(250,204,21,.7)', source: 'Founders Pack (never returns)', shimmer: true },
  { id: 'league-diamond', name: 'Diamond League', from: '#38bdf8', to: '#e0f2fe', glow: 'rgba(125,211,252,.65)', source: 'Finish a week in the Diamond league', shimmer: true },
  { id: 'prestige-crown', name: 'Prestige Crown', from: '#a16207', to: '#fef08a', glow: 'rgba(250,204,21,.65)', source: 'Prestige once', shimmer: true },
]

export const AURAS: readonly AuraDef[] = [
  { id: 'ember-aura', name: 'Ember Aura', color: 'rgba(249,115,22,.55)', motes: 'embers', source: 'Season pass' },
  { id: 'starlight-aura', name: 'Starlight Aura', color: 'rgba(147,197,253,.55)', motes: 'stars', source: 'Season pass' },
  { id: 'frost-aura', name: 'Frost Aura', color: 'rgba(186,230,253,.55)', motes: 'snow', source: 'Rotating shop' },
  { id: 'blossom-aura', name: 'Blossom Aura', color: 'rgba(244,114,182,.5)', motes: 'petals', source: 'Rotating shop' },
  { id: 'storm-aura', name: 'Storm Aura', color: 'rgba(167,139,250,.55)', motes: 'sparks', source: 'Daily chest (rare)' },
  { id: 'founding-light', name: 'Founding Light', color: 'rgba(250,204,21,.6)', motes: 'stars', source: 'Founders Pack (never returns)' },
]

/** A season's own frame: "season-<index>". */
export function seasonFrame(index: number): FrameDef {
  const theme = SEASON_THEMES[((index % SEASON_THEMES.length) + SEASON_THEMES.length) % SEASON_THEMES.length]!
  return { id: `season-${index}`, name: `${theme.name} Frame`, from: theme.from, to: theme.to, glow: theme.glow, source: `Season ${index + 1} pass`, shimmer: true }
}

export function frameDef(id: string | null | undefined): FrameDef | null {
  if (!id) return null
  const m = /^season-(\d{1,4})$/.exec(id)
  if (m) return seasonFrame(Number(m[1]))
  return FIXED_FRAMES.find((f) => f.id === id) ?? null
}

export const auraDef = (id: string | null | undefined): AuraDef | null => (id ? (AURAS.find((a) => a.id === id) ?? null) : null)

export const isFrameId = (id: unknown): id is string => typeof id === 'string' && frameDef(id) !== null
export const isAuraId = (id: unknown): id is string => typeof id === 'string' && auraDef(id) !== null

export const ALL_FIXED_FRAMES = FIXED_FRAMES

/** A frame's ring as a CSS background (two colours, conic). */
export const frameBackground = (f: FrameDef): string => `conic-gradient(from 210deg, ${f.from}, ${f.to}, ${f.from}, ${f.to}, ${f.from})`
