// The Hall of Trophies: crowns from realm overlords, weapons from milestone
// bosses, and cups and relics from the arena modes.
import type { PlayerProfile } from '../types/profile'
import type { TrophyDef } from '../types/rpg'
import { GRAND_REALMS, MILESTONE_INDEX } from './campaign/realms'
import { clearedCount } from '../utils/campaign'

export interface TrophyContext {
  profile: PlayerProfile
  gauntletBest: number
}

const REALM_TROPHIES: Readonly<Record<string, { weapon: [string, TrophyDef['icon']]; crown: [string, TrophyDef['icon']] }>> = {
  chronicle: { weapon: ['Sword of Charlemagne', 'sword'], crown: ['Crown of Ages', 'crown'] },
  mythic: { weapon: ['Mjölnir’s Echo', 'hammer'], crown: ['Diadem of the Wyrm', 'flame'] },
  discovery: { weapon: ['Corsair’s Cutlass', 'anchor'], crown: ['Shogun’s Kabuto', 'shield'] },
  cyber: { weapon: ['Monofilament Blade', 'zap'], crown: ['Neural Crown', 'cpu'] },
  cosmic: { weapon: ['Comet Spear', 'sparkles'], crown: ['Crown of the Infinite', 'orbit'] },
}

type Earned = (ctx: TrophyContext) => boolean

const realmTrophies: Array<TrophyDef & { earned: Earned }> = GRAND_REALMS.flatMap((realm) => {
  const t = REALM_TROPHIES[realm.id]
  if (!t) return []
  return [
    {
      id: `${realm.id}-weapon`,
      name: t.weapon[0],
      kind: 'weapon' as const,
      icon: t.weapon[1],
      shelf: realm.id,
      hint: `Defeat the milestone boss of ${realm.name} (boss #${MILESTONE_INDEX + 1}).`,
      from: realm.colors.from,
      to: realm.colors.to,
      earned: ({ profile }: TrophyContext) => clearedCount(profile.campaign, realm.id) > MILESTONE_INDEX || profile.campaign.realmsCleared.includes(realm.id),
    },
    {
      id: `${realm.id}-crown`,
      name: t.crown[0],
      kind: 'crown' as const,
      icon: t.crown[1],
      shelf: realm.id,
      hint: `Defeat the overlord of ${realm.name}.`,
      from: realm.colors.from,
      to: realm.colors.to,
      earned: ({ profile }: TrophyContext) => profile.campaign.realmsCleared.includes(realm.id),
    },
  ]
})

const arenaTrophies: Array<TrophyDef & { earned: Earned }> = [
  { id: 'iron-crown', name: 'The Iron Crown', kind: 'crown', icon: 'crown', shelf: 'arena', hint: 'Clear all five realms in Ironman mode.', from: '#a1a1aa', to: '#27272a', earned: ({ profile }) => profile.ironman.realmsConquered.length >= 5 },
  { id: 'iron-sigil', name: 'Iron Sigil', kind: 'relic', icon: 'shield-half', shelf: 'arena', hint: 'Clear any realm in Ironman mode.', from: '#d4d4d8', to: '#3f3f46', earned: ({ profile }) => profile.ironman.realmsConquered.length > 0 },
  { id: 'gauntlet-bronze', name: 'Gauntlet Bronze Cup', kind: 'cup', icon: 'flame', shelf: 'arena', hint: 'Win 3 battles in a row in the Endless Gauntlet.', from: '#f59e0b', to: '#78350f', earned: ({ gauntletBest }) => gauntletBest >= 3 },
  { id: 'gauntlet-gold', name: 'Gauntlet Gold Cup', kind: 'cup', icon: 'star', shelf: 'arena', hint: 'Win 10 battles in a row in the Endless Gauntlet.', from: '#fde68a', to: '#b45309', earned: ({ gauntletBest }) => gauntletBest >= 10 },
  { id: 'tournament-cup', name: 'Chronos Tournament Cup', kind: 'cup', icon: 'target', shelf: 'arena', hint: 'Win a daily tournament.', from: '#93c5fd', to: '#1e3a8a', earned: ({ profile }) => profile.tournamentsWon > 0 },
  { id: 'chronos-hourglass', name: 'The Chronos Hourglass', kind: 'relic', icon: 'hourglass', shelf: 'legends', hint: 'Complete the Historical Timeline of Chronos legends.', from: '#fcd34d', to: '#7c2d12', earned: ({ profile }) => Boolean(profile.achievements['master-of-time']) },
  { id: 'faerie-tome', name: 'Tome of the Fair Folk', kind: 'tome', icon: 'book', shelf: 'legends', hint: 'Complete the Fantasy Realm of Chronos legends.', from: '#6ee7b7', to: '#064e3b', earned: ({ profile }) => Boolean(profile.achievements['hero-of-the-realm']) },
]

export const TROPHIES: ReadonlyArray<TrophyDef & { earned: Earned }> = [...realmTrophies, ...arenaTrophies]

export const earnedTrophyIds = (ctx: TrophyContext): string[] => TROPHIES.filter((t) => t.earned(ctx)).map((t) => t.id)
