// The Custom Army: draft Classic characters you have beaten into your
// command (King, Queen, Rook, Bishop, Knight). Each brings one passive trait
// from their playing style, doubled in the King's seat, that applies in
// World War battles. Traits never change the rules of chess: they bend the
// battle around it (takebacks, scouting, rewards, the enemy's strength).
// Pure and unit-tested.
import type { ArchetypeId } from '../types/campaign'
import { type ClassicCharacter, getClassic } from '../data/classic/roster'

export type ArmySlot = 'king' | 'queen' | 'rook' | 'bishop' | 'knight'
export const ARMY_SLOTS: readonly ArmySlot[] = ['king', 'queen', 'rook', 'bishop', 'knight']
export type Army = Readonly<Record<ArmySlot, string | null>>
export const EMPTY_ARMY: Army = { king: null, queen: null, rook: null, bishop: null, knight: null }

export type TraitId = 'rally' | 'fortify' | 'second-chance' | 'insight' | 'spoils' | 'scout' | 'initiative' | 'surprise'

export interface TraitDef {
  id: TraitId
  name: string
  /** What one character gives (the King's seat gives double where it stacks). */
  describe: (power: number) => string
}

export const TRAITS: Readonly<Record<TraitId, TraitDef>> = {
  rally: { id: 'rally', name: 'Rally the troops', describe: (p) => `The enemy plays ${RALLY_ELO * p} Elo weaker.` },
  fortify: { id: 'fortify', name: 'Fortified lines', describe: (p) => `A rated defeat costs at most ${fortifyCap(p)} Elo.` },
  'second-chance': { id: 'second-chance', name: 'Second chance', describe: (p) => `${p} free takeback${p === 1 ? '' : 's'} per battle.` },
  insight: { id: 'insight', name: 'Strategic insight', describe: () => 'The engine brain stays allowed: the battle stays rated.' },
  spoils: { id: 'spoils', name: 'Spoils of war', describe: (p) => `+${SPOILS_PCT * p}% coins from victories.` },
  scout: { id: 'scout', name: 'Scouts', describe: () => 'Your scouts report the enemy’s favourite opening before the battle.' },
  initiative: { id: 'initiative', name: 'Initiative', describe: () => 'You always take White (the first move).' },
  surprise: { id: 'surprise', name: 'Surprise attack', describe: () => 'The enemy is caught without its opening book.' },
}

/** The trait each playing style brings. */
export const TRAIT_OF: Readonly<Record<ArchetypeId, TraitId>> = {
  warlord: 'rally',
  fortifier: 'fortify',
  trickster: 'second-chance',
  calculator: 'insight',
  gambiteer: 'spoils',
  sniper: 'scout',
  berserker: 'initiative',
  maverick: 'surprise',
}

export const RALLY_ELO = 50
export const MAX_RALLY = 200
export const SPOILS_PCT = 25
export const MAX_SPOILS = 100
export const MAX_TAKEBACKS = 3
const fortifyCap = (power: number): number => Math.max(4, 16 - 4 * power)

export interface ArmyEffects {
  /** Elo taken off the enemy's strength. */
  rally: number
  /** Most Elo a rated defeat may cost (null = no cap). */
  eloLossCap: number | null
  takebacks: number
  insight: boolean
  /** Extra coins from victories, in percent. */
  spoils: number
  scout: boolean
  initiative: boolean
  surprise: boolean
  /** One line per trait in force, for the battle briefing. */
  briefing: string[]
}

/** Who sits where, as characters (unknown ids are skipped). */
export function armyMembers(army: Army): Array<{ slot: ArmySlot; c: ClassicCharacter }> {
  return ARMY_SLOTS.flatMap((slot) => {
    const id = army[slot]
    const c = id ? getClassic(id) : null
    return c ? [{ slot, c }] : []
  })
}

/** The traits your army brings to a battle, stacked and capped. */
export function armyEffects(army: Army): ArmyEffects {
  const power: Partial<Record<TraitId, number>> = {}
  for (const { slot, c } of armyMembers(army)) {
    const t = TRAIT_OF[c.archetype]
    power[t] = (power[t] ?? 0) + (slot === 'king' ? 2 : 1)
  }
  const p = (t: TraitId) => power[t] ?? 0
  const briefing = (Object.keys(power) as TraitId[]).map((t) => `${TRAITS[t].name}: ${TRAITS[t].describe(p(t))}`)
  return {
    rally: Math.min(MAX_RALLY, RALLY_ELO * p('rally')),
    eloLossCap: p('fortify') > 0 ? fortifyCap(p('fortify')) : null,
    takebacks: Math.min(MAX_TAKEBACKS, p('second-chance')),
    insight: p('insight') > 0,
    spoils: Math.min(MAX_SPOILS, SPOILS_PCT * p('spoils')),
    scout: p('scout') > 0,
    initiative: p('initiative') > 0,
    surprise: p('surprise') > 0,
    briefing,
  }
}

/**
 * Seats a character (only ones you have beaten); a character sits in one
 * seat at a time, so drafting them elsewhere moves them. null clears a seat.
 */
export function draft(army: Army, slot: ArmySlot, id: string | null, beaten: ReadonlySet<string>): Army {
  if (id !== null && (!beaten.has(id) || !getClassic(id))) return army
  const cleared = Object.fromEntries(ARMY_SLOTS.map((s) => [s, army[s] === id && id !== null ? null : army[s]])) as Record<ArmySlot, string | null>
  return { ...cleared, [slot]: id }
}

export function sanitizeArmy(raw: unknown): Army {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const seen = new Set<string>()
  const out = { ...EMPTY_ARMY } as Record<ArmySlot, string | null>
  for (const slot of ARMY_SLOTS) {
    const v = r[slot]
    if (typeof v === 'string' && getClassic(v) && !seen.has(v)) {
      out[slot] = v
      seen.add(v)
    }
  }
  return out
}
