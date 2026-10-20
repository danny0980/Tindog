// Chess variants as a pure game state: Chess960 (Fischer Random), King of the
// Hill and Three-Check. chess.js does the move generation; this layer adds
// what it doesn't know — Chess960 start positions and castling, the variants'
// extra ways to win — and keeps its own position history so repetition
// draws still work after a Chess960 castle reloads the board.
import { Chess, type Square } from 'chess.js'
import type { Color, PieceSymbol } from '../types/chess'

export type VariantId = 'chess960' | 'koth' | 'threecheck' | 'battle' | 'vanish'

export interface VariantInfo {
  id: VariantId
  name: string
  short: string
  rules: string[]
}

export const VARIANTS: Record<VariantId, VariantInfo> = {
  chess960: {
    id: 'chess960',
    name: 'Chess960',
    short: 'Fischer Random: the back rank is shuffled, so opening theory is gone.',
    rules: [
      'The pieces behind the pawns start in one of 960 shuffled orders. The bishops stand on opposite colours and the king sits between the rooks.',
      'Castling still ends with the king on the c- or g-file and the rook beside it. To castle, move your king onto the rook you want to castle with.',
      'Squares between them must be empty, and the king may not be in check or pass through an attacked square.',
    ],
  },
  koth: {
    id: 'koth',
    name: 'King of the Hill',
    short: 'Walk your king to the centre to win.',
    rules: ['All the normal rules apply, and checkmate still wins.', 'You also win the moment your king safely reaches one of the four centre squares: d4, e4, d5 or e5.'],
  },
  battle: {
    id: 'battle',
    name: 'Historic battle',
    short: 'A real battle as a chess position, with its own objective and reinforcements.',
    rules: ['Each battle has its own objective (see the battle card).', 'Reinforcements arrive on the move history says they did.'],
  },
  vanish: {
    id: 'vanish',
    name: 'Vanishing Chess',
    short: 'Pieces fade from view a few moves after they move.',
    rules: ['Ordinary chess rules.', 'Every piece fades a few moves after it last moved, and the fade gets quicker as the game goes on. Three peeks per game show the whole board for a moment.'],
  },
  threecheck: {
    id: 'threecheck',
    name: 'Three-Check',
    short: 'Give check three times to win.',
    rules: ['All the normal rules apply, and checkmate still wins.', 'You also win as soon as you have given check three times. Every check counts, so king safety matters from move one.'],
  },
}

/** The variants on the Variants screen (battles have their own screen). */
export const VARIANT_IDS: readonly VariantId[] = ['chess960', 'koth', 'threecheck']
export const HILL: readonly Square[] = ['d4', 'e4', 'd5', 'e5']
const FILES = 'abcdefgh'

export type VariantResultReason = 'checkmate' | 'hill' | 'three-checks' | 'stalemate' | 'insufficient' | 'threefold' | 'fifty-move' | 'resign' | 'held' | 'attack-failed' | 'field' | 'field-even'

/** A battle's goal, judged after every move (checkmate always wins too). */
export type BattleObjective =
  /** `side` wins by still standing once `until` full moves are complete. */
  | { kind: 'survive'; side: Color; until: number }
  /** `side` must win by move `by`; otherwise the other side has held. */
  | { kind: 'win-by'; side: Color; by: number }
  /** Once `at` full moves are complete, whoever is ahead in material holds the field. */
  | { kind: 'material'; at: number }

/** Reinforcements: pieces that arrive when `color` starts its move number `move` (on empty squares only). */
export interface BattleEvent {
  id: string
  move: number
  color: Color
  pieces: ReadonlyArray<{ square: Square; type: PieceSymbol }>
  text: string
}

export interface BattleRules {
  fen: string
  objective: BattleObjective
  events: readonly BattleEvent[]
}

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Material per side (pawn 1, knight/bishop 3, rook 5, queen 9). */
export function material(chess: Chess): { w: number; b: number } {
  const out = { w: 0, b: 0 }
  for (const row of chess.board()) for (const p of row) if (p) out[p.color] += VALUE[p.type as PieceSymbol]
  return out
}

export interface VariantResult {
  winner: Color | null
  reason: VariantResultReason
}

export interface VMove {
  from: Square
  to: Square
  promotion?: PieceSymbol
  san: string
  /** Chess960 castling ('k' = h-side, 'q' = a-side). */
  castle?: 'k' | 'q'
  /** The move as the engine writes it (Chess960 castles are king-takes-rook). */
  uci: string
}

/** Castling rook files (0–7) still available, per colour and side. */
interface Rights {
  w: { k: number | null; q: number | null }
  b: { k: number | null; q: number | null }
}

// ── Chess960 start positions ───────────────────────────────────────────────

const KNIGHTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],
]

/** The back rank of Chess960 position `id` (0–959, standard numbering; 518 is the normal setup). */
export function chess960Rank(id: number): string {
  if (!Number.isInteger(id) || id < 0 || id > 959) throw new RangeError(`Chess960 position must be 0–959, got ${id}`)
  const rank: Array<string | null> = Array(8).fill(null)
  let n = id
  rank[(n % 4) * 2 + 1] = 'B' // light-squared bishop: b, d, f or h
  n = Math.floor(n / 4)
  rank[(n % 4) * 2] = 'B' // dark-squared bishop: a, c, e or g
  n = Math.floor(n / 4)
  const empty = () => rank.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0)
  rank[empty()[n % 6]!] = 'Q'
  n = Math.floor(n / 6)
  const [k1, k2] = KNIGHTS[n]!
  const free = empty()
  rank[free[k1]!] = 'N'
  rank[free[k2]!] = 'N'
  const [r1, k, r2] = empty()
  rank[r1!] = 'R'
  rank[k!] = 'K'
  rank[r2!] = 'R'
  return rank.join('')
}

export function chess960Fen(id: number): string {
  const rank = chess960Rank(id)
  return `${rank.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${rank} w - - 0 1`
}

// ── The game ────────────────────────────────────────────────────────────────

const STANDARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const sq = (file: number, rank: number): Square => `${FILES[file]}${rank}` as Square
const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w')

export class VariantGame {
  readonly variant: VariantId
  readonly startFen: string
  /** Chess960 position number (null for the other variants). */
  readonly position960: number | null
  private fenNow: string
  private rights: Rights
  private readonly sans: string[] = []
  private readonly ucis: string[] = []
  private readonly keys: string[] = []
  private lastMove: { from: Square; to: Square } | null = null
  readonly checks: { w: number; b: number } = { w: 0, b: 0 }
  private ended: VariantResult | null = null
  /** Battle rules (objective and reinforcements), for historic battles. */
  readonly battle: BattleRules | null = null
  /** Battle events that have happened, in order. */
  readonly fired: string[] = []

  constructor(variant: VariantId, position960 = 518, fen?: string, battle: BattleRules | null = null) {
    this.battle = battle
    this.variant = variant
    this.position960 = variant === 'chess960' ? position960 : null
    this.startFen = variant === 'chess960' ? chess960Fen(position960) : (battle?.fen ?? fen ?? STANDARD)
    this.fenNow = this.startFen
    this.rights = { w: { k: null, q: null }, b: { k: null, q: null } }
    if (variant === 'chess960') {
      const rank = chess960Rank(position960)
      const king = rank.indexOf('K')
      const right = rank.indexOf('R', king)
      const left = rank.lastIndexOf('R', king)
      this.rights = { w: { k: right, q: left }, b: { k: right, q: left } }
    }
    this.keys.push(this.key())
  }

  /** King of the Hill or Three-Check from a given position (standard castling rules). */
  static fromFen(variant: Exclude<VariantId, 'chess960'>, fen: string): VariantGame {
    return new VariantGame(variant, 518, fen)
  }

  /** A historic battle: its position, objective and reinforcements. */
  static battleGame(rules: BattleRules): VariantGame {
    return new VariantGame('battle', 518, rules.fen, rules)
  }

  /** The full-move number now (1 at the start, +1 after each Black move). */
  get moveNumber(): number {
    return Number(this.fenNow.split(' ')[5] ?? 1)
  }

  get fen(): string {
    return this.fenNow
  }
  get turn(): Color {
    return this.board().turn()
  }
  get history(): readonly string[] {
    return this.sans
  }
  get uciHistory(): readonly string[] {
    return this.ucis
  }
  get last(): { from: Square; to: Square } | null {
    return this.lastMove
  }
  get result(): VariantResult | null {
    return this.ended
  }
  get inCheck(): boolean {
    return this.board().inCheck()
  }
  /** chess.js reliably handles castling itself except in Chess960. */
  private get custom(): boolean {
    return this.variant === 'chess960'
  }

  private board(): Chess {
    return new Chess(this.fenNow)
  }

  /** Repetition key: placement, turn, en passant and castling rights. */
  private key(): string {
    const [placement, turn, castling, ep] = this.fenNow.split(' ')
    const r = this.custom ? `${this.rights.w.k ?? '-'}${this.rights.w.q ?? '-'}${this.rights.b.k ?? '-'}${this.rights.b.q ?? '-'}` : castling
    return `${placement} ${turn} ${r} ${ep}`
  }

  /** The FEN to give the engine (Chess960 uses Shredder-FEN castling letters). */
  engineFen(): string {
    if (!this.custom) return this.fenNow
    const parts = this.fenNow.split(' ')
    let castling = ''
    for (const [color, upper] of [['w', true], ['b', false]] as const) {
      for (const side of ['k', 'q'] as const) {
        const file = this.rights[color][side]
        if (file !== null) castling += upper ? FILES[file]!.toUpperCase() : FILES[file]!
      }
    }
    parts[2] = castling || '-'
    return parts.join(' ')
  }

  /** Every legal move in the position. */
  legalMoves(): VMove[] {
    if (this.ended) return []
    const chess = this.board()
    const moves: VMove[] = chess.moves({ verbose: true }).map((m) => ({
      from: m.from,
      to: m.to,
      ...(m.promotion ? { promotion: m.promotion as PieceSymbol } : {}),
      san: m.san,
      uci: `${m.from}${m.to}${m.promotion ?? ''}`,
    }))
    if (this.custom) moves.push(...this.castles(chess))
    return moves
  }

  /** Chess960 castling moves available now. */
  private castles(chess: Chess): VMove[] {
    const color = chess.turn()
    const rank = color === 'w' ? 1 : 8
    const king = chess.board()[8 - rank]?.findIndex((p) => p?.type === 'k' && p.color === color) ?? -1
    if (king < 0 || chess.inCheck()) return []
    const them = opposite(color)
    const out: VMove[] = []
    for (const side of ['k', 'q'] as const) {
      const rook = this.rights[color][side]
      if (rook === null) continue
      const piece = chess.get(sq(rook, rank))
      if (!piece || piece.type !== 'r' || piece.color !== color) continue
      const kingTo = side === 'k' ? 6 : 2
      const rookTo = side === 'k' ? 5 : 3
      // Everything between the king, the rook and their destinations must be empty (bar those two).
      const lo = Math.min(king, rook, kingTo, rookTo)
      const hi = Math.max(king, rook, kingTo, rookTo)
      let clear = true
      for (let f = lo; f <= hi && clear; f++) {
        if (f === king || f === rook) continue
        if (chess.get(sq(f, rank))) clear = false
      }
      if (!clear) continue
      // The king may not pass through, or land on, an attacked square.
      const step = kingTo >= king ? 1 : -1
      let safe = true
      for (let f = king; safe; f += step) {
        if (chess.isAttacked(sq(f, rank), them)) safe = false
        if (f === kingTo) break
      }
      if (!safe) continue
      out.push({ from: sq(king, rank), to: sq(rook, rank), castle: side, san: side === 'k' ? 'O-O' : 'O-O-O', uci: `${sq(king, rank)}${sq(rook, rank)}` })
    }
    return out
  }

  /**
   * Finds the legal move a player means. Chess960 castling is "king onto its
   * own rook" (as engines write it) or, when unambiguous, the king's landing square.
   */
  find(input: { from: string; to: string; promotion?: string | undefined }): VMove | null {
    const moves = this.legalMoves()
    const promo = input.promotion ?? 'q'
    const exact = moves.find((m) => m.from === input.from && m.to === input.to && (!m.promotion || m.promotion === promo))
    if (exact) return exact
    if (!this.custom) return null
    const rank = input.from[1]
    return moves.find((m) => m.castle && m.from === input.from && `${m.castle === 'k' ? 'g' : 'c'}${rank}` === input.to) ?? null
  }

  /** Plays a move (any of: a VMove, {from,to,promotion}, or engine UCI). Returns false if illegal. */
  play(input: VMove | { from: string; to: string; promotion?: string | undefined } | string): boolean {
    if (this.ended) return false
    const wanted = typeof input === 'string' ? { from: input.slice(0, 2), to: input.slice(2, 4), promotion: input[4] } : input
    const move = this.find(wanted)
    if (!move) return false
    const before = this.board()
    const mover = before.turn()
    if (move.castle) this.applyCastle(before, move)
    else {
      before.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) })
      this.fenNow = before.fen()
      if (this.custom) this.updateRights(move, mover)
    }
    this.sans.push(move.san)
    this.ucis.push(move.uci)
    this.lastMove = move.castle ? { from: move.from, to: sq(move.castle === 'k' ? 6 : 2, mover === 'w' ? 1 : 8) } : { from: move.from, to: move.to }
    this.reinforce()
    this.keys.push(this.key())
    const after = this.board()
    if (after.inCheck()) this.checks[mover] += 1
    this.ended = this.judge(after, mover)
    return true
  }

  /**
   * Battle reinforcements due now (the side to move, at this move number).
   * A piece only lands on an empty square, and never where it would leave the
   * waiting side in check (that position would be illegal).
   */
  private reinforce(): void {
    if (!this.battle) return
    const chess = this.board()
    const turn = chess.turn()
    const due = this.battle.events.filter((e) => e.color === turn && e.move === this.moveNumber && !this.fired.includes(e.id))
    if (due.length === 0) return
    const [, , , , half, full] = this.fenNow.split(' ')
    for (const event of due) {
      for (const p of event.pieces) {
        if (chess.get(p.square)) continue
        const before = chess.fen()
        chess.put({ type: p.type, color: event.color }, p.square)
        // The waiting side must not be left in check.
        const waiting = new Chess(chess.fen().replace(/ [wb] /, ` ${opposite(turn)} `), { skipValidation: true })
        if (waiting.inCheck()) chess.load(before, { skipValidation: true })
      }
      this.fired.push(event.id)
    }
    const [placement] = chess.fen().split(' ')
    this.fenNow = `${placement} ${turn} - - ${half ?? 0} ${full ?? 1}`
  }

  private applyCastle(chess: Chess, move: VMove): void {
    const color = chess.turn()
    const rank = color === 'w' ? 1 : 8
    const kingTo = sq(move.castle === 'k' ? 6 : 2, rank)
    const rookTo = sq(move.castle === 'k' ? 5 : 3, rank)
    chess.remove(move.from)
    chess.remove(move.to)
    chess.put({ type: 'k', color }, kingTo)
    chess.put({ type: 'r', color }, rookTo)
    const [placement] = chess.fen().split(' ')
    const [, , , , half, full] = this.fenNow.split(' ')
    const fullmove = Number(full ?? 1) + (color === 'b' ? 1 : 0)
    this.fenNow = `${placement} ${opposite(color)} - - ${Number(half ?? 0) + 1} ${fullmove}`
    this.rights[color] = { k: null, q: null }
  }

  private updateRights(move: VMove, mover: Color): void {
    const homeRank = (c: Color) => (c === 'w' ? '1' : '8')
    // A king move gives up both castles; a rook leaving (or being taken on) its home square gives up that side.
    for (const color of ['w', 'b'] as const) {
      for (const side of ['k', 'q'] as const) {
        const file = this.rights[color][side]
        if (file === null) continue
        const home = sq(file, Number(homeRank(color)))
        if (move.from === home || move.to === home) this.rights[color][side] = null
      }
    }
    if (move.san.startsWith('K')) this.rights[mover] = { k: null, q: null }
  }

  private judge(after: Chess, mover: Color): VariantResult | null {
    const replies = this.legalMoves()
    if (replies.length === 0) return after.inCheck() ? { winner: mover, reason: 'checkmate' } : { winner: null, reason: 'stalemate' }
    if (this.variant === 'koth') {
      const kingOn = HILL.find((s) => {
        const p = after.get(s)
        return p?.type === 'k' && p.color === mover
      })
      if (kingOn) return { winner: mover, reason: 'hill' }
    }
    if (this.variant === 'threecheck' && this.checks[mover] >= 3) return { winner: mover, reason: 'three-checks' }
    if (this.battle) {
      const done = this.moveNumber - 1
      const o = this.battle.objective
      if (o.kind === 'survive' && done >= o.until) return { winner: o.side, reason: 'held' }
      if (o.kind === 'win-by' && done >= o.by) return { winner: opposite(o.side), reason: 'attack-failed' }
      if (o.kind === 'material' && done >= o.at) {
        const m = material(after)
        return m.w === m.b ? { winner: null, reason: 'field-even' } : { winner: m.w > m.b ? 'w' : 'b', reason: 'field' }
      }
    }
    if (after.isInsufficientMaterial()) return { winner: null, reason: 'insufficient' }
    const now = this.keys.at(-1)
    if (this.keys.filter((k) => k === now).length >= 3) return { winner: null, reason: 'threefold' }
    if (Number(this.fenNow.split(' ')[4] ?? 0) >= 100) return { winner: null, reason: 'fifty-move' }
    return null
  }

  resign(loser: Color): void {
    if (!this.ended) this.ended = { winner: opposite(loser), reason: 'resign' }
  }

  /** Whether `move` would win on the spot under the variant's own rules (or by mate). */
  winsAt(move: VMove): boolean {
    const copy = this.clone()
    copy.play(move)
    return copy.result?.winner === this.turn
  }

  clone(): VariantGame {
    const copy = new VariantGame(this.variant, this.position960 ?? 518, this.startFen, this.battle)
    copy.fired.push(...this.fired)
    copy.fenNow = this.fenNow
    copy.rights = { w: { ...this.rights.w }, b: { ...this.rights.b } }
    copy.sans.push(...this.sans)
    copy.ucis.push(...this.ucis)
    copy.keys.splice(0, copy.keys.length, ...this.keys)
    copy.checks.w = this.checks.w
    copy.checks.b = this.checks.b
    copy.lastMove = this.lastMove
    copy.ended = this.ended
    return copy
  }
}

const REASON_TEXT: Record<VariantResultReason, string> = {
  checkmate: 'by checkmate',
  hill: 'by reaching the hill',
  'three-checks': 'by giving three checks',
  stalemate: 'by stalemate',
  insufficient: 'by insufficient material',
  threefold: 'by threefold repetition',
  'fifty-move': 'by the fifty-move rule',
  resign: 'by resignation',
  held: 'by holding out to the end',
  'attack-failed': 'as the attack ran out of time',
  field: 'by holding the field',
  'field-even': 'with the field still contested',
}

export function variantResultText(r: VariantResult, me: Color): string {
  if (r.winner === null) return `Draw ${REASON_TEXT[r.reason]}`
  return `${r.winner === me ? 'You won' : 'You lost'} ${REASON_TEXT[r.reason]}`
}

/** A random Chess960 position number. */
export const random960 = (random: () => number = Math.random): number => Math.floor(random() * 960)
