// The predictive coach. Two halves, both pure and unit-tested:
//   - detect(): the tactical traps a move you're about to play walks into
//     (a piece left hanging, a mate in one, a knight fork);
//   - coachProfile(): which of those traps actually cost you in your saved
//     games (the opponent took the piece, mated you, forked you next move).
// The play screen warns you before a move that repeats your own history.
import { Chess, type Move, type Square } from 'chess.js'
import type { Color, MoveInput } from '../types/chess'
import type { MatchRecord } from '../types/profile'

export type Pattern = 'hangs' | 'back-rank' | 'mate-in-1' | 'fork'

export interface Warning {
  pattern: Pattern
  /** The square of the piece at risk, or where the blow lands. */
  square: Square
  text: string
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }
const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }
const BIG = new Set(['k', 'q', 'r'])

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')

/** Is the piece on `sq` (of `color`) en prise: undefended and attacked, or attacked by something cheaper? */
export function isHanging(chess: Chess, sq: Square, color: Color): boolean {
  const piece = chess.get(sq)
  if (!piece || piece.color !== color || piece.type === 'k') return false
  const attackers = chess.attackers(sq, other(color))
  if (attackers.length === 0) return false
  const defended = chess.attackers(sq, color).length > 0
  const cheapest = Math.min(...attackers.map((a) => VALUE[chess.get(a)?.type ?? 'q'] ?? 9))
  return !defended || cheapest < VALUE[piece.type]!
}

function ownPieces(chess: Chess, color: Color): Array<{ square: Square; type: string }> {
  return chess
    .board()
    .flat()
    .filter((p): p is NonNullable<typeof p> => p !== null && p.color === color)
    .map((p) => ({ square: p.square, type: p.type }))
}

/** The squares a knight on `sq` attacks that hold `color`'s big pieces (king, queen, rook). */
function knightTargets(chess: Chess, sq: Square, color: Color): Square[] {
  const f = sq.charCodeAt(0) - 97
  const r = Number(sq[1])
  const out: Square[] = []
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const) {
    const ff = f + df
    const rr = r + dr
    if (ff < 0 || ff > 7 || rr < 1 || rr > 8) continue
    const t = `${String.fromCharCode(97 + ff)}${rr}` as Square
    const p = chess.get(t)
    if (p && p.color === color && BIG.has(p.type)) out.push(t)
  }
  return out
}

/** Traps the move walks into, worst first (empty when it looks safe). */
export function detect(fen: string, input: MoveInput): Warning[] {
  let chess: Chess
  let move: Move
  try {
    chess = new Chess(fen)
    move = chess.move(input)
  } catch {
    return []
  }
  const me = move.color
  const out: Warning[] = []
  if (chess.isGameOver()) return out

  // A mate in one for the opponent (on the back rank, or anywhere).
  for (const reply of chess.moves({ verbose: true })) {
    chess.move(reply)
    const mate = chess.isCheckmate()
    chess.undo()
    if (mate) {
      const backRank = me === 'w' ? '1' : '8'
      const onBack = reply.to[1] === backRank && (reply.piece === 'r' || reply.piece === 'q')
      out.push({ pattern: onBack ? 'back-rank' : 'mate-in-1', square: reply.to, text: onBack ? `This allows ${reply.san}, a back-rank mate. Give your king an escape square first.` : `This allows ${reply.san}, mate in one.` })
      break
    }
  }

  // A piece left hanging: the moved piece (unless it just traded) or one it stopped protecting.
  const before = new Chess(fen)
  const traded = move.captured ? VALUE[move.captured]! >= VALUE[move.piece]! : false
  let worst: { square: Square; type: string } | null = null
  for (const p of ownPieces(chess, me)) {
    if (VALUE[p.type]! < 3 || p.type === 'k') continue
    if (p.square === move.to && traded) continue
    const wasHanging = p.square !== move.to && isHanging(before, p.square, me)
    if (!wasHanging && isHanging(chess, p.square, me) && (!worst || VALUE[p.type]! > VALUE[worst.type]!)) worst = p
  }
  if (worst) out.push({ pattern: 'hangs', square: worst.square, text: `Your ${NAME[worst.type]} on ${worst.square} would be left hanging.` })

  // A knight fork waiting to happen.
  for (const reply of chess.moves({ verbose: true }).filter((m) => m.piece === 'n')) {
    chess.move(reply)
    const fork = knightTargets(chess, reply.to, me).length >= 2 && !chess.isAttacked(reply.to, me)
    chess.undo()
    if (fork) {
      out.push({ pattern: 'fork', square: reply.to, text: `This lets the knight fork your pieces with ${reply.san}.` })
      break
    }
  }
  return out
}

// ── Your history ─────────────────────────────────────────────────────────────

export type CoachProfile = Record<Pattern, number> & { games: number }

const EMPTY: CoachProfile = { hangs: 0, 'back-rank': 0, 'mate-in-1': 0, fork: 0, games: 0 }

/**
 * How often each trap actually cost you: in your saved games, the opponent's
 * very next move took a hanging piece, mated you, or forked you.
 */
export function coachProfile(matches: ReadonlyArray<Pick<MatchRecord, 'pgn' | 'humanColor' | 'variant'>>): CoachProfile {
  const out = { ...EMPTY }
  for (const m of matches) {
    if (!m.humanColor || m.variant?.length || !m.pgn) continue
    const me = m.humanColor
    let moves: Move[]
    try {
      const c = new Chess()
      c.loadPgn(m.pgn)
      moves = c.history({ verbose: true })
    } catch {
      continue
    }
    out.games += 1
    for (let i = 1; i < moves.length; i++) {
      const reply = moves[i]!
      const mine = moves[i - 1]!
      if (mine.color !== me || reply.color === me) continue
      const after = new Chess(reply.after)
      if (after.isCheckmate()) {
        const backRank = me === 'w' ? '1' : '8'
        out[reply.to[1] === backRank && (reply.piece === 'r' || reply.piece === 'q') ? 'back-rank' : 'mate-in-1'] += 1
        continue
      }
      if (reply.captured && VALUE[reply.captured]! >= 3 && isHanging(new Chess(reply.before), reply.to, me)) out.hangs += 1
      else if (reply.piece === 'n' && knightTargets(after, reply.to, me).length >= 2 && !after.isAttacked(reply.to, me)) out.fork += 1
    }
  }
  return out
}

export type CoachMode = 'off' | 'mine' | 'all'

/** Warnings worth showing: in "mine", only traps that have cost you at least twice before. */
export function warningsFor(found: readonly Warning[], profile: CoachProfile, mode: CoachMode): Warning[] {
  if (mode === 'off') return []
  if (mode === 'all') return [...found]
  return found.filter((w) => profile[w.pattern] >= 2)
}

/** "You lost a piece like this 4 times" — the history behind a warning. */
export function historyNote(w: Warning, profile: CoachProfile): string | null {
  const n = profile[w.pattern]
  if (n < 1) return null
  const what = w.pattern === 'hangs' ? 'a hanging piece' : w.pattern === 'fork' ? 'a knight fork' : w.pattern === 'back-rank' ? 'a back-rank mate' : 'a mate in one'
  return `In your saved games you have lost to ${what} ${n} time${n === 1 ? '' : 's'}.`
}
