// One player's side of an online room: hosting or joining, the seat handshake,
// heartbeats, reconnects, rematches — wrapped around the pure match rules.
// Framework-free and driven by tick(now), so whole two-player games (drops
// and all) can be tested deterministically over memoryNetwork().
import type { Color, MoveInput } from '../types/chess'
import { type MatchState, abandon, answerDraw, applySync, askRematch, checkFlags, localMove, offerDraw, rematchParams, remote, resign, startMatch, syncMessage } from './match'
import type { Channel, Endpoint, NetError, Network } from './network'
import { type ColorChoice, type OnlineMessage, PROTOCOL_VERSION, ROOM_KEY, type Seat, type StartParams, type TimeControl, newRoomCode, randomId } from './protocol'

export type Phase = 'idle' | 'opening' | 'waiting' | 'joining' | 'playing' | 'error'
export type LinkState = 'connected' | 'reconnecting' | 'offline'

export interface SessionView {
  phase: Phase
  role: Seat | null
  code: string | null
  link: LinkState
  opponent: { name: string; elo: number } | null
  match: MatchState | null
  error: string | null
}

export type SessionEvent =
  | { kind: 'move'; uci: string; byMe: boolean; match: MatchState }
  | { kind: 'result'; match: MatchState }
  | { kind: 'opponent-joined' }
  | { kind: 'draw-offered' }

export interface SessionDeps {
  network: Network
  now: () => number
  random?: () => number
  /** Where a guest keeps its seat token (survives a reload). */
  storage?: { get: (key: string) => string | null; set: (key: string, value: string) => void }
  me: () => { name: string; elo: number }
}

/** Heartbeat: ping every few seconds; a link silent for longer than this is dead. */
export const PING_MS = 4000
export const SILENCE_MS = 12_000
/** How long a dropped player has to come back before the game is lost. */
export const RECONNECT_MS = 90_000
const RETRY_MS = 3000

const ERRORS: Record<NetError, string> = {
  'code-taken': 'That room code is already in use.',
  'no-room': 'No room with that code. Check it, or ask your friend for a new one.',
  network: "Can't reach the online service. Check your connection and try again.",
  unsupported: "This browser can't play online (WebRTC is unavailable).",
}

export class OnlineSession {
  private view: SessionView = { phase: 'idle', role: null, code: null, link: 'offline', opponent: null, match: null, error: null }
  private readonly listeners = new Set<(v: SessionView) => void>()
  private readonly events = new Set<(e: SessionEvent) => void>()
  private endpoint: Endpoint | null = null
  private channel: Channel | null = null
  private lastHeard = 0
  private lastPing = 0
  /** When the link dropped (for reconnect deadlines and retries). */
  private droppedAt: number | null = null
  private nextRetry = 0
  private hostPrefs: { tc: TimeControl; color: ColorChoice } | null = null
  /** Host: the seat token handed to the guest; guest: the one it holds. */
  private seatToken: string | null = null
  private codeAttempts = 0
  private everConnected = false

  private readonly deps: SessionDeps

  constructor(deps: SessionDeps) {
    this.deps = deps
  }

  get state(): SessionView {
    return this.view
  }

  subscribe(fn: (v: SessionView) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  onEvent(fn: (e: SessionEvent) => void): () => void {
    this.events.add(fn)
    return () => this.events.delete(fn)
  }

  private set(patch: Partial<SessionView>): void {
    this.view = { ...this.view, ...patch }
    for (const fn of this.listeners) fn(this.view)
  }

  private emit(e: SessionEvent): void {
    for (const fn of this.events) fn(e)
  }

  private random(): number {
    return (this.deps.random ?? Math.random)()
  }

  private send(msg: OnlineMessage): void {
    this.channel?.send(msg)
  }

  // ── Hosting ───────────────────────────────────────────────────────────────

  /** Opens a room; the code appears once it is reachable. */
  host(tc: TimeControl, color: ColorChoice): void {
    this.leave()
    this.hostPrefs = { tc, color }
    this.codeAttempts = 0
    this.openRoom()
  }

  private openRoom(): void {
    const code = newRoomCode(() => this.random())
    this.codeAttempts += 1
    this.set({ phase: 'opening', role: 'host', code, error: null, opponent: null, match: null, link: 'offline' })
    this.endpoint = this.deps.network.host(code, {
      onReady: () => {
        if (this.view.code === code && this.view.phase === 'opening') this.set({ phase: 'waiting' })
      },
      onChannel: () => {},
      onMessage: (ch, msg) => this.hostMessage(ch, msg),
      onClose: (ch) => this.linkClosed(ch),
      onError: (err) => {
        // A clash of random codes: just roll another.
        if (err === 'code-taken' && this.codeAttempts < 4) {
          this.endpoint?.destroy()
          this.openRoom()
          return
        }
        // Moves travel directly between the players, so a broker hiccup mid-game doesn't matter.
        if (this.view.match && err === 'network') return
        this.fail(err)
      },
    })
  }

  private hostMessage(ch: Channel, msg: OnlineMessage): void {
    if (msg.t === 'hello') {
      // The seat is either free, or kept for whoever holds its token (a dropped guest coming back).
      const returning = msg.token !== null && msg.token === this.seatToken
      const free = this.seatToken === null && this.channel === null
      if (msg.v !== PROTOCOL_VERSION || !(returning || free)) {
        ch.send({ t: 'full' })
        // Give "full" a moment to arrive before hanging up.
        setTimeout(() => ch.close(), 400)
        return
      }
      if (this.channel && this.channel !== ch) this.channel.close()
      this.channel = ch
      this.seatToken ??= randomId(() => this.random())
      this.heard()
      this.droppedAt = null
      this.everConnected = true
      const me = this.deps.me()
      ch.send({ t: 'welcome', name: me.name, elo: me.elo, token: this.seatToken })
      this.set({ opponent: { name: msg.name, elo: msg.elo }, link: 'connected' })
      if (this.view.match) ch.send(syncMessage(this.view.match, this.deps.now()))
      else {
        this.emit({ kind: 'opponent-joined' })
        this.startGame()
      }
      return
    }
    if (ch !== this.channel) return
    this.heard()
    if (msg.t === 'sync-request') {
      if (this.view.match) ch.send(syncMessage(this.view.match, this.deps.now()))
      return
    }
    this.gameMessage(msg)
  }

  private startGame(): void {
    const prefs = this.hostPrefs
    if (!prefs) return
    const hostColor: Color = prefs.color === 'random' ? (this.random() < 0.5 ? 'w' : 'b') : prefs.color
    const game: StartParams = { gameId: randomId(() => this.random()), white: hostColor === 'w' ? 'host' : 'guest', tc: prefs.tc }
    this.send({ t: 'start', game })
    this.set({ phase: 'playing', match: startMatch(game, 'host') })
  }

  // ── Joining ───────────────────────────────────────────────────────────────

  join(code: string): void {
    this.leave()
    this.seatToken = this.deps.storage?.get(tokenKey(code)) ?? null
    this.deps.storage?.set(ROOM_KEY, code)
    this.everConnected = false
    this.set({ phase: 'joining', role: 'guest', code, error: null, opponent: null, match: null, link: 'offline' })
    this.connectGuest()
  }

  private connectGuest(): void {
    const code = this.view.code
    if (!code) return
    this.endpoint?.destroy()
    this.endpoint = this.deps.network.join(code, {
      onOpen: (ch) => {
        this.channel = ch
        this.heard()
        const me = this.deps.me()
        ch.send({ t: 'hello', v: PROTOCOL_VERSION, name: me.name, elo: me.elo, token: this.seatToken })
      },
      onMessage: (ch, msg) => {
        if (ch !== this.channel) return
        this.heard()
        this.guestMessage(msg)
      },
      onClose: (ch) => this.linkClosed(ch),
      onError: (err) => {
        // While a game is on, a missing host may just be reloading: keep retrying.
        if (this.everConnected && this.view.match && (err === 'no-room' || err === 'network')) return
        this.fail(err)
      },
    })
  }

  private guestMessage(msg: OnlineMessage): void {
    switch (msg.t) {
      case 'welcome':
        this.seatToken = msg.token
        if (this.view.code) this.deps.storage?.set(tokenKey(this.view.code), msg.token)
        this.everConnected = true
        this.droppedAt = null
        this.set({ opponent: { name: msg.name, elo: msg.elo }, link: 'connected' })
        return
      case 'full':
        this.fail(null, 'This room already has two players.')
        return
      case 'start':
        this.set({ phase: 'playing', match: startMatch(msg.game, 'guest') })
        return
      case 'sync': {
        const match = applySync('guest', msg, this.deps.now())
        if (match) this.set({ phase: 'playing', match })
        return
      }
      default:
        this.gameMessage(msg)
    }
  }

  // ── The game ──────────────────────────────────────────────────────────────

  private gameMessage(msg: OnlineMessage): void {
    if (msg.t === 'ping') {
      this.send({ t: 'pong', at: msg.at })
      return
    }
    if (msg.t === 'pong') return
    const match = this.view.match
    if (!match) return
    const out = remote(match, msg, this.deps.now())
    if (!out) return
    if ('desync' in out) {
      // The host's board is the reference: the guest asks for it, the host re-sends it.
      if (this.view.role === 'guest') this.send({ t: 'sync-request', gameId: match.game.gameId })
      else this.send(syncMessage(match, this.deps.now()))
      return
    }
    this.update(match, out.state, msg.t === 'move' ? msg.uci : null, false)
    if (out.state.rematch.me && out.state.rematch.them) this.beginRematch()
  }

  private update(before: MatchState, after: MatchState, uci: string | null, byMe: boolean): void {
    this.set({ match: after })
    if (uci) this.emit({ kind: 'move', uci, byMe, match: after })
    if (!before.result && after.result) this.emit({ kind: 'result', match: after })
    if (!before.drawOffer && after.drawOffer && after.drawOffer.from !== after.myColor) this.emit({ kind: 'draw-offered' })
  }

  private act(fn: (m: MatchState) => { state: MatchState; send: OnlineMessage } | null, uci: string | null = null): boolean {
    const match = this.view.match
    if (!match) return false
    const out = fn(match)
    if (!out) return false
    this.send(out.send)
    this.update(match, out.state, uci, true)
    return true
  }

  move(input: MoveInput): boolean {
    return this.act((m) => localMove(m, input, this.deps.now()), `${input.from}${input.to}${input.promotion ?? ''}`)
  }

  resign(): void {
    this.act(resign)
  }

  offerDraw(): void {
    this.act(offerDraw)
  }

  answerDraw(accept: boolean): void {
    this.act((m) => answerDraw(m, accept))
  }

  rematch(): void {
    if (this.act(askRematch) && this.view.match?.rematch.them) this.beginRematch()
  }

  private beginRematch(): void {
    // The host deals the next game; the guest waits for its "start".
    const match = this.view.match
    if (this.view.role !== 'host' || !match) return
    const game = rematchParams(match, randomId(() => this.random()))
    this.send({ t: 'start', game })
    this.set({ match: startMatch(game, 'host') })
  }

  // ── Link health ───────────────────────────────────────────────────────────

  private heard(): void {
    this.lastHeard = this.deps.now()
  }

  private linkClosed(ch: Channel): void {
    if (ch !== this.channel) return
    this.channel = null
    if (this.view.phase === 'idle' || this.view.phase === 'error') return
    if (!this.everConnected) {
      if (this.view.role === 'guest') this.fail(null, 'The connection closed before the game started.')
      return
    }
    this.droppedAt = this.deps.now()
    this.nextRetry = this.droppedAt + RETRY_MS
    this.set({ link: 'reconnecting' })
  }

  /** Call regularly (a few times a second): clocks, heartbeats and reconnects. */
  tick(now: number = this.deps.now()): void {
    const match = this.view.match
    if (match) {
      const flag = checkFlags(match, now)
      if (flag) {
        this.send(flag.send)
        this.update(match, flag.state, null, false)
      }
    }
    if (this.channel) {
      if (now - this.lastPing >= PING_MS) {
        this.lastPing = now
        this.send({ t: 'ping', at: now })
      }
      // A silent link is a dead one, even if the browser hasn't noticed yet.
      if (now - this.lastHeard > SILENCE_MS) this.channel.close()
      return
    }
    if (this.droppedAt === null) return
    if (now - this.droppedAt > RECONNECT_MS) {
      this.droppedAt = null
      const m = this.view.match
      this.set({ link: 'offline', ...(m ? { match: abandon(m) } : {}) })
      if (m && !m.result) this.emit({ kind: 'result', match: abandon(m) })
      return
    }
    if (this.view.role === 'guest' && now >= this.nextRetry) {
      this.nextRetry = now + RETRY_MS
      this.connectGuest()
    }
  }

  private fail(err: NetError | null, text?: string): void {
    this.endpoint?.destroy()
    this.endpoint = null
    this.channel = null
    this.set({ phase: 'error', error: text ?? (err ? ERRORS[err] : 'Something went wrong.'), link: 'offline' })
  }

  /** Leaves the room (the opponent sees the link drop). */
  leave(): void {
    if (this.view.role === 'guest') this.deps.storage?.set(ROOM_KEY, '')
    this.channel?.close()
    this.channel = null
    this.endpoint?.destroy()
    this.endpoint = null
    this.droppedAt = null
    this.seatToken = null
    this.everConnected = false
    this.set({ phase: 'idle', role: null, code: null, link: 'offline', opponent: null, match: null, error: null })
  }
}

const tokenKey = (code: string): string => `chronos-online-seat-${code}`

