// The history of all 100 Classic Chess opponents, era by era.
import { ANCIENT_LORE } from './ancient'
import { CLASSICAL_LORE } from './classical'
import { EAST_LORE } from './east'
import { ENLIGHTENMENT_LORE } from './enlightenment'
import { MASTERS_LORE } from './masters'
import { MEDIEVAL_LORE } from './medieval'
import { NINETEENTH_LORE } from './nineteenth'
import { RENAISSANCE_LORE } from './renaissance'
import { SAIL_LORE } from './sail'
import { SCIENCE_LORE } from './science'
import type { ClassicLore, EraLore } from './types'

export type { ClassicLore } from './types'

export const CLASSIC_LORE: EraLore = {
  ...ANCIENT_LORE,
  ...CLASSICAL_LORE,
  ...MEDIEVAL_LORE,
  ...EAST_LORE,
  ...RENAISSANCE_LORE,
  ...SAIL_LORE,
  ...ENLIGHTENMENT_LORE,
  ...NINETEENTH_LORE,
  ...SCIENCE_LORE,
  ...MASTERS_LORE,
}

export const loreFor = (id: string): ClassicLore | null => CLASSIC_LORE[id] ?? null

/** One of the character's facts, chosen by `seed` (e.g. a game number) so it changes between games. */
export const factFor = (id: string, seed: number): string | null => {
  const lore = loreFor(id)
  return lore ? (lore.facts[Math.abs(Math.floor(seed)) % lore.facts.length] ?? null) : null
}
