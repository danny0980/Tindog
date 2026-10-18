// Battle mutators: random twists rolled before a campaign battle, built from
// the arena's own rules (weather, contracts, boss fury). Each raises or lowers
// the reward. Rolls are seeded (boss + day + re-roll count), so they are fair
// and reproducible, and two mutators never fight over the same rule.
import type { PortraitIcon } from '../../types/persona'
import type { RestrictionId, WeatherId } from '../../types/rpg'
import { hashSeed, seededRandom } from '../spells'

export type MutatorId = 'blizzard' | 'gale' | 'fog' | 'iron-vow' | 'pawn-oath' | 'swift-hunt' | 'enraged' | 'weary'

export interface MutatorDef {
  id: MutatorId
  name: string
  description: string
  icon: PortraitIcon
  /** The arena rule it sets: only one mutator per slot. */
  slot: 'weather' | 'contract' | 'fury'
  weather?: WeatherId
  restriction?: RestrictionId
  bossBoost?: -1 | 1
  rewardFactor: number
}

export const MUTATORS: Readonly<Record<MutatorId, MutatorDef>> = {
  blizzard: { id: 'blizzard', name: 'Blizzard', description: 'Snow buries empty squares as the battle goes on.', icon: 'snowflake', slot: 'weather', weather: 'snow', rewardFactor: 1.2 },
  gale: { id: 'gale', name: 'Gale', description: 'Long slides into the wind are blown back.', icon: 'wind', slot: 'weather', weather: 'wind', rewardFactor: 1.2 },
  fog: { id: 'fog', name: 'Fog of War', description: 'No move hints, no evaluation bar.', icon: 'eclipse', slot: 'weather', weather: 'fog', rewardFactor: 1.25 },
  'iron-vow': { id: 'iron-vow', name: 'Iron Vow', description: 'Your king may not castle.', icon: 'shield', slot: 'contract', restriction: 'no-castling', rewardFactor: 1.15 },
  'pawn-oath': { id: 'pawn-oath', name: 'Pawn Oath', description: 'Win without moving a pawn.', icon: 'hexagon', slot: 'contract', restriction: 'pawnless', rewardFactor: 1.6 },
  'swift-hunt': { id: 'swift-hunt', name: 'Swift Hunt', description: 'Win within 30 of your moves.', icon: 'zap', slot: 'contract', restriction: 'swift-30', rewardFactor: 1.4 },
  enraged: { id: 'enraged', name: 'Enraged', description: 'The boss fights at full fury.', icon: 'flame', slot: 'fury', bossBoost: 1, rewardFactor: 1.5 },
  weary: { id: 'weary', name: 'Weary', description: 'The boss is tired and careless.', icon: 'moon', slot: 'fury', bossBoost: -1, rewardFactor: 0.7 },
}

export const MUTATOR_IDS = Object.keys(MUTATORS) as MutatorId[]

export const isMutatorId = (v: unknown): v is MutatorId => typeof v === 'string' && (MUTATOR_IDS as readonly string[]).includes(v)

/** The seed for a boss's roll on a given day and re-roll. */
export const mutatorSeed = (bossId: string, day: string, reroll: number): number => hashSeed(`${bossId}|${day}|${reroll}`)

/** Rolls up to `count` mutators, at most one per slot (one weather, one contract, one fury). */
export function rollMutators(seed: number, count: number): MutatorId[] {
  const random = seededRandom(seed)
  const pool = [...MUTATOR_IDS]
  const out: MutatorId[] = []
  const used = new Set<MutatorDef['slot']>()
  while (out.length < count && pool.length > 0) {
    const pick = pool.splice(Math.floor(random() * pool.length), 1)[0]
    if (!pick || used.has(MUTATORS[pick].slot)) continue
    used.add(MUTATORS[pick].slot)
    out.push(pick)
  }
  return out
}

export interface MutatorArena {
  weather?: WeatherId
  restriction?: RestrictionId
  bossBoost: -1 | 0 | 1
  rewardFactor: number
}

/** The arena rules a set of mutators imposes, combined with an existing fury (parley) and reward factor. */
export function mutatorArena(ids: readonly MutatorId[], base: { bossBoost?: -1 | 0 | 1; rewardFactor?: number } = {}): MutatorArena {
  let boost = base.bossBoost ?? 0
  let factor = base.rewardFactor ?? 1
  const out: MutatorArena = { bossBoost: 0, rewardFactor: 1 }
  for (const id of ids) {
    const m = MUTATORS[id]
    if (m.weather) out.weather = m.weather
    if (m.restriction) out.restriction = m.restriction
    if (m.bossBoost) boost += m.bossBoost
    factor *= m.rewardFactor
  }
  out.bossBoost = Math.max(-1, Math.min(1, boost)) as -1 | 0 | 1
  out.rewardFactor = Math.round(factor * 100) / 100
  return out
}
