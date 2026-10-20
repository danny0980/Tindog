// Stockfish Brain Visualizer: what the engine is thinking, as it thinks.
// Folds the streamed search lines into the candidate plans at the current
// depth, remembers the plans it has just dropped ("discarded"), and turns
// both into board arrows. Pure and unit-tested; useBrain() feeds it.
import { Chess } from 'chess.js'
import type { EngineLine } from '../types/engine'

export interface BrainLine {
  rank: number
  uci: string
  /** The plan in SAN (first few moves). */
  san: string[]
  /** Score for White, in centipawns (mates as ±(10000 − distance)). */
  cpWhite: number
  /** "+1.4", "−0.3", "M3", "−M2" (White's view). */
  score: string
  depth: number
}

export interface Discarded {
  uci: string
  san: string
  /** The depth at which the engine dropped it. */
  depth: number
  score: string
  /** When it stops being shown (ms timestamp). */
  until: number
}

export interface BrainState {
  fen: string
  depth: number
  lines: BrainLine[]
  discarded: Discarded[]
}

export const EMPTY_BRAIN: BrainState = { fen: '', depth: 0, lines: [], discarded: [] }

/** How long a dropped plan stays on screen. */
export const DISCARD_MS = 2200
const PLAN_LENGTH = 6

export function formatScore(cpWhite: number): string {
  if (Math.abs(cpWhite) >= 9000) {
    const n = 10000 - Math.abs(cpWhite)
    return `${cpWhite < 0 ? '−' : ''}M${n}`
  }
  const v = cpWhite / 100
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`
}

/** A line's plan in SAN (stops at the first move that doesn't parse). */
export function planSan(fen: string, pv: readonly string[], max = PLAN_LENGTH): string[] {
  const out: string[] = []
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return out
  }
  for (const uci of pv.slice(0, max)) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) })
      out.push(m.san)
    } catch {
      break
    }
  }
  return out
}

function toLine(fen: string, line: EngineLine): BrainLine | null {
  const uci = line.pv[0]
  if (!uci) return null
  const white = fen.split(' ')[1] !== 'b'
  const own = line.score.type === 'mate' ? Math.sign(line.score.value || 1) * (10000 - Math.abs(line.score.value)) : line.score.value
  const cpWhite = white ? own : -own
  return { rank: line.multipv, uci, san: planSan(fen, line.pv), cpWhite, score: formatScore(cpWhite), depth: line.depth }
}

/** The next brain state after a streamed update (`now` in ms). */
export function reduceBrain(prev: BrainState, fen: string, raw: readonly EngineLine[], now: number): BrainState {
  const base = prev.fen === fen ? prev : { ...EMPTY_BRAIN, fen }
  const lines = raw
    .map((l) => toLine(fen, l))
    .filter((l): l is BrainLine => l !== null)
    .sort((a, b) => a.rank - b.rank)
  const depth = Math.max(base.depth, ...lines.map((l) => l.depth))
  // Plans that were candidates a moment ago and are not any more.
  const kept = new Set(lines.map((l) => l.uci))
  const dropped: Discarded[] = base.lines
    .filter((l) => !kept.has(l.uci))
    .map((l) => ({ uci: l.uci, san: l.san[0] ?? l.uci, depth, score: l.score, until: now + DISCARD_MS }))
  const discarded = [...base.discarded.filter((d) => d.until > now && !kept.has(d.uci) && !dropped.some((x) => x.uci === d.uci)), ...dropped].slice(-4)
  return { fen, depth, lines, discarded }
}

/** Drops discarded plans whose time is up. */
export const pruneBrain = (s: BrainState, now: number): BrainState => (s.discarded.some((d) => d.until <= now) ? { ...s, discarded: s.discarded.filter((d) => d.until > now) } : s)

export interface BrainArrow {
  from: string
  to: string
  color: string
}

const RANK_RGB = ['52, 211, 153', '251, 191, 36', '125, 211, 252', '196, 181, 253'] as const

/**
 * Arrows for the board: the best plan bright and solid, other candidates
 * fainter the further they trail it, the engine's expected reply as a thin
 * ghost, and dropped plans in red.
 */
export function brainArrows(s: BrainState): BrainArrow[] {
  const best = s.lines[0]
  if (!best) return []
  const out: BrainArrow[] = []
  for (const l of s.lines) {
    const gap = Math.min(300, Math.abs(best.cpWhite - l.cpWhite))
    const alpha = l.rank === 1 ? 0.9 : Math.max(0.25, 0.75 - gap / 400)
    out.push({ from: l.uci.slice(0, 2), to: l.uci.slice(2, 4), color: `rgba(${RANK_RGB[(l.rank - 1) % RANK_RGB.length]}, ${alpha.toFixed(2)})` })
  }
  for (const d of s.discarded) out.push({ from: d.uci.slice(0, 2), to: d.uci.slice(2, 4), color: 'rgba(248, 113, 113, 0.45)' })
  // De-duplicate (react-chessboard keys arrows by squares): the first one wins.
  const seen = new Set<string>()
  return out.filter((a) => {
    const k = `${a.from}${a.to}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
