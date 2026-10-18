// Daily auto-tournaments: an 8-player single-elimination bracket of Chronos
// legends matched to your rating. You play your own matches; every other
// match is simulated from Elo expectations with a seeded RNG, so a day's
// bracket is reproducible.
import { LEGENDS, legendElo } from '../data/legends'
import { hashSeed, seededRandom } from '../data/spells'
import type { Outcome } from '../types/chess'
import type { LegendStrength } from '../types/legend'
import type { AchievementDef, PlayerProfile } from '../types/profile'
import type { TournamentEntrant, TournamentMatch, TournamentState } from '../types/rpg'
import { localDateKey } from './date'
import { expectedScore, grant } from './progression'

export const YOU = 'you'
export const TOURNAMENT_SIZE = 8
/** Coins for winning each round: quarter-final, semi-final, final. */
export const ROUND_PRIZES: readonly [number, number, number] = [40, 80, 200]
export const ROUND_NAMES: readonly [string, string, string] = ['Quarter-final', 'Semi-final', 'Final']

function strengthFor(legendBase: number, playerElo: number): LegendStrength {
  if (legendBase - playerElo > 350) return 'novice'
  if (playerElo - legendBase > 350) return 'mythic'
  return 'authentic'
}

/** Seeds today's bracket: you plus the seven legends closest to your rating (with some variety). */
export function createTournament(profile: PlayerProfile, now: Date = new Date()): TournamentState {
  const date = localDateKey(now)
  const seed = hashSeed(`tournament:${date}:${profile.name}`)
  const rng = seededRandom(seed)
  const pool = [...LEGENDS].sort((a, b) => Math.abs(a.elo - profile.elo) - Math.abs(b.elo - profile.elo)).slice(0, 12)
  const field: TournamentEntrant[] = []
  while (field.length < TOURNAMENT_SIZE - 1 && pool.length > 0) {
    const [legend] = pool.splice(Math.floor(rng() * pool.length), 1)
    if (!legend) break
    const strength = strengthFor(legend.elo, profile.elo)
    field.push({ id: legend.id, name: legend.name, elo: legendElo(legend, strength), legendId: legend.id, strength })
  }
  const you: TournamentEntrant = { id: YOU, name: profile.name, elo: profile.elo, legendId: null, strength: 'authentic' }
  // Seeding: strongest entrants spread across the bracket; you take a random slot.
  const seeded = [...field].sort((a, b) => b.elo - a.elo)
  const slot = Math.floor(rng() * TOURNAMENT_SIZE)
  seeded.splice(slot, 0, you)
  const order = [0, 7, 3, 4, 1, 6, 2, 5].map((i) => seeded[i]).filter((e): e is TournamentEntrant => e !== undefined)
  const first: TournamentMatch[] = []
  for (let i = 0; i < order.length; i += 2) {
    const a = order[i]
    const b = order[i + 1]
    if (a && b) first.push({ a: a.id, b: b.id, winner: null })
  }
  return { date, seed, entrants: order, rounds: [first], status: 'active', coins: 0 }
}

export const entrant = (t: TournamentState, id: string): TournamentEntrant | undefined => t.entrants.find((e) => e.id === id)

/** Your pending match and its opponent, or null when the tournament is over for you. */
export function currentMatch(t: TournamentState): { round: number; opponent: TournamentEntrant } | null {
  if (t.status !== 'active') return null
  const round = t.rounds.length - 1
  const match = t.rounds[round]?.find((m) => m.winner === null && (m.a === YOU || m.b === YOU))
  if (!match) return null
  const opponent = entrant(t, match.a === YOU ? match.b : match.a)
  return opponent ? { round, opponent } : null
}

function simulate(t: TournamentState, match: TournamentMatch, rng: () => number): string {
  const a = entrant(t, match.a)
  const b = entrant(t, match.b)
  if (!a || !b) return match.a
  return rng() < expectedScore(a.elo, b.elo) ? a.id : b.id
}

export interface TournamentResult {
  profile: PlayerProfile
  tournament: TournamentState
  coins: number
  advanced: boolean
  champion: boolean
  unlocked: AchievementDef[]
}

/**
 * Books your match result, simulates the rest of the round and builds the
 * next. A draw is settled Armageddon-style: the lower-rated player advances.
 */
export function recordTournamentResult(profile: PlayerProfile, outcome: Outcome, now: Date = new Date()): TournamentResult | null {
  const t = profile.tournament
  const pending = t ? currentMatch(t) : null
  if (!t || !pending) return null
  const rng = seededRandom(t.seed + t.rounds.length * 7919)
  const advanced = outcome === 'win' || (outcome === 'draw' && profile.elo < pending.opponent.elo)
  const round = (t.rounds[pending.round] ?? []).map((m) => {
    if (m.a === YOU || m.b === YOU) return { ...m, winner: advanced ? YOU : pending.opponent.id }
    return m.winner ? m : { ...m, winner: simulate(t, m, rng) }
  })
  const rounds = [...t.rounds.slice(0, pending.round), round]
  const coins = advanced ? (ROUND_PRIZES[pending.round] ?? 0) : 0
  const champion = advanced && round.length === 1
  if (!champion) {
    // Next round from this round's winners; when you are out, simulate to the end.
    let current = round
    while (current.length > 1) {
      const winners = current.map((m) => m.winner).filter((w): w is string => w !== null)
      const next: TournamentMatch[] = []
      for (let i = 0; i < winners.length; i += 2) {
        const a = winners[i]
        const b = winners[i + 1]
        if (a && b) next.push({ a, b, winner: null })
      }
      if (advanced) {
        rounds.push(next)
        break
      }
      const played = next.map((m) => ({ ...m, winner: simulate(t, m, rng) }))
      rounds.push(played)
      current = played
    }
  }
  const tournament: TournamentState = { ...t, rounds, status: champion ? 'won' : advanced ? 'active' : 'eliminated', coins: t.coins + coins }
  const next: PlayerProfile = {
    ...profile,
    tournament,
    coins: profile.coins + coins,
    totalCoinsEarned: profile.totalCoinsEarned + coins,
    tournamentsWon: profile.tournamentsWon + (champion ? 1 : 0),
  }
  const granted = grant(next, champion ? ['tournament-victor'] : [], now.toISOString())
  return { profile: granted.profile, tournament, coins, advanced, champion, unlocked: granted.unlocked }
}

/** Today's tournament (a fresh one each day). */
export function ensureTournament(profile: PlayerProfile, now: Date = new Date()): PlayerProfile {
  if (profile.tournament?.date === localDateKey(now)) return profile
  return { ...profile, tournament: createTournament(profile, now) }
}

/** The champion's id once the final is decided. */
export const championOf = (t: TournamentState): string | null => (t.rounds.length === 3 ? (t.rounds[2]?.[0]?.winner ?? null) : null)
