// Rewards the Journey pays out (pass tiers, chests, gifts, events): coins and
// potions go to the profile, frames, auras and titles to the Journey save.
// Pure and unit-tested.
import { POTIONS } from '../data/arena'
import { BOARD_THEMES, PIECE_SETS } from '../constants/themes'
import type { PlayerProfile } from '../types/profile'
import type { PotionId } from '../types/rpg'
import type { BoardThemeId, PieceSetId } from '../types/theme'
import { addPotion } from '../utils/inventory'
import { auraDef, frameDef } from './cosmetics'
import type { JourneyState } from './state'

export type Reward =
  | { kind: 'coins'; amount: number }
  | { kind: 'potion'; id: PotionId; count: number }
  | { kind: 'frame'; id: string }
  | { kind: 'aura'; id: string }
  | { kind: 'title'; id: string; name: string }
  | { kind: 'theme'; id: BoardThemeId }
  | { kind: 'pieces'; id: PieceSetId }

export function rewardLabel(r: Reward): string {
  switch (r.kind) {
    case 'coins':
      return `${r.amount} coins`
    case 'potion':
      return `${r.count}× ${POTIONS[r.id].name}`
    case 'frame':
      return frameDef(r.id)?.name ?? 'Frame'
    case 'aura':
      return auraDef(r.id)?.name ?? 'Aura'
    case 'title':
      return `Title “${r.name}”`
    case 'theme':
      return `${BOARD_THEMES.find((t) => t.id === r.id)?.name ?? 'Board'} board`
    case 'pieces':
      return `${PIECE_SETS.find((p) => p.id === r.id)?.name ?? 'Piece'} pieces`
  }
}

export interface Granted {
  profile: PlayerProfile
  journey: JourneyState
  labels: string[]
}

/** Applies rewards. Something you already own pays 150 coins instead. */
export function grantRewards(profile: PlayerProfile, journey: JourneyState, rewards: readonly Reward[]): Granted {
  let p = profile
  let j = journey
  const labels: string[] = []
  const coins = (n: number) => {
    p = { ...p, coins: p.coins + n, totalCoinsEarned: p.totalCoinsEarned + n }
  }
  for (const r of rewards) {
    switch (r.kind) {
      case 'coins':
        coins(r.amount)
        labels.push(rewardLabel(r))
        break
      case 'potion':
        p = addPotion(p, r.id, r.count)
        labels.push(rewardLabel(r))
        break
      case 'frame':
        if (j.frames.includes(r.id)) {
          coins(150)
          labels.push(`${rewardLabel(r)} (owned: +150 coins)`)
        } else {
          j = { ...j, frames: [...j.frames, r.id] }
          labels.push(rewardLabel(r))
        }
        break
      case 'aura':
        if (j.auras.includes(r.id)) {
          coins(150)
          labels.push(`${rewardLabel(r)} (owned: +150 coins)`)
        } else {
          j = { ...j, auras: [...j.auras, r.id] }
          labels.push(rewardLabel(r))
        }
        break
      case 'title':
        if (!j.titles.some((t) => t.id === r.id)) j = { ...j, titles: [...j.titles, { id: r.id, name: r.name }] }
        labels.push(rewardLabel(r))
        break
      case 'theme':
        if (p.unlockedThemes.includes(r.id)) {
          coins(150)
          labels.push(`${rewardLabel(r)} (owned: +150 coins)`)
        } else {
          p = { ...p, unlockedThemes: [...p.unlockedThemes, r.id] }
          labels.push(rewardLabel(r))
        }
        break
      case 'pieces':
        if (p.unlockedPieceSets.includes(r.id)) {
          coins(150)
          labels.push(`${rewardLabel(r)} (owned: +150 coins)`)
        } else {
          p = { ...p, unlockedPieceSets: [...p.unlockedPieceSets, r.id] }
          labels.push(rewardLabel(r))
        }
        break
    }
  }
  return { profile: p, journey: j, labels }
}
