// The Chronicles Log: your saga as a lore book — victories over bosses and
// legends, conquered timelines and realms, Ironman runs, and how brilliantly
// you have played. Pure, derived from the profile.
import { GRAND_REALMS } from '../data/campaign/realms'
import { EPOCHS, LEGENDS } from '../data/legends'
import type { PlayerProfile } from '../types/profile'

export interface ChronicleEntry {
  date: string
  kind: 'victory' | 'realm' | 'timeline' | 'ironman' | 'tournament'
  title: string
  detail: string
}

export interface Chronicle {
  victories: number
  bossVictories: number
  legendVictories: number
  /** Brilliant moves as a % of your moves in analysed games (null when nothing is analysed). */
  brilliantPct: number | null
  brilliantMoves: number
  timelinesConquered: number
  timelinesTotal: number
  realmsConquered: string[]
  /** Newest first. */
  entries: ChronicleEntry[]
}

const MAX_ENTRIES = 60

export function buildChronicle(profile: PlayerProfile): Chronicle {
  const entries: ChronicleEntry[] = []
  let bossVictories = 0
  let legendVictories = 0
  let analysedMoves = 0
  let brilliantMoves = 0
  for (const m of profile.matches) {
    if (m.analysis) {
      analysedMoves += m.analysis.moves
      brilliantMoves += m.analysis.brilliant
    }
    if (m.outcome !== 'win' || (!m.bossId && !m.legendId)) continue
    if (m.bossId) bossVictories += 1
    else legendVictories += 1
    entries.push({
      date: m.date,
      kind: 'victory',
      title: `${m.opponent} defeated`,
      detail: `${Math.ceil(m.plies / 2)} moves${m.accuracy !== null ? ` · ${m.accuracy}% accuracy` : ''}${m.analysis?.brilliant ? ` · ${m.analysis.brilliant} brilliant` : ''}`,
    })
  }
  for (const realm of GRAND_REALMS) {
    if (!profile.campaign.realmsCleared.includes(realm.id)) continue
    const when = profile.achievements[realm.completionAchievement]
    entries.push({ date: when ?? new Date(0).toISOString(), kind: 'realm', title: `${realm.name} conquered`, detail: realm.tagline })
  }
  // Timelines: each epoch whose legends have all fallen.
  let timelinesConquered = 0
  for (const epoch of EPOCHS) {
    const legends = LEGENDS.filter((l) => l.epoch === epoch.id)
    if (legends.length === 0) continue
    const dates = legends.map((l) => profile.legends.defeated[l.id])
    if (dates.every((d): d is string => typeof d === 'string')) {
      timelinesConquered += 1
      const last = [...dates].sort().at(-1) ?? new Date(0).toISOString()
      entries.push({ date: last, kind: 'timeline', title: `Timeline secured: ${epoch.name}`, detail: legends.map((l) => l.name).join(', ') })
    }
  }
  if (profile.ironman.wipes > 0 || profile.ironman.enabled) {
    entries.push({
      date: profile.ironman.since ?? new Date(0).toISOString(),
      kind: 'ironman',
      title: profile.ironman.enabled ? 'An Ironman run is under way' : 'Ironman runs',
      detail: `${profile.ironman.wipes} run${profile.ironman.wipes === 1 ? '' : 's'} lost to permadeath · best run ${profile.ironman.bestCleared} bosses`,
    })
  }
  if (profile.tournamentsWon > 0 && profile.achievements['tournament-victor']) {
    entries.push({ date: profile.achievements['tournament-victor'], kind: 'tournament', title: 'Tournament champion', detail: `${profile.tournamentsWon} daily tournament${profile.tournamentsWon === 1 ? '' : 's'} won` })
  }
  entries.sort((a, b) => b.date.localeCompare(a.date))
  return {
    victories: bossVictories + legendVictories,
    bossVictories,
    legendVictories,
    brilliantPct: analysedMoves > 0 ? Math.round((brilliantMoves / analysedMoves) * 1000) / 10 : null,
    brilliantMoves,
    timelinesConquered,
    timelinesTotal: EPOCHS.filter((e) => LEGENDS.some((l) => l.epoch === e.id)).length,
    realmsConquered: GRAND_REALMS.filter((r) => profile.campaign.realmsCleared.includes(r.id)).map((r) => r.name),
    entries: entries.slice(0, MAX_ENTRIES),
  }
}
