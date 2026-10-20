// The online modes on the live server: the Card Chess and Battle Royale
// queues, their game rooms and timers, reconnects, results and ratings.
// The Hub owns the connections and hands these messages over; like the Hub,
// time is injected so whole games run in tests.
import type { CardId } from '../../src/cards/cardGame'
import { CARDS_POOL, type ModeClientMessage, type OnlineMode, type RoyaleAction, type RoyaleSeat } from '../../src/online/ranked/modeProtocol'
import { cardNotation } from '../../src/online/ranked/modeRules'
import type { PublicPlayer, ServerMessage } from '../../src/online/ranked/protocol'
import { newId } from '../auth'
import { type Side, eloChange } from '../game'
import { Matchmaker } from '../matchmaker'
import type { RatedMode, Store } from '../store'
import { type CardResult, CardRoom, type CardRoomState } from './cardRoom'
import { RoyaleRoom, type RoyaleRoomState } from './royaleRoom'

/** How long a result waits for a player who never comes back. */
const MISSED_TTL_MS = 24 * 3_600_000

export interface ModeDeps {
  store: Store
  now: () => number
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
  log: (line: string) => void
  /** Sends to every connection of a user. */
  send: (userId: string, msg: ServerMessage) => void
  isOnline: (userId: string) => boolean
  /** In a chess game (a restored mode game is dropped if its player is busy elsewhere). */
  isBusy?: (userId: string) => boolean
  /** How long a Card Chess player has to come back. */
  graceMs: number
  /** After a restart, how long players of a resumed Card Chess game have to come back. */
  restoreGraceMs?: number
  /** Pause before a computer army moves (so people can follow). */
  botDelayMs?: number
  /** With two or three people waiting this long, computer armies fill the empty seats. */
  royaleFillMs?: number
  /** Alone this long, you play three computer armies (unrated). */
  royaleSoloMs?: number
  random?: () => number
}

const SEAT_NAMES = ['Red', 'Blue', 'Yellow', 'Green'] as const
const other = (s: Side): Side => (s === 'w' ? 'b' : 'w')

export class ModeRooms {
  private readonly d: Required<ModeDeps>
  private readonly cardQueue = new Matchmaker()
  private readonly royaleQueue = new Map<string, { rating: number; since: number }>()
  private readonly cards = new Map<string, CardRoom>()
  private readonly royales = new Map<string, RoyaleRoom>()
  private readonly active = new Map<string, string>()
  private readonly timers = new Map<string, unknown>()
  private readonly graceTimers = new Map<string, unknown>()
  /** Players known to be away: until when they may come back. */
  private readonly awayUntil = new Map<string, number>()
  /** Restored Card Chess games waiting for their players. */
  private readonly restoreTimers = new Map<string, unknown>()
  /** Results of games that ended while the player was away. */
  private readonly missed = new Map<string, { msg: ServerMessage; at: number }>()

  constructor(deps: ModeDeps) {
    this.d = { botDelayMs: 700, royaleFillMs: 20_000, royaleSoloMs: 60_000, random: Math.random, isBusy: () => false, restoreGraceMs: 120_000, ...deps }
  }

  // ── Queues ────────────────────────────────────────────────────────────────

  /** In a mode game now. */
  isPlaying(userId: string): boolean {
    return this.active.has(userId)
  }
  isQueued(userId: string): boolean {
    return this.cardQueue.isQueued(userId) || this.royaleQueue.has(userId)
  }
  owns(gameId: string): boolean {
    return this.cards.has(gameId) || this.royales.has(gameId)
  }

  private player(userId: string | null, mode: RatedMode): PublicPlayer {
    const u = userId ? this.d.store.user(userId) : null
    return { name: u?.name ?? 'Player', rating: userId ? this.d.store.modeRating(userId, mode).rating : 1200 }
  }

  find(userId: string, mode: OnlineMode): void {
    this.leaveQueues(userId)
    const rating = this.d.store.modeRating(userId, mode).rating
    if (mode === 'cards') this.cardQueue.join(userId, rating, CARDS_POOL.id, this.d.now())
    else this.royaleQueue.set(userId, { rating, since: this.d.now() })
    this.d.send(userId, { type: 'MODE_SEARCHING', mode, queued: mode === 'cards' ? this.cardQueue.waiting(CARDS_POOL.id) : this.royaleQueue.size })
    this.pair()
  }

  leaveQueues(userId: string): void {
    this.cardQueue.leave(userId)
    this.royaleQueue.delete(userId)
  }

  waiting(): number {
    return this.cardQueue.waiting(CARDS_POOL.id) + this.royaleQueue.size
  }

  /** Pairs Card Chess players and seats Battle Royale tables (also run on the Hub's timer). */
  pair(): void {
    const now = this.d.now()
    for (const [a, b] of this.cardQueue.pair(now)) {
      const aWhite = this.d.random() < 0.5
      this.startCards({ w: aWhite ? a.userId : b.userId, b: aWhite ? b.userId : a.userId })
    }
    // Battle Royale: four people at once; or, after a wait, two or three with computer armies; or, alone for long, three computer armies.
    const queue = [...this.royaleQueue.entries()].sort((x, y) => x[1].since - y[1].since)
    while (queue.length >= 4) this.startRoyale(queue.splice(0, 4).map(([id]) => id))
    const oldest = queue[0]?.[1].since
    if (oldest === undefined) return
    const waited = now - oldest
    if ((queue.length >= 2 && waited >= this.d.royaleFillMs) || (queue.length === 1 && waited >= this.d.royaleSoloMs)) this.startRoyale(queue.map(([id]) => id))
  }

  // ── Card Chess ────────────────────────────────────────────────────────────

  private startCards(players: Record<Side, string>): void {
    this.leaveQueues(players.w)
    this.leaveQueues(players.b)
    const room = new CardRoom(newId(), players, this.d.now(), this.d.random)
    this.cards.set(room.id, room)
    this.active.set(players.w, room.id)
    this.active.set(players.b, room.id)
    this.d.log(`cards ${room.id}: ${players.w} (white) vs ${players.b} (black)`)
    this.sendCardState(room)
    this.scheduleCards(room)
  }

  private sendCardState(room: CardRoom, only?: string): void {
    const now = this.d.now()
    for (const side of ['w', 'b'] as const) {
      const id = room.players[side]
      if (only && id !== only) continue
      this.d.send(id, { type: 'CARD_STATE', game: room.snapshot(side, this.player(room.players[other(side)], 'cards'), now) })
    }
  }

  private scheduleCards(room: CardRoom): void {
    this.clear(room.id)
    // Every change passes through here: save the game so a restart can resume it.
    if (this.cards.has(room.id) && !room.result) this.d.store.putLive(room.id, 'cards', room.toState(this.d.now()), this.d.now())
    const ms = room.msUntilDeadline(this.d.now())
    if (ms === null) return
    this.timers.set(
      room.id,
      this.d.setTimer(() => {
        this.timers.delete(room.id)
        const r = room.tick(this.d.now())
        if (r === 'started') this.sendCardState(room)
        if (r && r !== 'started') this.finishCards(room, r)
        else this.scheduleCards(room)
      }, ms + 5),
    )
  }

  private finishCards(room: CardRoom, result: CardResult): void {
    if (!this.cards.delete(room.id)) return
    this.clear(room.id)
    this.clearRestore(room.id)
    this.d.store.dropLive(room.id)
    const rated = result.reason !== 'aborted'
    const before = { w: this.d.store.modeRating(room.players.w, 'cards'), b: this.d.store.modeRating(room.players.b, 'cards') }
    const change = { w: 0, b: 0 }
    if (rated) {
      const score = (side: Side): 0 | 0.5 | 1 => (result.winner === null ? 0.5 : result.winner === side ? 1 : 0)
      change.w = eloChange(before.w.rating, before.b.rating, score('w'), before.w.games)
      change.b = eloChange(before.b.rating, before.w.rating, score('b'), before.b.games)
      this.d.store.transaction(() => {
        for (const side of ['w', 'b'] as const) {
          const r = before[side]
          const s = score(side)
          this.d.store.putModeRating(room.players[side], 'cards', { rating: Math.max(100, r.rating + change[side]), games: r.games + 1, wins: r.wins + (s === 1 ? 1 : 0), losses: r.losses + (s === 0 ? 1 : 0), draws: r.draws + (s === 0.5 ? 1 : 0) })
        }
        this.d.store.addGame({ id: room.id, pool: CARDS_POOL.id, white: room.players.w, black: room.players.b, winner: result.winner, reason: result.reason, moves: room.actions.map(cardNotation), ratingChange: change, endedAt: this.d.now(), ...(room.drafts.w && room.drafts.b ? { extra: { hands: { w: room.drafts.w, b: room.drafts.b } } } : {}) })
      })
    }
    for (const side of ['w', 'b'] as const) {
      const id = room.players[side]
      this.release(id)
      const r = before[side].rating
      this.deliver(id, { type: 'MODE_OVER', result: { gameId: room.id, mode: 'cards', winner: result.winner, ranking: [], reason: result.reason, rating: rated ? { before: r, after: Math.max(100, r + change[side]) } : null } })
    }
    this.d.log(`cards ${room.id} over: ${result.winner ?? 'draw'} by ${result.reason}`)
  }

  // ── Battle Royale ─────────────────────────────────────────────────────────

  private startRoyale(people: string[]): void {
    // People take random seats; computer armies fill the rest.
    const seats: Array<string | null> = [null, null, null, null]
    const order = [0, 1, 2, 3].sort(() => this.d.random() - 0.5)
    people.slice(0, 4).forEach((id, i) => {
      seats[order[i]!] = id
      this.leaveQueues(id)
    })
    const room = new RoyaleRoom(newId(), seats, this.d.now(), this.d.random)
    this.royales.set(room.id, room)
    for (const id of people) this.active.set(id, room.id)
    this.d.log(`royale ${room.id}: ${people.length} people, ${4 - people.length} computer armies`)
    this.sendRoyaleState(room)
    this.scheduleRoyale(room)
  }

  private royaleSeats(room: RoyaleRoom): RoyaleSeat[] {
    return room.seats.map((id, i) => (id ? { ...this.player(id, 'royale'), bot: false } : { name: `${SEAT_NAMES[i]} army`, rating: 1200, bot: true }))
  }

  private sendRoyaleState(room: RoyaleRoom, only?: string): void {
    const seats = this.royaleSeats(room)
    const now = this.d.now()
    room.seats.forEach((id, seat) => {
      if (id && (!only || id === only)) this.d.send(id, { type: 'ROYALE_STATE', game: room.snapshot(seat, seats, now) })
    })
  }

  private broadcastRoyale(room: RoyaleRoom, action: RoyaleAction): void {
    const msg: ServerMessage = { type: 'ROYALE_PLAYED', gameId: room.id, ply: room.actions.length - 1, action, turnMs: room.turnMsAt(this.d.now()) }
    for (const id of room.seats) if (id && this.active.get(id) === room.id) this.d.send(id, msg)
  }

  /** The next time event: a computer army's move, or the person to move running out of time. */
  private scheduleRoyale(room: RoyaleRoom): void {
    this.clear(room.id)
    if (room.over) return this.finishRoyale(room)
    this.d.store.putLive(room.id, 'royale', room.toState(this.d.now()), this.d.now())
    // Nobody is left to watch: play the rest out at once (only the order of the people matters, and they are all out).
    if (!room.humansAlive) {
      while (!room.over && room.autoMove(this.d.now())) {
        // keep going
      }
      return this.finishRoyale(room)
    }
    const now = this.d.now()
    const ms = room.isBot(room.turnSeat) ? this.d.botDelayMs : (room.turnMsAt(now) ?? 0)
    this.timers.set(
      room.id,
      this.d.setTimer(() => {
        this.timers.delete(room.id)
        const action = room.autoMove(this.d.now())
        if (action) this.broadcastRoyale(room, action)
        this.scheduleRoyale(room)
      }, ms + 5),
    )
  }

  private finishRoyale(room: RoyaleRoom): void {
    if (!this.royales.delete(room.id)) return
    this.clear(room.id)
    this.d.store.dropLive(room.id)
    const ranking = room.ranking()
    const people = room.seats.map((id, seat) => ({ id, seat })).filter((p): p is { id: string; seat: number } => p.id !== null)
    const place = (seat: number): number => ranking.indexOf(seat)
    const before = new Map(people.map((p) => [p.id, this.d.store.modeRating(p.id, 'royale')]))
    const change = new Map<string, number>()
    if (room.rated) {
      // Every pair of people is one game: the better finisher wins it. Averaged over the opponents.
      for (const a of people) {
        const ra = before.get(a.id)!
        let sum = 0
        for (const b of people) if (b !== a) sum += eloChange(ra.rating, before.get(b.id)!.rating, place(a.seat) < place(b.seat) ? 1 : 0, ra.games)
        change.set(a.id, Math.round(sum / (people.length - 1)))
      }
      this.d.store.transaction(() => {
        for (const p of people) {
          const r = before.get(p.id)!
          const won = place(p.seat) === 0
          this.d.store.putModeRating(p.id, 'royale', { rating: Math.max(100, r.rating + (change.get(p.id) ?? 0)), games: r.games + 1, wins: r.wins + (won ? 1 : 0), losses: r.losses + (won ? 0 : 1), draws: r.draws })
        }
        this.d.store.addRoyaleGame({ id: room.id, seats: [...room.seats], ranking, reason: room.game.result?.reason ?? 'last-king', plies: room.game.ply, ratingChange: Object.fromEntries(change), endedAt: this.d.now(), actions: [...room.actions] })
      })
    }
    for (const p of people) {
      const r = before.get(p.id)!.rating
      this.release(p.id)
      this.deliver(p.id, { type: 'MODE_OVER', result: { gameId: room.id, mode: 'royale', winner: null, ranking, reason: room.game.result?.reason ?? 'last-king', rating: room.rated ? { before: r, after: Math.max(100, r + (change.get(p.id) ?? 0)) } : null } })
    }
    this.d.log(`royale ${room.id} over: ${ranking.map((s) => SEAT_NAMES[s]).join(' > ')}`)
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  /** A mode message from a signed-in user. Returns an error to send back, or null. */
  handle(userId: string, msg: ModeClientMessage): { code: string; message: string } | null {
    const now = this.d.now()
    switch (msg.type) {
      case 'FIND_MODE':
        if (this.active.has(userId)) return { code: 'in-game', message: 'Finish your current game first.' }
        this.find(userId, msg.mode)
        return null
      case 'CARD_DRAFT': {
        const room = this.cards.get(msg.gameId)
        const side = room?.sideOf(userId)
        if (!room || !side) return { code: 'no-game', message: 'That game is not running.' }
        const refused = room.draft(side, msg.cards as CardId[], now)
        if (refused) {
          this.sendCardState(room, userId)
          return { code: 'refused', message: refused }
        }
        // Your own pick is confirmed; once both have picked, both see the full hands.
        if (room.phase === 'play') this.sendCardState(room)
        else this.sendCardState(room, userId)
        this.scheduleCards(room)
        return null
      }
      case 'CARD_ACTION': {
        const room = this.cards.get(msg.gameId)
        const side = room?.sideOf(userId)
        if (!room || !side) return { code: 'no-game', message: 'That game is not running.' }
        const timed = room.tick(now)
        if (timed && timed !== 'started') {
          this.finishCards(room, timed)
          return null
        }
        const refused = room.act(side, msg.ply, msg.action, now)
        if (refused) {
          this.sendCardState(room, userId)
          if (room.result) this.finishCards(room, room.result)
          return { code: 'refused', message: refused }
        }
        const played: ServerMessage = { type: 'CARD_PLAYED', gameId: room.id, ply: msg.ply, action: msg.action, clocks: room.clocksAt(now) }
        this.d.send(room.players.w, played)
        this.d.send(room.players.b, played)
        if (room.result) this.finishCards(room, room.result)
        else this.scheduleCards(room)
        return null
      }
      case 'ROYALE_MOVE': {
        const room = this.royales.get(msg.gameId)
        const seat = room?.seatOf(userId)
        if (!room || seat === null || seat === undefined) return { code: 'no-game', message: 'That game is not running.' }
        const out = room.move(seat, msg.ply, msg.from, msg.to, now)
        if (typeof out === 'string') {
          this.sendRoyaleState(room, userId)
          return { code: 'refused', message: out }
        }
        this.broadcastRoyale(room, out)
        this.scheduleRoyale(room)
        return null
      }
    }
  }

  /** Resigns a mode game (true when the game was one of ours). */
  resign(userId: string, gameId: string): boolean {
    const card = this.cards.get(gameId)
    const side = card?.sideOf(userId)
    if (card && side) {
      const r = card.resign(side)
      if (r) this.finishCards(card, r)
      return true
    }
    const royale = this.royales.get(gameId)
    const seat = royale?.seatOf(userId)
    if (royale && seat !== null && seat !== undefined) {
      const action = royale.leave(seat, this.d.now())
      if (action) this.broadcastRoyale(royale, action)
      // You are out: your result comes when the game ends, but you are free to play again now.
      this.release(userId)
      this.d.send(userId, { type: 'MODE_OVER', result: { gameId, mode: 'royale', winner: null, ranking: [], reason: 'resign', rating: null } })
      this.scheduleRoyale(royale)
      return true
    }
    return false
  }

  // ── Connections ───────────────────────────────────────────────────────────

  /** Sends a result that came while the user was away (before HELLO, so the app closes that game first). */
  deliverMissed(userId: string, conn: { send: (text: string) => void }): void {
    const missed = this.missed.get(userId)
    if (!missed) return
    this.missed.delete(userId)
    conn.send(JSON.stringify(missed.msg))
  }

  /** The mode game a user is in now, if any. */
  activeFor(userId: string): { kind: 'cards' | 'royale'; gameId: string } | null {
    const id = this.active.get(userId)
    if (!id) return null
    return this.cards.has(id) ? { kind: 'cards', gameId: id } : this.royales.has(id) ? { kind: 'royale', gameId: id } : null
  }

  /** A user (re)connected: their game in progress. */
  connected(userId: string): void {
    const grace = this.graceTimers.get(userId)
    if (grace !== undefined) {
      this.d.clearTimer(grace)
      this.graceTimers.delete(userId)
    }
    const wasAway = this.awayUntil.delete(userId) || grace !== undefined
    const id = this.active.get(userId)
    const card = id ? this.cards.get(id) : undefined
    if (card) {
      const side = card.sideOf(userId)
      const now = this.d.now()
      // Restored after a restart and your move: your clock starts now.
      if (side && card.paused && card.turn === side) {
        card.resume(now)
        this.scheduleCards(card)
        this.sendCardState(card)
      } else this.sendCardState(card, userId)
      if (wasAway && side) this.d.send(card.players[other(side)], { type: 'OPPONENT_RECONNECTED', gameId: card.id })
      const opp = side ? card.players[other(side)] : null
      const oppAway = opp ? this.awayUntil.get(opp) : undefined
      if (opp && oppAway !== undefined && !this.d.isOnline(opp)) this.d.send(userId, { type: 'OPPONENT_DISCONNECTED', gameId: card.id, graceMs: Math.max(0, oppAway - now) })
    }
    const royale = id ? this.royales.get(id) : undefined
    if (royale) this.sendRoyaleState(royale, userId)
  }

  /**
   * After a restart: brings back Card Chess games and Battle Royale tables.
   * Card Chess clocks stay stopped until the player to move is back, and a
   * player who isn't back within the grace loses (neither: aborted). Battle
   * Royale simply carries on: the move timer covers players who are away.
   */
  restoreLive(): number {
    const now = this.d.now()
    let restored = 0
    const usable = (ids: Array<string | null>) => ids.every((id) => id === null || (this.d.store.user(id) !== null && !this.active.has(id) && !this.d.isBusy(id)))
    for (const row of this.d.store.liveGames('cards')) {
      const room = CardRoom.restore(row.state as CardRoomState, now)
      if (!room || room.result || !usable([room.players.w, room.players.b])) {
        this.d.store.dropLive(row.id)
        continue
      }
      this.cards.set(room.id, room)
      for (const id of [room.players.w, room.players.b]) {
        this.active.set(id, room.id)
        this.awayUntil.set(id, now + this.d.restoreGraceMs)
      }
      this.scheduleCards(room)
      this.restoreTimers.set(
        room.id,
        this.d.setTimer(() => {
          this.restoreTimers.delete(room.id)
          if (!this.cards.has(room.id)) return
          const gone = (['w', 'b'] as const).filter((side) => !this.d.isOnline(room.players[side]) && !this.graceTimers.has(room.players[side]))
          const r = gone.length === 2 ? room.abort() : gone.length === 1 ? room.resign(gone[0]!, 'abandon') : null
          if (r) this.finishCards(room, r)
        }, this.d.restoreGraceMs),
      )
      restored += 1
    }
    for (const row of this.d.store.liveGames('royale')) {
      const room = RoyaleRoom.restore(row.state as RoyaleRoomState, now, this.d.random)
      if (!room || room.over || !usable([...room.seats])) {
        this.d.store.dropLive(row.id)
        continue
      }
      this.royales.set(room.id, room)
      for (const id of room.seats) if (id && room.alive(room.seats.indexOf(id))) this.active.set(id, room.id)
      this.scheduleRoyale(room)
      restored += 1
    }
    return restored
  }

  /** A user's last connection closed. */
  disconnected(userId: string): void {
    this.leaveQueues(userId)
    const id = this.active.get(userId)
    const card = id ? this.cards.get(id) : undefined
    if (!card) return
    // Card Chess: the opponent is told, and the player has a grace period. (In Battle Royale the move timer covers it.)
    const side = card.sideOf(userId)!
    this.awayUntil.set(userId, this.d.now() + this.d.graceMs)
    this.d.send(card.players[other(side)], { type: 'OPPONENT_DISCONNECTED', gameId: card.id, graceMs: this.d.graceMs })
    this.graceTimers.set(
      userId,
      this.d.setTimer(() => {
        this.graceTimers.delete(userId)
        if (this.d.isOnline(userId)) return
        const r = card.resign(side, 'abandon')
        if (r) this.finishCards(card, r)
      }, this.d.graceMs),
    )
  }

  // ── Bookkeeping ───────────────────────────────────────────────────────────

  private release(userId: string): void {
    this.active.delete(userId)
    this.awayUntil.delete(userId)
    const grace = this.graceTimers.get(userId)
    if (grace !== undefined) this.d.clearTimer(grace)
    this.graceTimers.delete(userId)
  }

  private deliver(userId: string, msg: ServerMessage): void {
    if (this.d.isOnline(userId)) {
      this.d.send(userId, msg)
      return
    }
    // Held for a day at most.
    const now = this.d.now()
    for (const [id, m] of this.missed) if (now - m.at > MISSED_TTL_MS) this.missed.delete(id)
    this.missed.set(userId, { msg, at: now })
  }

  private clearRestore(gameId: string): void {
    const t = this.restoreTimers.get(gameId)
    if (t !== undefined) this.d.clearTimer(t)
    this.restoreTimers.delete(gameId)
  }

  private clear(gameId: string): void {
    const t = this.timers.get(gameId)
    if (t !== undefined) this.d.clearTimer(t)
    this.timers.delete(gameId)
  }

  stats(): { cards: number; royale: number } {
    return { cards: this.cards.size, royale: this.royales.size }
  }

  close(): void {
    for (const t of this.timers.values()) this.d.clearTimer(t)
    for (const t of this.graceTimers.values()) this.d.clearTimer(t)
    for (const t of this.restoreTimers.values()) this.d.clearTimer(t)
    this.timers.clear()
    this.graceTimers.clear()
    this.restoreTimers.clear()
  }
}
