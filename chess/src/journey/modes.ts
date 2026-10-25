// Rules and data for the Journey's new ways to play against the characters:
// three-phase boss fights, the Duel of Powers, co-op, the Bullet Gauntlet and
// dream matches. Pure and unit-tested.
import { CLASSIC_ROSTER, type ClassicCharacter, getClassic } from '../data/classic/roster'
import type { ArchetypeId } from '../types/campaign'
import type { SpellId, TacticId } from '../types/spells'

// ── Three-phase boss fights ────────────────────────────────────────────────

export interface Phase {
  phase: 1 | 2 | 3
  name: string
  /** Material the boss must have lost to enter this phase (pawn = 1 … queen = 9). */
  lost: number
  /** What the phase adds. */
  spell: SpellId | null
  boost: 0 | 1
  announce: string
}

export const PHASES: readonly Phase[] = [
  { phase: 1, name: 'Composed', lost: 0, spell: null, boost: 0, announce: '' },
  { phase: 2, name: 'Enraged', lost: 6, spell: 'frost-sigil', boost: 1, announce: 'Phase 2: they rise in fury. Stronger moves, and a Frost Sigil every fifth move.' },
  { phase: 3, name: 'Last Stand', lost: 13, spell: 'ancient-fury', boost: 1, announce: 'Phase 3 — Last Stand! Every fifth move is played at full engine power.' },
]

/** The phase a boss is in, given the material they have lost. */
export function phaseFor(lost: number): Phase {
  let p = PHASES[0]!
  for (const ph of PHASES) if (lost >= ph.lost) p = ph
  return p
}

// ── Duel of Powers ─────────────────────────────────────────────────────────

/** Each character's signature power, by fighting style. */
export const ARCHETYPE_POWER: Readonly<Record<ArchetypeId, SpellId>> = {
  berserker: 'berserker-charge',
  fortifier: 'frost-sigil',
  trickster: 'shadow-step',
  calculator: 'threat-analysis',
  gambiteer: 'rally-of-orleans',
  sniper: 'arrow-storm',
  warlord: 'berserker-charge',
  maverick: 'faerie-ring',
}

/** The powers you may bring (clock powers only in timed games). */
export const PLAYER_POWERS: readonly TacticId[] = ['knights-boot', 'vanguard-charge', 'katana-blade', 'spell-ward', 'second-wind', 'chronos-hourglass']

export const powerFor = (c: ClassicCharacter): SpellId => ARCHETYPE_POWER[c.archetype]

// ── Co-op ──────────────────────────────────────────────────────────────────

/** Opponent boost in co-op (Elo): two heads are better than one. */
export const COOP_BOOST = 200

/** Whose turn it is in co-op after you have made `myMoves` moves (players alternate). */
export const coopPlayer = (myMoves: number): 0 | 1 => (myMoves % 2 === 0 ? 0 : 1)

// ── Bullet Gauntlet ────────────────────────────────────────────────────────

/** The next opponent in a Bullet Gauntlet run: each win climbs four rungs of the Classic ladder. */
export function bulletOpponent(elo: number, streak: number): ClassicCharacter {
  const startRank = CLASSIC_ROSTER.findIndex((c) => c.elo >= elo - 300)
  const rank = Math.min(CLASSIC_ROSTER.length - 1, Math.max(0, startRank === -1 ? CLASSIC_ROSTER.length - 1 : startRank) + streak * 4)
  return CLASSIC_ROSTER[rank]!
}

export const bulletCoins = (streak: number): number => 30 + streak * 20

// ── Dream matches ──────────────────────────────────────────────────────────

export interface DreamMatch {
  a: string
  b: string
  title: string
}

export const DREAM_MATCHES: readonly DreamMatch[] = [
  { a: 'cleopatra', b: 'alexander', title: 'The Queen of the Nile vs the King of Macedon' },
  { a: 'tesla', b: 'edison', title: 'The War of the Currents' },
  { a: 'napoleon', b: 'wellington', title: 'Waterloo, at last on equal terms' },
  { a: 'leonardo', b: 'michelangelo', title: 'The Renaissance rivals' },
  { a: 'newton', b: 'einstein', title: 'Gravity vs Relativity' },
  { a: 'musashi', b: 'hattori-hanzo', title: 'The Sword vs the Shadow' },
  { a: 'blackbeard', b: 'drake', title: 'Pirate vs Privateer' },
  { a: 'morphy', b: 'fischer', title: 'Two prodigies, a century apart' },
  { a: 'capablanca', b: 'alekhine', title: 'The rematch that never happened' },
  { a: 'marie-curie', b: 'rosalind-franklin', title: 'Two pioneers of science' },
  { a: 'genghis-khan', b: 'julius-caesar', title: 'The Great Khan vs Rome' },
  { a: 'sun-tzu', b: 'machiavelli', title: 'The Art of War vs The Prince' },
]

export const dreamPair = (m: DreamMatch): [ClassicCharacter, ClassicCharacter] | null => {
  const a = getClassic(m.a)
  const b = getClassic(m.b)
  return a && b ? [a, b] : null
}
