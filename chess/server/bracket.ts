// Knockout brackets for the weekly tournament: seeding by rating with byes
// for the top seeds, then each round's winners meet in the next. Pure and
// unit-tested; tournaments.ts runs the games.

export interface Entrant {
  id: string
  rating: number
}

export interface BracketMatch {
  /** Player ids; null = a bye (the other player goes through). */
  a: string | null
  b: string | null
  winner: string | null
  gameId: string | null
}

export const MAX_ENTRANTS = 32

/** The standard seeding order for a bracket of `size` (1 v 32, 16 v 17 …, so top seeds meet last). */
export function seedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const n = order.length * 2 + 1
    order = order.flatMap((s) => [s, n - s])
  }
  return order
}

const nextPow2 = (n: number): number => {
  let p = 1
  while (p < n) p *= 2
  return p
}

/** Round one: the strongest are seeded apart; missing places are byes for the top seeds. */
/** Entrants in seeding order: highest rating first (ties by id). */
export const bySeed = (entrants: readonly Entrant[]): Entrant[] => [...entrants].sort((x, y) => y.rating - x.rating || x.id.localeCompare(y.id))

export function seedBracket(entrants: readonly Entrant[]): BracketMatch[] {
  const seeded = bySeed(entrants).slice(0, MAX_ENTRANTS)
  const size = Math.max(2, nextPow2(seeded.length))
  const order = seedOrder(size)
  const at = (seed: number): string | null => seeded[seed - 1]?.id ?? null
  const matches: BracketMatch[] = []
  for (let i = 0; i < order.length; i += 2) {
    const a = at(order[i]!)
    const b = at(order[i + 1]!)
    // A bye decides itself.
    matches.push({ a, b, winner: a && !b ? a : b && !a ? b : null, gameId: null })
  }
  return matches
}

export const roundDone = (round: readonly BracketMatch[]): boolean => round.every((m) => m.winner !== null || (m.a === null && m.b === null))

/** The next round from a finished one (null when the final has been played). */
export function nextRound(round: readonly BracketMatch[]): BracketMatch[] | null {
  if (round.length <= 1) return null
  const out: BracketMatch[] = []
  for (let i = 0; i < round.length; i += 2) {
    const a = round[i]?.winner ?? null
    const b = round[i + 1]?.winner ?? null
    out.push({ a, b, winner: a && !b ? a : b && !a ? b : null, gameId: null })
  }
  return out
}

/** The name of a round, counted from the final. */
export function roundName(matchesInRound: number): string {
  if (matchesInRound === 1) return 'Final'
  if (matchesInRound === 2) return 'Semi-final'
  if (matchesInRound === 4) return 'Quarter-final'
  return `Round of ${matchesInRound * 2}`
}

/** One entrant's standing in the knockout: how far they got, and whether they are still in. */
export interface Standing {
  id: string
  /** 1 = top seed. */
  seed: number
  /** The furthest round they reached ("Semi-final"), or null before the start. */
  round: string | null
  status: 'champion' | 'in' | 'out' | 'entered'
}

/**
 * The live leaderboard of a knockout: the champion, then whoever got
 * furthest (players still in before those knocked out in the same round),
 * then by seed.
 */
export function tournamentStandings(t: { entrants: readonly Entrant[]; rounds: readonly BracketMatch[][]; champion: string | null }): Standing[] {
  const seeds = bySeed(t.entrants)
  return seeds
    .map((e, i) => {
      let reached = -1
      let out = false
      t.rounds.forEach((round, r) => {
        const m = round.find((x) => x.a === e.id || x.b === e.id)
        if (!m) return
        reached = r
        out = m.winner !== null && m.winner !== e.id
      })
      const status: Standing['status'] = t.champion === e.id ? 'champion' : reached < 0 ? 'entered' : out ? 'out' : 'in'
      return { id: e.id, seed: i + 1, reached, round: reached >= 0 ? roundName(t.rounds[reached]!.length) : null, status }
    })
    .sort((a, b) => Number(b.status === 'champion') - Number(a.status === 'champion') || b.reached - a.reached || Number(a.status === 'out') - Number(b.status === 'out') || a.seed - b.seed)
    .map(({ id, seed, round, status }) => ({ id, seed, round, status }))
}
