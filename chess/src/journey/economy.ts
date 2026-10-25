// The daily chest (with its odds shown up front), the rotating daily shop and
// the Founders Pack. Pure and unit-tested; prizes are Reward lists.
import { hashSeed, seededRandom } from '../data/spells'
import type { PlayerProfile } from '../types/profile'
import { previousDateKey } from '../utils/date'
import type { Reward } from './rewards'
import type { JourneyState } from './state'

// ── Daily chest ────────────────────────────────────────────────────────────

export interface ChestPrize {
  id: string
  name: string
  /** Chance in percent; the table adds up to 100. */
  chance: number
  rewards: Reward[]
  rare?: boolean
}

export const CHEST_TABLE: readonly ChestPrize[] = [
  { id: 'coins-100', name: '100 coins', chance: 40, rewards: [{ kind: 'coins', amount: 100 }] },
  { id: 'coins-200', name: '200 coins', chance: 25, rewards: [{ kind: 'coins', amount: 200 }] },
  { id: 'potion', name: 'A battle potion', chance: 15, rewards: [{ kind: 'potion', id: 'time-elixir', count: 1 }] },
  { id: 'coins-500', name: '500 coins', chance: 10, rewards: [{ kind: 'coins', amount: 500 }] },
  { id: 'ring', name: 'Bronze or Silver Ring frame', chance: 6, rewards: [{ kind: 'frame', id: 'bronze-ring' }] },
  { id: 'rare', name: 'Golden Laurel frame or Storm Aura', chance: 3, rewards: [{ kind: 'frame', id: 'golden-laurel' }], rare: true },
  { id: 'jackpot', name: 'Jackpot: 1,500 coins', chance: 1, rewards: [{ kind: 'coins', amount: 1500 }], rare: true },
]

/** Extra coins for opening the chest on consecutive days (+10 a day, up to +100). */
export const streakBonus = (streak: number): number => Math.min(100, Math.max(0, streak - 1) * 10)

/** Rolls one prize from the table. The ring and rare rows pick their variant with a second roll. */
export function rollChest(rng: () => number): ChestPrize {
  const r = rng() * 100
  let acc = 0
  let prize = CHEST_TABLE[0]!
  for (const p of CHEST_TABLE) {
    acc += p.chance
    if (r < acc) {
      prize = p
      break
    }
  }
  const second = rng()
  if (prize.id === 'ring') return { ...prize, rewards: [{ kind: 'frame', id: second < 0.6 ? 'bronze-ring' : 'silver-ring' }] }
  if (prize.id === 'rare') return { ...prize, rewards: [second < 0.5 ? { kind: 'frame', id: 'golden-laurel' } : { kind: 'aura', id: 'storm-aura' }] }
  if (prize.id === 'potion') {
    const potions = ['time-elixir', 'purge-potion', 'ward-tonic'] as const
    return { ...prize, rewards: [{ kind: 'potion', id: potions[Math.floor(second * potions.length) % potions.length]!, count: 1 }] }
  }
  return prize
}

const RANK = (p: ChestPrize): number => CHEST_TABLE.findIndex((x) => x.id === p.id)

export interface ChestOpen {
  journey: JourneyState
  prize: ChestPrize
  rewards: Reward[]
  streak: number
}

/** Opens today's chest (null if already opened). Extra rolls keep the rarest prize. */
export function openChest(j: JourneyState, today: string, rolls: number, rng: () => number): ChestOpen | null {
  if (j.chest.date === today) return null
  const streak = j.chest.date === previousDateKey(today) ? j.chest.streak + 1 : 1
  let prize = rollChest(rng)
  for (let i = 0; i < rolls; i++) {
    const again = rollChest(rng)
    if (RANK(again) > RANK(prize)) prize = again
  }
  const bonus = streakBonus(streak)
  const rewards: Reward[] = [...prize.rewards, ...(bonus > 0 ? [{ kind: 'coins' as const, amount: bonus }] : [])]
  return { journey: { ...j, chest: { date: today, streak } }, prize, rewards, streak }
}

// ── Rotating shop ──────────────────────────────────────────────────────────

export interface ShopOffer {
  id: string
  name: string
  detail: string
  price: number
  /** Price before today's discount. */
  was?: number
  rewards: Reward[]
  /** Already owned (shown, but can't be bought again). */
  owned: (p: PlayerProfile, j: JourneyState) => boolean
}

const POOL: readonly ShopOffer[] = [
  { id: 'theme-obsidian-marble', name: 'Obsidian Marble board', detail: '30% off today', price: 140, was: 200, rewards: [{ kind: 'theme', id: 'obsidian-marble' }], owned: (p) => p.unlockedThemes.includes('obsidian-marble') },
  { id: 'theme-cyberpunk-neon', name: 'Cyberpunk Neon board', detail: '30% off today', price: 280, was: 400, rewards: [{ kind: 'theme', id: 'cyberpunk-neon' }], owned: (p) => p.unlockedThemes.includes('cyberpunk-neon') },
  { id: 'theme-royal-gold', name: 'Royal Gold board', detail: '30% off today', price: 525, was: 750, rewards: [{ kind: 'theme', id: 'royal-gold' }], owned: (p) => p.unlockedThemes.includes('royal-gold') },
  { id: 'pieces-obsidian', name: 'Obsidian pieces', detail: '30% off today', price: 105, was: 150, rewards: [{ kind: 'pieces', id: 'obsidian' }], owned: (p) => p.unlockedPieceSets.includes('obsidian') },
  { id: 'pieces-neon', name: 'Neon pieces', detail: '30% off today', price: 210, was: 300, rewards: [{ kind: 'pieces', id: 'neon' }], owned: (p) => p.unlockedPieceSets.includes('neon') },
  { id: 'pieces-gilded', name: 'Gilded pieces', detail: '30% off today', price: 350, was: 500, rewards: [{ kind: 'pieces', id: 'gilded' }], owned: (p) => p.unlockedPieceSets.includes('gilded') },
  { id: 'frame-obsidian', name: 'Obsidian Ring', detail: 'Rare frame · shop only', price: 400, rewards: [{ kind: 'frame', id: 'obsidian-ring' }], owned: (_p, j) => j.frames.includes('obsidian-ring') },
  { id: 'frame-phoenix', name: 'Phoenix Ring', detail: 'Epic frame · shop only', price: 900, rewards: [{ kind: 'frame', id: 'phoenix-ring' }], owned: (_p, j) => j.frames.includes('phoenix-ring') },
  { id: 'frame-tide', name: 'Tide Ring', detail: 'Rare frame · shop only', price: 450, rewards: [{ kind: 'frame', id: 'tide-ring' }], owned: (_p, j) => j.frames.includes('tide-ring') },
  { id: 'frame-jade', name: 'Jade Ring', detail: 'Rare frame · shop only', price: 450, rewards: [{ kind: 'frame', id: 'jade-ring' }], owned: (_p, j) => j.frames.includes('jade-ring') },
  { id: 'aura-frost', name: 'Frost Aura', detail: 'Board aura · shop only', price: 700, rewards: [{ kind: 'aura', id: 'frost-aura' }], owned: (_p, j) => j.auras.includes('frost-aura') },
  { id: 'aura-blossom', name: 'Blossom Aura', detail: 'Board aura · shop only', price: 700, rewards: [{ kind: 'aura', id: 'blossom-aura' }], owned: (_p, j) => j.auras.includes('blossom-aura') },
  { id: 'potions-3', name: 'Potion bundle', detail: 'One of each battle potion', price: 160, rewards: [{ kind: 'potion', id: 'time-elixir', count: 1 }, { kind: 'potion', id: 'purge-potion', count: 1 }, { kind: 'potion', id: 'ward-tonic', count: 1 }], owned: () => false },
]

export const SHOP_SIZE = 4

/** Today's four offers (the same for everyone on a given date). */
export function dailyOffers(date: string): ShopOffer[] {
  const rng = seededRandom(hashSeed(`shop:${date}`))
  const pool = [...POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1))
    const t = pool[i]!
    pool[i] = pool[k]!
    pool[k] = t
  }
  return pool.slice(0, SHOP_SIZE)
}

export type Purchase = { ok: true; profile: PlayerProfile; journey: JourneyState; offer: ShopOffer } | { ok: false; reason: string }

/** Pays for an offer (the rewards are granted by the caller). */
export function buyOffer(p: PlayerProfile, j: JourneyState, date: string, id: string): Purchase {
  const offer = dailyOffers(date).find((o) => o.id === id)
  if (!offer) return { ok: false, reason: 'That offer has left the shop.' }
  const bought = j.shop.date === date ? j.shop.bought : []
  if (offer.owned(p, j) || (bought.includes(id) && offer.id !== 'potions-3')) return { ok: false, reason: 'You already own this.' }
  if (p.coins < offer.price) return { ok: false, reason: `It costs ${offer.price} coins.` }
  return { ok: true, offer, profile: { ...p, coins: p.coins - offer.price }, journey: { ...j, shop: { date, bought: [...bought, id] } } }
}

// ── Founders Pack ──────────────────────────────────────────────────────────

/** The Founders Pack can be claimed until the end of this day (local time); it never returns. */
export const FOUNDERS_UNTIL = '2027-06-30'

export const FOUNDERS_PACK: readonly Reward[] = [
  { kind: 'frame', id: 'founder-ring' },
  { kind: 'aura', id: 'founding-light' },
  { kind: 'title', id: 'founder', name: 'Founder' },
  { kind: 'coins', amount: 1000 },
]

export const foundersOpen = (today: string): boolean => today <= FOUNDERS_UNTIL
