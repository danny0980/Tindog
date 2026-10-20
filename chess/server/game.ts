// One rated game, refereed by the server: it holds the real position and the
// real clocks, accepts only legal moves from the side to move, and decides
// the result. Time is passed in (`now`) so tests can run whole games.
import { Chess } from 'chess.js'
import type { GameSnapshot, PublicPlayer, RankedReason, RankedTimeControl } from '../src/online/ranked/protocol'

export type Side = 'w' | 'b'
export interface Result {
  winner: Side | null
  reason: RankedReason
}

/** A player who hasn't made their first move in this long aborts the game (unrated). */
export const FIRST_MOVE_MS = 30_000

const other = (s: Side): Side => (s === 'w' ? 'b' : 'w')

/** Can `color` still ever deliver mate (for flag-vs-insufficient-material draws)? */
function canMate(chess: Chess, color: Side): boolean {
  let minors = 0
  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color) continue
      if (sq.type === 'p' || sq.type === 'r' || sq.type === 'q') return true
      if (sq.type === 'n' || sq.type === 'b') minors += 1
    }
  }
  return minors >= 2
}

export class GameRoom {
  readonly id: string
  readonly pool: RankedTimeControl
  /** User ids per side. */
  readonly players: Record<Side, string>
  readonly startedAt: number
  private readonly chess = new Chess()
  readonly moves: string[] = []
  private clocks: Record<Side, number>
  /** When the side to move started thinking (null until White's first move — or, for the abort timer, the start). */
  private turnStartedAt: number | null = null
  drawOffer: Side | null = null
  result: Result | null = null

  constructor(id: string, pool: RankedTimeControl, players: Record<Side, string>, now: number) {
    this.id = id
    this.pool = pool
    this.players = players
    this.startedAt = now
    const ms = pool.minutes * 60_000
    this.clocks = { w: ms, b: ms }
  }

  get turn(): Side {
    return this.chess.turn()
  }
  sideOf(userId: string): Side | null {
    return this.players.w === userId ? 'w' : this.players.b === userId ? 'b' : null
  }

  /** Remaining time per side at `now`. */
  clocksAt(now: number): Record<Side, number> {
    if (this.result || this.turnStartedAt === null) return { ...this.clocks }
    const side = this.turn
    return { ...this.clocks, [side]: Math.max(0, this.clocks[side] - (now - this.turnStartedAt)) }
  }

  /** Plays a move for `side`. Returns an error string when the move is refused. */
  move(side: Side, ply: number, uci: string, now: number): string | null {
    if (this.result) return 'The game is over.'
    if (side !== this.turn) return 'It is not your turn.'
    if (ply !== this.moves.length) return 'Out of sync.'
    const left = this.turnStartedAt === null ? this.clocks[side] : this.clocks[side] - (now - this.turnStartedAt)
    if (this.turnStartedAt !== null && left <= 0) {
      this.flag(side)
      return 'Your time ran out.'
    }
    try {
      this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci[4] } : {}) })
    } catch {
      return 'Illegal move.'
    }
    this.moves.push(uci)
    // The clock starts with White's first move; the increment is added after each move once clocks run.
    this.clocks[side] = this.turnStartedAt === null ? this.clocks[side] : Math.max(0, Math.round(left + this.pool.increment * 1000))
    this.turnStartedAt = now
    this.drawOffer = null
    this.result = this.boardResult()
    return null
  }

  private boardResult(): Result | null {
    const c = this.chess
    if (c.isCheckmate()) return { winner: other(c.turn()), reason: 'checkmate' }
    if (c.isStalemate()) return { winner: null, reason: 'stalemate' }
    if (c.isInsufficientMaterial()) return { winner: null, reason: 'insufficient' }
    if (c.isThreefoldRepetition()) return { winner: null, reason: 'threefold' }
    if (c.isDrawByFiftyMoves()) return { winner: null, reason: 'fifty-move' }
    return null
  }

  private flag(side: Side): void {
    this.clocks[side] = 0
    const winner = other(side)
    this.result = canMate(this.chess, winner) ? { winner, reason: 'timeout' } : { winner: null, reason: 'timeout-insufficient' }
  }

  /** The moments a time event can happen: an abort (first moves not made) and a flag. */
  private deadlines(): { abortAt: number | null; flagAt: number | null } {
    if (this.result) return { abortAt: null, flagAt: null }
    const firstMoveFrom = this.moves.length === 0 ? this.startedAt : this.turnStartedAt
    return {
      abortAt: this.moves.length < 2 && firstMoveFrom !== null ? firstMoveFrom + FIRST_MOVE_MS : null,
      flagAt: this.turnStartedAt !== null ? this.turnStartedAt + this.clocks[this.turn] : null,
    }
  }

  /**
   * Time-based events at `now`: an abort when a player never made their first
   * move, or a flag. Returns the new result, if one was reached.
   */
  tick(now: number): Result | null {
    const { abortAt, flagAt } = this.deadlines()
    if (abortAt !== null && now >= abortAt) {
      this.result = { winner: null, reason: 'aborted' }
      return this.result
    }
    if (flagAt !== null && now >= flagAt) {
      this.flag(this.turn)
      return this.result
    }
    return null
  }

  /** Time until the next possible time event (for scheduling the server's timer), or null. */
  msUntilDeadline(now: number): number | null {
    const next = Math.min(...Object.values(this.deadlines()).filter((t): t is number => t !== null))
    return Number.isFinite(next) ? Math.max(0, next - now) : null
  }

  resign(side: Side): Result | null {
    if (this.result) return null
    // Resigning before both sides have moved just aborts.
    this.result = this.moves.length < 2 ? { winner: null, reason: 'aborted' } : { winner: other(side), reason: 'resign' }
    return this.result
  }

  offerDraw(side: Side): boolean {
    if (this.result || this.drawOffer || this.moves.length < 2) return false
    this.drawOffer = side
    return true
  }

  /** Answers the opponent's offer. Returns the result when accepted. */
  answerDraw(side: Side, accept: boolean): Result | null | 'declined' | 'invalid' {
    if (this.result || !this.drawOffer || this.drawOffer === side) return 'invalid'
    this.drawOffer = null
    if (!accept) return 'declined'
    this.result = { winner: null, reason: 'agreement' }
    return this.result
  }

  /** The player left and didn't come back: the other side wins (or, before any real game, it aborts). */
  abandon(side: Side): Result | null {
    if (this.result) return null
    this.result = this.moves.length < 2 ? { winner: null, reason: 'aborted' } : { winner: other(side), reason: 'abandon' }
    return this.result
  }

  snapshot(side: Side, opponent: PublicPlayer, now: number): GameSnapshot {
    return {
      gameId: this.id,
      color: side,
      opponent,
      pool: this.pool.id,
      moves: [...this.moves],
      clocks: this.clocksAt(now),
      running: this.result || this.turnStartedAt === null ? null : this.turn,
      drawOffer: this.drawOffer,
    }
  }
}

/** Elo with a bigger K for the first 20 games, so new ratings settle fast. */
export function eloChange(rating: number, opponent: number, score: 0 | 0.5 | 1, games: number): number {
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400))
  const k = games < 20 ? 40 : rating >= 2400 ? 16 : 24
  return Math.round(k * (score - expected))
}
