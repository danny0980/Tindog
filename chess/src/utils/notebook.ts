// The Personal Notebook: turns your saved games (and their engine analyses)
// into weaknesses, blunder patterns and opening recommendations. Pure.
import type { GameAnalysis } from '../types/analysis'
import type { Color } from '../types/chess'
import type { MatchRecord } from '../types/profile'
import type { MatchAnalysisSummary } from '../types/rpg'

/** Ply boundaries between game phases (for error statistics). */
export const OPENING_PLIES = 20
export const ENDGAME_PLIES = 60

type PieceKey = keyof MatchAnalysisSummary['blunderPieces']
const PIECE_NAMES: Readonly<Record<PieceKey, string>> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

const pieceOfSan = (san: string): PieceKey => {
  const c = san[0]
  return c === 'K' ? 'k' : c === 'Q' ? 'q' : c === 'R' ? 'r' : c === 'B' ? 'b' : c === 'N' ? 'n' : 'p'
}

/** Compact summary of your moves in an analysed game. */
export function summarizeAnalysis(analysis: GameAnalysis, color: Color): MatchAnalysisSummary {
  const summary: MatchAnalysisSummary = {
    brilliant: 0, best: 0, inaccuracies: 0, mistakes: 0, blunders: 0, moves: 0,
    errorsByPhase: { opening: 0, middlegame: 0, endgame: 0 },
    blunderPieces: {},
  }
  for (const m of analysis.moves) {
    if (m.color !== color) continue
    summary.moves += 1
    if (m.classification === 'brilliant') summary.brilliant += 1
    else if (m.classification === 'best') summary.best += 1
    else if (m.classification === 'inaccuracy') summary.inaccuracies += 1
    else if (m.classification === 'mistake' || m.classification === 'blunder') {
      if (m.classification === 'mistake') summary.mistakes += 1
      else {
        summary.blunders += 1
        const piece = pieceOfSan(m.san)
        summary.blunderPieces[piece] = (summary.blunderPieces[piece] ?? 0) + 1
      }
      const phase = m.ply < OPENING_PLIES ? 'opening' : m.ply < ENDGAME_PLIES ? 'middlegame' : 'endgame'
      summary.errorsByPhase[phase] += 1
    }
  }
  return summary
}

export interface OpeningLine {
  name: string
  color: Color
  games: number
  wins: number
  draws: number
  losses: number
  /** Score in % (win = 1, draw = ½). */
  score: number
}

export interface NotebookInsight {
  tone: 'good' | 'warn' | 'info'
  title: string
  detail: string
}

export interface Notebook {
  games: number
  analysed: number
  openings: OpeningLine[]
  byColor: Record<Color, { games: number; score: number }>
  errorsByPhase: MatchAnalysisSummary['errorsByPhase']
  blunderPieces: Array<{ piece: string; count: number }>
  averageAccuracy: number | null
  timeoutLosses: number
  insights: NotebookInsight[]
  recommendations: string[]
}

/** Openings worth trying when your own record is too thin to judge. */
const STARTER_REPERTOIRE: Readonly<Record<Color, readonly string[]>> = {
  w: ['Italian Game — fast development and a clear plan against e5', 'Queen’s Gambit — solid central control'],
  b: ['Caro-Kann Defence — sturdy against 1.e4', 'Queen’s Gambit Declined — reliable against 1.d4'],
}

const pct = (n: number, d: number): number => (d === 0 ? 0 : Math.round((n / d) * 100))

export function buildNotebook(matches: readonly MatchRecord[]): Notebook {
  const games = matches.filter((m) => m.mode === 'ai' && m.humanColor !== null && m.outcome !== null)
  const openingMap = new Map<string, OpeningLine>()
  const byColor: Record<Color, { games: number; points: number }> = { w: { games: 0, points: 0 }, b: { games: 0, points: 0 } }
  const errorsByPhase = { opening: 0, middlegame: 0, endgame: 0 }
  const pieces: Partial<Record<PieceKey, number>> = {}
  let analysed = 0
  let accuracySum = 0
  let accuracyCount = 0
  let timeoutLosses = 0
  let moves = 0
  let blunders = 0

  for (const m of games) {
    const color = m.humanColor
    if (!color || !m.outcome) continue
    const points = m.outcome === 'win' ? 1 : m.outcome === 'draw' ? 0.5 : 0
    byColor[color].games += 1
    byColor[color].points += points
    if (m.outcome === 'loss' && m.result.kind === 'timeout') timeoutLosses += 1
    if (m.accuracy !== null) {
      accuracySum += m.accuracy
      accuracyCount += 1
    }
    if (m.opening) {
      const key = `${color}:${m.opening}`
      const line = openingMap.get(key) ?? { name: m.opening, color, games: 0, wins: 0, draws: 0, losses: 0, score: 0 }
      const next = {
        ...line,
        games: line.games + 1,
        wins: line.wins + (m.outcome === 'win' ? 1 : 0),
        draws: line.draws + (m.outcome === 'draw' ? 1 : 0),
        losses: line.losses + (m.outcome === 'loss' ? 1 : 0),
      }
      openingMap.set(key, { ...next, score: pct(next.wins + next.draws / 2, next.games) })
    }
    if (m.analysis) {
      analysed += 1
      moves += m.analysis.moves
      blunders += m.analysis.blunders
      errorsByPhase.opening += m.analysis.errorsByPhase.opening
      errorsByPhase.middlegame += m.analysis.errorsByPhase.middlegame
      errorsByPhase.endgame += m.analysis.errorsByPhase.endgame
      for (const [k, n] of Object.entries(m.analysis.blunderPieces) as [PieceKey, number][]) pieces[k] = (pieces[k] ?? 0) + n
    }
  }

  const openings = [...openingMap.values()].sort((a, b) => b.games - a.games || b.score - a.score)
  const blunderPieces = (Object.entries(pieces) as [PieceKey, number][]).map(([k, count]) => ({ piece: PIECE_NAMES[k], count })).sort((a, b) => b.count - a.count)
  const colorScore = (c: Color) => ({ games: byColor[c].games, score: pct(byColor[c].points, byColor[c].games) })

  const insights: NotebookInsight[] = []
  const totalErrors = errorsByPhase.opening + errorsByPhase.middlegame + errorsByPhase.endgame
  if (totalErrors >= 3) {
    const [phase, n] = (Object.entries(errorsByPhase) as [keyof typeof errorsByPhase, number][]).sort((a, b) => b[1] - a[1])[0] ?? ['middlegame', 0]
    const advice: Record<keyof typeof errorsByPhase, string> = {
      opening: 'Slow down in the first ten moves: develop, castle, and check every capture.',
      middlegame: 'Before each move, list your opponent’s checks, captures and threats.',
      endgame: 'Practise king activity and pawn races — Time Rush and puzzles help.',
    }
    insights.push({ tone: 'warn', title: `Most errors come in the ${phase}`, detail: `${pct(n, totalErrors)}% of your mistakes and blunders. ${advice[phase]}` })
  }
  const topPiece = blunderPieces[0]
  if (topPiece && topPiece.count >= 2) {
    insights.push({ tone: 'warn', title: `Your ${topPiece.piece} is your weak spot`, detail: `${topPiece.count} blunders with it. Double-check where it can be attacked before moving it.` })
  }
  if (moves > 0) {
    const rate = (blunders / moves) * 100
    insights.push(
      rate < 3
        ? { tone: 'good', title: 'Clean play', detail: `Only ${rate.toFixed(1)} blunders per 100 moves in analysed games.` }
        : { tone: 'warn', title: 'Blunder rate', detail: `${rate.toFixed(1)} blunders per 100 moves — aim for under 3.` },
    )
  }
  if (timeoutLosses >= 2) insights.push({ tone: 'warn', title: 'Clock trouble', detail: `${timeoutLosses} losses on time. Play a longer time control or bank time early.` })
  const w = colorScore('w')
  const b = colorScore('b')
  if (w.games >= 3 && b.games >= 3 && Math.abs(w.score - b.score) >= 15) {
    const weaker = w.score < b.score ? 'Black' : 'White'
    insights.push({ tone: 'info', title: `Stronger with ${weaker === 'Black' ? 'White' : 'Black'}`, detail: `You score ${Math.max(w.score, b.score)}% vs ${Math.min(w.score, b.score)}% as ${weaker}.` })
  }

  const recommendations: string[] = []
  for (const o of openings.filter((o) => o.games >= 2 && o.score >= 60).slice(0, 2)) recommendations.push(`Keep playing the ${o.name} as ${o.color === 'w' ? 'White' : 'Black'} — ${o.score}% over ${o.games} games.`)
  for (const o of openings.filter((o) => o.games >= 2 && o.score <= 35).slice(0, 2)) recommendations.push(`Review or replace the ${o.name} as ${o.color === 'w' ? 'White' : 'Black'} — only ${o.score}% over ${o.games} games.`)
  for (const color of ['w', 'b'] as const) {
    if (!openings.some((o) => o.color === color && o.games >= 2)) {
      const idea = STARTER_REPERTOIRE[color][0]
      if (idea) recommendations.push(`As ${color === 'w' ? 'White' : 'Black'}, try the ${idea}.`)
    }
  }
  if (analysed === 0 && games.length > 0) recommendations.push('Analyse a few games after playing them — the notebook learns from engine reviews.')

  return {
    games: games.length,
    analysed,
    openings,
    byColor: { w, b },
    errorsByPhase,
    blunderPieces,
    averageAccuracy: accuracyCount > 0 ? Math.round((accuracySum / accuracyCount) * 10) / 10 : null,
    timeoutLosses,
    insights,
    recommendations,
  }
}
