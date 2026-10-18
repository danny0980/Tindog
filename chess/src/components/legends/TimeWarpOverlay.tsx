import { useEffect } from 'react'
import { getLegend } from '../../data/historicalLegends'
import type { Epoch, LegendId } from '../../types/legend'
import { LegendPortrait } from './LegendPortrait'

const DURATION_MS = 2200

/** Full-screen "time travel" arrival card shown when a legend battle begins. */
export function TimeWarpOverlay({ epoch, legendId, onDone }: { epoch: Epoch; legendId: LegendId; onDone: () => void }) {
  const legend = getLegend(legendId)
  useEffect(() => {
    const id = window.setTimeout(onDone, DURATION_MS)
    return () => window.clearTimeout(id)
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[58] flex animate-warp-out items-center justify-center overflow-hidden bg-black/80 backdrop-blur-sm"
      onClick={onDone}
      role="presentation"
      aria-live="polite"
    >
      <div className="absolute inset-0 animate-warp-tunnel bg-[repeating-radial-gradient(circle_at_center,transparent_0_18px,color-mix(in_oklab,var(--accent)_35%,transparent)_19px_21px)]" aria-hidden="true" />
      <div className="relative flex animate-warp-in flex-col items-center text-center">
        <div className="font-mono text-xs tracking-[0.4em] text-accent">{epoch.year < 0 ? `${Math.abs(epoch.year)} BCE` : `AD ${epoch.year}`}</div>
        <LegendPortrait legendId={legendId} size="xl" className="mt-4 shadow-[0_0_80px_-10px_var(--accent)]" />
        <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.35em] text-slate-300">{epoch.name}</div>
        <div className="holo-text font-display text-3xl font-extrabold tracking-wide sm:text-4xl">{legend.name}</div>
        <div className="mt-1 text-sm text-slate-400">{legend.title}</div>
      </div>
    </div>
  )
}
