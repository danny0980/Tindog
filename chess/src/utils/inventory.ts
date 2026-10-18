// Potion inventory bookkeeping (pure).
import { POTIONS } from '../data/arena'
import type { AchievementDef, PlayerProfile } from '../types/profile'
import type { PotionId } from '../types/rpg'
import { grant } from './progression'

export const MAX_STACK = 9

export const potionCount = (profile: PlayerProfile, potion: PotionId): number => profile.inventory.potions[potion] ?? 0

export function addPotion(profile: PlayerProfile, potion: PotionId, n: number): PlayerProfile {
  const count = Math.min(MAX_STACK, potionCount(profile, potion) + n)
  return { ...profile, inventory: { ...profile.inventory, potions: { ...profile.inventory.potions, [potion]: count } } }
}

/** Removes one potion after it was drunk; null when you have none. */
export function consumePotion(profile: PlayerProfile, potion: PotionId, now: Date = new Date()): { profile: PlayerProfile; unlocked: AchievementDef[] } | null {
  const have = potionCount(profile, potion)
  if (have <= 0) return null
  const potions = { ...profile.inventory.potions }
  if (have === 1) delete potions[potion]
  else potions[potion] = have - 1
  const feats = { ...profile.feats, potionsDrunk: profile.feats.potionsDrunk + 1 }
  const next: PlayerProfile = { ...profile, inventory: { ...profile.inventory, potions }, feats }
  return grant(next, feats.potionsDrunk >= 10 ? ['alchemist'] : [], now.toISOString())
}

/** Shop purchase at the list price. */
export function buyPotion(profile: PlayerProfile, potion: PotionId): PlayerProfile | null {
  const price = POTIONS[potion].price
  if (profile.coins < price || potionCount(profile, potion) >= MAX_STACK) return null
  return addPotion({ ...profile, coins: profile.coins - price }, potion, 1)
}
