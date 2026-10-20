// One online Card Chess game, refereed by the server: the draft (both players
// pick three of the same five cards, in secret, within 30 seconds), then the
// game with real clocks. It holds the real position, accepts only legal
// actions from the side to move, and decides the result. Time is passed in.
import { CardGame, type CardId, HAND_SIZE, aiDraft, offer } from '../../src/cards/cardGame'
import { CARDS_POOL, CARD_DRAFT_MS, type CardAction, type CardOnlineReason, type CardSnapshot } from '../../src/online/ranked/modeProtocol'
import { applyCardAction, endsTurn } from '../../src/online/ranked/modeRules'
import type { PublicPlayer } from '../../src/online/ranked/protocol'
import { FIRST_MOVE_MS, type Side } from '../game'

export interface CardResult {
  winner: Side | null
  reason: CardOnlineReason
}

const other = (s: Side): Side => (s === 'w' ? 'b' : 'w')

/** A Card Chess game as saved to the database. */
export interface CardRoomState {
  id: string
  players: Record<Side, string>
  offer: CardId[]
  drafts: Record<Side, CardId[] | null>
  phase: 'draft' | 'play'
  draftEndsAt: number
  actions: CardAction[]
  turns: number
  clocks: Record<Side, number>
  playStartedAt: number
  savedAt: number
}

export class CardRoom {
  readonly id: string
  readonly players: Record<Side, string>
  readonly offer: CardId[]
  readonly drafts: Record<Side, CardId[] | null> = { w: null, b: null }
  phase: 'draft' | 'play' = 'draft'
  draftEndsAt: number
  private game: CardGame | null = null
  readonly actions: CardAction[] = []
  /** Turn-ending actions so far (the first two must come quickly, or the game is aborted). */
  private turns = 0
  private clocks: Record<Side, number>
  private turnStartedAt: number | null = null
  private playStartedAt = 0
  result: CardResult | null = null
  /** Restored after a restart: no play timer runs until the player to move is back. */
  private waiting = false

  constructor(id: string, players: Record<Side, string>, now: number, random: () => number = Math.random) {
    this.id = id
    this.players = players
    this.offer = offer(random)
    this.draftEndsAt = now + CARD_DRAFT_MS
    const ms = CARDS_POOL.minutes * 60_000
    this.clocks = { w: ms, b: ms }
  }

  sideOf(userId: string): Side | null {
    return this.players.w === userId ? 'w' : this.players.b === userId ? 'b' : null
  }

  get turn(): Side {
    return this.game?.turn ?? 'w'
  }

  /** A player's three cards. Returns an error, or null when accepted. */
  draft(side: Side, cards: readonly CardId[], now: number): string | null {
    if (this.phase !== 'draft' || this.result) return 'The draft is over.'
    if (this.drafts[side]) return 'You have already drafted.'
    if (cards.length !== HAND_SIZE || new Set(cards).size !== HAND_SIZE || !cards.every((c) => this.offer.includes(c))) return `Pick ${HAND_SIZE} different cards from the offer.`
    this.drafts[side] = [...cards]
    if (this.drafts.w && this.drafts.b) this.startPlay(now)
    return null
  }

  /** Ends the draft (both drafted, or time ran out: the computer picks for whoever didn't). */
  private startPlay(now: number): void {
    const w = this.drafts.w ?? aiDraft(this.offer)
    const b = this.drafts.b ?? aiDraft(this.offer)
    this.drafts.w = w
    this.drafts.b = b
    this.game = new CardGame({ w, b })
    this.phase = 'play'
    this.playStartedAt = now
  }

  clocksAt(now: number): Record<Side, number> {
    if (this.result || this.turnStartedAt === null) return { ...this.clocks }
    const side = this.turn
    return { ...this.clocks, [side]: Math.max(0, this.clocks[side] - (now - this.turnStartedAt)) }
  }

  /** Plays an action for `side`. Returns an error string when refused. */
  act(side: Side, ply: number, action: CardAction, now: number): string | null {
    if (this.result) return 'The game is over.'
    if (this.phase !== 'play' || !this.game) return 'The draft is not finished.'
    if (side !== this.turn) return 'It is not your turn.'
    if (ply !== this.actions.length) return 'Out of sync.'
    const left = this.turnStartedAt === null ? this.clocks[side] : this.clocks[side] - (now - this.turnStartedAt)
    if (this.turnStartedAt !== null && left <= 0) {
      this.flag(side)
      return 'Your time ran out.'
    }
    if (!applyCardAction(this.game, action)) return 'That move is not allowed.'
    this.actions.push(action)
    if (endsTurn(action)) {
      this.turns += 1
      // Clocks start with White's first move; the increment comes after each move once they run.
      this.clocks[side] = this.turnStartedAt === null ? this.clocks[side] : Math.max(0, Math.round(left + CARDS_POOL.increment * 1000))
      this.turnStartedAt = now
    }
    const r = this.game.result
    if (r) this.result = { winner: r.winner, reason: r.reason }
    return null
  }

  private flag(side: Side): void {
    this.clocks[side] = 0
    this.result = { winner: other(side), reason: 'timeout' }
  }

  private deadlines(): { draftAt: number | null; abortAt: number | null; flagAt: number | null } {
    if (this.result || this.waiting) return { draftAt: null, abortAt: null, flagAt: null }
    if (this.phase === 'draft') return { draftAt: this.draftEndsAt, abortAt: null, flagAt: null }
    const firstFrom = this.turns === 0 ? this.playStartedAt : this.turnStartedAt
    return {
      draftAt: null,
      abortAt: this.turns < 2 && firstFrom !== null ? firstFrom + FIRST_MOVE_MS : null,
      flagAt: this.turnStartedAt !== null ? this.turnStartedAt + this.clocks[this.turn] : null,
    }
  }

  /**
   * Time events at `now`: the draft closing (returns 'started'), an abort when
   * a first move never came, or a flag (returns the result).
   */
  tick(now: number): CardResult | 'started' | null {
    const { draftAt, abortAt, flagAt } = this.deadlines()
    if (draftAt !== null && now >= draftAt) {
      this.startPlay(now)
      return 'started'
    }
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

  msUntilDeadline(now: number): number | null {
    const next = Math.min(...Object.values(this.deadlines()).filter((t): t is number => t !== null))
    return Number.isFinite(next) ? Math.max(0, next - now) : null
  }

  /** Ends the game with no result (nobody came back after a restart). */
  abort(): CardResult | null {
    if (this.result) return null
    this.result = { winner: null, reason: 'aborted' }
    return this.result
  }

  /** Resigning (or leaving) before both sides have moved just aborts. */
  resign(side: Side, reason: 'resign' | 'abandon' = 'resign'): CardResult | null {
    if (this.result) return null
    this.result = this.turns < 2 ? { winner: null, reason: 'aborted' } : { winner: other(side), reason }
    return this.result
  }

  toState(now: number): CardRoomState {
    return { id: this.id, players: { ...this.players }, offer: [...this.offer], drafts: { w: this.drafts.w, b: this.drafts.b }, phase: this.phase, draftEndsAt: this.draftEndsAt, actions: [...this.actions], turns: this.turns, clocks: { ...this.clocks }, playStartedAt: this.playStartedAt, savedAt: now }
  }

  /**
   * Rebuilds a saved game: the draft timer and the first-move timer are moved
   * on by the time the server was down, and the clock to move stays stopped
   * until that player is back (`resume`). Null if the log doesn't replay.
   */
  static restore(s: CardRoomState, now: number): CardRoom | null {
    const shift = Math.max(0, now - s.savedAt)
    const room = new CardRoom(s.id, s.players, now)
    room.offer.splice(0, room.offer.length, ...s.offer)
    room.drafts.w = s.drafts.w
    room.drafts.b = s.drafts.b
    room.draftEndsAt = s.draftEndsAt + shift
    if (s.phase === 'play') {
      if (!s.drafts.w || !s.drafts.b) return null
      room.startPlay(s.playStartedAt + shift)
      for (const a of s.actions) {
        if (!room.game || !applyCardAction(room.game, a)) return null
        room.actions.push(a)
      }
      const r = room.game?.result
      if (r) room.result = { winner: r.winner, reason: r.reason }
    }
    room.turns = s.turns
    room.clocks = { ...s.clocks }
    room.turnStartedAt = null
    // In play, every timer waits for the player to move (the draft timer just carries on).
    room.waiting = s.phase === 'play'
    return room
  }

  /** Restored after a restart and waiting for the player to move. */
  get paused(): boolean {
    return this.waiting && this.result === null
  }

  resume(now: number): void {
    if (!this.paused) return
    this.waiting = false
    if (this.turns === 0) this.playStartedAt = now
    else this.turnStartedAt = now
  }

  snapshot(side: Side, opponent: PublicPlayer, now: number): CardSnapshot {
    const both = this.phase === 'play'
    return {
      gameId: this.id,
      color: side,
      opponent,
      phase: this.phase,
      offer: [...this.offer],
      hands: { w: both || side === 'w' ? this.drafts.w : null, b: both || side === 'b' ? this.drafts.b : null },
      draftMs: this.phase === 'draft' ? Math.max(0, this.draftEndsAt - now) : null,
      actions: [...this.actions],
      clocks: this.clocksAt(now),
      running: this.result || this.turnStartedAt === null ? null : this.turn,
    }
  }
}
