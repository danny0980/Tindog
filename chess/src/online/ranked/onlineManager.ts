// The browser's connection to the game server for ranked play: matchmaking,
// live moves and clocks, draws, resignations and reconnects. The server is
// the referee; this keeps a local copy of the game for instant feedback
// (your move shows at once and is corrected if the server disagrees).
// Framework-free; the socket is injected so tests can drive it.
import { Chess } from 'chess.js'
import type { Color, MoveInput, Square } from '../../types/chess'
import { type ClientMessage, type GameSnapshot, type PublicPlayer, type RankedReason, type ServerMessage, parseServerMessage } from './protocol'

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
}

export interface RankedView {
  phase: RankedPhase
  me: PublicPlayer | null
  searching: { pool: string; since: number; queued: number } | null
  game: RankedGame | null
  error: string | null
}

export type RankedEvent = { kind: 'move'; byMe: boolean; game: RankedGame } | { kind: 'found'; game: RankedGame } | { kind: 'over'; game: RankedGame } | { kind: 'draw-offered' }

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
export function clocksNow(game: RankedGame, now: number): { w: number; b: number } {
  if (!game.running || game.result) return game.clocks
  return { ...game.clocks, [game.running]: Math.max(0, game.clocks[game.running] - (now - game.clocksAt)) }
}

export class RankedManager {
  private view: RankedView = { phase: 'offline', me: null, searching: null, game: null, error: null }
  private readonly listeners = new Set<() => void>()
  private readonly events = new Set<(e: RankedEvent) => void>()
  private readonly deps: Required<ManagerDeps>
  private socket: SocketLike | null = null
  /** We want to be connected (so drops reconnect). */
  private wanted = false
  private retries = 0
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
    if (this.retryTimer !== null) this.deps.clearTimer(this.retryTimer)
    this.retryTimer = null
    const s = this.socket
    this.socket = null
    s?.close()
    this.set({ phase: 'offline', searching: null })
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  findMatch(pool: string): void {
    this.wantPool = pool
    this.set({ searching: { pool, since: this.deps.now(), queued: 0 }, phase: 'searching', error: null, ...(this.view.game?.result ? { game: null } : {}) })
    if (!this.send({ type: 'FIND_MATCH', pool })) this.connect()
  }

  cancelSearch(): void {
    this.wantPool = null
    this.send({ type: 'CANCEL_MATCH' })
    this.set({ searching: null, phase: this.socket ? 'idle' : 'offline' })
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

  /** Closes a finished game's screen. */
  dismissGame(): void {
    if (this.view.game?.result) this.set({ game: null, phase: this.socket ? 'idle' : 'offline' })
  }

  // ── From the server ───────────────────────────────────────────────────────

  private fromSnapshot(s: GameSnapshot): RankedGame | null {
    const r = replay(s.moves)
    if (!r) return null
    return { gameId: s.gameId, color: s.color, opponent: s.opponent, pool: s.pool, moves: s.moves, fen: r.fen, lastMove: r.last, clocks: s.clocks, clocksAt: this.deps.now(), running: s.running, drawOffer: s.drawOffer, opponentAwayUntil: null, result: null }
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
      case 'HELLO':
        this.retries = 0
        this.set({ me: { name: msg.user.name, rating: msg.user.rating }, phase: g && !g.result ? 'playing' : this.wantPool ? 'searching' : 'idle', error: null })
        // We were queueing when the connection dropped: queue again.
        if (this.wantPool && !(g && !g.result)) this.send({ type: 'FIND_MATCH', pool: this.wantPool })
        return
      case 'SEARCHING':
        this.set({ searching: { pool: msg.pool, since: this.view.searching?.since ?? this.deps.now(), queued: msg.queued }, phase: 'searching' })
        return
      case 'MATCH_FOUND': {
        const game = this.fromSnapshot(msg.game)
        if (!game) return this.resync()
        const fresh = !g || g.gameId !== game.gameId
        this.wantPool = null
        this.set({ game, phase: 'playing', searching: null, error: null })
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
      case 'OPPONENT_DISCONNECTED':
        if (g && g.gameId === msg.gameId) this.set({ game: { ...g, opponentAwayUntil: this.deps.now() + msg.graceMs } })
        return
      case 'OPPONENT_RECONNECTED':
        if (g && g.gameId === msg.gameId) this.set({ game: { ...g, opponentAwayUntil: null } })
        return
      case 'GAME_OVER': {
        if (!g || g.gameId !== msg.gameId) return
        const game: RankedGame = { ...g, clocks: clocksNow(g, this.deps.now()), running: null, drawOffer: null, opponentAwayUntil: null, result: { winner: msg.winner, reason: msg.reason, rating: msg.rating } }
        this.set({ game, phase: 'over', me: this.view.me ? { ...this.view.me, rating: msg.rating.after } : null })
        this.emit({ kind: 'over', game })
        return
      }
      case 'ERROR':
        this.set({ error: msg.message, ...(msg.code === 'in-game' ? {} : this.view.phase === 'searching' ? { searching: null, phase: 'idle' } : {}) })
        return
      case 'PONG':
        return
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
