// Chronos variant rules: the handful of rule-bending moves that boss spells
// and battle tactics unlock, implemented at FEN level so every resulting
// position is still a legal chess position for chess.js and Stockfish.
//
//  charge — a pawn steps one square diagonally forward onto an EMPTY square
//           (Berserker Charge, Rally, Vanguard). Reaching the last rank queens.
//  leap   — a knight makes a "camel" leap (3 + 1) over anything, onto an empty
//           square or an enemy piece other than the king (Knight's Boot, Shadow Step).
//  pass   — the side to move loses its turn (Katana Blade). Only when not in check.
//
// Special plies are recorded as synthetic `Move` objects with real before /
// after FENs, so undo, the time machine, analysis and review keep working.
import { Chess, validateFen } from 'chess.js'
import type { Color, Move, PieceSymbol, Square } from '../types/chess'

export type SpecialKind = 'charge' | 'leap' | 'pass'

export interface SpecialMove {
  kind: SpecialKind
  color: Color
  from: Square
  to: Square
  piece: PieceSymbol
  captured?: PieceSymbol
  promotion?: PieceSymbol
  san: string
  /** The ply as a Move (before / after FENs) ready for the game history. */
  move: Move
}

/** Serializable record of a special ply (stored with matches for review). */
export interface VariantEvent {
  ply: number
  kind: SpecialKind
  color: Color
  from: Square
  to: Square
  piece: PieceSymbol
  captured?: PieceSymbol
  promotion?: PieceSymbol
  san: string
  before: string
  after: string
}

type Piece = { type: PieceSymbol; color: Color }

interface ParsedFen {
  board: Map<Square, Piece>
  turn: Color
  castling: string
  half: number
  full: number
}

const FILES = 'abcdefgh'
const PIECES: Readonly<Record<string, PieceSymbol>> = { p: 'p', n: 'n', b: 'b', r: 'r', q: 'q', k: 'k' }

export const toSquare = (file: number, rank: number): Square | null =>
  file >= 0 && file < 8 && rank >= 1 && rank <= 8 ? (`${FILES[file]}${rank}` as Square) : null
const fileOf = (sq: Square): number => FILES.indexOf(sq[0] ?? 'a')
const rankOf = (sq: Square): number => Number(sq[1])

function parseFen(fen: string): ParsedFen {
  const [placement = '', turn = 'w', castling = '-', , half = '0', full = '1'] = fen.split(' ')
  const board = new Map<Square, Piece>()
  placement.split('/').forEach((row, i) => {
    let file = 0
    for (const ch of row) {
      const skip = Number(ch)
      if (skip) {
        file += skip
        continue
      }
      const type = PIECES[ch.toLowerCase()]
      const sq = toSquare(file, 8 - i)
      if (type && sq) board.set(sq, { type, color: ch === ch.toLowerCase() ? 'b' : 'w' })
      file += 1
    }
  })
  return { board, turn: turn === 'b' ? 'b' : 'w', castling, half: Number(half) || 0, full: Number(full) || 1 }
}

function buildFen(p: ParsedFen): string {
  const rows: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let row = ''
    let empty = 0
    for (let file = 0; file < 8; file++) {
      const sq = toSquare(file, rank)
      const piece = sq ? p.board.get(sq) : undefined
      if (!piece) {
        empty += 1
        continue
      }
      if (empty) row += String(empty)
      empty = 0
      row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type
    }
    rows.push(row + (empty ? String(empty) : ''))
  }
  return `${rows.join('/')} ${p.turn} ${p.castling || '-'} - ${p.half} ${p.full}`
}

/** Castling rights lost when a piece leaves or is captured on a corner / king square. */
function stripCastling(castling: string, touched: readonly Square[]): string {
  const lose: Record<string, string> = { e1: 'KQ', h1: 'K', a1: 'Q', e8: 'kq', h8: 'k', a8: 'q' }
  let rights = castling === '-' ? '' : castling
  for (const sq of touched) for (const r of lose[sq] ?? '') rights = rights.replace(r, '')
  return rights || '-'
}

const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w')

/** Square of `color`'s king in a position. */
export function kingSquare(fen: string, color: Color): Square | null {
  for (const [sq, piece] of parseFen(fen).board) if (piece.type === 'k' && piece.color === color) return sq
  return null
}

/** Whether `color`'s king is attacked in `fen` (regardless of whose turn it is). */
export function isKingAttacked(fen: string, color: Color): boolean {
  const king = kingSquare(fen, color)
  if (!king) return false
  try {
    return new Chess(fen, { skipValidation: true }).isAttacked(king, opposite(color))
  } catch {
    return false
  }
}

function syntheticMove(kind: SpecialKind, color: Color, from: Square, to: Square, piece: PieceSymbol, before: string, after: string, captured?: PieceSymbol, promotion?: PieceSymbol): SpecialMove | null {
  if (!validateFen(after).ok) return null
  // The mover may never leave its own king in check.
  if (isKingAttacked(after, color)) return null
  let suffix = ''
  try {
    const next = new Chess(after)
    suffix = next.isCheckmate() ? '#' : next.inCheck() ? '+' : ''
  } catch {
    return null
  }
  const letter = piece === 'p' ? '' : piece.toUpperCase()
  const san =
    kind === 'pass' ? '--' : `${letter}${from}~${captured ? 'x' : ''}${to}${promotion ? `=${promotion.toUpperCase()}` : ''}${suffix}`
  const move: Move = {
    color,
    from,
    to,
    piece,
    ...(captured ? { captured } : {}),
    ...(promotion ? { promotion } : {}),
    flags: kind === 'pass' ? 'z' : captured ? 'xc' : 'x',
    san,
    lan: kind === 'pass' ? '--' : `${from}${to}${promotion ?? ''}`,
    before,
    after,
    isCapture: () => captured !== undefined,
    isPromotion: () => promotion !== undefined,
    isEnPassant: () => false,
    isKingsideCastle: () => false,
    isQueensideCastle: () => false,
    isBigPawn: () => false,
  }
  return { kind, color, from, to, piece, ...(captured ? { captured } : {}), ...(promotion ? { promotion } : {}), san, move }
}

function relocate(p: ParsedFen, from: Square, to: Square, color: Color, piece: Piece, isPawn: boolean, captured: Piece | undefined): ParsedFen {
  const board = new Map(p.board)
  board.delete(from)
  board.set(to, piece)
  return {
    board,
    turn: opposite(color),
    castling: stripCastling(p.castling, captured ? [from, to] : [from]),
    half: isPawn || captured ? 0 : p.half + 1,
    full: color === 'b' ? p.full + 1 : p.full,
  }
}

/** Diagonal non-capturing pawn steps ("charges") available to `color`. Only when it's `color`'s turn. */
export function generateCharges(fen: string, color: Color): SpecialMove[] {
  const p = parseFen(fen)
  if (p.turn !== color) return []
  const dir = color === 'w' ? 1 : -1
  const out: SpecialMove[] = []
  for (const [from, piece] of p.board) {
    if (piece.type !== 'p' || piece.color !== color) continue
    for (const df of [-1, 1]) {
      const to = toSquare(fileOf(from) + df, rankOf(from) + dir)
      if (!to || p.board.has(to)) continue
      const lastRank = rankOf(to) === (color === 'w' ? 8 : 1)
      const placed: Piece = lastRank ? { type: 'q', color } : piece
      const after = buildFen(relocate(p, from, to, color, placed, true, undefined))
      const special = syntheticMove('charge', color, from, to, 'p', fen, after, undefined, lastRank ? 'q' : undefined)
      if (special) out.push(special)
    }
  }
  return out
}

const CAMEL: ReadonlyArray<readonly [number, number]> = [
  [1, 3], [3, 1], [-1, 3], [-3, 1], [1, -3], [3, -1], [-1, -3], [-3, -1],
]

/** Camel leaps (3 + 1) for `color`'s knights onto empty squares or enemy non-king pieces. */
export function generateLeaps(fen: string, color: Color): SpecialMove[] {
  const p = parseFen(fen)
  if (p.turn !== color) return []
  const out: SpecialMove[] = []
  for (const [from, piece] of p.board) {
    if (piece.type !== 'n' || piece.color !== color) continue
    for (const [df, dr] of CAMEL) {
      const to = toSquare(fileOf(from) + df, rankOf(from) + dr)
      if (!to) continue
      const target = p.board.get(to)
      if (target && (target.color === color || target.type === 'k')) continue
      const after = buildFen(relocate(p, from, to, color, piece, false, target))
      const special = syntheticMove('leap', color, from, to, 'n', fen, after, target?.type)
      if (special) out.push(special)
    }
  }
  return out
}

/** The side to move skips its turn. Null when it is in check (a pass would be illegal). */
export function passTurn(fen: string): SpecialMove | null {
  const p = parseFen(fen)
  if (isKingAttacked(fen, p.turn)) return null
  const king = kingSquare(fen, p.turn)
  if (!king) return null
  const after = buildFen({ ...p, turn: opposite(p.turn), half: p.half + 1, full: p.turn === 'b' ? p.full + 1 : p.full })
  return syntheticMove('pass', p.turn, king, king, 'k', fen, after)
}

/** Rebuilds a special ply from its stored record (match review). */
export function specialFromEvent(e: VariantEvent): SpecialMove | null {
  const all = e.kind === 'charge' ? generateCharges(e.before, e.color) : e.kind === 'leap' ? generateLeaps(e.before, e.color) : [passTurn(e.before)]
  return all.find((s) => s !== null && s.from === e.from && s.to === e.to && s.move.after === e.after) ?? null
}

export const toVariantEvent = (special: SpecialMove, ply: number): VariantEvent => ({
  ply,
  kind: special.kind,
  color: special.color,
  from: special.from,
  to: special.to,
  piece: special.piece,
  ...(special.captured ? { captured: special.captured } : {}),
  ...(special.promotion ? { promotion: special.promotion } : {}),
  san: special.san,
  before: special.move.before,
  after: special.move.after,
})

export const isSpecialMove = (move: Pick<Move, 'flags'>): boolean => move.flags.includes('x') || move.flags.includes('z')

// ── Frozen squares ───────────────────────────────────────────────────────────

/** Squares a move passes through or lands on (knights only land; castling covers the king's path). */
export function pathSquares(move: Pick<Move, 'from' | 'to' | 'piece' | 'flags'>): Square[] {
  if (move.flags.includes('k') || move.flags.includes('q')) {
    const rank = rankOf(move.from)
    const files = move.flags.includes('k') ? [5, 6] : [3, 2, 1]
    return files.map((f) => toSquare(f, rank)).filter((s): s is Square => s !== null)
  }
  if (move.piece === 'n') return [move.to]
  const df = Math.sign(fileOf(move.to) - fileOf(move.from))
  const dr = Math.sign(rankOf(move.to) - rankOf(move.from))
  const out: Square[] = []
  let f = fileOf(move.from) + df
  let r = rankOf(move.from) + dr
  for (let guard = 0; guard < 8; guard++) {
    const sq = toSquare(f, r)
    if (!sq) break
    out.push(sq)
    if (sq === move.to) break
    f += df
    r += dr
  }
  return out
}

export const crossesFrozen = (move: Pick<Move, 'from' | 'to' | 'piece' | 'flags'>, frozen: Square | null): boolean =>
  frozen !== null && pathSquares(move).includes(frozen)

// ── Repetition ───────────────────────────────────────────────────────────────

/** Position identity for repetition: placement, side to move, castling, en passant. */
export const positionKey = (fen: string): string => fen.split(' ').slice(0, 4).join(' ')

/** How many times the current position has occurred in a game (counting the start). */
export function repetitionCount(history: readonly Pick<Move, 'before' | 'after'>[], fen: string): number {
  const key = positionKey(fen)
  const first = history[0]
  let count = first && positionKey(first.before) === key ? 1 : 0
  for (const m of history) if (positionKey(m.after) === key) count += 1
  return Math.max(1, count)
}
