// World-map events and bounty contracts. Dealt once per local day against
// your campaign progress (so every event sits beside a boss you can reach),
// then resolved through pure profile → profile functions.
import { POTIONS, POTION_IDS, RESTRICTION_IDS, WEATHER_IDS } from '../data/arena'
import { GRAND_REALMS, BOSSES_PER_REALM } from '../data/campaign/realms'
import { TACTIC_IDS, hashSeed, seededRandom } from '../data/spells'
import type { CampaignProgress, GrandRealmId } from '../types/campaign'
import type { AchievementDef, PlayerProfile } from '../types/profile'
import type { Bounty, PotionId, WeatherId, WorldEvent, WorldEventKind, WorldState } from '../types/rpg'
import type { TacticId } from '../types/spells'
import { clearedCount, isRealmUnlocked } from './campaign'
import { localDateKey } from './date'
import { addPotion } from './inventory'
import { grant } from './progression'

export const MAX_BLESSINGS = 3
export const BOUNTIES_PER_REALM = 2

const EVENT_TITLES: Readonly<Record<WorldEventKind, readonly string[]>> = {
  shrine: ['Shrine of the Old Kings', 'Moonlit Shrine', 'Shrine of Still Time', 'Forgotten Altar'],
  merchant: ['Wandering Alchemist', 'Caravan of Curios', 'Black-Market Apothecary', 'Time-Lost Peddler'],
  ambush: ['Elite Ambush!', 'Shadow Patrol', 'Champion’s Challenge', 'Rogue Warband'],
}

const pick = <T,>(rng: () => number, items: readonly T[]): T | undefined => items[Math.floor(rng() * items.length)]

function sample<T>(rng: () => number, items: readonly T[], n: number): T[] {
  const pool = [...items]
  const out: T[] = []
  while (out.length < n && pool.length > 0) {
    const [item] = pool.splice(Math.floor(rng() * pool.length), 1)
    if (item !== undefined) out.push(item)
  }
  return out
}

/** Highest boss index you can reach in a realm (the next undefeated boss). */
export const frontierIndex = (progress: CampaignProgress, realm: GrandRealmId): number => Math.min(BOSSES_PER_REALM - 1, clearedCount(progress, realm))

/** Today's events and bounties for every unlocked realm. Deterministic per day and progress. */
export function dealWorld(progress: CampaignProgress, cycle: string): Pick<WorldState, 'events' | 'bounties'> {
  const events: WorldEvent[] = []
  const bounties: Bounty[] = []
  for (const realm of GRAND_REALMS) {
    if (!isRealmUnlocked(realm.id, progress)) continue
    const rng = seededRandom(hashSeed(`${cycle}:${realm.id}`))
    const frontier = frontierIndex(progress, realm.id)
    const tier = realm.order + 1
    const anchor = () => Math.floor(rng() * (frontier + 1))
    for (const kind of ['shrine', 'merchant', 'ambush'] as const) {
      const id = `${cycle}:${realm.id}:${kind}`
      events.push({
        id,
        kind,
        realm: realm.id,
        anchorIndex: anchor(),
        title: pick(rng, EVENT_TITLES[kind]) ?? kind,
        blessings: kind === 'shrine' ? sample(rng, TACTIC_IDS, 2) : [],
        wares:
          kind === 'merchant'
            ? sample(rng, POTION_IDS, 3).map((potion) => ({ potion, price: Math.round(POTIONS[potion].price * (0.8 + rng() * 0.4)) }))
            : [],
        bossIndex: kind === 'ambush' ? anchor() : 0,
        reward: kind === 'ambush' ? { coins: 50 + 25 * tier, potion: pick(rng, POTION_IDS) ?? 'time-elixir' } : { coins: 0, potion: null },
      })
    }
    for (const [i, restriction] of sample(rng, RESTRICTION_IDS, BOUNTIES_PER_REALM).entries()) {
      bounties.push({
        id: `${cycle}:${realm.id}:bounty${i}`,
        realm: realm.id,
        bossIndex: anchor(),
        restriction,
        reward: { coins: 70 + 30 * tier, potion: pick(rng, POTION_IDS) ?? 'purge-potion' },
      })
    }
  }
  return { events, bounties }
}

/** Deals a new day's world when the stored one is stale. Unspent blessings carry over. */
export function refreshWorld(profile: PlayerProfile, now: Date = new Date()): PlayerProfile {
  const cycle = localDateKey(now)
  if (profile.world.cycle === cycle) return profile
  return {
    ...profile,
    world: { ...profile.world, cycle, ...dealWorld(profile.campaign, cycle), resolved: [], purchases: [], completedBounties: [] },
  }
}

export const isEventResolved = (world: WorldState, id: string): boolean => world.resolved.includes(id)
export const isBountyDone = (world: WorldState, id: string): boolean => world.completedBounties.includes(id)
export const isEventReachable = (progress: CampaignProgress, event: Pick<WorldEvent, 'realm' | 'anchorIndex'>): boolean =>
  isRealmUnlocked(event.realm, progress) && event.anchorIndex <= frontierIndex(progress, event.realm)

export type WorldAction = { ok: true; profile: PlayerProfile; unlocked: AchievementDef[] } | { ok: false; reason: string }

function markResolved(profile: PlayerProfile, id: string, now: Date): { profile: PlayerProfile; unlocked: AchievementDef[] } {
  const feats = { ...profile.feats, eventsResolved: profile.feats.eventsResolved + 1 }
  const next: PlayerProfile = { ...profile, feats, world: { ...profile.world, resolved: [...profile.world.resolved, id] } }
  return grant(next, feats.eventsResolved >= 10 ? ['pilgrim'] : [], now.toISOString())
}

const findEvent = (profile: PlayerProfile, id: string, kind: WorldEventKind): WorldEvent | undefined =>
  profile.world.events.find((e) => e.id === id && e.kind === kind)

/** Shrine: accept one of its blessings (an extra tactic for your next campaign battle). */
export function acceptBlessing(profile: PlayerProfile, eventId: string, blessing: TacticId, now: Date = new Date()): WorldAction {
  const event = findEvent(profile, eventId, 'shrine')
  if (!event || !event.blessings.includes(blessing)) return { ok: false, reason: 'That shrine is gone.' }
  if (isEventResolved(profile.world, eventId)) return { ok: false, reason: 'You already prayed here today.' }
  const blessings = [...profile.world.blessings, blessing].slice(-MAX_BLESSINGS)
  const out = markResolved({ ...profile, world: { ...profile.world, blessings } }, eventId, now)
  return { ok: true, ...out }
}

/** Merchant: buy one ware (each ware once per day). */
export function buyWare(profile: PlayerProfile, eventId: string, potion: PotionId, now: Date = new Date()): WorldAction {
  const event = findEvent(profile, eventId, 'merchant')
  const ware = event?.wares.find((w) => w.potion === potion)
  if (!event || !ware) return { ok: false, reason: 'The merchant has moved on.' }
  const key = `${eventId}:${potion}`
  if (profile.world.purchases.includes(key)) return { ok: false, reason: 'Sold out.' }
  if (profile.coins < ware.price) return { ok: false, reason: 'Not enough coins.' }
  let next: PlayerProfile = addPotion({ ...profile, coins: profile.coins - ware.price }, potion, 1)
  next = { ...next, world: { ...next.world, purchases: [...next.world.purchases, key] } }
  // Buying out the whole stall resolves the event.
  const soldOut = event.wares.every((w) => next.world.purchases.includes(`${eventId}:${w.potion}`))
  if (soldOut && !isEventResolved(next.world, eventId)) return { ok: true, ...markResolved(next, eventId, now) }
  return { ok: true, profile: next, unlocked: [] }
}

export interface ArenaReward {
  profile: PlayerProfile
  coins: number
  potion: PotionId | null
  unlocked: AchievementDef[]
}

/** Elite ambush finished: a victory pays out; any finished battle clears the ambush. */
export function resolveAmbush(profile: PlayerProfile, eventId: string, won: boolean, now: Date = new Date()): ArenaReward {
  const event = findEvent(profile, eventId, 'ambush')
  if (!event || isEventResolved(profile.world, eventId)) return { profile, coins: 0, potion: null, unlocked: [] }
  const coins = won ? event.reward.coins : 0
  const potion = won ? event.reward.potion : null
  let next: PlayerProfile = { ...profile, coins: profile.coins + coins, totalCoinsEarned: profile.totalCoinsEarned + coins }
  if (potion) next = addPotion(next, potion, 1)
  const out = markResolved(next, eventId, now)
  return { profile: out.profile, coins, potion, unlocked: out.unlocked }
}

/** Bounty finished: paid when won with the contract honoured; otherwise it stays open for another try. */
export function resolveBounty(profile: PlayerProfile, bountyId: string, success: boolean, now: Date = new Date()): ArenaReward {
  const bounty = profile.world.bounties.find((b) => b.id === bountyId)
  if (!bounty || !success || isBountyDone(profile.world, bountyId)) return { profile, coins: 0, potion: null, unlocked: [] }
  const feats = { ...profile.feats, bountiesCompleted: profile.feats.bountiesCompleted + 1 }
  let next: PlayerProfile = {
    ...profile,
    coins: profile.coins + bounty.reward.coins,
    totalCoinsEarned: profile.totalCoinsEarned + bounty.reward.coins,
    feats,
    world: { ...profile.world, completedBounties: [...profile.world.completedBounties, bountyId] },
  }
  next = addPotion(next, bounty.reward.potion, 1)
  const granted = grant(next, feats.bountiesCompleted >= 5 ? ['bounty-hunter'] : [], now.toISOString())
  return { profile: granted.profile, coins: bounty.reward.coins, potion: bounty.reward.potion, unlocked: granted.unlocked }
}

/** The weather an elite ambush brings with it (stable per event). */
export function ambushWeather(eventId: string): WeatherId {
  const pool = WEATHER_IDS.filter((w) => w !== 'clear')
  return pool[hashSeed(eventId) % pool.length] ?? 'snow'
}

/** Board time control for a bounty contract: "clock-60" means 60 s for you vs 5 minutes for the boss. */
export const BOUNTY_CLOCK = { humanMs: 60_000, bossMinutes: 5, incrementSeconds: 2 } as const

/** Shrine blessings are spent by the next campaign battle. */
export function consumeBlessings(profile: PlayerProfile): { profile: PlayerProfile; blessings: TacticId[] } {
  const blessings = profile.world.blessings
  if (blessings.length === 0) return { profile, blessings }
  return { profile: { ...profile, world: { ...profile.world, blessings: [] } }, blessings }
}
