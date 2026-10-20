// The ranked-play protocol between the browser and the game server, shared by
// both sides. The server is the referee: it checks every move with chess.js,
// runs the clocks, decides results and updates ratings. Everything crossing
// the wire is validated here, in both directions.

import { type ModeClientMessage, type ModeServerMessage, parseModeClientMessage, parseModeServerMessage } from './modeProtocol'

export const RANKED_PROTOCOL = 2

export interface RankedTimeControl {
  id: string
  label: string
  minutes: number
  increment: number
  /** Vanishing Chess pools: blindfold on the client, their own rating on the server. */
  mode?: 'vanish'
}

/** The pools you can queue in. */
export const RANKED_POOLS: readonly RankedTimeControl[] = [
  { id: '3+2', label: '3 + 2 Blitz', minutes: 3, increment: 2 },
  { id: '5+3', label: '5 + 3 Blitz', minutes: 5, increment: 3 },
  { id: '10+0', label: '10 + 0 Rapid', minutes: 10, increment: 0 },
  { id: '15+10', label: '15 + 10 Rapid', minutes: 15, increment: 10 },
]
/** Vanishing Chess: the same rules, its own queue and rating. */
export const VANISH_POOLS: readonly RankedTimeControl[] = [
  { id: 'vanish-3+2', label: 'Vanishing 3 + 2', minutes: 3, increment: 2, mode: 'vanish' },
  { id: 'vanish-5+3', label: 'Vanishing 5 + 3', minutes: 5, increment: 3, mode: 'vanish' },
]
export const poolById = (id: string): RankedTimeControl | undefined => RANKED_POOLS.find((p) => p.id === id) ?? VANISH_POOLS.find((p) => p.id === id)

export type RankedReason = 'checkmate' | 'resign' | 'timeout' | 'agreement' | 'stalemate' | 'threefold' | 'insufficient' | 'fifty-move' | 'timeout-insufficient' | 'abandon' | 'aborted'

export interface PublicPlayer {
  name: string
  rating: number
}

export interface GameSnapshot {
  gameId: string
  color: 'w' | 'b'
  opponent: PublicPlayer
  pool: string
  /** Every move so far, in UCI. */
  moves: string[]
  /** Remaining ms per side, as of the moment the server sent this. */
  clocks: { w: number; b: number }
  /** Whose clock is running (null before White's first move, or when over). */
  running: 'w' | 'b' | null
  drawOffer: 'w' | 'b' | null
  /** What the game is part of, e.g. "Weekly Knockout · Semi-final" (absent for ordinary ranked games). */
  label?: string
}

/** A game you are watching. */
export interface SpectateSnapshot {
  gameId: string
  white: PublicPlayer
  black: PublicPlayer
  pool: string
  moves: string[]
  clocks: { w: number; b: number }
  running: 'w' | 'b' | null
  label: string | null
}

// ── Client → server ─────────────────────────────────────────────────────────
export type ClientMessage =
  | { type: 'FIND_MATCH'; pool: string }
  | { type: 'CANCEL_MATCH' }
  | { type: 'MAKE_MOVE'; gameId: string; ply: number; uci: string }
  | { type: 'RESIGN'; gameId: string }
  | { type: 'OFFER_DRAW'; gameId: string }
  | { type: 'ANSWER_DRAW'; gameId: string; accept: boolean }
  | { type: 'PING'; at: number }
  | { type: 'SPECTATE'; gameId: string }
  | { type: 'UNSPECTATE' }
  | ModeClientMessage

// ── Server → client ─────────────────────────────────────────────────────────
export type ServerMessage =
  | { type: 'HELLO'; protocol: number; user: PublicPlayer & { id: string } }
  | { type: 'SEARCHING'; pool: string; queued: number }
  | { type: 'MATCH_FOUND'; game: GameSnapshot }
  | { type: 'MOVE_ACCEPTED'; gameId: string; ply: number; clocks: { w: number; b: number } }
  | { type: 'MOVE_REJECTED'; gameId: string; ply: number; reason: string; game: GameSnapshot }
  | { type: 'OPPONENT_MOVE'; gameId: string; ply: number; uci: string; clocks: { w: number; b: number } }
  | { type: 'DRAW_OFFERED'; gameId: string; by: 'w' | 'b' }
  | { type: 'DRAW_DECLINED'; gameId: string }
  | { type: 'OPPONENT_DISCONNECTED'; gameId: string; graceMs: number }
  | { type: 'OPPONENT_RECONNECTED'; gameId: string }
  | { type: 'GAME_OVER'; gameId: string; winner: 'w' | 'b' | null; reason: RankedReason; rating: { before: number; after: number } }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'PONG'; at: number }
  | { type: 'SPECTATE_START'; game: SpectateSnapshot }
  | { type: 'SPECTATE_MOVE'; gameId: string; ply: number; uci: string; clocks: { w: number; b: number } }
  | { type: 'SPECTATE_OVER'; gameId: string; winner: 'w' | 'b' | null; reason: RankedReason }
  /** The weekly tournament changed (sign-ups, results): fetch /api/tournament again. */
  | { type: 'TOURNAMENT_CHANGED' }
  | ModeServerMessage

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/
const ID = /^[a-z0-9]{8,40}$/
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const int = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)
const id = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null)

function decode(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length > 4096) return null
  try {
    const data: unknown = JSON.parse(raw)
    return isRecord(data) ? data : null
  } catch {
    return null
  }
}

/** Parses a message from a browser (untrusted). */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  const d = decode(raw)
  if (!d) return null
  switch (d.type) {
    case 'FIND_MATCH':
      return typeof d.pool === 'string' && poolById(d.pool) ? { type: 'FIND_MATCH', pool: d.pool } : null
    case 'CANCEL_MATCH':
      return { type: 'CANCEL_MATCH' }
    case 'MAKE_MOVE': {
      const gameId = id(d.gameId)
      const ply = int(d.ply, 0, 1200)
      return gameId && ply !== null && typeof d.uci === 'string' && UCI.test(d.uci) ? { type: 'MAKE_MOVE', gameId, ply, uci: d.uci } : null
    }
    case 'RESIGN':
    case 'OFFER_DRAW': {
      const gameId = id(d.gameId)
      return gameId ? { type: d.type, gameId } : null
    }
    case 'ANSWER_DRAW': {
      const gameId = id(d.gameId)
      return gameId && typeof d.accept === 'boolean' ? { type: 'ANSWER_DRAW', gameId, accept: d.accept } : null
    }
    case 'PING': {
      const at = int(d.at, 0, Number.MAX_SAFE_INTEGER)
      return at === null ? null : { type: 'PING', at }
    }
    case 'SPECTATE': {
      const gameId = id(d.gameId)
      return gameId ? { type: 'SPECTATE', gameId } : null
    }
    case 'UNSPECTATE':
      return { type: 'UNSPECTATE' }
    default:
      return parseModeClientMessage(d)
  }
}

const REASONS: readonly RankedReason[] = ['checkmate', 'resign', 'timeout', 'agreement', 'stalemate', 'threefold', 'insufficient', 'fifty-move', 'timeout-insufficient', 'abandon', 'aborted']
const color = (v: unknown): 'w' | 'b' | null => (v === 'w' || v === 'b' ? v : null)
const clocks = (v: unknown): { w: number; b: number } | null => {
  if (!isRecord(v)) return null
  const w = int(v.w, 0, 4 * 3600_000)
  const b = int(v.b, 0, 4 * 3600_000)
  return w === null || b === null ? null : { w, b }
}
const player = (v: unknown): PublicPlayer | null => (isRecord(v) && typeof v.name === 'string' && v.name.length <= 40 && int(v.rating, 0, 4000) !== null ? { name: v.name, rating: v.rating as number } : null)

function snapshot(v: unknown): GameSnapshot | null {
  if (!isRecord(v)) return null
  const gameId = id(v.gameId)
  const c = color(v.color)
  const opp = player(v.opponent)
  const cl = clocks(v.clocks)
  const running = v.running === null ? null : color(v.running)
  const offer = v.drawOffer === null ? null : color(v.drawOffer)
  if (!gameId || !c || !opp || !cl || typeof v.pool !== 'string' || !poolById(v.pool)) return null
  if ((v.running !== null && !running) || (v.drawOffer !== null && !offer)) return null
  if (!movesOk(v.moves)) return null
  if (v.label !== undefined && (typeof v.label !== 'string' || v.label.length > 80)) return null
  return { gameId, color: c, opponent: opp, pool: v.pool, moves: v.moves, clocks: cl, running, drawOffer: offer, ...(typeof v.label === 'string' ? { label: v.label } : {}) }
}

const movesOk = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 1200 && v.every((m) => typeof m === 'string' && UCI.test(m))

function spectateSnapshot(v: unknown): SpectateSnapshot | null {
  if (!isRecord(v)) return null
  const gameId = id(v.gameId)
  const white = player(v.white)
  const black = player(v.black)
  const cl = clocks(v.clocks)
  const running = v.running === null ? null : color(v.running)
  if (!gameId || !white || !black || !cl || typeof v.pool !== 'string' || !poolById(v.pool) || !movesOk(v.moves)) return null
  if (v.running !== null && !running) return null
  if (v.label !== null && (typeof v.label !== 'string' || v.label.length > 80)) return null
  return { gameId, white, black, pool: v.pool, moves: v.moves, clocks: cl, running, label: typeof v.label === 'string' ? v.label : null }
}

/** Parses a message from the server (validated too: a bad deploy shouldn't crash the app). */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== 'string' || raw.length > 64_000) return null
  let d: unknown
  try {
    d = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(d)) return null
  switch (d.type) {
    case 'HELLO': {
      const p = player(d.user)
      const uid = isRecord(d.user) ? id(d.user.id) : null
      return p && uid && int(d.protocol, 0, 1000) !== null ? { type: 'HELLO', protocol: d.protocol as number, user: { ...p, id: uid } } : null
    }
    case 'SEARCHING':
      return typeof d.pool === 'string' && int(d.queued, 0, 1_000_000) !== null ? { type: 'SEARCHING', pool: d.pool, queued: d.queued as number } : null
    case 'MATCH_FOUND': {
      const game = snapshot(d.game)
      return game ? { type: 'MATCH_FOUND', game } : null
    }
    case 'MOVE_ACCEPTED': {
      const gameId = id(d.gameId)
      const cl = clocks(d.clocks)
      const ply = int(d.ply, 0, 1200)
      return gameId && cl && ply !== null ? { type: 'MOVE_ACCEPTED', gameId, ply, clocks: cl } : null
    }
    case 'MOVE_REJECTED': {
      const gameId = id(d.gameId)
      const ply = int(d.ply, 0, 1200)
      const game = snapshot(d.game)
      return gameId && ply !== null && game && typeof d.reason === 'string' ? { type: 'MOVE_REJECTED', gameId, ply, reason: d.reason.slice(0, 200), game } : null
    }
    case 'OPPONENT_MOVE': {
      const gameId = id(d.gameId)
      const ply = int(d.ply, 0, 1200)
      const cl = clocks(d.clocks)
      return gameId && ply !== null && cl && typeof d.uci === 'string' && UCI.test(d.uci) ? { type: 'OPPONENT_MOVE', gameId, ply, uci: d.uci, clocks: cl } : null
    }
    case 'DRAW_OFFERED': {
      const gameId = id(d.gameId)
      const by = color(d.by)
      return gameId && by ? { type: 'DRAW_OFFERED', gameId, by } : null
    }
    case 'DRAW_DECLINED':
    case 'OPPONENT_RECONNECTED': {
      const gameId = id(d.gameId)
      return gameId ? { type: d.type, gameId } : null
    }
    case 'OPPONENT_DISCONNECTED': {
      const gameId = id(d.gameId)
      const graceMs = int(d.graceMs, 0, 600_000)
      return gameId && graceMs !== null ? { type: 'OPPONENT_DISCONNECTED', gameId, graceMs } : null
    }
    case 'GAME_OVER': {
      const gameId = id(d.gameId)
      const winner = d.winner === null ? null : color(d.winner)
      const reason = REASONS.find((r) => r === d.reason)
      const rating = isRecord(d.rating) ? { before: int(d.rating.before, 0, 4000), after: int(d.rating.after, 0, 4000) } : null
      if (!gameId || (d.winner !== null && !winner) || !reason || !rating || rating.before === null || rating.after === null) return null
      return { type: 'GAME_OVER', gameId, winner, reason, rating: { before: rating.before, after: rating.after } }
    }
    case 'ERROR':
      return typeof d.code === 'string' && typeof d.message === 'string' ? { type: 'ERROR', code: d.code.slice(0, 40), message: d.message.slice(0, 300) } : null
    case 'PONG': {
      const at = int(d.at, 0, Number.MAX_SAFE_INTEGER)
      return at === null ? null : { type: 'PONG', at }
    }
    case 'SPECTATE_START': {
      const game = spectateSnapshot(d.game)
      return game ? { type: 'SPECTATE_START', game } : null
    }
    case 'SPECTATE_MOVE': {
      const gameId = id(d.gameId)
      const ply = int(d.ply, 0, 1200)
      const cl = clocks(d.clocks)
      return gameId && ply !== null && cl && typeof d.uci === 'string' && UCI.test(d.uci) ? { type: 'SPECTATE_MOVE', gameId, ply, uci: d.uci, clocks: cl } : null
    }
    case 'SPECTATE_OVER': {
      const gameId = id(d.gameId)
      const winner = d.winner === null ? null : color(d.winner)
      const reason = REASONS.find((r) => r === d.reason)
      return gameId && reason && (d.winner === null || winner) ? { type: 'SPECTATE_OVER', gameId, winner, reason } : null
    }
    case 'TOURNAMENT_CHANGED':
      return { type: 'TOURNAMENT_CHANGED' }
    default:
      return parseModeServerMessage(d)
  }
}
