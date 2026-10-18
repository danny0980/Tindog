import { type PointerEvent, useId } from 'react'
import { winChance } from '../../engine/scoring'
import type { MoveAnalysis, PositionEval } from '../../types/analysis'
import { CLASSIFICATION_META } from '../../constants/classifications'

interface EvalGraphProps {
  evals: readonly PositionEval[]
  totalPlies: number
  currentPly: number
  moves?: readonly MoveAnalysis[]
  onSelect: (ply: number) => void
}

const W = 300
const H = 80

/** Advantage-over-time area chart (White above the midline). Click to jump. */
export function EvalGraph({ evals, totalPlies, currentPly, moves, onSelect }: EvalGraphProps) {
  const gradientId = useId()
  const span = Math.max(1, totalPlies)
  const x = (ply: number) => (ply / span) * W
  const y = (e: PositionEval) => H - (winChance(e.cp) / 100) * H
  const points = evals.map((e, i) => `${x(i).toFixed(1)},${y(e).toFixed(1)}`)
  const area = points.length > 1 ? `M0,${H} L${points.join(' L')} L${x(evals.length - 1).toFixed(1)},${H} Z` : ''
  const line = points.length > 1 ? `M${points.join(' L')}` : ''
  const markers = (moves ?? []).filter((m) => m.classification === 'blunder' || m.classification === 'mistake' || m.classification === 'brilliant')

  const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    onSelect(Math.round(Math.max(0, Math.min(1, ratio)) * span))
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-20 w-full cursor-crosshair touch-none overflow-visible rounded-lg bg-slate-950 ring-1 ring-white/10"
      onPointerDown={handlePointer}
      role="img"
      aria-label="Evaluation graph"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" stopOpacity="0.95" />
          <stop offset="1" stopColor="#cbd5e1" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="rgba(148,163,184,0.35)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      {markers.map((m) => {
        const e = evals[m.ply]
        if (!e) return null
        return <circle key={m.ply} cx={x(m.ply)} cy={y(e)} r="3" fill={CLASSIFICATION_META[m.classification].color} stroke="#0b0d12" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      })}
      <line x1={x(currentPly)} x2={x(currentPly)} y1="0" y2={H} stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
