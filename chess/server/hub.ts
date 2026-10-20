// The live side of ranked play: connections, the matchmaking queue, game
// rooms, clocks, disconnect grace periods and reconnects. Transport-agnostic
// (a Conn is anything that can send text and close) and with time injected,
// so whole games — flags and abandons included — run in tests.
import { RANKED_POOLS, RANKED_PROTOCOL, type ClientMessage, type PublicPlayer, type ServerMessage, parseClientMessage, poolById } from '../src/online/ranked/protocol'
import { newId } from './auth'
import { GameRoom, type Result, type Side, eloChange } from './game'
import { Matchmaker } from './matchmaker'
import type { Store, User } from './store'

export interface Conn {
  send: (text: string) => void
  close: (code?: number, reason?: string) => void
}

export interface HubDeps {
  store: Store
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  /** How long a disconnected player has to come back before losing the game. */
  graceMs?: number
  /** How often the queue is paired. */
  pairEveryMs?: number
  log?: (line: string) => void
}

/** Messages per second a connection may send before being disconnected. */
const MAX_MSG_PER_SEC = 20

export class Hub {
  private readonly store: Store
  private readonly now: () => number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void
  readonly graceMs: number
  private readonly log: (line: string) => void
  private readonly conns = new Map<string, Set<Conn>>()
  private readonly rates = new WeakMap<Conn, { second: number; count: number }>()
  readonly matchmaker = new Matchmaker()
  private readonly games = new Map<string, GameRoom>()
  private readonly activeGame = new Map<string, string>()
  private readonly gameTimers = new Map<string, unknown>()
  private readonly graceTimers = new Map<string, unknown>()
  /** Results of games that ended while the player was away, delivered when they come back. */
  private readonly missedResults = new Map<string, ServerMessage>()
  private pairTimer: unknown = null
  private closed = false

  constructor(deps: HubDeps) {
    this.store = deps.store
    this.now = deps.now ?? Date.now
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
    this.graceMs = deps.graceMs ?? 60_000
    this.log = deps.log ?? (() => {})
    const every = deps.pairEveryMs ?? 1000
    // Re-pair on a timer too: waiting windows widen, so a pair may become possible without anyone joining.
    const loop = (): void => {
      if (this.closed) return
      this.pairTimer = this.setTimer(() => {
        this.pairNow()
        loop()
      }, every)
    }
    if (every > 0) loop()
  }

  // ── Connections ───────────────────────────────────────────────────────────

  private send(userId: string, msg: ServerMessage): void {
    const text = JSON.stringify(msg)
    for (const c of this.conns.get(userId) ?? []) c.send(text)
  }

  private player(userId: string): PublicPlayer {
    const u = this.store.user(userId)
    return { name: u?.name ?? 'Player', rating: u?.rating ?? 1200 }
  }

  /** A signed-in user connected (a new tab, or coming back). */
  connect(user: User, conn: Conn): void {
    const set = this.conns.get(user.id) ?? new Set<Conn>()
    set.add(conn)
    this.conns.set(user.id, set)
    conn.send(JSON.stringify({ type: 'HELLO', protocol: RANKED_PROTOCOL, user: { id: user.id, name: user.name, rating: user.rating } } satisfies ServerMessage))
    // Back in time: resume the game in progress.
    const grace = this.graceTimers.get(user.id)
    if (grace !== undefined) {
      this.clearTimer(grace)
      this.graceTimers.delete(user.id)
    }
    const missed = this.missedResults.get(user.id)
    if (missed) {
      this.missedResults.delete(user.id)
      conn.send(JSON.stringify(missed))
    }
    const game = this.gameOf(user.id)
    if (game) {
      const side = game.sideOf(user.id)!
      const opp = game.players[side === 'w' ? 'b' : 'w']
      conn.send(JSON.stringify({ type: 'MATCH_FOUND', game: game.snapshot(side, this.player(opp), this.now()) } satisfies ServerMessage))
      if (grace !== undefined) this.send(opp, { type: 'OPPONENT_RECONNECTED', gameId: game.id })
    }
  }

  disconnect(userId: string, conn: Conn): void {
    const set = this.conns.get(userId)
    set?.delete(conn)
    if (set && set.size > 0) return
    this.conns.delete(userId)
    this.matchmaker.leave(userId)
    const game = this.gameOf(userId)
    if (!game) return
    // The last tab closed mid-game: the opponent is told, and the player has a grace period.
    const side = game.sideOf(userId)!
    this.send(game.players[side === 'w' ? 'b' : 'w'], { type: 'OPPONENT_DISCONNECTED', gameId: game.id, graceMs: this.graceMs })
    this.graceTimers.set(
      userId,
      this.setTimer(() => {
        this.graceTimers.delete(userId)
        if (this.conns.has(userId)) return
        const r = game.abandon(side)
        if (r) this.finish(game, r)
      }, this.graceMs),
    )
  }

  /** A message from a signed-in user's connection. */
  message(userId: string, conn: Conn, raw: unknown): void {
    const second = Math.floor(this.now() / 1000)
    const rate = this.rates.get(conn)
    if (!rate || rate.second !== second) this.rates.set(conn, { second, count: 1 })
    else if (++rate.count > MAX_MSG_PER_SEC) {
      conn.close(1008, 'Too many messages')
      return
    }
    const msg = parseClientMessage(raw)
    if (!msg) {
      conn.send(JSON.stringify({ type: 'ERROR', code: 'bad-message', message: 'That message was not understood.' } satisfies ServerMessage))
      return
    }
    this.handle(userId, conn, msg)
  }

  private error(conn: Conn, code: string, message: string): void {
    conn.send(JSON.stringify({ type: 'ERROR', code, message } satisfies ServerMessage))
  }

  private handle(userId: string, conn: Conn, msg: ClientMessage): void {
    switch (msg.type) {
      case 'PING':
        conn.send(JSON.stringify({ type: 'PONG', at: msg.at } satisfies ServerMessage))
        return
      case 'FIND_MATCH': {
        if (this.gameOf(userId)) return this.error(conn, 'in-game', 'Finish your current game first.')
        const user = this.store.user(userId)
        if (!user) return this.error(conn, 'no-user', 'Your account was not found.')
        this.matchmaker.join(userId, user.rating, msg.pool, this.now())
        this.send(userId, { type: 'SEARCHING', pool: msg.pool, queued: this.matchmaker.waiting(msg.pool) })
        this.pairNow()
        return
      }
      case 'CANCEL_MATCH':
        this.matchmaker.leave(userId)
        return
      case 'MAKE_MOVE': {
        const game = this.games.get(msg.gameId)
        const side = game?.sideOf(userId)
        if (!game || !side) return this.error(conn, 'no-game', 'That game is not running.')
        const now = this.now()
        const timed = game.tick(now)
        if (timed) return this.finish(game, timed)
        const refused = game.move(side, msg.ply, msg.uci, now)
        if (refused) {
          conn.send(JSON.stringify({ type: 'MOVE_REJECTED', gameId: game.id, ply: msg.ply, reason: refused, game: game.snapshot(side, this.player(game.players[side === 'w' ? 'b' : 'w']), now) } satisfies ServerMessage))
          if (game.result) this.finish(game, game.result)
          return
        }
        const clocks = game.clocksAt(now)
        const opp = game.players[side === 'w' ? 'b' : 'w']
        this.send(userId, { type: 'MOVE_ACCEPTED', gameId: game.id, ply: msg.ply, clocks })
        this.send(opp, { type: 'OPPONENT_MOVE', gameId: game.id, ply: msg.ply, uci: msg.uci, clocks })
        if (game.result) this.finish(game, game.result)
        else this.schedule(game)
        return
      }
      case 'RESIGN': {
        const game = this.games.get(msg.gameId)
        const side = game?.sideOf(userId)
        if (!game || !side) return
        const r = game.resign(side)
        if (r) this.finish(game, r)
        return
      }
      case 'OFFER_DRAW': {
        const game = this.games.get(msg.gameId)
        const side = game?.sideOf(userId)
        if (game && side && game.offerDraw(side)) this.send(game.players[side === 'w' ? 'b' : 'w'], { type: 'DRAW_OFFERED', gameId: game.id, by: side })
        return
      }
      case 'ANSWER_DRAW': {
        const game = this.games.get(msg.gameId)
        const side = game?.sideOf(userId)
        if (!game || !side) return
        const out = game.answerDraw(side, msg.accept)
        if (out === 'declined') this.send(game.players[side === 'w' ? 'b' : 'w'], { type: 'DRAW_DECLINED', gameId: game.id })
        else if (out && out !== 'invalid') this.finish(game, out)
        return
      }
    }
  }

  // ── Games ─────────────────────────────────────────────────────────────────

  private gameOf(userId: string): GameRoom | null {
    const id = this.activeGame.get(userId)
    return id ? (this.games.get(id) ?? null) : null
  }

  /** Pairs the queue now (also runs on a timer, as waiting windows widen). */
  pairNow(): void {
    for (const [a, b] of this.matchmaker.pair(this.now())) {
      const pool = poolById(a.pool)
      if (!pool) continue
      // Colours are random.
      const aWhite = Math.random() < 0.5
      const players = { w: aWhite ? a.userId : b.userId, b: aWhite ? b.userId : a.userId }
      const game = new GameRoom(newId(), pool, players, this.now())
      this.games.set(game.id, game)
      this.activeGame.set(players.w, game.id)
      this.activeGame.set(players.b, game.id)
      for (const side of ['w', 'b'] as const) {
        const opp = players[side === 'w' ? 'b' : 'w']
        this.send(players[side], { type: 'MATCH_FOUND', game: game.snapshot(side, this.player(opp), this.now()) })
      }
      this.log(`match ${game.id}: ${players.w} (white) vs ${players.b} (black), ${pool.id}`)
      this.schedule(game)
    }
  }

  /** Arms the game's next time event (abort or flag). */
  private schedule(game: GameRoom): void {
    const prev = this.gameTimers.get(game.id)
    if (prev !== undefined) this.clearTimer(prev)
    const ms = game.msUntilDeadline(this.now())
    if (ms === null) return
    this.gameTimers.set(
      game.id,
      this.setTimer(() => {
        this.gameTimers.delete(game.id)
        const r = game.tick(this.now())
        if (r) this.finish(game, r)
        else this.schedule(game)
      }, ms + 5),
    )
  }

  /** Records the result, updates ratings, tells both players, and frees the room. */
  private finish(game: GameRoom, result: Result): void {
    if (!this.games.has(game.id)) return
    this.games.delete(game.id)
    const timer = this.gameTimers.get(game.id)
    if (timer !== undefined) this.clearTimer(timer)
    this.gameTimers.delete(game.id)
    const w = this.store.user(game.players.w)
    const b = this.store.user(game.players.b)
    const rated = result.reason !== 'aborted' && w !== null && b !== null
    const score = (side: Side): 0 | 0.5 | 1 => (result.winner === null ? 0.5 : result.winner === side ? 1 : 0)
    const change = { w: 0, b: 0 }
    if (rated && w && b) {
      change.w = eloChange(w.rating, b.rating, score('w'), w.games)
      change.b = eloChange(b.rating, w.rating, score('b'), b.games)
      for (const [side, u] of [['w', w], ['b', b]] as const) {
        const s = score(side)
        this.store.putUser({ ...u, rating: Math.max(100, u.rating + change[side]), games: u.games + 1, wins: u.wins + (s === 1 ? 1 : 0), losses: u.losses + (s === 0 ? 1 : 0), draws: u.draws + (s === 0.5 ? 1 : 0) })
      }
      this.store.addGame({ id: game.id, pool: game.pool.id, white: game.players.w, black: game.players.b, winner: result.winner, reason: result.reason, moves: [...game.moves], ratingChange: change, endedAt: this.now() })
    }
    for (const side of ['w', 'b'] as const) {
      const id = game.players[side]
      const before = side === 'w' ? (w?.rating ?? 1200) : (b?.rating ?? 1200)
      this.activeGame.delete(id)
      const grace = this.graceTimers.get(id)
      if (grace !== undefined) this.clearTimer(grace)
      this.graceTimers.delete(id)
      const over: ServerMessage = { type: 'GAME_OVER', gameId: game.id, winner: result.winner, reason: result.reason, rating: { before, after: Math.max(100, before + change[side]) } }
      if (this.conns.has(id)) this.send(id, over)
      else this.missedResults.set(id, over)
    }
    this.log(`game ${game.id} over: ${result.winner ?? 'draw'} by ${result.reason}`)
  }

  /** Live counts (for /api/health). */
  stats(): { online: number; games: number; queued: number } {
    let queued = 0
    for (const p of RANKED_POOLS) queued += this.matchmaker.waiting(p.id)
    return { online: this.conns.size, games: this.games.size, queued }
  }

  close(): void {
    this.closed = true
    if (this.pairTimer !== null) this.clearTimer(this.pairTimer)
    for (const t of this.gameTimers.values()) this.clearTimer(t)
    for (const t of this.graceTimers.values()) this.clearTimer(t)
  }
}
