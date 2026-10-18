import type { MutatorId } from './campaign/mutators'
import type { TierId } from './campaign/tiers'
// Boss spells, battle tactics, relic synergies and the pre-battle draft.
import type { BossId, RelicId } from '../types/campaign'
import type { LegendId } from '../types/legend'
import type { RestrictionId, WeatherId } from '../types/rpg'
import type { BattleSetup, SpellDef, SpellId, Synergy, TacticDef, TacticId } from '../types/spells'

export const SPELLS: Readonly<Record<SpellId, SpellDef>> = {
  'frost-sigil': {
    id: 'frost-sigil', mechanic: 'freeze', name: 'Frost Sigil', icon: 'snowflake', needsClock: false,
    description: 'Freezes an empty square: on your next move no piece may land on it or pass through it.',
    trigger: 'Every 5th move, with a one-move warning',
  },
  'faerie-ring': {
    id: 'faerie-ring', mechanic: 'freeze', name: 'Faerie Ring', icon: 'sparkles', needsClock: false,
    description: 'A ring of toadstools seals a square for your next move — no landing, no passing through.',
    trigger: 'Every 5th move, with a one-move warning',
  },
  'arrow-storm': {
    id: 'arrow-storm', mechanic: 'freeze', name: 'Arrow Storm', icon: 'target', needsClock: false,
    description: 'Longbow volleys pin down a square: your pieces cannot cross it on your next move.',
    trigger: 'Every 5th move, with a one-move warning',
  },
  'void-lock': {
    id: 'void-lock', mechanic: 'freeze', name: 'Void Lock', icon: 'eclipse', needsClock: false, duration: 2,
    description: 'A square falls into the void for your next two moves: nothing may enter or pass it.',
    trigger: 'Every 5th move, with a one-move warning',
  },
  'berserker-charge': {
    id: 'berserker-charge', mechanic: 'berserker', name: 'Berserker Charge', icon: 'axe', needsClock: false,
    description: 'Once he loses a rook, his pawns may also step one square diagonally forward onto empty squares.',
    trigger: 'When he loses a rook (lasts the rest of the battle)',
  },
  'rally-of-orleans': {
    id: 'rally-of-orleans', mechanic: 'berserker', name: 'Rally of Orléans', icon: 'flag', needsClock: false,
    description: 'Losing a rook rallies her infantry: her pawns may also advance diagonally onto empty squares.',
    trigger: 'When she loses a rook (lasts the rest of the battle)',
  },
  'time-dilation': {
    id: 'time-dilation', mechanic: 'time-dilation', name: 'Time Dilation', icon: 'atom', needsClock: true,
    description: 'Relativity bends the clocks: whenever you think for more than 15 seconds, he gains 10 seconds.',
    trigger: 'Each of your moves that takes over 15 s',
  },
  eternity: {
    id: 'eternity', mechanic: 'time-dilation', name: 'Eternity', icon: 'infinity', needsClock: true,
    description: 'Time belongs to the Infinite: every move you think over 15 seconds grants it 10 seconds.',
    trigger: 'Each of your moves that takes over 15 s',
  },
  'ancient-fury': {
    id: 'ancient-fury', mechanic: 'overclock', name: 'Ancient Fury', icon: 'flame', needsClock: false,
    description: 'The dragon gathers its strength: its next move is calculated at full engine power.',
    trigger: 'Every 5th move, announced one move ahead',
  },
  'threat-analysis': {
    id: 'threat-analysis', mechanic: 'overclock', name: 'Threat Analysis', icon: 'shield-half', needsClock: false,
    description: 'Full threat assessment: its next move is computed at maximum depth and strength.',
    trigger: 'Every 5th move, announced one move ahead',
  },
  'total-computation': {
    id: 'total-computation', mechanic: 'overclock', name: 'Total Computation', icon: 'microchip', needsClock: false,
    description: 'Every processor in the Sprawl focuses on one move: maximum depth and strength.',
    trigger: 'Every 5th move, announced one move ahead',
  },
  'shadow-step': {
    id: 'shadow-step', mechanic: 'shadow-step', name: 'Shadow Step', icon: 'eclipse', needsClock: false,
    description: 'Once per battle, when threatened, one of his knights vanishes and reappears with a 3 + 1 leap over anything.',
    trigger: 'Once, while he is in check or his queen is attacked',
  },
}

export const SPELL_IDS = Object.keys(SPELLS) as SpellId[]
export const getSpell = (id: SpellId): SpellDef => SPELLS[id]

/** Chronos legends' spells — also used by their Grand Campaign cameos. */
export const LEGEND_SPELLS: Readonly<Partial<Record<LegendId, readonly SpellId[]>>> = {
  malakor: ['frost-sigil'],
  ragnar: ['berserker-charge'],
  einstein: ['time-dilation'],
}

/** Elite bosses: every realm's milestone (#10) and overlord (#20), plus cameos above. */
export const BOSS_SPELLS: Readonly<Partial<Record<BossId, readonly SpellId[]>>> = {
  'chronicle.joan-of-arc': ['rally-of-orleans'],
  'mythic.oberon': ['faerie-ring'],
  'mythic.aurelion': ['ancient-fury'],
  'discovery.black-prince': ['arrow-storm'],
  'discovery.hattori-hanzo': ['shadow-step'],
  'cyber.aegis-prime': ['threat-analysis'],
  'cyber.omnicore': ['total-computation'],
  'cosmic.warden-xal': ['void-lock'],
  'cosmic.the-infinite': ['eternity'],
}

/** A Grand Campaign boss's spells (cameo legends bring their own). */
export const spellsForBoss = (boss: { id: BossId; legendRef: LegendId | null }): readonly SpellId[] =>
  BOSS_SPELLS[boss.id] ?? (boss.legendRef ? (LEGEND_SPELLS[boss.legendRef] ?? []) : [])

export const TACTICS: Readonly<Record<TacticId, TacticDef>> = {
  'knights-boot': {
    id: 'knights-boot', name: 'Knight’s Boot', icon: 'knight', needsClock: false,
    description: 'Once per battle, a knight may make a long 3 + 1 leap over anything onto an empty square or an enemy piece.',
  },
  'chronos-hourglass': {
    id: 'chronos-hourglass', name: 'Chronos Hourglass', icon: 'hourglass', needsClock: true,
    description: 'Every time you are put in check, you gain +20 seconds.',
  },
  'katana-blade': {
    id: 'katana-blade', name: 'Katana Blade', icon: 'swords', needsClock: false,
    description: 'Your first capture gains a tempo: the boss loses its next turn (as soon as it isn’t in check).',
  },
  'vanguard-charge': {
    id: 'vanguard-charge', name: 'Vanguard Charge', icon: 'flag', needsClock: false,
    description: 'Once per battle, one of your pawns may step diagonally forward onto an empty square.',
  },
  'spell-ward': {
    id: 'spell-ward', name: 'Spell Ward', icon: 'shield', needsClock: false,
    description: 'Blocks the boss’s first spell (freeze, overclock, time warp or berserker rally).',
  },
  'second-wind': {
    id: 'second-wind', name: 'Second Wind', icon: 'wind', needsClock: true,
    description: 'The first time your clock drops under 30 seconds, you gain +60 seconds.',
  },
}

export const TACTIC_IDS = Object.keys(TACTICS) as TacticId[]
export const getTactic = (id: TacticId): TacticDef => TACTICS[id]

/** Reliquary relics that upgrade tactics or the draft. */
export const SYNERGIES: ReadonlyArray<Synergy> = [
  { relic: 'hourglass-of-time', tactic: 'chronos-hourglass', description: 'Chronos Hourglass grants +30 s instead of +20 s.' },
  { relic: 'smoke-veil', tactic: 'knights-boot', description: 'Knight’s Boot can be used twice.' },
  { relic: 'shield-of-kings', tactic: 'spell-ward', description: 'Spell Ward blocks two spells.' },
  { relic: 'starforged-crown', tactic: null, description: 'The draft offers four cards and you may take two.' },
]

export const synergiesFor = (relics: readonly RelicId[]): Synergy[] => SYNERGIES.filter((s) => relics.includes(s.relic))

// ── Draft ────────────────────────────────────────────────────────────────────

/** Small deterministic PRNG (mulberry32) so a draft can be reproduced from its seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const hashSeed = (text: string): number => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export interface DraftOffer {
  cards: TacticId[]
  /** How many cards the player may take. */
  picks: number
}

/**
 * Deals the pre-battle draft: three tactic cards (four with the Starforged
 * Crown, which also allows two picks). Clock-only tactics are left out of
 * untimed battles; a boss with spells always makes Spell Ward eligible.
 */
export function dealDraft(seed: number, relics: readonly RelicId[], timed: boolean): DraftOffer {
  const crown = relics.includes('starforged-crown')
  const pool = TACTIC_IDS.filter((id) => timed || !TACTICS[id].needsClock)
  const rng = seededRandom(seed)
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = shuffled[i] as TacticId
    shuffled[i] = shuffled[j] as TacticId
    shuffled[j] = a
  }
  return { cards: shuffled.slice(0, crown ? 4 : 3), picks: crown ? 2 : 1 }
}

/** Battle rules from the opponent's spells, the drafted tactics, the clock and owned relics. */
/** Arena modifiers for one battle (bounties, weather, parley, Ironman). */
export interface ArenaOptions {
  restriction?: RestrictionId | null
  weather?: WeatherId
  bossBoost?: -1 | 0 | 1
  rewardFactor?: number
  ironman?: boolean
  tier?: TierId
  mutators?: readonly MutatorId[]
}

export function buildBattleSetup(
  kind: BattleSetup['kind'],
  spells: readonly SpellId[],
  tactics: readonly TacticId[],
  timed: boolean,
  relics: readonly RelicId[],
  arena: ArenaOptions = {},
): BattleSetup {
  const usable = [...new Set(tactics)].filter((t) => timed || !TACTICS[t].needsClock)
  return {
    restriction: arena.restriction ?? null,
    weather: arena.weather ?? 'clear',
    bossBoost: arena.bossBoost ?? 0,
    rewardFactor: arena.rewardFactor ?? 1,
    ironman: arena.ironman ?? false,
    tier: arena.tier ?? 'normal',
    mutators: arena.mutators ?? [],
    kind,
    spells,
    tactics: usable,
    timed,
    hourglassBonusMs: relics.includes('hourglass-of-time') ? 30_000 : 20_000,
    bootCharges: usable.includes('knights-boot') ? (relics.includes('smoke-veil') ? 2 : 1) : 0,
    wardCharges: usable.includes('spell-ward') ? (relics.includes('shield-of-kings') ? 2 : 1) : 0,
  }
}
