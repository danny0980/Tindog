import type { OpponentProfile } from '../../types/engine'
import type { RelicDef, RelicId } from '../../types/campaign'

/**
 * Relics are earned from milestone (#10) and overlord (#20) bosses. Battle
 * and Time Rush relics only work while equipped; passive relics work as soon
 * as they are owned.
 */
export const RELICS: ReadonlyArray<RelicDef> = [
  {
    id: 'shield-of-kings',
    name: 'Shield of Kings',
    description: 'Your first takeback in the first 15 moves of a campaign battle is free: the game stays rated and keeps its stars.',
    icon: 'shield',
    scope: 'battle',
    realm: 'chronicle',
  },
  { id: 'hourglass-of-time', name: 'Hourglass of Time', description: 'Time Rush runs start with +10 seconds on the countdown.', icon: 'hourglass', scope: 'rush', realm: 'chronicle' },
  { id: 'fae-gold', name: 'Oberon’s Fae Gold', description: '+25% coins from campaign victories.', icon: 'gem', scope: 'battle', realm: 'mythic' },
  { id: 'dragonheart-ember', name: 'Dragonheart Ember', description: '+30 seconds on your clock in timed campaign battles.', icon: 'flame', scope: 'battle', realm: 'mythic' },
  {
    id: 'black-prince-banner',
    name: 'Black Prince’s Banner',
    description: 'Star targets are 25% more generous: more moves still earn two and three stars.',
    icon: 'flag',
    scope: 'battle',
    realm: 'discovery',
  },
  { id: 'smoke-veil', name: 'Smoke Veil of Iga', description: 'In Time Rush, your first blunder of a run costs no time and keeps your combo.', icon: 'wind', scope: 'rush', realm: 'discovery' },
  { id: 'emp-spike', name: 'EMP Spike', description: 'Campaign bosses search 2 plies shallower and think 25% faster.', icon: 'zap', scope: 'battle', realm: 'cyber' },
  { id: 'firewall-core', name: 'Firewall Core', description: 'Rated campaign defeats cost at most 4 Elo.', icon: 'shield-half', scope: 'battle', realm: 'cyber' },
  { id: 'starforged-crown', name: 'Starforged Crown', description: 'Passive: grants a third relic slot.', icon: 'crown', scope: 'passive', realm: 'cosmic' },
  { id: 'singularity-core', name: 'Singularity Core', description: 'Time Rush points +20%.', icon: 'orbit', scope: 'rush', realm: 'cosmic' },
]

export const RELIC_IDS: readonly RelicId[] = RELICS.map((r) => r.id)
export const getRelic = (id: RelicId): RelicDef => RELICS.find((r) => r.id === id) ?? (RELICS[0] as RelicDef)
export const isRelicId = (v: unknown): v is RelicId => typeof v === 'string' && (RELIC_IDS as readonly string[]).includes(v)

export const BASE_RELIC_SLOTS = 2

/** Equip slots available with the relics owned. */
export const relicSlots = (owned: readonly RelicId[]): number => BASE_RELIC_SLOTS + (owned.includes('starforged-crown') ? 1 : 0)

/** Relics in effect for a battle or a rush run: equipped ones plus owned passives, deduplicated. */
export function activeRelics(owned: readonly RelicId[], equipped: readonly RelicId[]): RelicId[] {
  const slots = relicSlots(owned)
  const worn = equipped.filter((id) => owned.includes(id) && getRelic(id).scope !== 'passive').slice(0, slots)
  const passives = owned.filter((id) => getRelic(id).scope === 'passive')
  return [...new Set([...worn, ...passives])]
}

// ── Effects ──────────────────────────────────────────────────────────────────

export const SHIELD_MOVE_LIMIT = 15
export const HOURGLASS_BONUS_MS = 10_000
export const EMBER_BONUS_MS = 30_000
export const FAE_GOLD_FACTOR = 1.25
export const BANNER_PAR_FACTOR = 1.25
export const FIREWALL_ELO_CAP = 4
export const SINGULARITY_FACTOR = 1.2

/** EMP Spike: a shallower, quicker boss. */
export function applyRelicsToProfile(profile: OpponentProfile, relics: readonly RelicId[]): OpponentProfile {
  if (!relics.includes('emp-spike')) return profile
  return {
    ...profile,
    depth: Math.max(3, profile.depth - 2),
    moveTimeMs: Math.round(profile.moveTimeMs * 0.75),
  }
}
