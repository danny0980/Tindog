// The Historical World War: a strategic map of 21 territories held by five
// empires, each defended by a Classic character. Choose a capital, attack
// the territories on your borders, and hold what you take — after every
// battle the empires may lay siege to one of your provinces, which falls if
// you don't break the siege within two battles. Pure and unit-tested; the
// battles themselves are Classic Chess games.
import { getClassic } from '../data/classic/roster'

export type FactionId = 'west' | 'north' | 'med' | 'cradle' | 'east'

export interface Faction {
  id: FactionId
  name: string
  color: string
}

export const FACTIONS: Readonly<Record<FactionId, Faction>> = {
  west: { id: 'west', name: 'Powers of Revolution', color: '#60a5fa' },
  north: { id: 'north', name: 'Northern Realms', color: '#34d399' },
  med: { id: 'med', name: 'Mediterranean Empires', color: '#f97316' },
  cradle: { id: 'cradle', name: 'Cradles of Civilisation', color: '#fb7185' },
  east: { id: 'east', name: 'Empires of the East', color: '#c084fc' },
}

export interface Territory {
  id: string
  name: string
  faction: FactionId
  /** The Classic character who holds it. */
  defender: string
  /** Position on the war map (% of width and height). */
  x: number
  y: number
  neighbors: readonly string[]
}

export const TERRITORIES: readonly Territory[] = [
  { id: 'americas', name: 'The Thirteen Colonies', faction: 'west', defender: 'washington', x: 12, y: 30, neighbors: ['britannia', 'south-america'] },
  { id: 'south-america', name: 'Gran Colombia', faction: 'west', defender: 'bolivar', x: 16, y: 64, neighbors: ['americas', 'iberia'] },
  { id: 'france', name: 'France', faction: 'west', defender: 'napoleon', x: 40, y: 34, neighbors: ['britannia', 'francia', 'iberia', 'rome'] },
  { id: 'prussia', name: 'Prussia', faction: 'west', defender: 'frederick-the-great', x: 54, y: 22, neighbors: ['scandinavia', 'francia', 'russia'] },
  { id: 'russia', name: 'Russia', faction: 'west', defender: 'peter-the-great', x: 64, y: 14, neighbors: ['scandinavia', 'prussia', 'anatolia', 'steppe'] },
  { id: 'britannia', name: 'Britannia', faction: 'north', defender: 'boudica', x: 37, y: 20, neighbors: ['americas', 'scandinavia', 'france', 'francia'] },
  { id: 'scandinavia', name: 'Scandinavia', faction: 'north', defender: 'ragnar', x: 48, y: 8, neighbors: ['britannia', 'prussia', 'russia'] },
  { id: 'francia', name: 'Francia', faction: 'north', defender: 'charlemagne', x: 46, y: 27, neighbors: ['britannia', 'france', 'prussia', 'rome'] },
  { id: 'iberia', name: 'Iberia', faction: 'north', defender: 'el-cid', x: 34, y: 46, neighbors: ['france', 'carthage', 'south-america'] },
  { id: 'rome', name: 'Rome', faction: 'med', defender: 'julius-caesar', x: 50, y: 40, neighbors: ['francia', 'france', 'greece', 'carthage'] },
  { id: 'greece', name: 'Greece', faction: 'med', defender: 'leonidas', x: 57, y: 46, neighbors: ['rome', 'anatolia'] },
  { id: 'carthage', name: 'Carthage', faction: 'med', defender: 'hannibal', x: 46, y: 56, neighbors: ['rome', 'iberia', 'egypt'] },
  { id: 'anatolia', name: 'Anatolia', faction: 'med', defender: 'suleiman', x: 63, y: 39, neighbors: ['greece', 'russia', 'holy-land', 'mesopotamia', 'persia'] },
  { id: 'egypt', name: 'Egypt', faction: 'cradle', defender: 'ramesses-ii', x: 58, y: 63, neighbors: ['carthage', 'holy-land'] },
  { id: 'holy-land', name: 'The Levant', faction: 'cradle', defender: 'saladin', x: 65, y: 53, neighbors: ['egypt', 'anatolia', 'mesopotamia'] },
  { id: 'mesopotamia', name: 'Mesopotamia', faction: 'cradle', defender: 'sargon', x: 71, y: 47, neighbors: ['holy-land', 'anatolia', 'persia'] },
  { id: 'persia', name: 'Persia', faction: 'cradle', defender: 'cyrus', x: 77, y: 41, neighbors: ['anatolia', 'mesopotamia', 'india', 'steppe'] },
  { id: 'india', name: 'India', faction: 'east', defender: 'ashoka', x: 81, y: 60, neighbors: ['persia', 'china'] },
  { id: 'steppe', name: 'The Steppe', faction: 'east', defender: 'genghis-khan', x: 79, y: 23, neighbors: ['russia', 'persia', 'china'] },
  { id: 'china', name: 'China', faction: 'east', defender: 'qin-shi-huang', x: 89, y: 37, neighbors: ['steppe', 'india', 'japan'] },
  { id: 'japan', name: 'Japan', faction: 'east', defender: 'tokugawa-ieyasu', x: 96, y: 29, neighbors: ['china'] },
]

const BY_ID = new Map(TERRITORIES.map((t) => [t.id, t]))
export const getTerritory = (id: string): Territory | null => BY_ID.get(id) ?? null

export interface WarLogEntry {
  turn: number
  text: string
}

export interface WarState {
  capital: string
  owned: string[]
  /** Your provinces under siege: by which empire, and battles left to break it. */
  sieges: Record<string, { faction: FactionId; turns: number }>
  turn: number
  log: WarLogEntry[]
  won: boolean
  startedAt: string
}

/** Battles a siege can be ignored before the province falls. */
export const SIEGE_TURNS = 2
const LOG_SIZE = 20

export function startWar(capital: string, date: string): WarState | null {
  const t = getTerritory(capital)
  if (!t) return null
  return { capital, owned: [capital], sieges: {}, turn: 0, log: [{ turn: 0, text: `You raise your banner in ${t.name}.` }], won: false, startedAt: date }
}

const ownedSet = (s: WarState): Set<string> => new Set(s.owned)

/** Enemy territories on your borders. */
export function attackable(s: WarState): Territory[] {
  const mine = ownedSet(s)
  return TERRITORIES.filter((t) => !mine.has(t.id) && t.neighbors.some((n) => mine.has(n)))
}

/** Who you face to break a siege: the strongest defender of the besieging empire on that border. */
export function besieger(s: WarState, territoryId: string): Territory | null {
  const siege = s.sieges[territoryId]
  const t = getTerritory(territoryId)
  if (!siege || !t) return null
  const mine = ownedSet(s)
  const candidates = t.neighbors
    .map((n) => getTerritory(n))
    .filter((n): n is Territory => n !== null && !mine.has(n.id) && n.faction === siege.faction)
  const strongest = candidates.sort((a, b) => (getClassic(b.defender)?.elo ?? 0) - (getClassic(a.defender)?.elo ?? 0))[0]
  return strongest ?? TERRITORIES.find((x) => x.faction === siege.faction && !mine.has(x.id)) ?? null
}

export type BattleMode = 'attack' | 'defend'

/** The Classic character you face for a battle over `territoryId`, or null if no such battle is possible. */
export function opponentFor(s: WarState, territoryId: string, mode: BattleMode): string | null {
  if (mode === 'attack') return attackable(s).some((t) => t.id === territoryId) ? (getTerritory(territoryId)?.defender ?? null) : null
  return besieger(s, territoryId)?.defender ?? null
}

/** Coins for a war victory. */
export const conquestCoins = (territoryId: string): number => 40 + Math.floor((getClassic(getTerritory(territoryId)?.defender ?? '')?.elo ?? 0) / 25)
export const DEFENCE_COINS = 25
export const FACTION_COINS = 150
export const VICTORY_COINS = 1000

export interface WarOutcome {
  state: WarState
  coins: number
  /** What happened, in order (shown after the battle). */
  events: string[]
  /** An empire fell this turn / the whole war was won. */
  factionFallen: FactionId | null
  warWon: boolean
}

const factionOwnedBy = (owned: ReadonlySet<string>, f: FactionId): boolean => TERRITORIES.filter((t) => t.faction === f).every((t) => owned.has(t.id))

/**
 * Settles a war battle: conquest or a broken siege, then the other sieges
 * tighten, and the empires may strike back somewhere on your borders.
 */
export function resolveBattle(s: WarState, territoryId: string, mode: BattleMode, won: boolean, random: () => number = Math.random): WarOutcome {
  const t = getTerritory(territoryId)
  if (!t || s.won) return { state: s, coins: 0, events: [], factionFallen: null, warWon: false }
  const turn = s.turn + 1
  const events: string[] = []
  let owned = [...s.owned]
  const sieges = { ...s.sieges }
  let coins = 0
  let factionFallen: FactionId | null = null

  if (mode === 'attack') {
    if (won && !owned.includes(territoryId)) {
      owned.push(territoryId)
      coins += conquestCoins(territoryId)
      events.push(`${t.name} is yours: ${getClassic(t.defender)?.name ?? 'its defender'} has fallen.`)
      if (factionOwnedBy(new Set(owned), t.faction)) {
        factionFallen = t.faction
        coins += FACTION_COINS
        events.push(`The ${FACTIONS[t.faction].name} have fallen entirely!`)
      }
    } else events.push(`Your attack on ${t.name} was thrown back.`)
  } else if (sieges[territoryId]) {
    const by = sieges[territoryId].faction
    if (won) {
      delete sieges[territoryId]
      coins += DEFENCE_COINS
      events.push(`You broke the siege of ${t.name}.`)
    } else {
      delete sieges[territoryId]
      owned = owned.filter((id) => id !== territoryId)
      events.push(`${t.name} fell to the ${FACTIONS[by].name}.`)
    }
  }

  // The other sieges tighten; a siege left too long takes the province.
  for (const [id, siege] of Object.entries(sieges)) {
    if (id === territoryId) continue
    const left = siege.turns - 1
    if (left <= 0) {
      delete sieges[id]
      owned = owned.filter((x) => x !== id)
      events.push(`${getTerritory(id)?.name ?? id} fell after a long siege.`)
    } else sieges[id] = { ...siege, turns: left }
  }

  // The empires strike back: more often as the war goes on.
  const mine = new Set(owned)
  const exposed = owned.filter((id) => id !== s.capital && !sieges[id] && (getTerritory(id)?.neighbors ?? []).some((n) => !mine.has(n)))
  const chance = Math.min(0.6, 0.25 + 0.05 * turn)
  if (exposed.length > 0 && owned.length < TERRITORIES.length && random() < chance) {
    const target = exposed[Math.floor(random() * exposed.length)]!
    const enemies = (getTerritory(target)?.neighbors ?? []).map((n) => getTerritory(n)).filter((n): n is Territory => n !== null && !mine.has(n.id))
    const attacker = enemies[Math.floor(random() * enemies.length)]
    if (attacker) {
      sieges[target] = { faction: attacker.faction, turns: SIEGE_TURNS }
      events.push(`${getClassic(attacker.defender)?.name ?? 'An enemy'} marches on ${getTerritory(target)?.name ?? target}! Break the siege within ${SIEGE_TURNS} battles.`)
    }
  }

  const warWon = owned.length === TERRITORIES.length
  if (warWon) {
    coins += VICTORY_COINS
    events.push('The whole world is yours. The World War is won!')
  }
  const log = [...s.log, ...events.map((text) => ({ turn, text }))].slice(-LOG_SIZE)
  return { state: { ...s, owned, sieges, turn, log, won: warWon }, coins, events, factionFallen, warWon }
}

const FACTION_IDS = Object.keys(FACTIONS) as FactionId[]

export function sanitizeWar(raw: unknown): WarState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.capital !== 'string' || !getTerritory(r.capital)) return null
  const owned = Array.isArray(r.owned) ? [...new Set(r.owned.filter((x): x is string => typeof x === 'string' && getTerritory(x) !== null))] : []
  if (!owned.includes(r.capital)) owned.unshift(r.capital)
  const sieges: WarState['sieges'] = {}
  if (typeof r.sieges === 'object' && r.sieges !== null) {
    for (const [id, v] of Object.entries(r.sieges as Record<string, unknown>)) {
      const sv = v as Record<string, unknown> | null
      const faction = FACTION_IDS.find((f) => f === sv?.faction)
      if (!owned.includes(id) || id === r.capital || !faction || typeof sv?.turns !== 'number') continue
      sieges[id] = { faction, turns: Math.max(1, Math.min(SIEGE_TURNS, Math.floor(sv.turns))) }
    }
  }
  const log = Array.isArray(r.log)
    ? r.log
        .filter((e): e is { turn: number; text: string } => typeof e === 'object' && e !== null && typeof (e as WarLogEntry).text === 'string' && typeof (e as WarLogEntry).turn === 'number')
        .map((e) => ({ turn: Math.max(0, Math.floor(e.turn)), text: e.text.slice(0, 200) }))
        .slice(-LOG_SIZE)
    : []
  return {
    capital: r.capital,
    owned,
    sieges,
    turn: typeof r.turn === 'number' && Number.isFinite(r.turn) ? Math.max(0, Math.floor(r.turn)) : 0,
    log,
    won: owned.length === TERRITORIES.length,
    startedAt: typeof r.startedAt === 'string' ? r.startedAt.slice(0, 40) : '',
  }
}
