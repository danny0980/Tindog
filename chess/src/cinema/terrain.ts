// Living battlefields: the ground the board stands on. Each terrain has its
// own ambient particles (drifting sand, falling snow, sea spray…) and its own
// way of breaking up a captured piece. Pure data; <Battlefield> draws it.
import type { ParticleKind } from '../components/fx/particles'
import type { BoardThemeId } from '../types/theme'

export type TerrainId = 'sand' | 'snow' | 'sea' | 'forest' | 'ember' | 'void'

export interface Terrain {
  id: TerrainId
  name: string
  /** Ground colours under and around the board (CSS gradient). */
  ground: string
  /** Ambient particles drifting over the field. */
  ambient: {
    count: number
    color: string
    /** Size range (px, before device scaling). */
    size: readonly [number, number]
    /** Velocity (px/s): steady wind and fall, plus random sway. */
    vx: number
    vy: number
    sway: number
    /** Fading in and out so the field never pops. */
    alpha: number
  }
  /** The particles a captured piece breaks up into. */
  shatter: ParticleKind
}

export const TERRAINS: Readonly<Record<TerrainId, Terrain>> = {
  sand: {
    id: 'sand',
    name: 'Egyptian sand',
    ground: 'radial-gradient(ellipse at 50% 120%, rgba(217,160,80,0.55), transparent 60%), linear-gradient(180deg, rgba(120,72,24,0.0), rgba(180,120,50,0.35))',
    ambient: { count: 70, color: '232, 190, 120', size: [1, 2.6], vx: 46, vy: 6, sway: 14, alpha: 0.7 },
    shatter: 'dust',
  },
  snow: {
    id: 'snow',
    name: 'Russian snow',
    ground: 'radial-gradient(ellipse at 50% 120%, rgba(226,232,240,0.45), transparent 60%), linear-gradient(180deg, rgba(30,41,59,0.0), rgba(148,163,184,0.3))',
    ambient: { count: 90, color: '241, 245, 249', size: [1.2, 3.4], vx: 14, vy: 38, sway: 22, alpha: 0.85 },
    shatter: 'frost',
  },
  sea: {
    id: 'sea',
    name: 'Pirate sea',
    ground: 'radial-gradient(ellipse at 50% 125%, rgba(45,212,191,0.4), transparent 62%), linear-gradient(180deg, rgba(8,47,73,0.0), rgba(14,116,144,0.4))',
    ambient: { count: 55, color: '186, 230, 253', size: [1, 2.8], vx: -18, vy: -22, sway: 30, alpha: 0.6 },
    shatter: 'bubble',
  },
  forest: {
    id: 'forest',
    name: 'Old forest',
    ground: 'radial-gradient(ellipse at 50% 120%, rgba(74,222,128,0.28), transparent 60%), linear-gradient(180deg, rgba(20,83,45,0.0), rgba(63,98,18,0.35))',
    ambient: { count: 40, color: '190, 242, 100', size: [1.4, 3], vx: 10, vy: 18, sway: 26, alpha: 0.65 },
    shatter: 'dust',
  },
  ember: {
    id: 'ember',
    name: 'Burning field',
    ground: 'radial-gradient(ellipse at 50% 120%, rgba(249,115,22,0.42), transparent 60%), linear-gradient(180deg, rgba(69,10,10,0.0), rgba(127,29,29,0.4))',
    ambient: { count: 60, color: '253, 186, 116', size: [1, 2.4], vx: 8, vy: -34, sway: 18, alpha: 0.8 },
    shatter: 'ember',
  },
  void: {
    id: 'void',
    name: 'Starfield',
    ground: 'radial-gradient(ellipse at 50% 120%, rgba(167,139,250,0.35), transparent 62%), linear-gradient(180deg, rgba(15,23,42,0.0), rgba(49,46,129,0.35))',
    ambient: { count: 70, color: '221, 214, 254', size: [0.8, 2.2], vx: 4, vy: 3, sway: 6, alpha: 0.75 },
    shatter: 'rune',
  },
}

export const TERRAIN_IDS = Object.keys(TERRAINS) as TerrainId[]

/** The battlefield a board theme implies (its era and setting). */
const BY_THEME: Partial<Record<BoardThemeId, TerrainId>> = {
  'papyrus-gold': 'sand',
  'royal-gold': 'sand',
  'chalkboard': 'snow',
  'imperial-velvet': 'snow',
  'oled-black': 'void',
  'storm-sea': 'sea',
  'blueprint': 'sea',
  'rune-oak': 'forest',
  'bamboo-gold': 'forest',
  'elven-crystal': 'forest',
  'obsidian-lava': 'ember',
  'obsidian-marble': 'ember',
  'nebula': 'void',
  'cyberpunk-neon': 'void',
}

export type BattlefieldSetting = 'auto' | 'off' | TerrainId

/** The terrain to show: the player's choice, or (on auto) the one the board's theme implies. */
export function terrainFor(setting: BattlefieldSetting, theme: BoardThemeId): Terrain | null {
  if (setting === 'off') return null
  if (setting !== 'auto') return TERRAINS[setting]
  const id = BY_THEME[theme]
  return id ? TERRAINS[id] : null
}

export interface Drift {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
  life: number
}

/** Seeded scatter of the ambient particles over a w × h field. */
export function seedDrift(t: Terrain, w: number, h: number, random: () => number = Math.random): Drift[] {
  const a = t.ambient
  return Array.from({ length: a.count }, () => ({
    x: random() * w,
    y: random() * h,
    vx: a.vx * (0.6 + random() * 0.8),
    vy: a.vy * (0.6 + random() * 0.8),
    size: a.size[0] + random() * (a.size[1] - a.size[0]),
    phase: random() * Math.PI * 2,
    life: random(),
  }))
}

/** Moves the particles on by `dt` seconds, wrapping round the edges of the field. */
export function stepDrift(ps: Drift[], t: Terrain, dt: number, w: number, h: number, time: number): void {
  const sway = t.ambient.sway
  for (const p of ps) {
    p.x += (p.vx + Math.sin(time * 1.3 + p.phase) * sway) * dt
    p.y += (p.vy + Math.cos(time * 0.9 + p.phase) * sway * 0.4) * dt
    p.life = (p.life + dt * 0.12) % 1
    if (p.x < -8) p.x += w + 16
    else if (p.x > w + 8) p.x -= w + 16
    if (p.y < -8) p.y += h + 16
    else if (p.y > h + 8) p.y -= h + 16
  }
}

/** Fade in, hold, fade out across a particle's life (0 → 1 → 0). */
export const lifeAlpha = (life: number): number => Math.min(1, life * 5, (1 - life) * 5)
