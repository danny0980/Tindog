// The shape of a realm's campaign map: each zone of five bosses forks after
// its gate into two branches that rejoin before the zone boss, and every
// realm hides an Echo — a stronger mirror of its overlord — revealed only once
// every node, both branches included, is conquered.
import type { Boss, BossId, GrandRealmId } from '../../types/campaign'
import { BOSSES_PER_ZONE } from './realms'

/**
 * Slot of a boss inside its zone:
 *   gate   → the zone's first boss (needs the previous zone boss)
 *   left / right → the fork: either opens the merge
 *   merge  → needs left OR right
 *   keep   → the zone boss (milestone / overlord in zones II and IV)
 */
export type NodeSlot = 'gate' | 'left' | 'right' | 'merge' | 'keep'
const SLOTS: readonly NodeSlot[] = ['gate', 'left', 'right', 'merge', 'keep']

export const slotOf = (index: number): NodeSlot => SLOTS[index % BOSSES_PER_ZONE] ?? 'gate'

/** Indices (within the realm) that open this node: ANY one of them cleared is enough. */
export function parentsOf(index: number): number[] {
  const base = index - (index % BOSSES_PER_ZONE)
  switch (slotOf(index)) {
    case 'gate':
      return index === 0 ? [] : [index - 1]
    case 'left':
    case 'right':
      return [base]
    case 'merge':
      return [base + 1, base + 2]
    case 'keep':
      return [base + 3]
  }
}

/** Every road on the map, as [from, to] index pairs. */
export function edgesOf(count: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let i = 0; i < count; i++) for (const p of parentsOf(i)) out.push([p, i])
  return out
}

/** Map row (0-based) of a node: the fork's two branches share a row. */
export function rowOf(index: number): number {
  const zone = Math.floor(index / BOSSES_PER_ZONE)
  const slot = slotOf(index)
  const inZone = slot === 'gate' ? 0 : slot === 'left' || slot === 'right' ? 1 : slot === 'merge' ? 2 : 3
  return zone * 4 + inZone
}

/** Horizontal position (%) of a node: branches spread left and right, the trunk winds gently. */
export function columnOf(index: number): number {
  const slot = slotOf(index)
  if (slot === 'left') return 26
  if (slot === 'right') return 74
  return 50 + 16 * Math.sin(rowOf(index) * 0.9 + 0.4)
}

// ── Hidden nodes ─────────────────────────────────────────────────────────────

export const ECHO_SLUG = 'echo'
export const echoId = (realm: GrandRealmId): BossId => `${realm}.${ECHO_SLUG}`
export const isHiddenBossId = (id: string): boolean => id.endsWith(`.${ECHO_SLUG}`)

const echoes = new WeakMap<readonly Boss[], Boss>()

/**
 * The realm's hidden Echo: its overlord's shadow, 250 Elo stronger, with
 * deeper search and double rewards. Built once per loaded roster (stable
 * object, safe to select from a store).
 */
export function echoBoss(roster: readonly Boss[]): Boss | null {
  const cached = echoes.get(roster)
  if (cached) return cached
  const overlord = roster[roster.length - 1]
  if (!overlord) return null
  const elo = overlord.elo + 250
  const echo: Boss = {
    ...overlord,
    id: echoId(overlord.realm),
    index: roster.length,
    globalIndex: overlord.globalIndex + 1000,
    name: `Echo of ${overlord.shortName}`,
    shortName: `Echo`,
    title: `The shadow ${overlord.title.toLowerCase().startsWith('the ') ? overlord.title.slice(4) : overlord.title}`,
    bio: `When every road of the realm has been walked, ${overlord.shortName}'s echo answers — the same mind, sharpened by every defeat it remembers.`,
    elo,
    par: overlord.par + 4,
    portrait: { ...overlord.portrait, from: '#0b0418', to: overlord.portrait.from },
    profile: {
      ...overlord.profile,
      skillLevel: Math.min(20, overlord.profile.skillLevel + 2),
      depth: overlord.profile.depth + 2,
      toleranceCp: Math.max(0, overlord.profile.toleranceCp - 10),
    },
    rewards: { first: overlord.rewards.first * 2, repeat: overlord.rewards.repeat * 2 },
    relic: null,
    hidden: true,
    arrivalCaption: 'A hidden challenger',
  }
  echoes.set(roster, echo)
  return echo
}
