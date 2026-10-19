// One online game as a pure state machine: whose turn it is, which moves are
// legal, the clocks, draw offers, results and resyncs. No networking here —
// useOnlineMatch feeds it local actions and validated messages, and sends
// whatever messages it returns. Both browsers run the same rules on the same
// moves, so they always agree on the position.
import { Chess } from 'chess.js'
import type { Color, MoveInput, PieceSymbol, Square } from '../types/chess'
import { getBoardResult, hasMatingMaterial, opposite } from '../utils/chess'
import type { OnlineMessage, Seat, StartParams, SyncResult } from './protocol'

export type ResultReason = 'checkmate' | 'resign' | 'timeout' | 'agreement' | 'stalemate' | 'threefold' | 'insufficient' | 'fifty-move' | 'timeout-insufficient' | 'abandon'

export interface OnlineResult {
  winner: Color | null
  reason: ResultReason
}

export interface MatchState {
  game: StartParams
  mySeat: Seat
  myColor: Color
  /** Every move so far, in UCI ("e2e4", "e7e8q"). */
  moves: string[]
  fen: string
  lastMove: { from: Square; to: Square } | null
  /** Remaining time (ms) for each side as of `turnStartedAt`. */
  clocks: { w: number; b: number }
  /** Local time the side to move started thinking; null while the clock isn't running. */
  turnStartedAt: number | null
  result: OnlineResult | null
  /** An open draw offer, valid only in the position it was made in. */
  drawOffer: { from: Color; ply: number } | null
  rematch: { me: boolean; them: boolean }
}

/** How long past zero an opponent's clock may run (lag, a slow tab) before we claim the win ourselves. */
export const FLAG_GRACE_MS = 4000

const REASONS: readonly ResultReason[] = ['checkmate', 'resign', 'timeout', 'agreement', 'stalemate', 'threefold', 'insufficient', 'fifty-move', 'timeout-insufficient', 'abandon']

const clockOf = (game: StartParams): number => game.tc.minutes * 60_000
export const hasClock = (state: MatchState): boolean => state.game.tc.minutes > 0
const colorOf = (game: StartParams, seat: Seat): Color => (game.white === seat ? 'w' : 'b')
export const turnOf = (state: MatchState): Color => (state.moves.length % 2 === 0 ? 'w' : 'b')

/** Replays UCI moves from the start; null if any is illegal. */
export function replay(moves: readonly string[]): Chess | null {
  const chess = new Chess()
  for (const uci of moves) {
    try {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci[4] } : {}) })
    } catch {
      return null
    }
  }
  return chess
}

export const toUci = (m: { from: string; to: string; promotion?: string | undefined }): string => `${m.from}${m.to}${m.promotion ?? ''}`

function boardResult(chess: Chess): OnlineResult | null {
  const r = getBoardResult(chess)
  if (!r) return null
  if (r.kind === 'checkmate') return { winner: r.winner, reason: 'checkmate' }
  if (r.kind === 'draw') return { winner: null, reason: r.reason }
  return null
}

export function startMatch(game: StartParams, mySeat: Seat): MatchState {
  return {
    game,
    mySeat,
    myColor: colorOf(game, mySeat),
    moves: [],
    fen: new Chess().fen(),
    lastMove: null,
    clocks: { w: clockOf(game), b: clockOf(game) },
    // Clocks start with White's first move.
    turnStartedAt: null,
    result: null,
    drawOffer: null,
    rematch: { me: false, them: false },
  }
}

/** Live clock values for display at local time `now`. */
export function clocksAt(state: MatchState, now: number): { w: number; b: number } {
  if (!hasClock(state) || state.turnStartedAt === null || state.result) return state.clocks
  const side = turnOf(state)
  return { ...state.clocks, [side]: Math.max(0, state.clocks[side] - Math.max(0, now - state.turnStartedAt)) }
}

/** Applies a move by `mover` (already checked to be their turn). */
function applyMove(state: MatchState, uci: string, mover: Color, remainingMs: number, now: number): MatchState | null {
  const chess = replay(state.moves)
  if (!chess) return null
  let move
  try {
    move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci[4] } : {}) })
  } catch {
    return null
  }
  const moves = [...state.moves, uci]
  const clocks = { ...state.clocks, [mover]: remainingMs }
  return {
    ...state,
    moves,
    fen: chess.fen(),
    lastMove: { from: move.from, to: move.to },
    clocks,
    // The opponent's clock starts once both sides have made a move (and from Black's reply on).
    turnStartedAt: hasClock(state) && moves.length >= 1 ? now : null,
    result: boardResult(chess),
    // Any move withdraws a standing draw offer.
    drawOffer: null,
  }
}

/** Remaining time for the side to move after it moves at `now` (with increment). */
function spent(state: MatchState, mover: Color, now: number): number {
  if (!hasClock(state)) return 0
  const left = state.turnStartedAt === null ? state.clocks[mover] : state.clocks[mover] - (now - state.turnStartedAt)
  return Math.max(0, Math.round(left + state.game.tc.increment * 1000))
}

/** The local player moves. Returns the new state and the message to send, or null if not allowed. */
export function localMove(state: MatchState, input: MoveInput, now: number): { state: MatchState; send: OnlineMessage } | null {
  if (state.result || turnOf(state) !== state.myColor) return null
  if (hasClock(state) && clocksAt(state, now)[state.myColor] <= 0) return null
  const uci = toUci({ from: input.from, to: input.to, promotion: input.promotion as PieceSymbol | undefined })
  const remaining = spent(state, state.myColor, now)
  const next = applyMove(state, uci, state.myColor, remaining, now)
  if (!next) return null
  return { state: next, send: { t: 'move', gameId: state.game.gameId, ply: state.moves.length, uci, clockMs: remaining } }
}

export type RemoteOutcome = { state: MatchState; send?: OnlineMessage } | { desync: true } | null

/**
 * Applies a validated message from the opponent. null = ignore it;
 * `desync` = the two boards disagree, so ask the host for the full game.
 */
export function remote(state: MatchState, msg: OnlineMessage, now: number): RemoteOutcome {
  const them = opposite(state.myColor)
  switch (msg.t) {
    case 'move': {
      if (msg.gameId !== state.game.gameId || state.result) return null
      if (msg.ply < state.moves.length) return null // a duplicate after a reconnect
      if (msg.ply > state.moves.length || turnOf(state) !== them) return { desync: true }
      // Trust the opponent's reported clock, but never let it grow by more than the increment.
      const ceiling = state.clocks[them] + state.game.tc.increment * 1000
      const next = applyMove(state, msg.uci, them, hasClock(state) ? Math.min(msg.clockMs, ceiling) : 0, now)
      return next ? { state: next } : { desync: true }
    }
    case 'resign':
      if (msg.gameId !== state.game.gameId || state.result) return null
      return { state: { ...state, result: { winner: state.myColor, reason: 'resign' }, drawOffer: null } }
    case 'timeout': {
      // The opponent reports that the side to move ran out of time.
      if (msg.gameId !== state.game.gameId || state.result || !hasClock(state) || state.turnStartedAt === null) return null
      return { state: { ...state, result: timeoutResult(state, turnOf(state)), clocks: { ...state.clocks, [turnOf(state)]: 0 } } }
    }
    case 'draw-offer':
      if (msg.gameId !== state.game.gameId || state.result || msg.ply !== state.moves.length) return null
      return { state: { ...state, drawOffer: { from: them, ply: msg.ply } } }
    case 'draw-reply':
      if (msg.gameId !== state.game.gameId || state.result || state.drawOffer?.from !== state.myColor) return null
      return { state: msg.accept ? { ...state, result: { winner: null, reason: 'agreement' }, drawOffer: null } : { ...state, drawOffer: null } }
    case 'rematch':
      if (msg.gameId !== state.game.gameId || !state.result) return null
      return { state: { ...state, rematch: { ...state.rematch, them: true } } }
    default:
      return null
  }
}

/** Who wins when `flagged` runs out: the other side — unless it could never mate (then a draw). */
function timeoutResult(state: MatchState, flagged: Color): OnlineResult {
  const chess = new Chess(state.fen)
  const winner = opposite(flagged)
  return hasMatingMaterial(chess, winner) ? { winner, reason: 'timeout' } : { winner: null, reason: 'timeout-insufficient' }
}

/**
 * Checks the clocks at `now`: our own flag falls at zero; the opponent's we
 * claim only after a grace period (their own browser normally reports it).
 */
export function checkFlags(state: MatchState, now: number): { state: MatchState; send: OnlineMessage } | null {
  if (state.result || !hasClock(state) || state.turnStartedAt === null) return null
  const side = turnOf(state)
  const left = state.clocks[side] - (now - state.turnStartedAt)
  const limit = side === state.myColor ? 0 : -FLAG_GRACE_MS
  if (left > limit) return null
  return { state: { ...state, result: timeoutResult(state, side), clocks: { ...state.clocks, [side]: 0 } }, send: { t: 'timeout', gameId: state.game.gameId } }
}

export function resign(state: MatchState): { state: MatchState; send: OnlineMessage } | null {
  if (state.result) return null
  return { state: { ...state, result: { winner: opposite(state.myColor), reason: 'resign' }, drawOffer: null }, send: { t: 'resign', gameId: state.game.gameId } }
}

export function offerDraw(state: MatchState): { state: MatchState; send: OnlineMessage } | null {
  if (state.result || state.drawOffer || state.moves.length < 2) return null
  return { state: { ...state, drawOffer: { from: state.myColor, ply: state.moves.length } }, send: { t: 'draw-offer', gameId: state.game.gameId, ply: state.moves.length } }
}

export function answerDraw(state: MatchState, accept: boolean): { state: MatchState; send: OnlineMessage } | null {
  if (state.result || !state.drawOffer || state.drawOffer.from === state.myColor) return null
  const next = accept ? { ...state, result: { winner: null, reason: 'agreement' as const }, drawOffer: null } : { ...state, drawOffer: null }
  return { state: next, send: { t: 'draw-reply', gameId: state.game.gameId, accept } }
}

export function askRematch(state: MatchState): { state: MatchState; send: OnlineMessage } | null {
  if (!state.result || state.rematch.me) return null
  return { state: { ...state, rematch: { ...state.rematch, me: true } }, send: { t: 'rematch', gameId: state.game.gameId } }
}

/** The opponent left for good: the game is theirs to lose. */
export function abandon(state: MatchState): MatchState {
  return state.result ? state : { ...state, result: { winner: state.myColor, reason: 'abandon' }, drawOffer: null }
}

/** The next game after a rematch: same seats, colours swapped. */
export function rematchParams(state: MatchState, gameId: string): StartParams {
  return { gameId, white: state.game.white === 'host' ? 'guest' : 'host', tc: state.game.tc }
}

/** The full game, as the host sends it to a reconnecting guest. */
export function syncMessage(state: MatchState, now: number): OnlineMessage {
  const c = clocksAt(state, now)
  return { t: 'sync', game: state.game, moves: state.moves, clocks: { w: Math.round(c.w), b: Math.round(c.b) }, result: state.result }
}

/** Rebuilds the game from the host's sync; null if it doesn't replay. */
export function applySync(mySeat: Seat, msg: Extract<OnlineMessage, { t: 'sync' }>, now: number): MatchState | null {
  const chess = replay(msg.moves)
  if (!chess) return null
  const base = startMatch(msg.game, mySeat)
  const last = chess.history({ verbose: true }).at(-1)
  return {
    ...base,
    moves: msg.moves,
    fen: chess.fen(),
    lastMove: last ? { from: last.from, to: last.to } : null,
    clocks: msg.clocks,
    turnStartedAt: hasClock(base) && msg.moves.length >= 1 ? now : null,
    result: msg.result ? parseResult(msg.result) : boardResult(chess),
  }
}

function parseResult(r: SyncResult): OnlineResult {
  const reason = REASONS.find((x) => x === r.reason) ?? 'abandon'
  return { winner: r.winner, reason }
}

const REASON_TEXT: Record<ResultReason, string> = {
  checkmate: 'by checkmate',
  resign: 'by resignation',
  timeout: 'on time',
  agreement: 'by agreement',
  stalemate: 'by stalemate',
  threefold: 'by threefold repetition',
  insufficient: 'by insufficient material',
  'fifty-move': 'by the fifty-move rule',
  'timeout-insufficient': 'on time vs. insufficient material',
  abandon: 'by abandonment',
}

/** "You won by checkmate", "Draw by agreement", … */
export function resultText(result: OnlineResult, myColor: Color): string {
  if (result.winner === null) return `Draw ${REASON_TEXT[result.reason]}`
  return `${result.winner === myColor ? 'You won' : 'You lost'} ${REASON_TEXT[result.reason]}`
}
