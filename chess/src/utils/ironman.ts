// Ironman (permadeath) campaign runs. Pure profile → profile functions.
//
//  • Starting a run puts your regular campaign aside (it is restored intact
//    when the run is abandoned) and begins a fresh campaign.
//  • Campaign victories pay IRONMAN_COIN_FACTOR × coins; takebacks are off.
//  • A single campaign defeat wipes the run: bosses, stars, realms and relics
//    earned in it are lost, and a new run starts from boss #1.
import type { CampaignProgress, GrandRealmId } from '../types/campaign'
import type { AchievementDef, PlayerProfile } from '../types/profile'
import { GRAND_REALM_IDS } from '../data/campaign/realms'
import { clearedCount, createCampaignProgress } from './campaign'
import { grant } from './progression'

export const IRONMAN_COIN_FACTOR = 3

export function startIronman(profile: PlayerProfile, now: Date = new Date()): PlayerProfile {
  if (profile.ironman.enabled) return profile
  return {
    ...profile,
    ironman: { ...profile.ironman, enabled: true, since: now.toISOString(), savedCampaign: profile.campaign },
    campaign: createCampaignProgress(),
  }
}

/** Ends the run voluntarily; your regular campaign comes back. */
export function abandonIronman(profile: PlayerProfile): PlayerProfile {
  if (!profile.ironman.enabled) return profile
  const best = Math.max(profile.ironman.bestCleared, clearedCount(profile.campaign))
  return {
    ...profile,
    ironman: { ...profile.ironman, enabled: false, since: null, bestCleared: best, savedCampaign: null },
    campaign: profile.ironman.savedCampaign ?? createCampaignProgress(),
  }
}

export interface IronmanOutcome {
  profile: PlayerProfile
  /** The run was wiped by this defeat. */
  wiped: boolean
  /** Bosses the wiped run had cleared. */
  lostBosses: number
  unlocked: AchievementDef[]
}

/**
 * Applies a finished Ironman campaign battle (after the normal campaign
 * bookkeeping). `realmCleared` is the realm this victory completed, if any.
 */
export function applyIronmanResult(profile: PlayerProfile, outcome: 'win' | 'loss' | 'draw', realmCleared: GrandRealmId | null, now: Date = new Date()): IronmanOutcome {
  if (!profile.ironman.enabled) return { profile, wiped: false, lostBosses: 0, unlocked: [] }
  const cleared = clearedCount(profile.campaign)
  const bestCleared = Math.max(profile.ironman.bestCleared, cleared)
  if (outcome === 'loss') {
    const wipedCampaign: CampaignProgress = createCampaignProgress()
    return {
      profile: {
        ...profile,
        campaign: wipedCampaign,
        ironman: { ...profile.ironman, wipes: profile.ironman.wipes + 1, bestCleared, since: now.toISOString() },
      },
      wiped: true,
      lostBosses: cleared,
      unlocked: [],
    }
  }
  const conquered = realmCleared && !profile.ironman.realmsConquered.includes(realmCleared) ? [...profile.ironman.realmsConquered, realmCleared] : profile.ironman.realmsConquered
  const next: PlayerProfile = { ...profile, ironman: { ...profile.ironman, bestCleared, realmsConquered: conquered } }
  const ids: string[] = []
  if (realmCleared) ids.push('iron-will')
  if (GRAND_REALM_IDS.every((id) => conquered.includes(id))) ids.push('iron-crown')
  const granted = grant(next, ids, now.toISOString())
  return { profile: granted.profile, wiped: false, lostBosses: 0, unlocked: granted.unlocked }
}
