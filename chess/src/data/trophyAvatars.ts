// Trophy avatars: any opponent you have beaten — a Classic character, a Grand
// Campaign boss or a Chronos legend — can be worn as your avatar.
import type { BossId } from '../types/campaign'
import type { PlayerProfile } from '../types/profile'
import type { Persona, PortraitSpec } from '../types/persona'
import type { TrophyAvatar } from '../types/settings'
import { asRecord, str } from '../utils/validate'
import { type ClassicCharacter, classicPortrait, getClassic } from './classic/roster'

/** Personas that can be won as avatars (not ghosts, gauntlet stand-ins or online players). */
const TROPHY_KEY = /^(classic|boss|legend):[a-z0-9.-]{1,60}$/

export const isTrophyKey = (key: string): boolean => TROPHY_KEY.test(key)

export const trophyOf = (p: Pick<Persona, 'key' | 'name' | 'portrait'>): TrophyAvatar => ({ key: p.key, name: p.name, portrait: p.portrait })

export const classicTrophy = (c: ClassicCharacter): TrophyAvatar => ({ key: `classic:${c.id}`, name: c.name, portrait: classicPortrait(c) })

/** The Classic character behind a trophy, if it is one (they greet their old rivals by name). */
export const trophyClassicId = (t: TrophyAvatar | null): string | null => (t?.key.startsWith('classic:') ? t.key.slice('classic:'.length) : null)

const COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i

/** A stored trophy, checked field by field (it comes back from localStorage). */
export function sanitizeTrophy(raw: unknown): TrophyAvatar | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = asRecord(raw)
  const p = asRecord(r.portrait)
  const key = str(r.key, '')
  const name = str(r.name, '').trim().slice(0, 60)
  const icon = str(p.icon, '')
  const from = str(p.from, '')
  const to = str(p.to, '')
  if (!isTrophyKey(key) || !name || !/^[a-z-]{2,20}$/.test(icon) || !COLOR.test(from) || !COLOR.test(to)) return null
  const portrait: PortraitSpec = { icon: icon as PortraitSpec['icon'], from, to, monogram: str(p.monogram, '?').slice(0, 2) || '?' }
  return { key, name, portrait }
}

/** The old setting ("classicAvatar": a Classic id) becomes a trophy, so nobody loses their avatar. */
export function legacyClassicTrophy(id: unknown): TrophyAvatar | null {
  const c = typeof id === 'string' ? getClassic(id) : null
  return c ? classicTrophy(c) : null
}

/** Everyone you have beaten, by mode. Boss ids still need their realm roster to show. */
export function beatenIds(profile: Pick<PlayerProfile, 'legends' | 'campaign' | 'feats' | 'matches'>): { legends: string[]; bosses: BossId[]; classicIds: Set<string>; classicNames: Set<string> } {
  return {
    legends: Object.keys(profile.legends.defeated),
    bosses: (Object.entries(profile.campaign.bosses) as Array<[BossId, { wins: number; firstClear: string | null } | undefined]>)
      .filter(([, r]) => r && (r.wins > 0 || r.firstClear !== null))
      .map(([id]) => id),
    classicIds: new Set(profile.feats.classicBeaten),
    classicNames: new Set(profile.matches.filter((m) => m.outcome === 'win').map((m) => m.opponent)),
  }
}
