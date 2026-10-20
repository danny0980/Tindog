// The weekly knockout: up to 32 players sign up during the week; on Saturday
// at 18:00 UTC the bracket is seeded by rating and the rounds are played as
// rated 5+3 games. A player who isn't there when their game starts forfeits;
// a draw (or an aborted game) sends the higher seed through. The next week's
// tournament opens as soon as one ends.
import { MAX_ENTRANTS, bySeed, nextRound, roundDone, roundName, seedBracket } from './bracket'
import type { GameResultHook } from './hub'
import type { Store, TournamentState } from './store'

export const TOURNAMENT_POOL = '5+3'
export const TOURNAMENT_NAME = 'Weekly Knockout'
const WEEK = 7 * 86_400_000

/** The next Saturday 18:00 UTC strictly after `now`. */
export function nextSaturday(now: number): number {
  const d = new Date(now)
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 18)
  const days = (6 - d.getUTCDay() + 7) % 7
  const at = base + days * 86_400_000
  return at > now ? at : at + WEEK
}

export interface TournamentDeps {
  store: Store
  now: () => number
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (h: unknown) => void
  /** Starts a rated game; null when a player can't play now. */
  startGame: (players: { w: string; b: string }, pool: string, label: string, onResult: GameResultHook) => string | null
  isAvailable: (userId: string) => boolean
  /** Something changed (tell the clients). */
  changed: () => void
  log?: (line: string) => void
  /** When the first tournament starts (default: next Saturday 18:00 UTC). */
  firstStartsAt?: number
}

/** The longest a timer is armed for at once (setTimeout's limit is about 24.8 days). */
const MAX_TIMER = 2 ** 31 - 1

export class TournamentManager {
  private readonly d: TournamentDeps
  private timer: unknown = null

  constructor(deps: TournamentDeps) {
    this.d = deps
    const t = deps.store.tournament()
    if (!t || t.status === 'done') this.open(deps.firstStartsAt ?? nextSaturday(deps.now()))
    else if (t.status === 'running') {
      // After a restart, games that were in progress are played again.
      const round = t.rounds[t.rounds.length - 1] ?? []
      for (const m of round) if (!m.winner) m.gameId = null
      deps.store.putTournament(t)
      this.play()
    } else this.arm()
  }

  get state(): TournamentState {
    return this.d.store.tournament()!
  }

  private save(t: TournamentState): void {
    this.d.store.putTournament(t)
    this.d.changed()
  }

  private open(startsAt: number): void {
    const prev = this.d.store.tournament()
    const previous = prev && prev.status === 'done' && prev.champion ? { champion: prev.champion, players: prev.entrants.length, finishedAt: prev.finishedAt ?? this.d.now() } : (prev?.previous ?? null)
    this.save({ id: `t${startsAt}`, name: TOURNAMENT_NAME, startsAt, pool: TOURNAMENT_POOL, status: 'signup', entrants: [], rounds: [], champion: null, finishedAt: null, previous })
    this.arm()
  }

  private arm(): void {
    if (this.timer !== null) this.d.clearTimer(this.timer)
    const t = this.state
    if (t.status !== 'signup') return
    const ms = Math.max(0, t.startsAt - this.d.now())
    this.timer = this.d.setTimer(() => {
      this.timer = null
      if (this.d.now() >= this.state.startsAt) this.start()
      else this.arm()
    }, Math.min(ms, MAX_TIMER))
  }

  join(userId: string, rating: number): string | null {
    const t = this.state
    if (t.status !== 'signup') return 'Sign-ups are closed: the tournament has started.'
    if (t.entrants.some((e) => e.id === userId)) return null
    if (t.entrants.length >= MAX_ENTRANTS) return 'The tournament is full (32 players).'
    this.save({ ...t, entrants: [...t.entrants, { id: userId, rating }] })
    return null
  }

  leave(userId: string): void {
    const t = this.state
    if (t.status !== 'signup') return
    this.save({ ...t, entrants: t.entrants.filter((e) => e.id !== userId) })
  }

  /** Starts now (also used by the schedule). With fewer than two players it moves to next week. */
  start(): void {
    const t = this.state
    if (t.status !== 'signup') return
    if (t.entrants.length < 2) {
      this.d.log?.(`tournament ${t.id}: not enough players, moved to next week`)
      this.save({ ...t, startsAt: nextSaturday(this.d.now()) })
      this.arm()
      return
    }
    this.save({ ...t, status: 'running', rounds: [seedBracket(t.entrants)] })
    this.d.log?.(`tournament ${t.id}: started with ${t.entrants.length} players`)
    this.play()
  }

  /** Starts every game of the current round that can start; forfeits players who aren't there. */
  private play(): void {
    const t = this.state
    if (t.status !== 'running') return
    const rounds = t.rounds.map((r) => r.map((m) => ({ ...m })))
    const round = rounds[rounds.length - 1]!
    const label = `${t.name} · ${roundName(round.length)}`
    // Seeds, not sign-up order: a draw or forfeit sends the higher-rated seed through.
    const seeds = bySeed(t.entrants)
    const seedOf = (id: string): number => seeds.findIndex((e) => e.id === id)
    round.forEach((m, i) => {
      if (m.winner || m.gameId || !m.a || !m.b) return
      const aHere = this.d.isAvailable(m.a)
      const bHere = this.d.isAvailable(m.b)
      if (!aHere || !bHere) {
        // Forfeit: whoever is there goes through (the higher seed if neither is).
        m.winner = aHere ? m.a : bHere ? m.b : seedOf(m.a) <= seedOf(m.b) ? m.a : m.b
        return
      }
      const players = (rounds.length + i) % 2 === 0 ? { w: m.a, b: m.b } : { w: m.b, b: m.a }
      const a = m.a
      const b = m.b
      m.gameId = this.d.startGame(players, t.pool, label, (winner, aborted) => this.result(rounds.length - 1, i, aborted || winner === null ? (seedOf(a) <= seedOf(b) ? a : b) : winner))
      if (!m.gameId) m.winner = seedOf(a) <= seedOf(b) ? a : b
    })
    this.save({ ...t, rounds })
    this.advance()
  }

  private result(roundIndex: number, matchIndex: number, winner: string): void {
    const t = this.state
    if (t.status !== 'running' || roundIndex !== t.rounds.length - 1) return
    const rounds = t.rounds.map((r) => r.map((m) => ({ ...m })))
    const m = rounds[roundIndex]![matchIndex]
    if (!m || m.winner) return
    m.winner = winner
    this.save({ ...t, rounds })
    this.advance()
  }

  /** When a round is complete: the next one, or the champion. */
  private advance(): void {
    const t = this.state
    const round = t.rounds[t.rounds.length - 1]
    if (t.status !== 'running' || !round || !roundDone(round)) return
    const next = nextRound(round)
    if (!next) {
      const champion = round[0]?.winner ?? null
      this.save({ ...t, status: 'done', champion, finishedAt: this.d.now() })
      this.d.log?.(`tournament ${t.id}: won by ${champion ?? 'nobody'}`)
      this.open(nextSaturday(this.d.now()))
      return
    }
    this.save({ ...t, rounds: [...t.rounds, next] })
    this.play()
  }

  /** Stops the schedule (server shutdown). */
  close(): void {
    if (this.timer !== null) this.d.clearTimer(this.timer)
    this.timer = null
  }
}

