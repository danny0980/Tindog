import { evalBarFraction, formatEval } from '../../engine/scoring'
import type { PositionEval } from '../../types/analysis'
import type { Color } from '../../types/chess'

interface EvalBarProps {
  evaluation: PositionEval | null
  orientation: Color
  /** Horizontal layout for narrow screens. */
  horizontal?: boolean
}

/** Stockfish-driven advantage bar; White's share grows from White's side of the board. */
export function EvalBar({ evaluation, orientation, horizontal = false }: EvalBarProps) {
  const fraction = evaluation ? evalBarFraction(evaluation) : 0.5
  const label = evaluation ? formatEval(evaluation) : '…'
  const whiteAhead = (evaluation?.cp ?? 0) >= 0
  const whitePct = `${(fraction * 100).toFixed(1)}%`

  if (horizontal) {
    const whiteOnLeft = orientation === 'w'
    return (
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/10" role="meter" aria-label={`Evaluation ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
        <div
          className="absolute inset-y-0 bg-gradient-to-r from-slate-100 to-white transition-[width] duration-700 ease-out"
          style={{ width: whitePct, [whiteOnLeft ? 'left' : 'right']: 0 }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-accent/70" />
      </div>
    )
  }

  // Vertical: White's portion sits at the bottom when White is at the bottom.
  const whiteAtBottom = orientation === 'w'
  return (
    <div
      className="relative w-3.5 shrink-0 self-stretch overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/10 sm:w-5"
      role="meter"
      aria-label={`Evaluation ${label}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
    >
      <div
        className="absolute inset-x-0 bg-gradient-to-t from-slate-200 to-white shadow-[0_0_16px_rgba(255,255,255,0.4)] transition-[height] duration-700 ease-out"
        style={{ height: whitePct, [whiteAtBottom ? 'bottom' : 'top']: 0 }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px bg-accent/80" />
      <span
        className={`absolute inset-x-0 hidden text-center font-mono text-[8px] font-bold tracking-tighter sm:block ${
          whiteAhead === whiteAtBottom ? 'bottom-1 text-slate-800' : 'top-1 text-slate-200'
        }`}
      >
        {label.replace('+', '')}
      </span>
    </div>
  )
}
