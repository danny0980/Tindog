// The wire protocol for online games: two browsers talk directly over a
// WebRTC data channel. Everything that arrives from the other side is
// untrusted, so every message is parsed and validated here before the game
// sees it — anything malformed is dropped.

export const PROTOCOL_VERSION = 1

/** Room codes avoid look-alike characters (0/O, 1/I/L) so they are easy to read out. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6
/** Prefix for the PeerJS id of a room's host (namespaced to this game and protocol). */
export const PEER_PREFIX = `chronos-chess-v${PROTOCOL_VERSION}-`
/** sessionStorage key for the room a guest is in (so reloading the page rejoins it). */
export const ROOM_KEY = 'chronos-online-room'

export type Seat = 'host' | 'guest'

export interface TimeControl {
  /** Minutes per side; 0 = no clock. */
  minutes: number
  /** Seconds added after each move. */
  increment: number
}

export const TIME_CONTROLS: ReadonlyArray<{ id: string; label: string; tc: TimeControl }> = [
  { id: 'none', label: 'No clock', tc: { minutes: 0, increment: 0 } },
  { id: '3+2', label: '3 + 2', tc: { minutes: 3, increment: 2 } },
  { id: '5+0', label: '5 + 0', tc: { minutes: 5, increment: 0 } },
  { id: '10+0', label: '10 + 0', tc: { minutes: 10, increment: 0 } },
  { id: '15+10', label: '15 + 10', tc: { minutes: 15, increment: 10 } },
]

export type ColorChoice = 'w' | 'b' | 'random'

export interface StartParams {
  gameId: string
  /** Which seat plays white. */
  white: Seat
  tc: TimeControl
}

export type OnlineMessage =
  | { t: 'hello'; v: number; name: string; elo: number; token: string | null }
  | { t: 'welcome'; name: string; elo: number; token: string }
  | { t: 'full' }
  | { t: 'start'; game: StartParams }
  | { t: 'move'; gameId: string; ply: number; uci: string; clockMs: number }
  | { t: 'resign'; gameId: string }
  | { t: 'timeout'; gameId: string }
  | { t: 'draw-offer'; gameId: string; ply: number }
  | { t: 'draw-reply'; gameId: string; accept: boolean }
  | { t: 'rematch'; gameId: string }
  | { t: 'sync-request'; gameId: string }
  | { t: 'sync'; game: StartParams; moves: string[]; clocks: { w: number; b: number }; result: SyncResult | null }
  | { t: 'ping'; at: number }
  | { t: 'pong'; at: number }

/** A finished game as the host reports it during a resync. */
export interface SyncResult {
  winner: 'w' | 'b' | null
  reason: string
}

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/
const ID = /^[A-Za-z0-9-]{4,40}$/
const MAX_PLIES = 1200
const MAX_CLOCK_MS = 4 * 60 * 60 * 1000

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const int = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)
const id = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null)

/** A display name: trimmed, no control or direction-override characters, at most 20 characters ('' if nothing is left). */
export function trimName(v: unknown): string {
  if (typeof v !== 'string') return ''
  // oxlint-disable-next-line no-control-regex -- stripping control characters is the point
  return v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20)
}

/** A display name from the other side, never empty. */
export const cleanName = (v: unknown): string => trimName(v) || 'Opponent'

function parseTimeControl(v: unknown): TimeControl | null {
  if (!isRecord(v)) return null
  const minutes = int(v.minutes, 0, 180)
  const increment = int(v.increment, 0, 60)
  return minutes === null || increment === null ? null : { minutes, increment }
}

function parseStart(v: unknown): StartParams | null {
  if (!isRecord(v)) return null
  const gameId = id(v.gameId)
  const tc = parseTimeControl(v.tc)
  if (!gameId || !tc || (v.white !== 'host' && v.white !== 'guest')) return null
  return { gameId, white: v.white, tc }
}

/** Parses one message from the other browser; null if it is not a valid message. */
export function parseMessage(raw: unknown): OnlineMessage | null {
  let data: unknown = raw
  if (typeof raw === 'string') {
    if (raw.length > 64_000) return null
    try {
      data = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!isRecord(data)) return null
  switch (data.t) {
    case 'hello': {
      const v = int(data.v, 0, 1000)
      const elo = int(data.elo, 0, 4000)
      const token = data.token === null ? null : id(data.token)
      if (v === null || elo === null || (data.token !== null && token === null)) return null
      return { t: 'hello', v, name: cleanName(data.name), elo, token }
    }
    case 'welcome': {
      const elo = int(data.elo, 0, 4000)
      const token = id(data.token)
      return elo === null || !token ? null : { t: 'welcome', name: cleanName(data.name), elo, token }
    }
    case 'full':
      return { t: 'full' }
    case 'start': {
      const game = parseStart(data.game)
      return game ? { t: 'start', game } : null
    }
    case 'move': {
      const gameId = id(data.gameId)
      const ply = int(data.ply, 0, MAX_PLIES)
      const clockMs = int(data.clockMs, 0, MAX_CLOCK_MS)
      if (!gameId || ply === null || clockMs === null || typeof data.uci !== 'string' || !UCI.test(data.uci)) return null
      return { t: 'move', gameId, ply, uci: data.uci, clockMs }
    }
    case 'resign':
    case 'timeout':
    case 'rematch':
    case 'sync-request': {
      const gameId = id(data.gameId)
      return gameId ? { t: data.t, gameId } : null
    }
    case 'draw-offer': {
      const gameId = id(data.gameId)
      const ply = int(data.ply, 0, MAX_PLIES)
      return gameId && ply !== null ? { t: 'draw-offer', gameId, ply } : null
    }
    case 'draw-reply': {
      const gameId = id(data.gameId)
      return gameId && typeof data.accept === 'boolean' ? { t: 'draw-reply', gameId, accept: data.accept } : null
    }
    case 'sync': {
      const game = parseStart(data.game)
      if (!game || !Array.isArray(data.moves) || data.moves.length > MAX_PLIES || !data.moves.every((m) => typeof m === 'string' && UCI.test(m))) return null
      const clocks = isRecord(data.clocks) ? { w: int(data.clocks.w, 0, MAX_CLOCK_MS), b: int(data.clocks.b, 0, MAX_CLOCK_MS) } : null
      if (!clocks || clocks.w === null || clocks.b === null) return null
      let result: SyncResult | null = null
      if (data.result !== null) {
        if (!isRecord(data.result) || typeof data.result.reason !== 'string' || data.result.reason.length > 30) return null
        const w = data.result.winner
        if (w !== 'w' && w !== 'b' && w !== null) return null
        result = { winner: w, reason: data.result.reason }
      }
      return { t: 'sync', game, moves: data.moves as string[], clocks: { w: clocks.w, b: clocks.b }, result }
    }
    case 'ping':
    case 'pong': {
      const at = int(data.at, 0, Number.MAX_SAFE_INTEGER)
      return at === null ? null : { t: data.t, at }
    }
    default:
      return null
  }
}

/** A fresh room code, e.g. "K7QM2D". */
export function newRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)] ?? 'A'
  return code
}

/** Normalises what someone typed or pasted (a code or an invite link) into a room code, or null. */
export function parseRoomCode(input: string): string | null {
  const fromLink = /[?&]room=([A-Za-z0-9]+)/.exec(input)?.[1]
  const code = (fromLink ?? input).toUpperCase().replace(/[\s-]/g, '')
  if (code.length !== CODE_LENGTH) return null
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null
}

export const peerIdFor = (code: string): string => `${PEER_PREFIX}${code.toLowerCase()}`

/** A random id for games and seat tokens. */
export function randomId(random: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < 16; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(random() * 36)] ?? 'a'
  return s
}
