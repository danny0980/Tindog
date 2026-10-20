// The browser's connection to the game server for ranked play: matchmaking,
// live moves and clocks, draws, resignations and reconnects. The server is
// the referee; this keeps a local copy of the game for instant feedback
// (your move shows at once and is corrected if the server disagrees).
// Framework-free; the socket is injected so tests can drive it.
import { Chess } from 'chess.js'
import type { CardGame, CardId } from '../../cards/cardGame'
import type { RoyaleGame } from '../../royale/royale'
import type { Color, MoveInput, Square } from '../../types/chess'
import type { CardAction, CardSnapshot, ModeOver, OnlineMode, RoyaleAction, RoyaleSeat, RoyaleSnapshot } from './modeProtocol'
import { applyCardAction, applyRoyaleAction, endsTurn, replayCards, replayRoyale, seatPlayer } from './modeRules'
import { type ActiveGame, type ClientMessage, type GameSnapshot, type PublicPlayer, type RankedReason, type ServerMessage, type SpectateSnapshot, parseServerMessage } from './protocol'

/** The parts of the browser WebSocket API we use (the `ws` package matches it too). */
export interface SocketLike {
  readonly readyState: number
  onopen: ((ev: Event) => void) | null
  onmessage: ((ev: MessageEvent) => void) | null
  onclose: ((ev: CloseEvent) => void) | null
  onerror: ((ev: Event) => void) | null
  send: (data: string) => void
  close: () => void
}

export type RankedPhase = 'offline' | 'connecting' | 'idle' | 'searching' | 'playing' | 'over'

export interface RankedGame {
  gameId: string
  color: Color
  opponent: PublicPlayer
  pool: string
  moves: string[]
  fen: string
  lastMove: { from: Square; to: Square } | null
  /** Remaining ms per side as of `clocksAt` (local time). */
  clocks: { w: number; b: number }
  clocksAt: number
  running: Color | null
  drawOffer: Color | null
  /** Set while the opponent is disconnected: when their grace period ends (local time). */
  opponentAwayUntil: number | null
  result: { winner: Color | null; reason: RankedReason; rating: { before: number; after: number } } | null
  /** Tournament round, if it is one. */
  label: string | null
}

/** A game you are watching. */
export interface WatchGame {
  gameId: string
  white: PublicPlayer
  black: PublicPlayer
  pool: string
  moves: string[]
  fen: string
  lastMove: { from: Square; to: Square } | null
  clocks: { w: number; b: number }
  clocksAt: number
  running: Color | null
  label: string | null
  result: { winner: Color | null; reason: RankedReason } | null
}

/** An online Card Chess game. */
export interface CardsOnline {
  gameId: string
  color: Color
  opponent: PublicPlayer
  phase: 'draft' | 'play'
  offer: CardId[]
  hands: { w: CardId[] | null; b: CardId[] | null }
  /** When the draft closes (local time). */
  draftEndsAt: number | null
  actions: CardAction[]
  /** The position (rebuilt from the log; a fresh object on every change). */
  game: CardGame | null
  clocks: { w: number; b: number }
  clocksAt: number
  running: Color | null
  opponentAwayUntil: number | null
  result: ModeOver | null
}

/** An online Battle Royale. */
export interface RoyaleOnline {
  gameId: string
  seat: number
  seats: RoyaleSeat[]
  actions: RoyaleAction[]
  game: RoyaleGame
  /** When the player to move runs out of time (local time). */
  turnEndsAt: number | null
  rated: boolean
  result: ModeOver | null
}

export interface RankedView {
  phase: RankedPhase
  me: PublicPlayer | null
  searching: { pool: string; since: number; queued: number } | null
  game: RankedGame | null
  /** The game you are watching (null = none; 'loading' while it is being fetched). */
  watch: WatchGame | 'loading' | null
  /** Waiting for a Card Chess or Battle Royale game. */
  modeSearch: { mode: OnlineMode; since: number; queued: number } | null
  cards: CardsOnline | null
  royale: RoyaleOnline | null
  error: string | null
}

export type RankedEvent =
  | { kind: 'move'; byMe: boolean; game: RankedGame }
  | { kind: 'found'; game: RankedGame }
  | { kind: 'over'; game: RankedGame }
  | { kind: 'draw-offered' }
  | { kind: 'tournament' }
  | { kind: 'mode-found'; mode: OnlineMode }
  | { kind: 'mode-move'; mode: OnlineMode; byMe: boolean; capture: boolean }
  | { kind: 'mode-over'; result: ModeOver; won: boolean }
  /** A result for a game this screen no longer shows (it ended while we were away). */
  | { kind: 'missed-result'; text: string }
  /** The socket keeps failing before it opens: the sign-in may have expired. */
  | { kind: 'auth-check' }

export interface ManagerDeps {
  /** Opens the socket to /ws (cookies go along on their own in a browser). */
  open: () => SocketLike
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (h: unknown) => void
  /** First reconnect delay (doubles each try, up to 15 s). */
  retryBaseMs?: number
}

const OPEN = 1
/** Said when a game is closed because the server no longer has it. */
export const STALE_GAME = 'This game was cancelled: the server restarted and couldn’t resume it (unrated).'
/** Failed connection attempts in a row before asking whether the sign-in is still valid. */
const AUTH_CHECK_AFTER = 2
const turnOf = (moves: readonly string[]): Color => (moves.length % 2 === 0 ? 'w' : 'b')

function replay(moves: readonly string[]): { fen: string; last: { from: Square; to: Square } | null } | null {
  const chess = new Chess()
  let last: { from: Square; to: Square } | null = null
  for (const uci of moves) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci[4] } : {}) })
      last = { from: m.from, to: m.to }
    } catch {
      return null
    }
  }
  return { fen: chess.fen(), last }
}

/** Live clock values at local time `now`. */
export function clocksNow(game: { running: Color | null; result: unknown; clocks: { w: number; b: number }; clocksAt: number }, now: number): { w: number; b: number } {
  if (!game.running || game.result) return game.clocks
  return { ...game.clocks, [game.running]: Math.max(0, game.clocks[game.running] - (now - game.clocksAt)) }
}

export class RankedManager {
  private view: RankedView = { phase: 'offline', me: null, searching: null, game: null, watch: null, modeSearch: null, cards: null, royale: null, error: null }
  /** The mode we are queueing for (re-sent after a reconnect). */
  private wantMode: OnlineMode | null = null
  /** The game to watch once connected. */
  private wantWatch: string | null = null
  private readonly listeners = new Set<() => void>()
  private readonly events = new Set<(e: RankedEvent) => void>()
  private readonly deps: Required<ManagerDeps>
  private socket: SocketLike | null = null
  /** We want to be connected (so drops reconnect). */
  private wanted = false
  private retries = 0
  /** Connections in a row that closed before the server said HELLO (a refused sign-in looks like this). */
  private failedOpens = 0
  private retryTimer: unknown = null
  /** The pool we are queueing for (re-sent after a reconnect). */
  private wantPool: string | null = null

  constructor(deps: ManagerDeps) {
    this.deps = {
      now: Date.now,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      retryBaseMs: 1000,
      ...deps,
    }
  }

  get state(): RankedView {
    return this.view
  }
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  onEvent(fn: (e: RankedEvent) => void): () => void {
    this.events.add(fn)
    return () => this.events.delete(fn)
  }
  private set(patch: Partial<RankedView>): void {
    this.view = { ...this.view, ...patch }
    for (const fn of this.listeners) fn()
  }
  private emit(e: RankedEvent): void {
    for (const fn of this.events) fn(e)
  }
  private send(msg: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== OPEN) return false
    this.socket.send(JSON.stringify(msg))
    return true
  }

  // ── Connection ────────────────────────────────────────────────────────────

  connect(): void {
    this.wanted = true
    if (this.socket) return
    this.set({ phase: this.view.game && !this.view.game.result ? this.view.phase : 'connecting', error: null })
    const s = this.deps.open()
    this.socket = s
    s.onmessage = (ev) => {
      const msg = parseServerMessage(typeof ev.data === 'string' ? ev.data : String(ev.data))
      if (msg) this.receive(msg)
    }
    s.onclose = () => {
      if (this.socket !== s) return
      this.socket = null
      if (!this.wanted) {
        this.set({ phase: 'offline', searching: null })
        return
      }
      // Refused before HELLO, again and again: the app checks whether the sign-in has expired (it signs out if so).
      if (this.view.phase === 'connecting' || this.retries > 0) {
        this.failedOpens += 1
        if (this.failedOpens === AUTH_CHECK_AFTER) this.emit({ kind: 'auth-check' })
      }
      // Dropped: try again with backoff (1 s, 2 s, 4 s … up to 15 s).
      const delay = Math.min(15_000, this.deps.retryBaseMs * 2 ** this.retries)
      this.retries += 1
      this.set({ phase: this.view.game && !this.view.game.result ? 'playing' : 'connecting', error: 'Connection lost — reconnecting…' })
      this.retryTimer = this.deps.setTimer(() => {
        this.retryTimer = null
        if (this.wanted) this.connect()
      }, delay)
    }
    s.onerror = () => {}
  }

  /** Leaves (stops reconnecting). A game in progress keeps running on the server for its grace period. */
  disconnect(): void {
    this.wanted = false
    this.wantPool = null
    this.wantMode = null
    if (this.retryTimer !== null) this.deps.clearTimer(this.retryTimer)
    this.retryTimer = null
    const s = this.socket
    this.socket = null
    s?.close()
    this.set({ phase: 'offline', searching: null, modeSearch: null })
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  findMatch(pool: string): void {
    this.wantPool = pool
    this.set({ searching: { pool, since: this.deps.now(), queued: 0 }, phase: 'searching', error: null, ...(this.view.game?.result ? { game: null } : {}) })
    if (!this.send({ type: 'FIND_MATCH', pool })) this.connect()
  }

  cancelSearch(): void {
    this.wantPool = null
    this.wantMode = null
    this.send({ type: 'CANCEL_MATCH' })
    this.set({ searching: null, modeSearch: null, phase: this.socket ? 'idle' : 'offline' })
  }

  // ── Card Chess & Battle Royale ────────────────────────────────────────────

  /** Queues for an online mode (opens the connection if needed). */
  findMode(mode: OnlineMode): void {
    this.wantMode = mode
    this.wantPool = null
    this.set({ modeSearch: { mode, since: this.deps.now(), queued: 0 }, searching: null, error: null, ...(this.view.cards?.result ? { cards: null } : {}), ...(this.view.royale?.result ? { royale: null } : {}) })
    if (!this.send({ type: 'FIND_MODE', mode })) this.connect()
  }

  /** Your three cards. */
  draftCards(cards: CardId[]): boolean {
    const c = this.view.cards
    if (!c || c.phase !== 'draft' || c.hands[c.color] || c.result) return false
    // Shown first, then sent: the server's answer (which may come at once) always lands on top.
    this.set({ cards: { ...c, hands: { ...c.hands, [c.color]: cards } } })
    if (this.send({ type: 'CARD_DRAFT', gameId: c.gameId, cards })) return true
    this.set({ cards: c })
    return false
  }

  /** Plays a Card Chess action: shown at once, confirmed (or corrected) by the server. */
  cardAction(action: CardAction): boolean {
    const c = this.view.cards
    if (!c || !c.game || c.result || c.game.turn !== c.color) return false
    const next = c.game.clone()
    if (!applyCardAction(next, action)) return false
    const now = this.deps.now()
    const turnOver = endsTurn(action)
    this.set({ cards: { ...c, actions: [...c.actions, action], game: next, ...(turnOver ? { clocks: clocksNow(c, now), clocksAt: now, running: next.result ? null : c.color === 'w' ? 'b' : 'w' } : {}) } })
    if (!this.send({ type: 'CARD_ACTION', gameId: c.gameId, ply: c.actions.length, action })) {
      this.set({ cards: c })
      return false
    }
    this.emit({ kind: 'mode-move', mode: 'cards', byMe: true, capture: false })
    return true
  }

  /** Plays your Battle Royale move. */
  royaleMove(from: [number, number], to: [number, number]): boolean {
    const r = this.view.royale
    if (!r || r.result || r.game.result || r.game.turn !== seatPlayer(r.seat)) return false
    const action: RoyaleAction = { k: 'm', from, to }
    const capture = r.game.at(to) !== null
    const next = r.game.clone()
    if (!applyRoyaleAction(next, action)) return false
    this.set({ royale: { ...r, actions: [...r.actions, action], game: next, turnEndsAt: null } })
    if (!this.send({ type: 'ROYALE_MOVE', gameId: r.gameId, ply: r.actions.length, from, to })) {
      this.set({ royale: r })
      return false
    }
    this.emit({ kind: 'mode-move', mode: 'royale', byMe: true, capture })
    return true
  }

  /** Resigns the Card Chess game, or leaves the Battle Royale (your army turns to rubble). */
  resignMode(): void {
    const id = this.view.cards && !this.view.cards.result ? this.view.cards.gameId : this.view.royale && !this.view.royale.result ? this.view.royale.gameId : null
    if (id) this.send({ type: 'RESIGN', gameId: id })
  }

  /** Closes a finished mode game's screen. */
  dismissMode(): void {
    this.set({ ...(this.view.cards?.result ? { cards: null } : {}), ...(this.view.royale?.result ? { royale: null } : {}) })
  }

  /** Plays your move: shown at once, confirmed (or corrected) by the server. */
  move(input: MoveInput): boolean {
    const g = this.view.game
    if (!g || g.result || turnOf(g.moves) !== g.color) return false
    const uci = `${input.from}${input.to}${input.promotion ?? ''}`
    const next = replay([...g.moves, uci])
    if (!next) return false
    const now = this.deps.now()
    const clocks = clocksNow(g, now)
    if (!this.send({ type: 'MAKE_MOVE', gameId: g.gameId, ply: g.moves.length, uci })) return false
    const game: RankedGame = { ...g, moves: [...g.moves, uci], fen: next.fen, lastMove: next.last, clocks, clocksAt: now, running: g.color === 'w' ? 'b' : 'w', drawOffer: null }
    this.set({ game })
    this.emit({ kind: 'move', byMe: true, game })
    return true
  }

  resign(): void {
    const g = this.view.game
    if (g && !g.result) this.send({ type: 'RESIGN', gameId: g.gameId })
  }

  offerDraw(): void {
    const g = this.view.game
    if (!g || g.result || g.drawOffer || g.moves.length < 2) return
    if (this.send({ type: 'OFFER_DRAW', gameId: g.gameId })) this.set({ game: { ...g, drawOffer: g.color } })
  }

  answerDraw(accept: boolean): void {
    const g = this.view.game
    if (!g || g.result || !g.drawOffer || g.drawOffer === g.color) return
    if (this.send({ type: 'ANSWER_DRAW', gameId: g.gameId, accept })) this.set({ game: { ...g, drawOffer: null } })
  }

  /** Watches a live game (opens the connection if needed). */
  watch(gameId: string): void {
    this.wantWatch = gameId
    this.set({ watch: 'loading', error: null })
    if (!this.send({ type: 'SPECTATE', gameId })) this.connect()
  }

  stopWatching(): void {
    this.wantWatch = null
    this.send({ type: 'UNSPECTATE' })
    this.set({ watch: null })
  }

  /** Closes a finished game's screen. */
  private fromCards(s: CardSnapshot, prev: CardsOnline | null): CardsOnline | null {
    const now = this.deps.now()
    const hands = s.hands.w && s.hands.b ? { w: s.hands.w, b: s.hands.b } : null
    const game = s.phase === 'play' && hands ? replayCards(hands, s.actions) : null
    if (s.phase === 'play' && !game) return null
    return {
      gameId: s.gameId,
      color: s.color,
      opponent: s.opponent,
      phase: s.phase,
      offer: s.offer,
      hands: s.hands,
      draftEndsAt: s.draftMs === null ? null : now + s.draftMs,
      actions: s.actions,
      game,
      clocks: s.clocks,
      clocksAt: now,
      running: s.running,
      opponentAwayUntil: prev?.gameId === s.gameId ? prev.opponentAwayUntil : null,
      result: null,
    }
  }

  private fromRoyale(s: RoyaleSnapshot): RoyaleOnline | null {
    const game = replayRoyale(s.actions)
    if (!game) return null
    return { gameId: s.gameId, seat: s.seat, seats: s.seats, actions: s.actions, game, turnEndsAt: s.turnMs === null ? null : this.deps.now() + s.turnMs, rated: s.rated, result: null }
  }

  /**
   * Closes any unfinished game the server no longer has (it restarted and
   * couldn't resume it). Shown as aborted, with a note why.
   */
  private dropStale(active: ActiveGame | null): void {
    const has = (kind: ActiveGame['kind'], id: string) => active?.kind === kind && active.gameId === id
    const g = this.view.game
    if (g && !g.result && !has('chess', g.gameId)) {
      const r = this.view.me?.rating ?? 0
      this.set({ game: { ...g, running: null, drawOffer: null, opponentAwayUntil: null, result: { winner: null, reason: 'aborted', rating: { before: r, after: r } } }, phase: 'over', error: STALE_GAME })
    }
    const c = this.view.cards
    if (c && !c.result && !has('cards', c.gameId)) this.set({ cards: { ...c, running: null, opponentAwayUntil: null, result: { gameId: c.gameId, mode: 'cards', winner: null, ranking: [], reason: 'aborted', rating: null } }, error: STALE_GAME })
    const ry = this.view.royale
    if (ry && !ry.result && !has('royale', ry.gameId)) this.set({ royale: { ...ry, turnEndsAt: null, result: { gameId: ry.gameId, mode: 'royale', winner: null, ranking: [], reason: 'aborted', rating: null } }, error: STALE_GAME })
  }

  dismissGame(): void {
    if (this.view.game?.result) this.set({ game: null, phase: this.socket ? 'idle' : 'offline' })
  }

  // ── From the server ───────────────────────────────────────────────────────

  private fromSnapshot(s: GameSnapshot): RankedGame | null {
    const r = replay(s.moves)
    if (!r) return null
    return { gameId: s.gameId, color: s.color, opponent: s.opponent, pool: s.pool, moves: s.moves, fen: r.fen, lastMove: r.last, clocks: s.clocks, clocksAt: this.deps.now(), running: s.running, drawOffer: s.drawOffer, opponentAwayUntil: null, result: null, label: s.label ?? null }
  }

  private fromSpectate(s: SpectateSnapshot): WatchGame | null {
    const r = replay(s.moves)
    if (!r) return null
    return { gameId: s.gameId, white: s.white, black: s.black, pool: s.pool, moves: s.moves, fen: r.fen, lastMove: r.last, clocks: s.clocks, clocksAt: this.deps.now(), running: s.running, label: s.label, result: null }
  }

  /** The two copies disagree: reconnecting makes the server send the true game. */
  private resync(): void {
    const s = this.socket
    this.socket = null
    s?.close()
    if (this.wanted) this.connect()
  }

  private receive(msg: ServerMessage): void {
    const g = this.view.game
    switch (msg.type) {
      case 'HELLO': {
        this.retries = 0
        this.failedOpens = 0
        // The server says which game we are in; one we still show that it no longer has is closed.
        if (msg.active !== undefined) this.dropStale(msg.active)
        const live = this.view.game
        this.set({ me: { name: msg.user.name, rating: msg.user.rating }, phase: live && !live.result ? 'playing' : live?.result ? 'over' : this.wantPool ? 'searching' : 'idle', ...(this.view.error === STALE_GAME ? {} : { error: null }) })
        // We were queueing when the connection dropped: queue again.
        if (this.wantPool && !(live && !live.result)) this.send({ type: 'FIND_MATCH', pool: this.wantPool })
        if (this.wantMode) this.send({ type: 'FIND_MODE', mode: this.wantMode })
        if (this.wantWatch) this.send({ type: 'SPECTATE', gameId: this.wantWatch })
        return
      }
      case 'SEARCHING':
        this.set({ searching: { pool: msg.pool, since: this.view.searching?.since ?? this.deps.now(), queued: msg.queued }, phase: 'searching' })
        return
      case 'MATCH_FOUND': {
        const game = this.fromSnapshot(msg.game)
        if (!game) return this.resync()
        const fresh = !g || g.gameId !== game.gameId
        this.wantPool = null
        this.wantMode = null
        this.set({ game, phase: 'playing', searching: null, modeSearch: null, error: null })
        if (fresh) this.emit({ kind: 'found', game })
        return
      }
      case 'MOVE_ACCEPTED':
        if (g && g.gameId === msg.gameId) this.set({ game: { ...g, clocks: msg.clocks, clocksAt: this.deps.now() } })
        return
      case 'MOVE_REJECTED': {
        // The server's game is the truth.
        const game = this.fromSnapshot(msg.game)
        if (game) this.set({ game: { ...game, result: g?.result ?? null }, error: msg.reason })
        return
      }
      case 'OPPONENT_MOVE': {
        if (!g || g.gameId !== msg.gameId) return
        if (msg.ply < g.moves.length) return
        if (msg.ply > g.moves.length) return this.resync()
        const next = replay([...g.moves, msg.uci])
        if (!next) return this.resync()
        const game: RankedGame = { ...g, moves: [...g.moves, msg.uci], fen: next.fen, lastMove: next.last, clocks: msg.clocks, clocksAt: this.deps.now(), running: g.color, drawOffer: null }
        this.set({ game, error: null })
        this.emit({ kind: 'move', byMe: false, game })
        return
      }
      case 'DRAW_OFFERED':
        if (g && g.gameId === msg.gameId) {
          this.set({ game: { ...g, drawOffer: msg.by } })
          if (msg.by !== g.color) this.emit({ kind: 'draw-offered' })
        }
        return
      case 'DRAW_DECLINED':
        if (g && g.gameId === msg.gameId) this.set({ game: { ...g, drawOffer: null } })
        return
      case 'OPPONENT_DISCONNECTED': {
        if (g && g.gameId === msg.gameId) this.set({ game: { ...g, opponentAwayUntil: this.deps.now() + msg.graceMs } })
        const c = this.view.cards
        if (c && c.gameId === msg.gameId) this.set({ cards: { ...c, opponentAwayUntil: this.deps.now() + msg.graceMs } })
        return
      }
      case 'OPPONENT_RECONNECTED': {
        if (g && g.gameId === msg.gameId) this.set({ game: { ...g, opponentAwayUntil: null } })
        const c = this.view.cards
        if (c && c.gameId === msg.gameId) this.set({ cards: { ...c, opponentAwayUntil: null } })
        return
      }
      case 'GAME_OVER': {
        if (!g || g.gameId !== msg.gameId) {
          // A game that ended while we were away (e.g. the page was reloaded): say how it went.
          const d = msg.rating.after - msg.rating.before
          this.emit({ kind: 'missed-result', text: msg.reason === 'aborted' ? 'A ranked game was aborted while you were away.' : `A ranked game ended while you were away: ${d > 0 ? 'you won' : d < 0 ? 'you lost' : 'no rating change'} (${msg.rating.before} → ${msg.rating.after}).` })
          return
        }
        const game: RankedGame = { ...g, clocks: clocksNow(g, this.deps.now()), running: null, drawOffer: null, opponentAwayUntil: null, result: { winner: msg.winner, reason: msg.reason, rating: msg.rating } }
        // Vanishing Chess changes its own rating, not the one shown as yours.
        const standard = !g.pool.startsWith('vanish-')
        this.set({ game, phase: 'over', me: this.view.me && standard ? { ...this.view.me, rating: msg.rating.after } : this.view.me })
        this.emit({ kind: 'over', game })
        return
      }
      case 'ERROR':
        if (msg.code === 'no-game' && this.view.watch === 'loading') {
          this.wantWatch = null
          this.set({ watch: null, error: msg.message })
          return
        }
        if (msg.code === 'refused' && (this.view.cards || this.view.royale)) {
          // A mode move the server refused: it sends the true game too, which replaces ours.
          this.set({ error: msg.message })
          return
        }
        if (this.view.modeSearch && msg.code !== 'in-game') this.wantMode = null
        this.set({ error: msg.message, ...(msg.code === 'in-game' ? {} : this.view.phase === 'searching' ? { searching: null, phase: 'idle' } : {}), ...(msg.code === 'in-game' ? {} : { modeSearch: null }) })
        return
      case 'PONG':
        return
      case 'SPECTATE_START': {
        if (this.wantWatch !== msg.game.gameId) return
        const watch = this.fromSpectate(msg.game)
        this.set({ watch: watch ?? null })
        return
      }
      case 'SPECTATE_MOVE': {
        const w = this.view.watch
        if (!w || w === 'loading' || w.gameId !== msg.gameId || msg.ply !== w.moves.length) return
        const next = replay([...w.moves, msg.uci])
        if (!next) return
        this.set({ watch: { ...w, moves: [...w.moves, msg.uci], fen: next.fen, lastMove: next.last, clocks: msg.clocks, clocksAt: this.deps.now(), running: w.moves.length % 2 === 0 ? 'b' : 'w' } })
        return
      }
      case 'SPECTATE_OVER': {
        const w = this.view.watch
        if (!w || w === 'loading' || w.gameId !== msg.gameId) return
        this.wantWatch = null
        this.set({ watch: { ...w, clocks: clocksNow(w, this.deps.now()), running: null, result: { winner: msg.winner, reason: msg.reason } } })
        return
      }
      case 'TOURNAMENT_CHANGED':
        this.emit({ kind: 'tournament' })
        return
      case 'MODE_SEARCHING':
        this.set({ modeSearch: { mode: msg.mode, since: this.view.modeSearch?.since ?? this.deps.now(), queued: msg.queued } })
        return
      case 'CARD_STATE': {
        const prev = this.view.cards
        const cards = this.fromCards(msg.game, prev)
        if (!cards) return this.resync()
        const fresh = !prev || prev.gameId !== cards.gameId
        this.wantMode = null
        this.set({ cards, modeSearch: null, error: null })
        if (fresh) this.emit({ kind: 'mode-found', mode: 'cards' })
        return
      }
      case 'CARD_PLAYED': {
        const c = this.view.cards
        if (!c || c.gameId !== msg.gameId || !c.game) return
        const now = this.deps.now()
        // Our own action coming back: only the clocks are news.
        if (msg.ply < c.actions.length) {
          this.set({ cards: { ...c, clocks: msg.clocks, clocksAt: now } })
          return
        }
        if (msg.ply > c.actions.length) return this.resync()
        const next = c.game.clone()
        const capture = msg.action.k === 'm' && new Chess(c.game.fen).get(msg.action.uci.slice(2, 4) as Square) !== undefined
        if (!applyCardAction(next, msg.action)) return this.resync()
        this.set({ cards: { ...c, actions: [...c.actions, msg.action], game: next, clocks: msg.clocks, clocksAt: now, running: next.result ? null : next.turn } })
        this.emit({ kind: 'mode-move', mode: 'cards', byMe: false, capture })
        return
      }
      case 'ROYALE_STATE': {
        const prev = this.view.royale
        const royale = this.fromRoyale(msg.game)
        if (!royale) return this.resync()
        this.wantMode = null
        this.set({ royale, modeSearch: null, error: null })
        if (!prev || prev.gameId !== royale.gameId) this.emit({ kind: 'mode-found', mode: 'royale' })
        return
      }
      case 'ROYALE_PLAYED': {
        const r = this.view.royale
        if (!r || r.gameId !== msg.gameId) return
        const turnEndsAt = msg.turnMs === null ? null : this.deps.now() + msg.turnMs
        if (msg.ply < r.actions.length) {
          this.set({ royale: { ...r, turnEndsAt } })
          return
        }
        if (msg.ply > r.actions.length) return this.resync()
        const capture = msg.action.k === 'm' && r.game.at(msg.action.to) !== null
        const next = r.game.clone()
        if (!applyRoyaleAction(next, msg.action)) return this.resync()
        this.set({ royale: { ...r, actions: [...r.actions, msg.action], game: next, turnEndsAt } })
        this.emit({ kind: 'mode-move', mode: 'royale', byMe: false, capture })
        return
      }
      case 'MODE_OVER': {
        const res = msg.result
        const c = this.view.cards
        const r = this.view.royale
        if (res.mode === 'cards' && c && c.gameId === res.gameId) {
          this.set({ cards: { ...c, clocks: clocksNow(c, this.deps.now()), running: null, opponentAwayUntil: null, result: res } })
          this.emit({ kind: 'mode-over', result: res, won: res.winner === c.color })
        } else if (res.mode === 'royale' && r && r.gameId === res.gameId) {
          // Leaving early: the final order arrives later, so keep what we know.
          this.set({ royale: { ...r, turnEndsAt: null, result: res.ranking.length === 0 && r.result ? r.result : res } })
          this.emit({ kind: 'mode-over', result: res, won: res.ranking[0] === r.seat })
        } else {
          const name = res.mode === 'cards' ? 'Card Chess' : 'Battle Royale'
          const d = res.rating ? res.rating.after - res.rating.before : 0
          this.emit({ kind: 'missed-result', text: res.rating ? `A ${name} game ended while you were away: ${d > 0 ? '+' : ''}${d} rating (${res.rating.before} → ${res.rating.after}).` : `A ${name} game ended while you were away.` })
        }
        return
      }
    }
  }
}

const REASONS: Record<RankedReason, string> = {
  checkmate: 'by checkmate',
  resign: 'by resignation',
  timeout: 'on time',
  agreement: 'by agreement',
  stalemate: 'by stalemate',
  threefold: 'by threefold repetition',
  insufficient: 'by insufficient material',
  'fifty-move': 'by the fifty-move rule',
  'timeout-insufficient': 'on time vs. insufficient material',
  abandon: '— your opponent left',
  aborted: '— game aborted (unrated)',
}

export function rankedResultText(game: RankedGame): string {
  const r = game.result
  if (!r) return ''
  if (r.reason === 'aborted') return 'Game aborted (unrated)'
  if (r.reason === 'abandon') return r.winner === game.color ? 'You won — your opponent left' : 'You lost — you left the game'
  if (r.winner === null) return `Draw ${REASONS[r.reason]}`
  return `${r.winner === game.color ? 'You won' : 'You lost'} ${REASONS[r.reason]}`
}
