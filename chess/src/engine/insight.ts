// Turns one analysed move into a short lesson: what the move did to the
// evaluation (from the mover's side), how much winning chance it cost, the
// better move, and a coaching tip for that kind of moment. Pure, so the
// wording is tested.
import type { MoveAnalysis, MoveClassification, PositionEval } from '../types/analysis'
import type { Color } from '../types/chess'

export interface MoveInsight {
  /** "14. Qxf7 — Blunder" */
  title: string
  classification: MoveClassification
  /** Evaluation before → after, from the mover's point of view ("+0.8 → −2.6", "#3"). */
  swing: string
  /** "Cost about 38% of your winning chances." (or praise) */
  verdict: string
  /** The engine's move, when it preferred another. */
  better: string | null
  tip: string
}

/** An evaluation as a player reads it, from `side`'s point of view: "+1.2", "−0.4", "#3" (mate in 3), "#−2". */
export function formatEval(e: PositionEval, side: Color): string {
  const sign = side === 'w' ? 1 : -1
  if (e.mate !== null) {
    const m = e.mate * sign
    return m > 0 ? `#${m}` : `#−${Math.abs(m)}`
  }
  const pawns = (e.cp * sign) / 100
  if (Math.abs(pawns) < 0.05) return '0.0'
  return `${pawns > 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`
}

const TIPS: Record<MoveClassification, string> = {
  brilliant: 'A sacrifice that really works: you gave material for something worth more. Remember the pattern.',
  best: "The engine's own first choice. Exactly right.",
  excellent: 'Very close to perfect: a strong, practical move.',
  good: 'A sound move. A slightly stronger one existed; compare it with the better move shown.',
  book: 'Opening theory: a move masters have played here for generations.',
  forced: 'The only reasonable move in the position.',
  inaccuracy: 'Not a disaster, but it let the advantage slip. Look for moves that improve your worst-placed piece.',
  mistake: 'This handed over real chances. Before moving, ask: what does my opponent want to do next?',
  blunder: 'A game-changing slip. Before every move, check all your opponent’s captures, checks and threats (CCT).',
}

const LABELS: Record<MoveClassification, string> = {
  brilliant: 'Brilliant',
  best: 'Best move',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Book move',
  forced: 'Forced',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

export function moveInsight(m: MoveAnalysis): MoveInsight {
  const number = `${Math.ceil(m.ply / 2)}${m.color === 'w' ? '.' : '…'}`
  const loss = Math.round(m.winChanceLoss)
  const bad = m.classification === 'inaccuracy' || m.classification === 'mistake' || m.classification === 'blunder'
  const verdict = bad
    ? `Cost about ${Math.max(1, loss)}% of your winning chances.`
    : m.classification === 'brilliant' || m.classification === 'best' || m.classification === 'excellent'
      ? 'Kept every bit of your advantage.'
      : loss >= 2
        ? `Gave up about ${loss}% of your winning chances.`
        : 'Kept the balance.'
  return {
    title: `${number} ${m.san} — ${LABELS[m.classification]}`,
    classification: m.classification,
    swing: `${formatEval(m.evalBefore, m.color)} → ${formatEval(m.evalAfter, m.color)}`,
    verdict,
    better: m.bestMoveSan && m.bestMoveSan !== m.san ? m.bestMoveSan : null,
    tip: TIPS[m.classification],
  }
}
