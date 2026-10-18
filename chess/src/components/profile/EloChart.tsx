import { useId } from 'react'
import type { EloPoint } from '../../types/profile'

interface EloChartProps {
  points: readonly EloPoint[]
}

const W = 600
const H = 180
const PAD = { top: 14, right: 12, bottom: 22, left: 40 }

/** Rating history line chart with a gradient fill and min/max guides. */
export function EloChart({ points }: EloChartProps) {
  const gradientId = useId()
  if (points.length < 2) {
    return <div className="flex h-44 items-center justify-center rounded-xl bg-white/[0.03] text-sm text-slate-500">Play rated games to build your rating graph.</div>
  }
  const values = points.map((p) => p.elo)
  const min = Math.min(...values) - 20
  const max = Math.max(...values) + 20
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.elo).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${PAD.top + innerH} L${PAD.left},${PAD.top + innerH} Z`
  const ticks = [max - 20, Math.round((max + min) / 2), min + 20]
  const last = points[points.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label="Elo rating history">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgba(148,163,184,0.15)" strokeDasharray="4 4" />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="rgb(148,163,184)" fontFamily="JetBrains Mono, monospace">
            {Math.round(t)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={x(points.length - 1)} cy={y(last.elo)} r="5" fill="var(--accent)" stroke="#0b0d12" strokeWidth="2" />}
      <text x={PAD.left} y={H - 4} fontSize="11" fill="rgb(100,116,139)">
        {points.length} rated games
      </text>
    </svg>
  )
}
