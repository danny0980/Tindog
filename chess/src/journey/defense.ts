// "Hold the Line": chess tower defence. Waves of enemy pawns (and, later,
// knights) march down the board from the 8th rank. Each turn you move one of
// your pieces as in chess (or recruit a new one with the gold you earn from
// captures). Then every enemy advances: pawns step forward or take
// diagonally, knights leap forward. An enemy that reaches your 1st rank
// breaks through and costs a life. Pure, deterministic and unit-tested.
import { seededRandom } from '../data/spells'

export type DefensePiece = 'p' | 'n' | 'b' | 'r' | 'q'
export type FoeKind = 'p' | 'n'

export interface Unit {
  side: 'me' | 'foe'
  type: DefensePiece
}

/** Board squares "a1"…"h8" → unit. */
export type Grid = Readonly<Record<string, Unit>>

export interface DefenseState {
  grid: Grid
  lives: number
  gold: number
  wave: number
  /** Enemies of the current wave still to arrive. */
  queue: FoeKind[]
  turn: number
  captures: number
  breaches: number
  over: boolean
  seed: number
  /** Squares that changed this turn (for the board's highlight). */
  last: string[]
  log: string[]
}

export const START_LIVES = 3
export const RECRUIT_COST: Readonly<Record<DefensePiece, number>> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
export const BOUNTY: Readonly<Record<FoeKind, number>> = { p: 1, n: 3 }
const FILES = 'abcdefgh'

const sq = (file: number, rank: number): string => `${FILES[file]}${rank}`
const fileOf = (s: string): number => FILES.indexOf(s[0]!)
const rankOf = (s: string): number => Number(s[1])
const onBoard = (f: number, r: number): boolean => f >= 0 && f < 8 && r >= 1 && r <= 8

export function newDefense(seed = 1): DefenseState {
  const grid: Record<string, Unit> = {
    a1: { side: 'me', type: 'r' },
    h1: { side: 'me', type: 'r' },
    c1: { side: 'me', type: 'b' },
    f1: { side: 'me', type: 'n' },
    d2: { side: 'me', type: 'p' },
    e2: { side: 'me', type: 'p' },
  }
  return { grid, lives: START_LIVES, gold: 2, wave: 1, queue: waveFor(1), turn: 0, captures: 0, breaches: 0, over: false, seed, last: [], log: ['Wave 1 is coming. Hold the line!'] }
}

/** The enemies of wave `n`: more each wave, knights from wave 3. */
export function waveFor(n: number): FoeKind[] {
  const pawns = 2 + Math.round(n * 1.5)
  const knights = n >= 3 ? n - 2 : 0
  const out: FoeKind[] = []
  for (let i = 0; i < pawns + knights; i++) out.push(i % 3 === 2 && out.filter((k) => k === 'n').length < knights ? 'n' : 'p')
  while (out.filter((k) => k === 'n').length < knights) out[out.lastIndexOf('p')] = 'n'
  return out
}

/** Your moves for the piece on `from` (chess movement; you can't take your own pieces). */
export function movesFrom(s: DefenseState, from: string): string[] {
  const u = s.grid[from]
  if (!u || u.side !== 'me' || s.over) return []
  const f = fileOf(from)
  const r = rankOf(from)
  const out: string[] = []
  const at = (ff: number, rr: number) => s.grid[sq(ff, rr)]
  if (u.type === 'p') {
    if (onBoard(f, r + 1) && !at(f, r + 1)) out.push(sq(f, r + 1))
    for (const df of [-1, 1]) if (onBoard(f + df, r + 1) && at(f + df, r + 1)?.side === 'foe') out.push(sq(f + df, r + 1))
    return out
  }
  if (u.type === 'n') {
    for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]] as const) {
      if (onBoard(f + df, r + dr) && at(f + df, r + dr)?.side !== 'me') out.push(sq(f + df, r + dr))
    }
    return out
  }
  const dirs: ReadonlyArray<readonly [number, number]> =
    u.type === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : u.type === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
  for (const [df, dr] of dirs) {
    let ff = f + df
    let rr = r + dr
    while (onBoard(ff, rr)) {
      const there = at(ff, rr)
      if (there?.side === 'me') break
      out.push(sq(ff, rr))
      if (there) break
      ff += df
      rr += dr
    }
  }
  return out
}

/** Empty squares on your first two ranks where a recruit may stand. */
export function recruitSquares(s: DefenseState): string[] {
  const out: string[] = []
  for (let r = 1; r <= 2; r++) for (let f = 0; f < 8; f++) if (!s.grid[sq(f, r)]) out.push(sq(f, r))
  return out
}

export type DefenseAction = { kind: 'move'; from: string; to: string } | { kind: 'recruit'; type: DefensePiece; to: string }

/** Plays your action, then the enemy's turn. Returns null for an illegal action. */
export function act(s: DefenseState, a: DefenseAction): DefenseState | null {
  if (s.over) return null
  const grid: Record<string, Unit> = { ...s.grid }
  let gold = s.gold
  let captures = s.captures
  const log: string[] = []
  const last: string[] = []
  if (a.kind === 'move') {
    if (!movesFrom(s, a.from).includes(a.to)) return null
    const taken = grid[a.to]
    if (taken?.side === 'foe') {
      gold += BOUNTY[taken.type as FoeKind] ?? 1
      captures += 1
      log.push(`Captured an enemy ${taken.type === 'n' ? 'knight' : 'pawn'} (+${BOUNTY[taken.type as FoeKind] ?? 1} gold).`)
    }
    grid[a.to] = grid[a.from]!
    delete grid[a.from]
    // A pawn that reaches the far rank is promoted to a queen.
    if (grid[a.to]!.type === 'p' && rankOf(a.to) === 8) {
      grid[a.to] = { side: 'me', type: 'q' }
      log.push('Your pawn reached the far rank and became a queen!')
    }
    last.push(a.from, a.to)
  } else {
    const cost = RECRUIT_COST[a.type]
    if (gold < cost || !recruitSquares(s).includes(a.to)) return null
    gold -= cost
    grid[a.to] = { side: 'me', type: a.type }
    last.push(a.to)
    log.push(`Recruited a ${NAMES[a.type]} for ${cost} gold.`)
  }
  return enemyTurn({ ...s, grid, gold, captures, last, log: [...log] })
}

const NAMES: Readonly<Record<DefensePiece, string>> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' }

function enemyTurn(s: DefenseState): DefenseState {
  const grid: Record<string, Unit> = { ...s.grid }
  let lives = s.lives
  let breaches = s.breaches
  const log = [...s.log]
  const last = [...s.last]
  // Front-most enemies move first, so the column doesn't block itself.
  const foes = Object.keys(grid)
    .filter((k) => grid[k]!.side === 'foe')
    .sort((a, b) => rankOf(a) - rankOf(b))
  for (const from of foes) {
    const u = grid[from]
    if (!u || u.side !== 'foe') continue
    const f = fileOf(from)
    const r = rankOf(from)
    let to: string | null = null
    if (u.type === 'p') {
      const prey = [-1, 1].map((df) => (onBoard(f + df, r - 1) ? sq(f + df, r - 1) : null)).find((t) => t && grid[t]?.side === 'me')
      if (prey) to = prey
      else if (r - 1 >= 1 && !grid[sq(f, r - 1)]) to = sq(f, r - 1)
      else if (r === 1) to = null
    } else {
      // Knights leap to take a piece if they can, else as far forward as possible.
      const jumps = ([[1, -2], [-1, -2], [2, -1], [-2, -1]] as const).filter(([df, dr]) => onBoard(f + df, r + dr)).map(([df, dr]) => sq(f + df, r + dr))
      to = jumps.find((t) => grid[t]?.side === 'me') ?? jumps.filter((t) => !grid[t]).sort((a, b) => rankOf(a) - rankOf(b) || Math.abs(fileOf(a) - 3.5) - Math.abs(fileOf(b) - 3.5))[0] ?? null
    }
    if (!to) continue
    if (grid[to]?.side === 'me') log.push(`An enemy ${u.type === 'n' ? 'knight' : 'pawn'} took your ${NAMES[grid[to]!.type]} on ${to}.`)
    delete grid[from]
    grid[to] = u
    last.push(to)
    if (rankOf(to) === 1) {
      delete grid[to]
      lives -= 1
      breaches += 1
      log.push(`An enemy broke through on ${to}! ${Math.max(0, lives)} li${lives === 1 ? 'fe' : 'ves'} left.`)
    }
  }
  // Reinforcements arrive on the 8th rank: one or two a turn.
  const rng = seededRandom(s.seed * 7919 + s.turn * 31 + s.wave)
  const queue = [...s.queue]
  // Later waves pour in faster.
  const arrivals = Math.min(queue.length, 1 + Math.floor(s.wave / 3) + (s.turn % 2 === 0 ? 1 : 0))
  for (let i = 0; i < arrivals; i++) {
    const free = Array.from({ length: 8 }, (_, f) => sq(f, 8)).filter((t) => !grid[t])
    if (free.length === 0) break
    const at = free[Math.floor(rng() * free.length)]!
    grid[at] = { side: 'foe', type: queue.shift()! }
    last.push(at)
  }
  let wave = s.wave
  let gold = s.gold
  const foesLeft = Object.values(grid).some((u) => u.side === 'foe')
  if (queue.length === 0 && !foesLeft && lives > 0) {
    wave += 1
    gold += 2 + wave
    queue.push(...waveFor(wave))
    log.push(`Wave ${wave - 1} held! +${2 + wave} gold. Wave ${wave} approaches.`)
  }
  const over = lives <= 0
  if (over) log.push(`The line has fallen after ${wave - 1} wave${wave - 1 === 1 ? '' : 's'}.`)
  return { ...s, grid, lives: Math.max(0, lives), breaches, gold, wave, queue, turn: s.turn + 1, over, last, log: log.slice(-6) }
}

/** Waves fully held (the score). */
export const wavesHeld = (s: DefenseState): number => s.wave - 1

/** The best simple move for a hint: a capture of the most advanced enemy, else nothing. */
export function hint(s: DefenseState): DefenseAction | null {
  let best: { a: DefenseAction; score: number } | null = null
  for (const from of Object.keys(s.grid)) {
    if (s.grid[from]?.side !== 'me') continue
    for (const to of movesFrom(s, from)) {
      const t = s.grid[to]
      if (t?.side !== 'foe') continue
      const score = 9 - rankOf(to) + (t.type === 'n' ? 2 : 0)
      if (!best || score > best.score) best = { a: { kind: 'move', from, to }, score }
    }
  }
  return best?.a ?? null
}
