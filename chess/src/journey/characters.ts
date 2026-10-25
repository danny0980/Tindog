// The characters as people you get to know: bonds that grow with every game
// against them (they open up, tell you about their lives and give gifts), a
// nemesis who keeps beating you and comes back for more, card rarities for
// the Codex, and era collections. Pure and unit-tested.
import { CLASSIC_ERAS, CLASSIC_ROSTER, type ClassicCharacter, type ClassicEraId, getClassic } from '../data/classic/roster'
import type { ClassicLore } from '../data/classic/lore/types'
import type { MemoryBook, OpponentMemory } from '../memory/memory'
import type { Reward } from './rewards'

// ── Bonds ──────────────────────────────────────────────────────────────────

export interface BondLevel {
  level: number
  /** Games together needed. */
  games: number
  name: string
}

export const BOND_LEVELS: readonly BondLevel[] = [
  { level: 1, games: 1, name: 'Acquaintance' },
  { level: 2, games: 3, name: 'Sparring Partner' },
  { level: 3, games: 6, name: 'Respected Rival' },
  { level: 4, games: 10, name: 'Confidant' },
  { level: 5, games: 15, name: 'Kindred Spirit' },
]

export const classicKey = (id: string): string => `classic:${id}`

/** Bond level 0–5 from games played together (the Kindred Spirit skill doubles them). */
export function bondLevel(games: number, factor = 1): number {
  const effective = games * Math.max(1, factor)
  let level = 0
  for (const b of BOND_LEVELS) if (effective >= b.games) level = b.level
  return level
}

export function nextBond(games: number, factor = 1): { level: BondLevel; gamesLeft: number } | null {
  const effective = games * Math.max(1, factor)
  const next = BOND_LEVELS.find((b) => effective < b.games)
  return next ? { level: next, gamesLeft: Math.ceil((next.games - effective) / Math.max(1, factor)) } : null
}

/** What they tell you at each bond level: who they were, then their three facts. */
export function bondStories(c: ClassicCharacter, lore: ClassicLore | null, level: number): Array<{ level: number; text: string }> {
  if (!lore) return []
  const out: Array<{ level: number; text: string }> = [{ level: 1, text: lore.bio }]
  const openers = ['Between us, ', 'Few people know this: ', 'I will tell you something I rarely share. ']
  lore.facts.forEach((fact, i) => out.push({ level: i + 2, text: `${openers[i]}${fact.charAt(0).toLowerCase()}${fact.slice(1)}` }))
  out.push({ level: 5, text: `${c.name.split(' ')[0]} smiles. “${lore.defeat}”` })
  return out.filter((s) => s.level <= level)
}

/** The gift waiting at a bond level (levels 3 and 5 give one). */
export function bondGift(c: ClassicCharacter, level: number): Reward[] {
  if (level === 3) return [{ kind: 'coins', amount: 120 + Math.round(c.elo / 20) }, { kind: 'potion', id: 'ward-tonic', count: 1 }]
  if (level === 5) return [{ kind: 'coins', amount: 300 + Math.round(c.elo / 10) }, { kind: 'title', id: `kindred-${c.id}`, name: `Kindred of ${c.name.split(' ')[0]}` }]
  return []
}

export const GIFT_LEVELS = [3, 5] as const

/** Gifts you have earned but not yet opened: [classic id, level]. */
export function pendingGifts(memory: MemoryBook, claimed: Readonly<Record<string, number>>, factor = 1): Array<{ character: ClassicCharacter; level: number }> {
  const out: Array<{ character: ClassicCharacter; level: number }> = []
  for (const c of CLASSIC_ROSTER) {
    const lvl = bondLevel(memory[classicKey(c.id)]?.games ?? 0, factor)
    for (const g of GIFT_LEVELS) if (lvl >= g && (claimed[c.id] ?? 0) < g) out.push({ character: c, level: g })
  }
  return out
}

// ── Nemesis ────────────────────────────────────────────────────────────────

/** Extra strength your nemesis brings to a revenge match (Elo). */
export const NEMESIS_BOOST = 120

/** How much a character has had the better of you (higher = more of a nemesis). */
export function grudge(m: OpponentMemory): number {
  return m.losses - m.wins + Math.max(0, -m.streak)
}

/** The Classic character who has beaten you most and is still ahead; your defeated nemeses are skipped. */
export function pickNemesis(memory: MemoryBook, defeated: readonly string[]): string | null {
  let best: { key: string; score: number; date: string } | null = null
  for (const [key, m] of Object.entries(memory)) {
    if (!key.startsWith('classic:') || defeated.includes(key) || !getClassic(key.slice(8))) continue
    if (m.losses < 2 || m.losses <= m.wins) continue
    const score = grudge(m)
    if (!best || score > best.score || (score === best.score && m.lastDate > best.date)) best = { key, score, date: m.lastDate }
  }
  return best?.key ?? null
}

export function nemesisTaunt(c: ClassicCharacter, m: OpponentMemory | undefined): string {
  if (!m) return `${c.name} is waiting for you.`
  const record = `${m.losses} win${m.losses === 1 ? '' : 's'} to ${m.wins}`
  if (m.streak <= -3) return `“${-m.streak} in a row. Do you even remember how to beat me?” — ${c.name}, ${record}`
  if (m.last === 'loss') return `“You came close. Close is not enough.” — ${c.name}, ${record} in their favour`
  return `“You took one game. The war is still mine.” — ${c.name}, ${record}`
}

export function nemesisReward(first: boolean): Reward[] {
  return first ? [{ kind: 'coins', amount: 400 }, { kind: 'frame', id: 'nemesis-ring' }] : [{ kind: 'coins', amount: 400 }]
}

// ── Codex & collection ─────────────────────────────────────────────────────

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export const RARITY: Readonly<Record<Rarity, { name: string; color: string }>> = {
  common: { name: 'Common', color: '#94a3b8' },
  rare: { name: 'Rare', color: '#38bdf8' },
  epic: { name: 'Epic', color: '#c084fc' },
  legendary: { name: 'Legendary', color: '#fbbf24' },
}

export const rarityFor = (elo: number): Rarity => (elo < 1200 ? 'common' : elo < 1800 ? 'rare' : elo < 2400 ? 'epic' : 'legendary')

export interface EraCollection {
  era: ClassicEraId
  name: string
  total: number
  owned: number
  complete: boolean
}

export function collections(beaten: ReadonlySet<string>): EraCollection[] {
  return CLASSIC_ERAS.map((era) => {
    const members = CLASSIC_ROSTER.filter((c) => c.era === era.id)
    const owned = members.filter((c) => beaten.has(c.id)).length
    return { era: era.id, name: era.name, total: members.length, owned, complete: owned === members.length }
  })
}

/** Completing an era: coins and the era's own board and pieces. */
export function collectionReward(era: ClassicEraId): Reward[] {
  const e = CLASSIC_ERAS.find((x) => x.id === era)
  if (!e) return []
  return [{ kind: 'coins', amount: 500 }, { kind: 'theme', id: e.themeId }, { kind: 'pieces', id: e.pieceSetId }]
}

export const completion = (beaten: ReadonlySet<string>): number => Math.round((CLASSIC_ROSTER.filter((c) => beaten.has(c.id)).length / CLASSIC_ROSTER.length) * 100)
