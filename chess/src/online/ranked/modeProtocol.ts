// The online modes' part of the ranked protocol: Card Chess (1 v 1, a draft
// then a game), the four-player Battle Royale, and the queue messages they
// share. Vanishing Chess needs nothing here: it is ordinary chess on the
// server (its own pools and rating), drawn blindfold by the client.
//
// Games are sent as an action log; both sides rebuild the position by
// replaying it with the same rules code (src/cards, src/royale), so the
// server and the browser can never disagree about what a move did.
import { CARD_IDS, type CardId, HAND_SIZE, OFFER_SIZE } from '../../cards/cardGame'
import { SIZE, onBoard } from '../../royale/royale'
import type { PublicPlayer } from './protocol'

export type OnlineMode = 'cards' | 'royale'
export const ONLINE_MODES: readonly OnlineMode[] = ['cards', 'royale']

/** Card Chess online: 5 + 3, a 30-second draft first. */
export const CARDS_POOL = { id: 'cards-5+3', label: 'Card Chess 5 + 3', minutes: 5, increment: 3 } as const
export const CARD_DRAFT_MS = 30_000
/** Battle Royale online: each move has this long (then the computer moves for you). */
export const ROYALE_MOVE_MS = 30_000
/** Missed turns in a row before an army is out. */
export const ROYALE_MAX_STRIKES = 2

const SQUARE = /^[a-h][1-8]$/
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/
const ID = /^[a-z0-9]{8,40}$/

// ── Card Chess ──────────────────────────────────────────────────────────────

/** One entry of a Card Chess action log: a move, a card move or drop, or a ward. */
export type CardAction = { k: 'm'; uci: string } | { k: 'c'; card: CardId; from: string | null; to: string } | { k: 'w'; card: 'stone-wall' | 'aegis'; sq: string }

export type CardOnlineReason = 'checkmate' | 'stalemate' | 'insufficient' | 'threefold' | 'fifty-move' | 'resign' | 'timeout' | 'abandon' | 'aborted'

export interface CardSnapshot {
  gameId: string
  color: 'w' | 'b'
  opponent: PublicPlayer
  phase: 'draft' | 'play'
  /** The five cards both players draft from. */
  offer: CardId[]
  /** Your hand (null until you draft) and theirs (hidden until both have drafted). */
  hands: { w: CardId[] | null; b: CardId[] | null }
  /** ms left to draft (draft phase only). */
  draftMs: number | null
  actions: CardAction[]
  clocks: { w: number; b: number }
  running: 'w' | 'b' | null
}

// ── Battle Royale ───────────────────────────────────────────────────────────

/** One entry of a Battle Royale log: a move (auto = the computer moved for a player out of time), or an army leaving. */
export type RoyaleAction = { k: 'm'; from: [number, number]; to: [number, number]; auto?: true } | { k: 'x'; seat: number }

export interface RoyaleSeat extends PublicPlayer {
  /** A computer army (filling an empty seat). */
  bot: boolean
}

export interface RoyaleSnapshot {
  gameId: string
  /** Your seat: 0 red, 1 blue, 2 yellow, 3 green. */
  seat: number
  seats: RoyaleSeat[]
  actions: RoyaleAction[]
  /** ms left for the player to move (null when over). */
  turnMs: number | null
  /** Rated: at least two people are playing. */
  rated: boolean
}

export interface ModeOver {
  gameId: string
  mode: OnlineMode
  /** Card Chess: the winning colour (null = draw). */
  winner: 'w' | 'b' | null
  /** Battle Royale: seats in finishing order. */
  ranking: number[]
  reason: string
  /** Your rating in this mode (null when the game wasn't rated). */
  rating: { before: number; after: number } | null
}

export type ModeClientMessage =
  | { type: 'FIND_MODE'; mode: OnlineMode }
  | { type: 'CARD_DRAFT'; gameId: string; cards: CardId[] }
  | { type: 'CARD_ACTION'; gameId: string; ply: number; action: CardAction }
  | { type: 'ROYALE_MOVE'; gameId: string; ply: number; from: [number, number]; to: [number, number] }

export type ModeServerMessage =
  | { type: 'MODE_SEARCHING'; mode: OnlineMode; queued: number }
  | { type: 'CARD_STATE'; game: CardSnapshot }
  | { type: 'CARD_PLAYED'; gameId: string; ply: number; action: CardAction; clocks: { w: number; b: number } }
  | { type: 'ROYALE_STATE'; game: RoyaleSnapshot }
  | { type: 'ROYALE_PLAYED'; gameId: string; ply: number; action: RoyaleAction; turnMs: number | null }
  | { type: 'MODE_OVER'; result: ModeOver }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const int = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)
const id = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null)
const cardId = (v: unknown): CardId | null => (typeof v === 'string' && (CARD_IDS as string[]).includes(v) ? (v as CardId) : null)
const square = (v: unknown): string | null => (typeof v === 'string' && SQUARE.test(v) ? v : null)
const mode = (v: unknown): OnlineMode | null => (v === 'cards' || v === 'royale' ? v : null)
const pos = (v: unknown): [number, number] | null => {
  if (!Array.isArray(v) || v.length !== 2) return null
  const r = int(v[0], 0, SIZE - 1)
  const c = int(v[1], 0, SIZE - 1)
  return r !== null && c !== null && onBoard(r, c) ? [r, c] : null
}
const cardList = (v: unknown, max: number): CardId[] | null => {
  if (!Array.isArray(v) || v.length > max) return null
  const out = v.map(cardId)
  return out.every((c): c is CardId => c !== null) && new Set(out).size === out.length ? out : null
}
const player = (v: unknown): PublicPlayer | null => (isRecord(v) && typeof v.name === 'string' && v.name.length <= 40 && int(v.rating, 0, 4000) !== null ? { name: v.name, rating: v.rating as number } : null)
const clocks = (v: unknown): { w: number; b: number } | null => {
  if (!isRecord(v)) return null
  const w = int(v.w, 0, 4 * 3600_000)
  const b = int(v.b, 0, 4 * 3600_000)
  return w === null || b === null ? null : { w, b }
}
const colorOrNull = (v: unknown): 'w' | 'b' | null | undefined => (v === null ? null : v === 'w' || v === 'b' ? v : undefined)

export function parseCardAction(v: unknown): CardAction | null {
  if (!isRecord(v)) return null
  if (v.k === 'm') return typeof v.uci === 'string' && UCI.test(v.uci) ? { k: 'm', uci: v.uci } : null
  if (v.k === 'c') {
    const card = cardId(v.card)
    const to = square(v.to)
    const from = v.from === null ? null : square(v.from)
    return card && to && (v.from === null || from) ? { k: 'c', card, from, to } : null
  }
  if (v.k === 'w') {
    const sq = square(v.sq)
    return (v.card === 'stone-wall' || v.card === 'aegis') && sq ? { k: 'w', card: v.card, sq } : null
  }
  return null
}

export function parseRoyaleAction(v: unknown): RoyaleAction | null {
  if (!isRecord(v)) return null
  if (v.k === 'm') {
    const from = pos(v.from)
    const to = pos(v.to)
    return from && to ? { k: 'm', from, to, ...(v.auto === true ? { auto: true as const } : {}) } : null
  }
  if (v.k === 'x') {
    const seat = int(v.seat, 0, 3)
    return seat === null ? null : { k: 'x', seat }
  }
  return null
}

/** A mode message from a browser (untrusted), or null if it isn't one. */
export function parseModeClientMessage(d: Record<string, unknown>): ModeClientMessage | null {
  switch (d.type) {
    case 'FIND_MODE': {
      const m = mode(d.mode)
      return m ? { type: 'FIND_MODE', mode: m } : null
    }
    case 'CARD_DRAFT': {
      const gameId = id(d.gameId)
      const cards = cardList(d.cards, HAND_SIZE)
      return gameId && cards && cards.length === HAND_SIZE ? { type: 'CARD_DRAFT', gameId, cards } : null
    }
    case 'CARD_ACTION': {
      const gameId = id(d.gameId)
      const ply = int(d.ply, 0, 2000)
      const action = parseCardAction(d.action)
      return gameId && ply !== null && action ? { type: 'CARD_ACTION', gameId, ply, action } : null
    }
    case 'ROYALE_MOVE': {
      const gameId = id(d.gameId)
      const ply = int(d.ply, 0, 2000)
      const from = pos(d.from)
      const to = pos(d.to)
      return gameId && ply !== null && from && to ? { type: 'ROYALE_MOVE', gameId, ply, from, to } : null
    }
    default:
      return null
  }
}

function cardSnapshot(v: unknown): CardSnapshot | null {
  if (!isRecord(v) || !isRecord(v.hands)) return null
  const gameId = id(v.gameId)
  const color = colorOrNull(v.color)
  const opponent = player(v.opponent)
  const offer = cardList(v.offer, OFFER_SIZE)
  const hw = v.hands.w === null ? null : cardList(v.hands.w, HAND_SIZE)
  const hb = v.hands.b === null ? null : cardList(v.hands.b, HAND_SIZE)
  const cl = clocks(v.clocks)
  const running = colorOrNull(v.running)
  const draftMs = v.draftMs === null ? null : int(v.draftMs, 0, 600_000)
  if (!gameId || !color || !opponent || !offer || !cl || running === undefined || (v.phase !== 'draft' && v.phase !== 'play')) return null
  if ((v.hands.w !== null && !hw) || (v.hands.b !== null && !hb) || (v.draftMs !== null && draftMs === null)) return null
  if (!Array.isArray(v.actions) || v.actions.length > 2000) return null
  const actions = v.actions.map(parseCardAction)
  if (!actions.every((a): a is CardAction => a !== null)) return null
  return { gameId, color, opponent, phase: v.phase, offer, hands: { w: hw, b: hb }, draftMs, actions, clocks: cl, running }
}

function royaleSnapshot(v: unknown): RoyaleSnapshot | null {
  if (!isRecord(v)) return null
  const gameId = id(v.gameId)
  const seat = int(v.seat, 0, 3)
  const turnMs = v.turnMs === null ? null : int(v.turnMs, 0, 600_000)
  if (!gameId || seat === null || (v.turnMs !== null && turnMs === null) || typeof v.rated !== 'boolean') return null
  if (!Array.isArray(v.seats) || v.seats.length !== 4) return null
  const seats = v.seats.map((s) => {
    const p = player(s)
    return p && isRecord(s) && typeof s.bot === 'boolean' ? { ...p, bot: s.bot } : null
  })
  if (!seats.every((s): s is RoyaleSeat => s !== null)) return null
  if (!Array.isArray(v.actions) || v.actions.length > 2000) return null
  const actions = v.actions.map(parseRoyaleAction)
  if (!actions.every((a): a is RoyaleAction => a !== null)) return null
  return { gameId, seat, seats, actions, turnMs, rated: v.rated }
}

/** A mode message from the server, or null if it isn't one (or is malformed). */
export function parseModeServerMessage(d: Record<string, unknown>): ModeServerMessage | null {
  switch (d.type) {
    case 'MODE_SEARCHING': {
      const m = mode(d.mode)
      const queued = int(d.queued, 0, 1_000_000)
      return m && queued !== null ? { type: 'MODE_SEARCHING', mode: m, queued } : null
    }
    case 'CARD_STATE': {
      const game = cardSnapshot(d.game)
      return game ? { type: 'CARD_STATE', game } : null
    }
    case 'CARD_PLAYED': {
      const gameId = id(d.gameId)
      const ply = int(d.ply, 0, 2000)
      const action = parseCardAction(d.action)
      const cl = clocks(d.clocks)
      return gameId && ply !== null && action && cl ? { type: 'CARD_PLAYED', gameId, ply, action, clocks: cl } : null
    }
    case 'ROYALE_STATE': {
      const game = royaleSnapshot(d.game)
      return game ? { type: 'ROYALE_STATE', game } : null
    }
    case 'ROYALE_PLAYED': {
      const gameId = id(d.gameId)
      const ply = int(d.ply, 0, 2000)
      const action = parseRoyaleAction(d.action)
      const turnMs = d.turnMs === null ? null : int(d.turnMs, 0, 600_000)
      return gameId && ply !== null && action && (d.turnMs === null || turnMs !== null) ? { type: 'ROYALE_PLAYED', gameId, ply, action, turnMs } : null
    }
    case 'MODE_OVER': {
      const r = d.result
      if (!isRecord(r)) return null
      const gameId = id(r.gameId)
      const m = mode(r.mode)
      const winner = colorOrNull(r.winner)
      const rating = r.rating === null ? null : isRecord(r.rating) ? { before: int(r.rating.before, 0, 4000), after: int(r.rating.after, 0, 4000) } : undefined
      if (!gameId || !m || winner === undefined || typeof r.reason !== 'string' || rating === undefined) return null
      if (rating && (rating.before === null || rating.after === null)) return null
      if (!Array.isArray(r.ranking) || r.ranking.length > 4 || !r.ranking.every((s) => int(s, 0, 3) !== null)) return null
      return { type: 'MODE_OVER', result: { gameId, mode: m, winner, ranking: r.ranking as number[], reason: r.reason.slice(0, 40), rating: rating ? { before: rating.before!, after: rating.after! } : null } }
    }
    default:
      return null
  }
}
