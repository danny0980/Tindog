// Turns hand-authored roster rows into complete bosses: Elo from the realm
// ramp, engine profile from the archetype engine, book, dialogue, portrait,
// rank, rewards and relics. Imported only by the code-split rosters.
import type { Boss, BossRank, GrandRealmId, RosterEntry } from '../../types/campaign'
import type { QuoteTrigger } from '../../types/legend'
import { epochLabel, getEpoch, getLegend } from '../legends'
import { ARCHETYPES, buildProfile, rescaleProfile } from './archetypes'
import { BOOKS } from './books'
import { BOSSES_PER_REALM, BOSSES_PER_ZONE, MILESTONE_INDEX, OVERLORD_INDEX, bossElo, getGrandRealm } from './realms'

const RANK_REWARD: Record<BossRank, number> = { regular: 1, milestone: 2, overlord: 3 }

/** Three-star target (your moves): stronger bosses get a longer par. */
export const parForElo = (elo: number): number => Math.round(22 + (elo - 800) / 80)

const SKIP = new Set(['the', 'of', 'sir', 'lady', 'queen', 'king', 'high', 'mr.', 'madame', 'captain', 'commander', 'general', 'major', 'colonel', 'warlord', 'lich', 'warden'])

/** Name used in tight UI: drops honorifics and epithets ("Hattori Hanzō", "Aurelion"). */
function shortNameOf(name: string): string {
  const head = name.split(/ the | of /i)[0] ?? name
  const words = head.split(' ').filter((w) => !SKIP.has(w.toLowerCase()))
  return (words.length > 0 ? words : head.split(' ')).join(' ')
}

export function buildRealmRoster(realmId: GrandRealmId, entries: readonly RosterEntry[]): Boss[] {
  const realm = getGrandRealm(realmId)
  if (entries.length !== BOSSES_PER_REALM) throw new Error(`${realmId}: expected ${BOSSES_PER_REALM} bosses, got ${entries.length}`)
  return entries.map((entry, index): Boss => {
    const zone = realm.zones[Math.floor(index / BOSSES_PER_ZONE)] ?? realm.zones[0]
    const rank: BossRank = index === OVERLORD_INDEX ? 'overlord' : index === MILESTONE_INDEX ? 'milestone' : 'regular'
    const elo = bossElo(realm, index)
    const first = Math.round((50 + (elo - 800) / 10) * RANK_REWARD[rank] / 5) * 5
    const common = {
      id: `${realmId}.${entry.slug}` as const,
      realm: realmId,
      zone,
      index,
      globalIndex: realm.order * BOSSES_PER_REALM + index,
      rank,
      archetype: entry.archetype,
      elo,
      par: parForElo(elo),
      rewards: { first, repeat: Math.round(first / 8 / 5) * 5 + 5 },
      relic: rank === 'milestone' ? realm.relics[0] : rank === 'overlord' ? realm.relics[1] : null,
    }

    if ('legend' in entry) {
      const legend = getLegend(entry.legend)
      const epoch = getEpoch(legend.epoch)
      return {
        ...common,
        name: legend.name,
        shortName: legend.shortName,
        title: legend.title,
        bio: legend.bio,
        book: null,
        portrait: legend.portrait,
        profile: rescaleProfile(legend.profile, elo),
        quotes: legend.quotes,
        legendRef: legend.id,
        themeId: epoch.themeId,
        pieceSetId: epoch.pieceSetId,
        arrivalCaption: epochLabel(epoch),
        settingName: epoch.name,
      }
    }

    const archetype = ARCHETYPES[entry.archetype]
    const book = BOOKS[entry.book]
    const quotes: Record<QuoteTrigger, readonly string[]> = {
      ...archetype.lines,
      intro: [entry.lines.intro],
      legendWins: [entry.lines.win],
      legendLoses: [entry.lines.lose],
    }
    return {
      ...common,
      name: entry.name,
      shortName: shortNameOf(entry.name),
      title: entry.title,
      bio: entry.bio,
      book: entry.book,
      portrait: { icon: entry.icon, from: zone.from, to: zone.to, monogram: (shortNameOf(entry.name)[0] ?? '?').toUpperCase() },
      profile: buildProfile(entry.archetype, elo, { w: book.w, b: book.b }),
      quotes,
      legendRef: null,
      themeId: zone.themeId,
      pieceSetId: zone.pieceSetId,
      arrivalCaption: realm.name,
      settingName: zone.name,
    }
  })
}
