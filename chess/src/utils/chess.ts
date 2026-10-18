import { Chess, DEFAULT_POSITION } from 'chess.js'
import { PIECE_VALUES } from '../constants/game'
import type { CapturedSummary, Color, GameResult, GameStatus, Move, PieceSymbol, Square } from '../types/chess'

export const opposite = (color: Color): Color => (color === 'w' ? 'b' : 'w')

export const colorName = (color: Color): string => (color === 'w' ? 'White' : 'Black')

/**
 * Derives the result implied by the board position alone (mate / draws), if any.
 * `repetitions` overrides chess.js's own count — needed when the game history
 * is longer than the chess.js instance's (Chronos special moves reload it).
 */
export function getBoardResult(chess: Chess, repetitions?: number): GameResult | null {
  if (chess.isCheckmate()) return { kind: 'checkmate', winner: opposite(chess.turn()) }
  if (chess.isStalemate()) return { kind: 'draw', reason: 'stalemate' }
  if (chess.isInsufficientMaterial()) return { kind: 'draw', reason: 'insufficient' }
  if (repetitions !== undefined ? repetitions >= 3 : chess.isThreefoldRepetition()) return { kind: 'draw', reason: 'threefold' }
  if (chess.isDrawByFiftyMoves()) return { kind: 'draw', reason: 'fifty-move' }
  return null
}

export function getGameStatus(chess: Chess, externalResult: GameResult | null): GameStatus {
  const result = externalResult ?? getBoardResult(chess)
  if (result) return { kind: 'over', result }
  return { kind: 'playing', turn: chess.turn(), inCheck: chess.inCheck() }
}

const sortByValue = (pieces: PieceSymbol[]): PieceSymbol[] =>
  [...pieces].sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b])

export function getCapturedPieces(history: readonly Move[]): CapturedSummary {
  const w: PieceSymbol[] = []
  const b: PieceSymbol[] = []
  let materialDiff = 0

  for (const move of history) {
    if (move.captured) {
      ;(move.color === 'w' ? w : b).push(move.captured)
      materialDiff += (move.color === 'w' ? 1 : -1) * PIECE_VALUES[move.captured]
    }
    if (move.promotion) {
      // A promotion converts a pawn into a stronger piece.
      materialDiff += (move.color === 'w' ? 1 : -1) * (PIECE_VALUES[move.promotion] - PIECE_VALUES.p)
    }
  }

  return { w: sortByValue(w), b: sortByValue(b), materialDiff }
}

/** Returns true when `color` has enough material to ever deliver checkmate. */
export function hasMatingMaterial(chess: Chess, color: Color): boolean {
  let minors = 0
  for (const row of chess.board()) {
    for (const square of row) {
      if (!square || square.color !== color) continue
      if (square.type === 'p' || square.type === 'r' || square.type === 'q') return true
      if (square.type === 'n' || square.type === 'b') minors += 1
    }
  }
  return minors >= 2
}

export function findKingSquare(chess: Chess, color: Color): Square | null {
  const [square] = chess.findPiece({ type: 'k', color })
  return square ?? null
}

export function isPromotionMove(chess: Chess, from: Square, to: Square): boolean {
  const piece = chess.get(from)
  if (!piece || piece.type !== 'p') return false
  const lastRank = piece.color === 'w' ? '8' : '1'
  if (!to.endsWith(lastRank)) return false
  return chess.moves({ square: from, verbose: true }).some((m) => m.to === to)
}

export function parseUciMove(uci: string): { from: Square; to: Square; promotion?: PieceSymbol } | null {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci)
  if (!match) return null
  const [, from, to, promotion] = match
  return {
    from: from as Square,
    to: to as Square,
    ...(promotion ? { promotion: promotion as PieceSymbol } : {}),
  }
}

export function describeResult(result: GameResult): { title: string; detail: string } {
  switch (result.kind) {
    case 'checkmate':
      return { title: `${colorName(result.winner)} wins`, detail: 'by checkmate' }
    case 'resign':
      return { title: `${colorName(result.winner)} wins`, detail: `${colorName(opposite(result.winner))} resigned` }
    case 'timeout':
      return { title: `${colorName(result.winner)} wins`, detail: 'on time' }
    case 'draw': {
      const reasons: Record<typeof result.reason, string> = {
        stalemate: 'by stalemate',
        threefold: 'by threefold repetition',
        insufficient: 'by insufficient material',
        'fifty-move': 'by the fifty-move rule',
        'timeout-insufficient': 'timeout vs insufficient material',
      }
      return { title: 'Draw', detail: reasons[result.reason] }
    }
  }
}

export function pgnResultToken(result: GameResult | null): string {
  if (!result) return '*'
  if (result.kind === 'draw') return '1/2-1/2'
  return result.winner === 'w' ? '1-0' : '0-1'
}

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms)
  if (clamped < 10_000) {
    // Show tenths of a second when time is running low.
    const seconds = Math.floor(clamped / 1000)
    const tenths = Math.floor((clamped % 1000) / 100)
    return `0:0${seconds}.${tenths}`
  }
  const totalSeconds = Math.ceil(clamped / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const ss = seconds.toString().padStart(2, '0')
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${ss}`
  return `${minutes}:${ss}`
}

/** FEN of the position after `ply` half-moves (0 = starting position). */
export function fenAtPly(history: readonly Move[], ply: number, startFen: string = DEFAULT_POSITION): string {
  if (ply <= 0) return history[0]?.before ?? startFen
  return history[Math.min(ply, history.length) - 1]?.after ?? startFen
}

export const givesCheck = (move: Move): boolean => move.san.includes('+') || move.san.includes('#')

export function uciToSan(fen: string, uci: string): string | null {
  const parsed = parseUciMove(uci)
  if (!parsed) return null
  try {
    return new Chess(fen).move(parsed).san
  } catch {
    return null
  }
}

export const moveToUci = (move: Pick<Move, 'from' | 'to' | 'promotion'>): string => `${move.from}${move.to}${move.promotion ?? ''}`
