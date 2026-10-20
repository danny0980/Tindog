// Card Chess: normal chess, plus three tactical cards each player drafts
// before the game. Each card is played once:
//   Jumping Pawn   — a pawn moves two squares from any rank (both empty);
//   Knight's Leap  — a bishop or rook jumps like a knight;
//   Reinforcements — drop a pawn on an empty square of your second rank (your move);
//   Royal Swap     — your king trades places with a piece next to it (your move);
//   Stone Wall     — one of your rooks can't be captured for 3 enemy moves (free);
//   Aegis          — your queen can't be captured for 2 enemy moves (free).
// chess.js generates the ordinary moves; this layer adds the cards, the
// wards they create, and its own result judgement. Pure and unit-tested.
import { Chess, type Square } from 'chess.js'
import type { Color, PieceSymbol } from '../types/chess'

export type CardId = 'jumping-pawn' | 'knights-leap' | 'reinforcements' | 'royal-swap' | 'stone-wall' | 'aegis'

export interface CardDef {
  id: CardId
  name: string
  text: string
  /** 'move' cards are played as your move; 'ward' cards are free and protect a piece. */
  kind: 'move' | 'drop' | 'ward'
  /** How much the computer likes it when drafting. */
  value: number
}

export const CARDS: Readonly<Record<CardId, CardDef>> = {
  'jumping-pawn': { id: 'jumping-pawn', name: 'Jumping Pawn', text: 'Once, a pawn moves two squares forward from any rank (both squares empty).', kind: 'move', value: 5 },
  'knights-leap': { id: 'knights-leap', name: 'Knight’s Leap', text: 'Once, a bishop or rook jumps like a knight.', kind: 'move', value: 7 },
  reinforcements: { id: 'reinforcements', name: 'Reinforcements', text: 'Once, instead of moving, drop a new pawn on an empty square of your second rank.', kind: 'drop', value: 6 },
  'royal-swap': { id: 'royal-swap', name: 'Royal Swap', text: 'Once, your king trades places with one of your pieces next to it (not into check).', kind: 'move', value: 4 },
  'stone-wall': { id: 'stone-wall', name: 'Stone Wall', text: 'Free action: one of your rooks can’t be captured for the enemy’s next 3 moves.', kind: 'ward', value: 6 },
  aegis: { id: 'aegis', name: 'Aegis', text: 'Free action: your queen can’t be captured for the enemy’s next 2 moves.', kind: 'ward', value: 7 },
}
export const CARD_IDS = Object.keys(CARDS) as CardId[]
export const HAND_SIZE = 3
export const OFFER_SIZE = 5

/** Five cards to draft from (seeded). */
export function offer(random: () => number = Math.random): CardId[] {
  const pool = [...CARD_IDS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, OFFER_SIZE)
}

/** The computer's draft: the three it values most. */
export const aiDraft = (offered: readonly CardId[]): CardId[] => [...offered].sort((a, b) => CARDS[b].value - CARDS[a].value).slice(0, HAND_SIZE)

export interface CardMove {
  card: CardId
  /** For a drop, `from` is null. */
  from: Square | null
  to: Square
  /** For display and logs: "♠Nb3" style notation. */
  label: string
}

export interface Ward {
  color: Color
  square: Square
  /** The ply (number of moves played) at which it lapses. */
  until: number
}

export type CardResultReason = 'checkmate' | 'stalemate' | 'insufficient' | 'threefold' | 'fifty-move' | 'resign'
export interface CardResult {
  winner: Color | null
  reason: CardResultReason
}

export interface GameMove {
  from: string
  to: string
  promotion?: string
}

const STANDARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const FILES = 'abcdefgh'
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
const sq = (f: number, r: number): Square | null => (f >= 0 && f < 8 && r >= 1 && r <= 8 ? (`${FILES[f]}${r}` as Square) : null)
const fileOf = (s: string) => FILES.indexOf(s[0] ?? 'a')
const rankOf = (s: string) => Number(s[1])
const LEAPS: ReadonlyArray<readonly [number, number]> = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const CASTLE_HOMES: ReadonlyArray<readonly [right: string, king: Square, rook: Square, color: Color]> = [
  ['K', 'e1', 'h1', 'w'],
  ['Q', 'e1', 'a1', 'w'],
  ['k', 'e8', 'h8', 'b'],
  ['q', 'e8', 'a8', 'b'],
]
function keptCastling(board: Chess, rights: string): string {
  const at = (sq: Square, type: PieceSymbol, color: Color) => {
    const p = board.get(sq)
    return p?.type === type && p.color === color
  }
  return CASTLE_HOMES.filter(([r, k, rook, c]) => rights.includes(r) && at(k, 'k', c) && at(rook, 'r', c))
    .map(([r]) => r)
    .join('')
}
const WARD_PLIES: Record<'stone-wall' | 'aegis', number> = { 'stone-wall': 6, aegis: 4 }

export class CardGame {
  private fenNow: string
  readonly hands: Record<Color, CardId[]>
  readonly used: Record<Color, CardId[]> = { w: [], b: [] }
  wards: Ward[] = []
  readonly sans: string[] = []
  private readonly keys: string[] = []
  private ended: CardResult | null = null
  lastMove: { from: Square; to: Square } | null = null

  constructor(hands: Record<Color, CardId[]>, fen = STANDARD) {
    this.hands = { w: [...hands.w], b: [...hands.b] }
    this.fenNow = fen
    this.keys.push(this.key())
  }

  get fen(): string {
    return this.fenNow
  }
  get turn(): Color {
    return this.fenNow.split(' ')[1] === 'b' ? 'b' : 'w'
  }
  get ply(): number {
    return this.sans.length
  }
  get result(): CardResult | null {
    return this.ended
  }
  get inCheck(): boolean {
    return new Chess(this.fenNow).inCheck()
  }

  private key(): string {
    return this.fenNow.split(' ').slice(0, 4).join(' ')
  }

  /** Cards `color` can still play. */
  available(color: Color): CardId[] {
    return this.hands[color].filter((c) => !this.used[color].includes(c))
  }

  /** Squares protected from capture by `color`'s wards right now. */
  wardedBy(color: Color): Set<Square> {
    return new Set(this.wards.filter((w) => w.color === color && w.until > this.ply).map((w) => w.square))
  }

  /** Ordinary legal moves (captures of warded pieces removed). */
  legalMoves(): GameMove[] {
    if (this.ended) return []
    const protectedSquares = this.wardedBy(other(this.turn))
    return new Chess(this.fenNow)
      .moves({ verbose: true })
      .filter((m) => !(m.captured && protectedSquares.has(m.to)))
      .map((m) => ({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) }))
  }

  /** The placement after a card move, or null if it would leave the mover's king attacked. */
  private apply(move: CardMove): Chess | null {
    const chess = new Chess(this.fenNow, { skipValidation: true })
    const me = this.turn
    if (move.card === 'reinforcements') chess.put({ type: 'p', color: me }, move.to)
    else if (move.card === 'royal-swap') {
      const king = chess.get(move.from!)
      const piece = chess.get(move.to)
      if (!king || !piece) return null
      chess.remove(move.from!)
      chess.remove(move.to)
      chess.put(piece, move.from!)
      chess.put(king, move.to)
    } else {
      const piece = chess.get(move.from!)
      if (!piece) return null
      chess.remove(move.from!)
      chess.put(piece, move.to)
    }
    // Is the mover's king attacked now?
    const kingSq = chess
      .board()
      .flat()
      .find((p) => p?.type === 'k' && p.color === me)?.square
    if (!kingSq || chess.isAttacked(kingSq, other(me))) return null
    return chess
  }

  /** Card moves available now for the side to move. */
  cardMoves(): CardMove[] {
    if (this.ended) return []
    const me = this.turn
    const chess = new Chess(this.fenNow)
    const cards = this.available(me)
    const out: CardMove[] = []
    const board = chess.board().flat().filter((p): p is NonNullable<typeof p> => p !== null)
    const enemyWards = this.wardedBy(other(me))
    const push = (m: CardMove) => {
      if (this.apply(m)) out.push(m)
    }
    if (cards.includes('jumping-pawn')) {
      const dir = me === 'w' ? 1 : -1
      for (const p of board.filter((x) => x.type === 'p' && x.color === me)) {
        const f = fileOf(p.square)
        const r = rankOf(p.square)
        if (r === (me === 'w' ? 2 : 7)) continue // the ordinary double step
        const one = sq(f, r + dir)
        const two = sq(f, r + 2 * dir)
        // Not onto the last rank (no promotion by card).
        if (!one || !two || chess.get(one) || chess.get(two) || rankOf(two) === (me === 'w' ? 8 : 1)) continue
        push({ card: 'jumping-pawn', from: p.square, to: two, label: `${p.square}–${two}` })
      }
    }
    if (cards.includes('knights-leap')) {
      for (const p of board.filter((x) => (x.type === 'b' || x.type === 'r') && x.color === me)) {
        for (const [df, dr] of LEAPS) {
          const to = sq(fileOf(p.square) + df, rankOf(p.square) + dr)
          if (!to) continue
          const target = chess.get(to)
          if (target && (target.color === me || target.type === 'k' || enemyWards.has(to))) continue
          push({ card: 'knights-leap', from: p.square, to, label: `${p.type.toUpperCase()}${target ? 'x' : ''}${to}` })
        }
      }
    }
    if (cards.includes('reinforcements')) {
      const rank = me === 'w' ? 2 : 7
      for (let f = 0; f < 8; f++) {
        const to = sq(f, rank)!
        if (!chess.get(to)) push({ card: 'reinforcements', from: null, to, label: `+P@${to}` })
      }
    }
    if (cards.includes('royal-swap') && !chess.inCheck()) {
      const king = board.find((x) => x.type === 'k' && x.color === me)
      if (king) {
        for (let df = -1; df <= 1; df++)
          for (let dr = -1; dr <= 1; dr++) {
            const to = sq(fileOf(king.square) + df, rankOf(king.square) + dr)
            const piece = to ? chess.get(to) : undefined
            // Pawns can't land on the first or last rank.
            if (!to || (df === 0 && dr === 0) || !piece || piece.color !== me || (piece.type === 'p' && (rankOf(king.square) === 1 || rankOf(king.square) === 8))) continue
            push({ card: 'royal-swap', from: king.square, to, label: `K⇄${piece.type.toUpperCase()}${to}` })
          }
      }
    }
    return out
  }

  /** Pieces a ward card can protect now. */
  wardTargets(card: 'stone-wall' | 'aegis'): Square[] {
    if (this.ended || !this.available(this.turn).includes(card)) return []
    const type: PieceSymbol = card === 'stone-wall' ? 'r' : 'q'
    return new Chess(this.fenNow)
      .board()
      .flat()
      .filter((p): p is NonNullable<typeof p> => p !== null && p.color === this.turn && p.type === type)
      .map((p) => p.square)
  }

  /** Plays a ward card (a free action: it is still your move). */
  ward(card: 'stone-wall' | 'aegis', square: Square): boolean {
    if (!this.wardTargets(card).includes(square)) return false
    this.used[this.turn].push(card)
    this.wards.push({ color: this.turn, square, until: this.ply + WARD_PLIES[card] })
    return true
  }

  /** Plays an ordinary move. */
  play(input: GameMove): boolean {
    if (this.ended || !this.legalMoves().some((m) => m.from === input.from && m.to === input.to && (m.promotion ?? 'q') === (input.promotion ?? 'q'))) return false
    const chess = new Chess(this.fenNow)
    const m = chess.move({ from: input.from, to: input.to, ...(input.promotion ? { promotion: input.promotion } : { promotion: 'q' }) })
    this.moveWards(m.from, m.to)
    this.commit(chess.fen(), m.san, { from: m.from, to: m.to })
    return true
  }

  /** Plays a card move (it is your move). */
  playCard(move: CardMove): boolean {
    if (this.ended) return false
    const legal = this.cardMoves().find((m) => m.card === move.card && m.from === move.from && m.to === move.to)
    if (!legal) return false
    const after = this.apply(legal)
    if (!after) return false
    const me = this.turn
    this.used[me].push(legal.card)
    if (legal.from) this.moveWards(legal.from, legal.to)
    // Rebuild the FEN: other side to move; a king or rook move by card gives up castling.
    const [placement] = after.fen().split(' ')
    const [, , castling = '-', , half = '0', full = '1'] = this.fenNow.split(' ')
    // A right survives only while its king and rook are still on their home squares (a card can move or capture either).
    const rights = keptCastling(after, castling)
    const resetsClock = legal.card === 'jumping-pawn' || legal.card === 'reinforcements' || legal.label.includes('x')
    const fen = `${placement} ${other(me)} ${rights || '-'} - ${resetsClock ? 0 : Number(half) + 1} ${Number(full) + (me === 'b' ? 1 : 0)}`
    this.commit(fen, `${CARDS[legal.card].name}: ${legal.label}`, legal.from ? { from: legal.from, to: legal.to } : { from: legal.to, to: legal.to })
    return true
  }

  /** A warded piece that moves keeps its ward. */
  private moveWards(from: string, to: string): void {
    this.wards = this.wards.map((w) => (w.square === from ? { ...w, square: to as Square } : w))
  }

  private commit(fen: string, san: string, last: { from: Square; to: Square }): void {
    this.fenNow = fen
    this.sans.push(san)
    this.lastMove = last
    this.keys.push(this.key())
    this.wards = this.wards.filter((w) => w.until > this.ply)
    this.ended = this.judge()
  }

  private judge(): CardResult | null {
    const chess = new Chess(this.fenNow)
    const canMove = this.legalMoves().length > 0 || this.cardMoves().length > 0
    if (!canMove) return chess.inCheck() ? { winner: other(this.turn), reason: 'checkmate' } : { winner: null, reason: 'stalemate' }
    if (chess.isInsufficientMaterial()) return { winner: null, reason: 'insufficient' }
    const now = this.keys.at(-1)
    if (this.keys.filter((k) => k === now).length >= 3) return { winner: null, reason: 'threefold' }
    if (Number(this.fenNow.split(' ')[4] ?? 0) >= 100) return { winner: null, reason: 'fifty-move' }
    return null
  }

  resign(loser: Color): void {
    if (!this.ended) this.ended = { winner: other(loser), reason: 'resign' }
  }

  /** The position after a card move (for the computer to evaluate). */
  fenAfter(move: CardMove): string | null {
    const copy = this.clone()
    return copy.playCard(move) ? copy.fen : null
  }

  clone(): CardGame {
    const c = new CardGame(this.hands, this.fenNow)
    c.used.w.push(...this.used.w)
    c.used.b.push(...this.used.b)
    c.wards = this.wards.map((w) => ({ ...w }))
    c.sans.push(...this.sans)
    c.keys.length = 0
    c.keys.push(...this.keys)
    return c
  }
}
