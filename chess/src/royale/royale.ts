// Battle Royale: four-player free-for-all chess on the cross-shaped 14 × 14
// board. Red (you), Blue, Yellow and Green move in turn, clockwise. There is
// no check: a king can be captured, and a player whose king falls (or who
// has no move) is out; their army turns grey and stays on the board as
// rubble. Captures score points; the last king standing wins, or, after 100
// rounds, the most points among the survivors. Pawns promote to queens on
// reaching the middle of the board. No castling or en passant.
// Pure and unit-tested; the computer players live in chooseRoyaleMove().

export type PlayerId = 'red' | 'blue' | 'yellow' | 'green'
export const PLAYERS: readonly PlayerId[] = ['red', 'blue', 'yellow', 'green']
export type RType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export interface RPiece {
  owner: PlayerId | 'dead'
  type: RType
}

export type Pos = readonly [row: number, col: number]

export interface RMove {
  from: Pos
  to: Pos
  /** The piece taken, if any. */
  captured: RPiece | null
  promotion: boolean
}

export const SIZE = 14
export const MAX_PLIES = 400
/** Points for taking a piece; a king is worth the most. Rubble is worth nothing. */
export const POINTS: Record<RType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 20 }

/** Squares cut from the corners of the board. */
export const onBoard = (r: number, c: number): boolean => r >= 0 && r < SIZE && c >= 0 && c < SIZE && !((r < 3 || r > 10) && (c < 3 || c > 10))

/** Each army's forward direction, pawn start line and promotion line. */
const FORWARD: Record<PlayerId, Pos> = { red: [-1, 0], blue: [0, 1], yellow: [1, 0], green: [0, -1] }
const PAWN_START: Record<PlayerId, (p: Pos) => boolean> = { red: ([r]) => r === 12, blue: ([, c]) => c === 1, yellow: ([r]) => r === 1, green: ([, c]) => c === 12 }
const PROMOTES: Record<PlayerId, (p: Pos) => boolean> = { red: ([r]) => r === 6, blue: ([, c]) => c === 7, yellow: ([r]) => r === 7, green: ([, c]) => c === 6 }

const KNIGHT: readonly Pos[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const DIAG: readonly Pos[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const ORTHO: readonly Pos[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]

export function initialBoard(): Array<Array<RPiece | null>> {
  const b: Array<Array<RPiece | null>> = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null))
  const back: readonly RType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
  const backMirror: readonly RType[] = ['r', 'n', 'b', 'k', 'q', 'b', 'n', 'r']
  for (let i = 0; i < 8; i++) {
    b[13]![3 + i] = { owner: 'red', type: back[i]! }
    b[12]![3 + i] = { owner: 'red', type: 'p' }
    b[0]![3 + i] = { owner: 'yellow', type: backMirror[i]! }
    b[1]![3 + i] = { owner: 'yellow', type: 'p' }
    b[3 + i]![0] = { owner: 'blue', type: back[i]! }
    b[3 + i]![1] = { owner: 'blue', type: 'p' }
    b[3 + i]![13] = { owner: 'green', type: backMirror[i]! }
    b[3 + i]![12] = { owner: 'green', type: 'p' }
  }
  return b
}

export interface RoyaleResult {
  winner: PlayerId
  /** Everyone, first to last. */
  ranking: PlayerId[]
  reason: 'last-king' | 'points'
}

export class RoyaleGame {
  board: Array<Array<RPiece | null>>
  turn: PlayerId = 'red'
  ply = 0
  readonly points: Record<PlayerId, number> = { red: 0, blue: 0, yellow: 0, green: 0 }
  /** Players knocked out, in order. */
  readonly out: PlayerId[] = []
  result: RoyaleResult | null = null
  last: RMove | null = null

  constructor(board = initialBoard()) {
    this.board = board
  }

  at([r, c]: Pos): RPiece | null {
    return onBoard(r, c) ? (this.board[r]![c] ?? null) : null
  }

  alive(p: PlayerId): boolean {
    return !this.out.includes(p)
  }

  /** Squares a piece attacks (pawns: their diagonals only). */
  private targets(from: Pos, piece: RPiece, attacksOnly: boolean): Pos[] {
    const [r, c] = from
    const out: Pos[] = []
    if (piece.owner === 'dead') return out
    const owner = piece.owner
    const free = (p: Pos) => onBoard(p[0], p[1]) && this.at(p) === null
    const enemy = (p: Pos) => {
      const t = this.at(p)
      return t !== null && t.owner !== owner
    }
    if (piece.type === 'p') {
      const [dr, dc] = FORWARD[owner]
      const diagonals: Pos[] = dr !== 0 ? [[r + dr, c - 1], [r + dr, c + 1]] : [[r - 1, c + dc], [r + 1, c + dc]]
      for (const d of diagonals) if (onBoard(d[0], d[1]) && (attacksOnly || enemy(d))) out.push(d)
      if (attacksOnly) return out
      const one: Pos = [r + dr, c + dc]
      if (free(one)) {
        out.push(one)
        const two: Pos = [r + 2 * dr, c + 2 * dc]
        if (PAWN_START[owner](from) && free(two)) out.push(two)
      }
      return out
    }
    if (piece.type === 'n' || piece.type === 'k') {
      const steps = piece.type === 'n' ? KNIGHT : [...DIAG, ...ORTHO]
      for (const [dr, dc] of steps) {
        const p: Pos = [r + dr, c + dc]
        if (onBoard(p[0], p[1]) && (attacksOnly || free(p) || enemy(p))) out.push(p)
      }
      return out
    }
    const dirs = piece.type === 'b' ? DIAG : piece.type === 'r' ? ORTHO : [...DIAG, ...ORTHO]
    for (const [dr, dc] of dirs) {
      let p: Pos = [r + dr, c + dc]
      while (onBoard(p[0], p[1])) {
        const t = this.at(p)
        if (t === null) out.push(p)
        else {
          if (attacksOnly || t.owner !== owner) out.push(p)
          break
        }
        p = [p[0] + dr, p[1] + dc]
      }
    }
    return out
  }

  /** Every move `player` can make (kings may walk into danger: there is no check). */
  movesFor(player: PlayerId): RMove[] {
    const out: RMove[] = []
    if (!this.alive(player)) return out
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const piece = this.board[r]![c]
        if (!piece || piece.owner !== player) continue
        for (const to of this.targets([r, c], piece, false)) {
          const captured = this.at(to)
          if (captured && captured.owner === player) continue
          out.push({ from: [r, c], to, captured, promotion: piece.type === 'p' && PROMOTES[player](to) })
        }
      }
    return out
  }

  /** Is `pos` attacked by any live player other than `player`? */
  attacked(pos: Pos, player: PlayerId): boolean {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const piece = this.board[r]![c]
        if (!piece || piece.owner === 'dead' || piece.owner === player) continue
        if (this.targets([r, c], piece, true).some(([tr, tc]) => tr === pos[0] && tc === pos[1])) return true
      }
    return false
  }

  kingOf(player: PlayerId): Pos | null {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (this.board[r]![c]?.owner === player && this.board[r]![c]?.type === 'k') return [r, c]
    return null
  }

  private knockOut(player: PlayerId): void {
    if (!this.alive(player)) return
    this.out.push(player)
    for (const row of this.board) for (let c = 0; c < SIZE; c++) if (row[c]?.owner === player) row[c] = { owner: 'dead', type: row[c]!.type }
  }

  private nextTurn(): void {
    const order = PLAYERS
    let i = order.indexOf(this.turn)
    for (let n = 0; n < 4; n++) {
      i = (i + 1) % 4
      const p = order[i]!
      if (!this.alive(p)) continue
      // A player with nothing to move is out.
      if (this.movesFor(p).length === 0) {
        this.knockOut(p)
        continue
      }
      this.turn = p
      return
    }
  }

  private judge(): void {
    const alive = PLAYERS.filter((p) => this.alive(p))
    if (alive.length === 1) {
      this.result = { winner: alive[0]!, ranking: [alive[0]!, ...[...this.out].reverse()], reason: 'last-king' }
      return
    }
    if (this.ply >= MAX_PLIES) {
      const standing = [...alive].sort((a, b) => this.points[b] - this.points[a])
      this.result = { winner: standing[0]!, ranking: [...standing, ...[...this.out].reverse()], reason: 'points' }
    }
  }

  /** Plays a move for the player to move. Returns false if it isn't one of their moves. */
  play(move: Pick<RMove, 'from' | 'to'>): boolean {
    if (this.result) return false
    const legal = this.movesFor(this.turn).find((m) => m.from[0] === move.from[0] && m.from[1] === move.from[1] && m.to[0] === move.to[0] && m.to[1] === move.to[1])
    if (!legal) return false
    const piece = this.at(legal.from)!
    const captured = this.at(legal.to)
    if (captured && captured.owner !== 'dead') {
      this.points[this.turn] += POINTS[captured.type]
      if (captured.type === 'k') this.knockOut(captured.owner)
    }
    this.board[legal.to[0]]![legal.to[1]] = legal.promotion ? { owner: piece.owner, type: 'q' } : piece
    this.board[legal.from[0]]![legal.from[1]] = null
    this.last = legal
    this.ply += 1
    this.judge()
    if (!this.result) {
      this.nextTurn()
      this.judge()
    }
    return true
  }

  /** Resigning: you are out. */
  resign(player: PlayerId): void {
    if (this.result || !this.alive(player)) return
    this.knockOut(player)
    if (this.turn === player) this.nextTurn()
    this.judge()
  }

  clone(): RoyaleGame {
    const g = new RoyaleGame(this.board.map((row) => row.map((p) => (p ? { ...p } : null))))
    g.turn = this.turn
    g.ply = this.ply
    Object.assign(g.points, this.points)
    g.out.push(...this.out)
    g.result = this.result
    return g
  }
}

export type RoyaleLevel = 'easy' | 'normal' | 'hard'

/**
 * A computer player's move: greedy, with a look at the danger. Captures by
 * value (a king above all), promotions, escapes from attack, never leaving
 * its own king en prise if it can help it; "hard" also checks that a capture
 * isn't simply recaptured.
 */
export function chooseRoyaleMove(game: RoyaleGame, player: PlayerId, level: RoyaleLevel, random: () => number = Math.random): RMove | null {
  const moves = game.movesFor(player)
  if (moves.length === 0) return null
  const noise = level === 'easy' ? 6 : level === 'normal' ? 2 : 0.5
  let best: RMove | null = null
  let bestScore = -Infinity
  for (const m of moves) {
    const piece = game.at(m.from)!
    const value = POINTS[piece.type]
    let score = 0
    if (m.captured && m.captured.owner !== 'dead') score += m.captured.type === 'k' ? 1000 : POINTS[m.captured.type] * 10
    if (m.promotion) score += 80
    // Toward the centre (gently).
    score += (6.5 - (Math.abs(m.to[0] - 6.5) + Math.abs(m.to[1] - 6.5)) / 2) * 0.3
    if (level !== 'easy') {
      const after = game.clone()
      after.board[m.to[0]]![m.to[1]] = m.promotion ? { owner: player, type: 'q' } : piece
      after.board[m.from[0]]![m.from[1]] = null
      const king = after.kingOf(player)
      if (king && after.attacked(king, player)) score -= 2000
      const wasAttacked = game.attacked(m.from, player)
      const nowAttacked = after.attacked(m.to, player)
      if (nowAttacked) score -= value * (level === 'hard' ? 9 : 7)
      else if (wasAttacked) score += value * 5
    }
    score += random() * noise
    if (score > bestScore) {
      bestScore = score
      best = m
    }
  }
  return best
}
