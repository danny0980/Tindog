// Learning tools built from your own games: the mentor's diagnosis and
// seven-day plan, the weekly report, and puzzles made from your mistakes.
// Pure and unit-tested (the engine pass that finds mistakes lives in the UI).
import { Chess } from 'chess.js'
import type { Color } from '../types/chess'
import type { MatchRecord } from '../types/profile'
import { weekKey } from './league'
import type { MistakePuzzle } from './state'

// ── Mentor ─────────────────────────────────────────────────────────────────

export type Focus = 'openings' | 'tactics' | 'endgames' | 'time' | 'black' | 'consistency'

export interface Diagnosis {
  focus: Focus
  title: string
  /** What the numbers say, in a sentence. */
  evidence: string
  /** Games the diagnosis rests on. */
  games: number
}

export const FOCUS_INFO: Readonly<Record<Focus, { title: string; advice: string }>> = {
  openings: { title: 'Your openings', advice: 'Too many games go wrong in the first 15 moves. Learn one opening for White and one defence for Black, and stick with them.' },
  tactics: { title: 'Tactics and blunders', advice: 'Pieces are being left hanging. Before every move, ask: what does my move leave undefended, and what can they take?' },
  endgames: { title: 'Endgames', advice: 'Good positions are slipping away late in the game. The basic endgames win games you have already earned.' },
  time: { title: 'The clock', advice: 'You are losing on time. Spend less time on easy moves early, and keep a reserve for the critical moments.' },
  black: { title: 'Playing Black', advice: 'Your results with Black are much worse than with White. A solid defence will even them out.' },
  consistency: { title: 'Consistency', advice: 'No big weakness stands out. Keep a daily habit: one puzzle, one game, one review.' },
}

const humanOf = (m: MatchRecord): Color | null => m.humanColor

/** Finds your biggest weakness from your recent games against the computer and the characters. */
export function diagnose(matches: readonly MatchRecord[]): Diagnosis {
  const games = matches.filter((m) => m.mode === 'ai' && m.outcome !== null).slice(0, 40)
  const n = games.length
  if (n < 3) return { focus: 'consistency', title: FOCUS_INFO.consistency.title, evidence: 'Play a few more games and the mentor will find your patterns.', games: n }
  const losses = games.filter((m) => m.outcome === 'loss')
  const scores: Array<{ focus: Focus; score: number; evidence: string }> = []
  const timeLosses = losses.filter((m) => m.result.kind === 'timeout').length
  if (timeLosses > 0) scores.push({ focus: 'time', score: timeLosses / n * 3, evidence: `${timeLosses} of your last ${n} games were lost on time.` })
  const quick = losses.filter((m) => m.plies <= 40).length
  if (quick > 0) scores.push({ focus: 'openings', score: quick / n * 2.2, evidence: `${quick} of your losses were over within 20 moves.` })
  const long = losses.filter((m) => m.plies >= 80).length
  if (long > 0) scores.push({ focus: 'endgames', score: long / n * 2.4, evidence: `${long} of your losses came after move 40.` })
  const analysed = games.filter((m) => m.analysis)
  if (analysed.length > 0) {
    const blunders = analysed.reduce((s, m) => s + (m.analysis?.blunders ?? 0), 0) / analysed.length
    const phase = analysed.reduce((acc, m) => ({ opening: acc.opening + (m.analysis?.errorsByPhase.opening ?? 0), middlegame: acc.middlegame + (m.analysis?.errorsByPhase.middlegame ?? 0), endgame: acc.endgame + (m.analysis?.errorsByPhase.endgame ?? 0) }), { opening: 0, middlegame: 0, endgame: 0 })
    if (blunders >= 1) scores.push({ focus: 'tactics', score: blunders * 0.6, evidence: `About ${blunders.toFixed(1)} blunders per analysed game.` })
    const worst = (Object.entries(phase) as Array<[keyof typeof phase, number]>).sort((a, b) => b[1] - a[1])[0]
    if (worst && worst[1] > analysed.length) {
      const focus: Focus = worst[0] === 'opening' ? 'openings' : worst[0] === 'endgame' ? 'endgames' : 'tactics'
      scores.push({ focus, score: worst[1] / analysed.length / 2, evidence: `Most of your mistakes come in the ${worst[0]}.` })
    }
  }
  const asWhite = games.filter((m) => humanOf(m) === 'w')
  const asBlack = games.filter((m) => humanOf(m) === 'b')
  const rate = (xs: MatchRecord[]) => (xs.length === 0 ? 0 : xs.filter((m) => m.outcome === 'win').length / xs.length)
  if (asWhite.length >= 3 && asBlack.length >= 3 && rate(asWhite) - rate(asBlack) >= 0.25) {
    scores.push({ focus: 'black', score: (rate(asWhite) - rate(asBlack)) * 2, evidence: `You win ${Math.round(rate(asWhite) * 100)}% with White but ${Math.round(rate(asBlack) * 100)}% with Black.` })
  }
  const top = scores.sort((a, b) => b.score - a.score)[0]
  if (!top || top.score < 0.25) return { focus: 'consistency', title: FOCUS_INFO.consistency.title, evidence: `${n} recent games without one clear weakness.`, games: n }
  return { focus: top.focus, title: FOCUS_INFO[top.focus].title, evidence: top.evidence, games: n }
}

export type PlanTask = 'puzzles' | 'endgame' | 'opening' | 'mistakes' | 'game' | 'review' | 'rush'

export interface PlanDay {
  day: number
  title: string
  task: PlanTask
}

const PLANS: Readonly<Record<Focus, readonly PlanTask[]>> = {
  openings: ['opening', 'game', 'opening', 'review', 'opening', 'game', 'review'],
  tactics: ['puzzles', 'mistakes', 'rush', 'puzzles', 'game', 'mistakes', 'review'],
  endgames: ['endgame', 'endgame', 'game', 'endgame', 'review', 'endgame', 'game'],
  time: ['rush', 'game', 'rush', 'review', 'game', 'rush', 'game'],
  black: ['opening', 'game', 'review', 'opening', 'game', 'mistakes', 'game'],
  consistency: ['puzzles', 'game', 'review', 'endgame', 'game', 'mistakes', 'game'],
}

const TASK_TITLE: Readonly<Record<PlanTask, string>> = {
  puzzles: 'Solve the daily puzzles',
  endgame: 'Play an endgame lesson',
  opening: 'Study an opening in the Opening School',
  mistakes: 'Solve puzzles from your own mistakes',
  game: 'Play a slow game (10 minutes or more)',
  review: 'Analyse one of your games',
  rush: 'Play a Time Rush run',
}

export function sevenDayPlan(focus: Focus): PlanDay[] {
  return PLANS[focus].map((task, i) => ({ day: i + 1, title: TASK_TITLE[task], task }))
}

// ── Weekly report ──────────────────────────────────────────────────────────

export interface WeeklyReport {
  week: string
  games: number
  wins: number
  draws: number
  losses: number
  eloChange: number | null
  bestOpening: { name: string; score: number; games: number } | null
  accuracy: number | null
  /** The most common way you lost, in words. */
  commonLoss: string | null
  /** Ratings through the week, oldest first. */
  ratings: number[]
}

/** A report for the week starting `week` (a Monday key) from your saved games. */
export function weeklyReport(matches: readonly MatchRecord[], week: string): WeeklyReport {
  const games = matches.filter((m) => m.outcome !== null && weekKey(new Date(m.date)) === week).slice().reverse()
  const wins = games.filter((m) => m.outcome === 'win').length
  const draws = games.filter((m) => m.outcome === 'draw').length
  const losses = games.filter((m) => m.outcome === 'loss').length
  const rated = games.filter((m) => m.rated && m.eloBefore !== null && m.eloAfter !== null)
  const eloChange = rated.length > 0 ? Math.round((rated[rated.length - 1]!.eloAfter ?? 0) - (rated[0]!.eloBefore ?? 0)) : null
  const byOpening = new Map<string, { score: number; games: number }>()
  for (const m of games) {
    if (!m.opening) continue
    const e = byOpening.get(m.opening) ?? { score: 0, games: 0 }
    byOpening.set(m.opening, { score: e.score + (m.outcome === 'win' ? 1 : m.outcome === 'draw' ? 0.5 : 0), games: e.games + 1 })
  }
  const best = [...byOpening.entries()].filter(([, v]) => v.games >= 1).sort((a, b) => b[1].score / b[1].games - a[1].score / a[1].games || b[1].games - a[1].games)[0]
  const acc = games.filter((m) => m.accuracy !== null)
  const lost = games.filter((m) => m.outcome === 'loss')
  const kinds = [
    { text: 'losing on time', n: lost.filter((m) => m.result.kind === 'timeout').length },
    { text: 'getting mated early', n: lost.filter((m) => m.result.kind === 'checkmate' && m.plies <= 50).length },
    { text: 'resigning lost positions', n: lost.filter((m) => m.result.kind === 'resign').length },
    { text: 'long games slipping away', n: lost.filter((m) => m.plies >= 80).length },
  ].sort((a, b) => b.n - a.n)
  return {
    week,
    games: games.length,
    wins,
    draws,
    losses,
    eloChange,
    bestOpening: best ? { name: best[0], score: best[1].score, games: best[1].games } : null,
    accuracy: acc.length > 0 ? Math.round(acc.reduce((s, m) => s + (m.accuracy ?? 0), 0) / acc.length) : null,
    commonLoss: kinds[0] && kinds[0].n > 0 ? kinds[0].text : null,
    ratings: rated.map((m) => Math.round(m.eloAfter ?? 0)),
  }
}

// ── Puzzles from your mistakes ─────────────────────────────────────────────

/** A mistake costs at least this much (centipawns, from the mover's side). */
export const MISTAKE_SWING = 180

export interface PlyEval {
  /** Centipawns for White before the move. */
  before: number
  /** Centipawns for White after it. */
  after: number
  /** The engine's best move in the position before (UCI). */
  best: string | null
}

/**
 * Picks your worst moves in a game. `evals[i]` describes ply i (0-based);
 * only your moves count, and only real swings that the best move avoids.
 */
export function mistakesIn(match: Pick<MatchRecord, 'id' | 'pgn' | 'humanColor' | 'opponent' | 'date'>, evals: readonly (PlyEval | null)[], limit = 3): MistakePuzzle[] {
  if (!match.humanColor) return []
  const chess = new Chess()
  try {
    chess.loadPgn(match.pgn)
  } catch {
    return []
  }
  const history = chess.history({ verbose: true })
  const sign = match.humanColor === 'w' ? 1 : -1
  const found: MistakePuzzle[] = []
  history.forEach((m, i) => {
    const e = evals[i]
    if (!e || m.color !== match.humanColor || !e.best) return
    const swing = (e.before - e.after) * sign
    // Skip "mistakes" in positions that stay completely winning.
    if (swing < MISTAKE_SWING || e.before * sign > 900) return
    if (e.best === `${m.from}${m.to}${m.promotion ?? ''}`) return
    found.push({ id: `${match.id}:${i}`, fen: m.before, best: e.best, played: m.san, swing: Math.round(swing), opponent: match.opponent, date: match.date })
  })
  return found.sort((a, b) => b.swing - a.swing).slice(0, limit)
}

/** Whether `uci` solves a mistake puzzle: the engine's move, or one that mates. */
export function solvesMistake(p: MistakePuzzle, uci: string): boolean {
  if (uci.slice(0, 4) === p.best.slice(0, 4)) return true
  const chess = new Chess(p.fen)
  try {
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' })
  } catch {
    return false
  }
  return chess.isCheckmate()
}
