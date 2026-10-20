// The live side of ranked play: connections, the matchmaking queue, game
// rooms, clocks, disconnect grace periods and reconnects. Transport-agnostic
// (a Conn is anything that can send text and close) and with time injected,
// so whole games — flags and abandons included — run in tests.
import { RANKED_POOLS, RANKED_PROTOCOL, VANISH_POOLS, type ClientMessage, type GameSnapshot, type PublicPlayer, type ServerMessage, parseClientMessage, poolById } from '../src/online/ranked/protocol'
import { warPoints } from './clans'
import { newId } from './auth'
import { GameRoom, type GameRoomState, type Result, type Side, eloChange } from './game'
import { Matchmaker } from './matchmaker'
import { ModeRooms } from './modes/modeRooms'
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
  /** After a restart, how long players of a resumed game have to come back. */
  restoreGraceMs?: number
  /** Overrides for the online modes (tests). */
  modes?: { botDelayMs?: number; royaleFillMs?: number; royaleSoloMs?: number; random?: () => number }
  log?: (line: string) => void
}

/** How long a result waits for a player who never comes back. */
export const MISSED_TTL_MS = 24 * 3_600_000

/** Messages per second a connection may send before being disconnected. */
const MAX_MSG_PER_SEC = 20
/** Most people watching one game. */
export const MAX_SPECTATORS = 200

/** Who won a game started for someone else (the tournament): the winner's id, null for a draw. */
export type GameResultHook = (winner: string | null, aborted: boolean) => void

export interface LiveGame {
  gameId: string
  white: PublicPlayer
  black: PublicPlayer
  pool: string
  moves: number
  label: string | null
  watchers: number
}

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
  /** Card Chess and Battle Royale. */
  readonly modes: ModeRooms
  private readonly games = new Map<string, GameRoom>()
  private readonly activeGame = new Map<string, string>()
  private readonly gameTimers = new Map<string, unknown>()
  private readonly graceTimers = new Map<string, unknown>()
  /** Results of games that ended while the player was away, delivered when they come back (kept a day). */
  private readonly missedResults = new Map<string, { msg: ServerMessage; at: number }>()
  /** Players known to be away from a game: until when they may come back (for the opponent's countdown). */
  private readonly awayUntil = new Map<string, number>()
  /** Restored games waiting for their players after a restart. */
  private readonly restoreTimers = new Map<string, unknown>()
  readonly restoreGraceMs: number
  /** Called after a user connects (the tournament listens, to start games after a restart). */
  onConnect: ((userId: string) => void) | null = null
  private pairTimer: unknown = null
  private closed = false
  /** Tournament (or other) games: a label for the players, and who to tell the result. */
  private readonly labels = new Map<string, string>()
  private readonly hooks = new Map<string, GameResultHook>()
  /** Watchers per game, and the game each watching connection follows. */
  private readonly spectators = new Map<string, Set<Conn>>()
  private readonly watching = new WeakMap<Conn, string>()

  constructor(deps: HubDeps) {
    this.store = deps.store
    this.now = deps.now ?? Date.now
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
    this.graceMs = deps.graceMs ?? 60_000
    this.restoreGraceMs = deps.restoreGraceMs ?? 120_000
    this.log = deps.log ?? (() => {})
    this.modes = new ModeRooms({ store: this.store, now: this.now, setTimer: this.setTimer, clearTimer: this.clearTimer, log: this.log, send: (id, msg) => this.send(id, msg), isOnline: (id) => this.isOnline(id), isBusy: (id) => this.activeGame.has(id), graceMs: this.graceMs, restoreGraceMs: this.restoreGraceMs, ...deps.modes })
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

  private snap(game: GameRoom, side: 'w' | 'b', now: number): GameSnapshot {
    const s = game.snapshot(side, this.player(game.players[side === 'w' ? 'b' : 'w'], game.pool.mode), now)
    const label = this.labels.get(game.id)
    return label ? { ...s, label } : s
  }

  /** Every connected user gets this (tournament pings). */
  broadcast(msg: ServerMessage): void {
    const text = JSON.stringify(msg)
    for (const set of this.conns.values()) for (const c of set) c.send(text)
  }

  isOnline(userId: string): boolean {
    return this.conns.has(userId)
  }

  /** Free to start a game now: connected and not already playing. */
  isAvailable(userId: string): boolean {
    return this.conns.has(userId) && !this.activeGame.has(userId) && !this.modes.isPlaying(userId)
  }

  /** Name and rating (a Vanishing Chess game shows the Vanishing rating). */
  private player(userId: string, mode?: 'vanish'): PublicPlayer {
    const u = this.store.user(userId)
    return { name: u?.name ?? 'Player', rating: mode ? this.store.modeRating(userId, mode).rating : (u?.rating ?? 1200) }
  }

  /** A signed-in user connected (a new tab, or coming back). */
  connect(user: User, conn: Conn): void {
    const set = this.conns.get(user.id) ?? new Set<Conn>()
    set.add(conn)
    this.conns.set(user.id, set)
    const now = this.now()
    // Back in time: cancel the countdown.
    const grace = this.graceTimers.get(user.id)
    if (grace !== undefined) {
      this.clearTimer(grace)
      this.graceTimers.delete(user.id)
    }
    const wasAway = this.awayUntil.delete(user.id)
    // A result from while you were away comes first, so the app closes that game before HELLO says what is live.
    const missed = this.missedResults.get(user.id)
    if (missed) {
      this.missedResults.delete(user.id)
      conn.send(JSON.stringify(missed.msg))
    }
    this.modes.deliverMissed(user.id, conn)
    conn.send(JSON.stringify({ type: 'HELLO', protocol: RANKED_PROTOCOL, user: { id: user.id, name: user.name, rating: user.rating }, active: this.activeFor(user.id) } satisfies ServerMessage))
    const game = this.gameOf(user.id)
    if (game) {
      const side = game.sideOf(user.id)!
      const opp = game.players[side === 'w' ? 'b' : 'w']
      // Restored after a restart and your move: your clock starts now (not while the server was down).
      if (game.paused && game.turn === side) {
        game.resume(now)
        this.schedule(game)
        this.persist(game)
        this.send(opp, { type: 'MATCH_FOUND', game: this.snap(game, side === 'w' ? 'b' : 'w', now) })
      }
      conn.send(JSON.stringify({ type: 'MATCH_FOUND', game: this.snap(game, side, now) } satisfies ServerMessage))
      if (wasAway) this.send(opp, { type: 'OPPONENT_RECONNECTED', gameId: game.id })
      // Your opponent isn't back yet: show their countdown.
      const oppAway = this.awayUntil.get(opp)
      if (oppAway !== undefined && !this.conns.has(opp)) conn.send(JSON.stringify({ type: 'OPPONENT_DISCONNECTED', gameId: game.id, graceMs: Math.max(0, oppAway - now) } satisfies ServerMessage))
    }
    this.modes.connected(user.id)
    this.onConnect?.(user.id)
  }

  /** The game a user is in right now, of any kind (sent in HELLO so the app can drop a game the server no longer has). */
  private activeFor(userId: string): { kind: 'chess' | 'cards' | 'royale'; gameId: string } | null {
    const id = this.activeGame.get(userId)
    if (id) return { kind: 'chess', gameId: id }
    return this.modes.activeFor(userId)
  }

  /** Saves a game in progress, so a restarted server can resume it. */
  private persist(game: GameRoom): void {
    const label = this.labels.get(game.id)
    this.store.putLive(game.id, 'chess', { ...game.toState(this.now()), label: label ?? null }, this.now())
  }

  /**
   * After a restart: brings back the games that were being played. Clocks
   * stay stopped until the player to move reconnects; whoever isn't back
   * within `restoreGraceMs` loses (or, if neither is, the game is aborted).
   * Returns how many games came back.
   */
  restoreLive(): number {
    let restored = 0
    const now = this.now()
    for (const row of this.store.liveGames('chess')) {
      const state = row.state as GameRoomState & { label?: string | null }
      const game = GameRoom.restore(state, now)
      const players = game ? [game.players.w, game.players.b] : []
      if (!game || players.some((id) => !this.store.user(id) || this.activeGame.has(id))) {
        this.store.dropLive(row.id)
        continue
      }
      this.games.set(game.id, game)
      for (const id of players) {
        this.activeGame.set(id, game.id)
        this.awayUntil.set(id, now + this.restoreGraceMs)
      }
      if (state.label) this.labels.set(game.id, state.label)
      this.schedule(game)
      this.restoreTimers.set(
        game.id,
        this.setTimer(() => {
          this.restoreTimers.delete(game.id)
          if (!this.games.has(game.id)) return
          const gone = (['w', 'b'] as const).filter((side) => !this.conns.has(game.players[side]) && !this.graceTimers.has(game.players[side]))
          const r = gone.length === 2 ? game.abort() : gone.length === 1 ? game.abandon(gone[0]!) : null
          if (r) this.finish(game, r)
        }, this.restoreGraceMs),
      )
      restored += 1
    }
    restored += this.modes.restoreLive()
    if (restored > 0) this.log(`restored ${restored} game(s) in progress`)
    return restored
  }

  /** In a game of any kind right now. */
  isPlaying(userId: string): boolean {
    return this.activeGame.has(userId) || this.modes.isPlaying(userId)
  }

  /** Closes every connection of a user and takes them out of the queues (account deletion). */
  kick(userId: string): void {
    this.matchmaker.leave(userId)
    this.modes.leaveQueues(userId)
    for (const c of [...(this.conns.get(userId) ?? [])]) c.close(4001, 'Account deleted')
  }

  /** Is this game being played now? (The tournament asks after a restart.) */
  hasGame(gameId: string): boolean {
    return this.games.has(gameId)
  }

  /** Tells `hook` the result of a game already running (the tournament, after a restart). */
  attachResultHook(gameId: string, hook: GameResultHook): boolean {
    if (!this.games.has(gameId)) return false
    this.hooks.set(gameId, hook)
    return true
  }

  disconnect(userId: string, conn: Conn): void {
    this.unwatch(conn)
    const set = this.conns.get(userId)
    set?.delete(conn)
    if (set && set.size > 0) return
    this.conns.delete(userId)
    this.matchmaker.leave(userId)
    this.modes.disconnected(userId)
    const game = this.gameOf(userId)
    if (!game) return
    // The last tab closed mid-game: the opponent is told, and the player has a grace period.
    const side = game.sideOf(userId)!
    this.awayUntil.set(userId, this.now() + this.graceMs)
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
        if (this.gameOf(userId) || this.modes.isPlaying(userId)) return this.error(conn, 'in-game', 'Finish your current game first.')
        const user = this.store.user(userId)
        if (!user) return this.error(conn, 'no-user', 'Your account was not found.')
        const pool = poolById(msg.pool)
        this.modes.leaveQueues(userId)
        this.matchmaker.join(userId, pool?.mode ? this.store.modeRating(userId, pool.mode).rating : user.rating, msg.pool, this.now())
        this.send(userId, { type: 'SEARCHING', pool: msg.pool, queued: this.matchmaker.waiting(msg.pool) })
        this.pairNow()
        return
      }
      case 'CANCEL_MATCH':
        this.matchmaker.leave(userId)
        this.modes.leaveQueues(userId)
        return
      case 'FIND_MODE':
      case 'CARD_DRAFT':
      case 'CARD_ACTION':
      case 'ROYALE_MOVE': {
        if (msg.type === 'FIND_MODE') {
          if (this.gameOf(userId)) return this.error(conn, 'in-game', 'Finish your current game first.')
          this.matchmaker.leave(userId)
        }
        const refused = this.modes.handle(userId, msg)
        if (refused) this.error(conn, refused.code, refused.message)
        return
      }
      case 'SPECTATE': {
        const game = this.games.get(msg.gameId)
        // Vanishing Chess games can't be watched: a second account would see every hidden piece.
        if (!game || game.pool.mode) return this.error(conn, 'no-game', 'That game has finished.')
        if (game.sideOf(userId)) return this.error(conn, 'own-game', 'You are playing this game.')
        const set = this.spectators.get(game.id) ?? new Set<Conn>()
        if (!set.has(conn) && set.size >= MAX_SPECTATORS) return this.error(conn, 'full', 'Too many people are watching this game.')
        this.unwatch(conn)
        set.add(conn)
        this.spectators.set(game.id, set)
        this.watching.set(conn, game.id)
        const now = this.now()
        conn.send(
          JSON.stringify({
            type: 'SPECTATE_START',
            game: { gameId: game.id, white: this.player(game.players.w), black: this.player(game.players.b), pool: game.pool.id, moves: [...game.moves], clocks: game.clocksAt(now), running: game.result || game.moves.length === 0 ? null : game.moves.length % 2 === 0 ? 'w' : 'b', label: this.labels.get(game.id) ?? null },
          } satisfies ServerMessage),
        )
        return
      }
      case 'UNSPECTATE':
        this.unwatch(conn)
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
          conn.send(JSON.stringify({ type: 'MOVE_REJECTED', gameId: game.id, ply: msg.ply, reason: refused, game: this.snap(game, side, now) } satisfies ServerMessage))
          if (game.result) this.finish(game, game.result)
          return
        }
        const clocks = game.clocksAt(now)
        const opp = game.players[side === 'w' ? 'b' : 'w']
        this.send(userId, { type: 'MOVE_ACCEPTED', gameId: game.id, ply: msg.ply, clocks })
        this.send(opp, { type: 'OPPONENT_MOVE', gameId: game.id, ply: msg.ply, uci: msg.uci, clocks })
        this.toWatchers(game.id, { type: 'SPECTATE_MOVE', gameId: game.id, ply: msg.ply, uci: msg.uci, clocks })
        if (game.result) this.finish(game, game.result)
        else {
          this.schedule(game)
          this.persist(game)
        }
        return
      }
      case 'RESIGN': {
        if (this.modes.resign(userId, msg.gameId)) return
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
        if (game && side && game.offerDraw(side)) {
          this.send(game.players[side === 'w' ? 'b' : 'w'], { type: 'DRAW_OFFERED', gameId: game.id, by: side })
          this.persist(game)
        }
        return
      }
      case 'ANSWER_DRAW': {
        const game = this.games.get(msg.gameId)
        const side = game?.sideOf(userId)
        if (!game || !side) return
        const out = game.answerDraw(side, msg.accept)
        if (out === 'declined') {
          this.send(game.players[side === 'w' ? 'b' : 'w'], { type: 'DRAW_DECLINED', gameId: game.id })
          this.persist(game)
        }
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
    this.modes.pair()
    for (const [a, b] of this.matchmaker.pair(this.now())) {
      // Colours are random.
      const aWhite = Math.random() < 0.5
      this.startGame({ w: aWhite ? a.userId : b.userId, b: aWhite ? b.userId : a.userId }, a.pool)
    }
  }

  /**
   * Starts a rated game between two players (the queue, or the tournament).
   * Returns the game id, or null if either can't play now.
   */
  startGame(players: { w: string; b: string }, poolId: string, label: string | null = null, onResult: GameResultHook | null = null): string | null {
    const pool = poolById(poolId)
    if (!pool || players.w === players.b || !this.isFree(players.w) || !this.isFree(players.b)) return null
    this.matchmaker.leave(players.w)
    this.matchmaker.leave(players.b)
    const game = new GameRoom(newId(), pool, players, this.now())
    this.games.set(game.id, game)
    this.activeGame.set(players.w, game.id)
    this.activeGame.set(players.b, game.id)
    if (label) this.labels.set(game.id, label)
    if (onResult) this.hooks.set(game.id, onResult)
    for (const side of ['w', 'b'] as const) this.send(players[side], { type: 'MATCH_FOUND', game: this.snap(game, side, this.now()) })
    this.log(`match ${game.id}: ${players.w} (white) vs ${players.b} (black), ${pool.id}${label ? ` · ${label}` : ''}`)
    this.schedule(game)
    this.persist(game)
    return game.id
  }

  /** Not in a game of any kind. */
  private isFree(userId: string): boolean {
    return !this.activeGame.has(userId) && !this.modes.isPlaying(userId)
  }

  /** Games being played now, the strongest first (for the Watch list; Vanishing Chess is never listed). */
  liveGames(limit = 20): LiveGame[] {
    return [...this.games.values()]
      .filter((g) => !g.result && !g.pool.mode)
      .map((g) => ({ gameId: g.id, white: this.player(g.players.w), black: this.player(g.players.b), pool: g.pool.id, moves: g.moves.length, label: this.labels.get(g.id) ?? null, watchers: this.spectators.get(g.id)?.size ?? 0 }))
      .sort((a, b) => b.white.rating + b.black.rating - (a.white.rating + a.black.rating))
      .slice(0, limit)
  }

  private toWatchers(gameId: string, msg: ServerMessage): void {
    const set = this.spectators.get(gameId)
    if (!set) return
    const text = JSON.stringify(msg)
    for (const c of set) c.send(text)
  }

  private unwatch(conn: Conn): void {
    const id = this.watching.get(conn)
    if (!id) return
    this.watching.delete(conn)
    const set = this.spectators.get(id)
    set?.delete(conn)
    if (set && set.size === 0) this.spectators.delete(id)
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
    this.store.dropLive(game.id)
    for (const timers of [this.gameTimers, this.restoreTimers]) {
      const timer = timers.get(game.id)
      if (timer !== undefined) this.clearTimer(timer)
      timers.delete(game.id)
    }
    const w = this.store.user(game.players.w)
    const b = this.store.user(game.players.b)
    const rated = result.reason !== 'aborted' && w !== null && b !== null
    const score = (side: Side): 0 | 0.5 | 1 => (result.winner === null ? 0.5 : result.winner === side ? 1 : 0)
    const change = { w: 0, b: 0 }
    const mode = game.pool.mode
    // The rating this game counts for: the user's own, or (Vanishing Chess) the mode's.
    const ratingOf = (u: User): { rating: number; games: number } => (mode ? this.store.modeRating(u.id, mode) : u)
    const before = { w: w ? ratingOf(w).rating : 1200, b: b ? ratingOf(b).rating : 1200 }
    if (rated && w && b) {
      const rw = ratingOf(w)
      const rb = ratingOf(b)
      change.w = eloChange(rw.rating, rb.rating, score('w'), rw.games)
      change.b = eloChange(rb.rating, rw.rating, score('b'), rb.games)
      const now = this.now()
      this.store.transaction(() => {
        for (const [side, u] of [['w', w], ['b', b]] as const) {
          const s = score(side)
          const tally = { wins: s === 1 ? 1 : 0, losses: s === 0 ? 1 : 0, draws: s === 0.5 ? 1 : 0 }
          if (mode) {
            const r = this.store.modeRating(u.id, mode)
            this.store.putModeRating(u.id, mode, { rating: Math.max(100, r.rating + change[side]), games: r.games + 1, wins: r.wins + tally.wins, losses: r.losses + tally.losses, draws: r.draws + tally.draws })
          } else this.store.putUser({ ...u, rating: Math.max(100, u.rating + change[side]), games: u.games + 1, wins: u.wins + tally.wins, losses: u.losses + tally.losses, draws: u.draws + tally.draws })
        }
        this.store.addGame({ id: game.id, pool: game.pool.id, white: game.players.w, black: game.players.b, winner: result.winner, reason: result.reason, moves: [...game.moves], ratingChange: change, endedAt: now })
        if (mode) return
        // The season table and the clan war (standard chess only).
        this.store.rollSeason(now)
        const clans = { w: this.store.clanOf(w.id)?.id ?? null, b: this.store.clanOf(b.id)?.id ?? null }
        for (const side of ['w', 'b'] as const) {
          const u = side === 'w' ? w : b
          this.store.recordSeasonGame(u.id, score(side) === 1, Math.max(100, u.rating + change[side]))
          const mine = clans[side]
          if (mine) this.store.addWarPoints(mine, warPoints(mine, clans[side === 'w' ? 'b' : 'w'], score(side)), now)
        }
      })
    }
    this.toWatchers(game.id, { type: 'SPECTATE_OVER', gameId: game.id, winner: result.winner, reason: result.reason })
    this.spectators.delete(game.id)
    this.labels.delete(game.id)
    const hook = this.hooks.get(game.id)
    this.hooks.delete(game.id)
    for (const side of ['w', 'b'] as const) {
      const id = game.players[side]
      this.activeGame.delete(id)
      this.awayUntil.delete(id)
      const grace = this.graceTimers.get(id)
      if (grace !== undefined) this.clearTimer(grace)
      this.graceTimers.delete(id)
      const over: ServerMessage = { type: 'GAME_OVER', gameId: game.id, winner: result.winner, reason: result.reason, rating: { before: before[side], after: Math.max(100, before[side] + change[side]) } }
      if (this.conns.has(id)) this.send(id, over)
      else this.keepMissed(id, over)
    }
    this.log(`game ${game.id} over: ${result.winner ?? 'draw'} by ${result.reason}`)
    hook?.(result.winner ? game.players[result.winner] : null, result.reason === 'aborted')
  }

  /** Holds a result for a player who is away; results older than a day are dropped. */
  private keepMissed(userId: string, msg: ServerMessage): void {
    const now = this.now()
    for (const [id, m] of this.missedResults) if (now - m.at > MISSED_TTL_MS) this.missedResults.delete(id)
    this.missedResults.set(userId, { msg, at: now })
  }

  /** Live counts (for /api/health). */
  stats(): { online: number; games: number; queued: number; modes: { cards: number; royale: number } } {
    let queued = this.modes.waiting()
    for (const p of [...RANKED_POOLS, ...VANISH_POOLS]) queued += this.matchmaker.waiting(p.id)
    return { online: this.conns.size, games: this.games.size, queued, modes: this.modes.stats() }
  }

  close(): void {
    this.closed = true
    if (this.pairTimer !== null) this.clearTimer(this.pairTimer)
    for (const t of this.gameTimers.values()) this.clearTimer(t)
    for (const t of this.graceTimers.values()) this.clearTimer(t)
    for (const t of this.restoreTimers.values()) this.clearTimer(t)
    this.modes.close()
  }
}
