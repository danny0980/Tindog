import { useEffect } from 'react'
import type { Persona } from '../../types/persona'
import { PortraitEmblem } from './PortraitEmblem'

const DURATION_MS = 2200

/** Full-screen "time travel" arrival card shown when a character battle begins. */
export function TimeWarpOverlay({ persona, onDone }: { persona: Persona; onDone: () => void }) {
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
      <div className="relative flex animate-warp-in flex-col items-center px-6 text-center">
        <div className="font-mono text-xs tracking-[0.4em] text-accent uppercase">{persona.arrivalCaption}</div>
        <PortraitEmblem spec={persona.portrait} label={persona.name} size="xl" className="mt-4 shadow-[0_0_80px_-10px_var(--accent)]" />
        <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.35em] text-slate-300">{persona.settingName}</div>
        <div className="holo-text font-display text-3xl font-extrabold tracking-wide sm:text-4xl">{persona.name}</div>
        <div className="mt-1 text-sm text-slate-400">{persona.title}</div>
      </div>
    </div>
  )
}
