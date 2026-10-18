import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play, Radio } from 'lucide-react'
import type { TimeMachine as TimeMachineState } from '../../hooks/useTimeMachine'

interface TimeMachineProps {
  machine: TimeMachineState
  total: number
}

/** Video-player style scrubber through the game's history. */
export function TimeMachine({ machine, total }: TimeMachineProps) {
  const { displayPly, isLive, playing, goTo, step, togglePlay } = machine
  const disabled = total === 0
  const button = 'flex size-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-90 disabled:opacity-30'
  return (
    <div className="glass rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={Math.max(1, total)}
          value={displayPly}
          disabled={disabled}
          onChange={(e) => goTo(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer"
          aria-label="Scrub through moves"
        />
        <span className="w-14 text-right font-mono text-[11px] text-slate-400 tabular-nums">
          {displayPly}/{total}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button type="button" className={button} onClick={() => goTo(0)} disabled={disabled || displayPly === 0} aria-label="First move">
            <ChevronFirst className="size-5" />
          </button>
          <button type="button" className={button} onClick={() => step(-1)} disabled={disabled || displayPly === 0} aria-label="Previous move">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" className={`${button} bg-white/5`} onClick={togglePlay} disabled={disabled} aria-label={playing ? 'Pause replay' : 'Replay game'}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button type="button" className={button} onClick={() => step(1)} disabled={disabled || isLive} aria-label="Next move">
            <ChevronRight className="size-5" />
          </button>
          <button type="button" className={button} onClick={() => goTo(null)} disabled={disabled || isLive} aria-label="Last move">
            <ChevronLast className="size-5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => goTo(null)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold tracking-wider transition ${
            isLive ? 'text-accent' : 'bg-accent/15 text-accent hover:bg-accent/25'
          }`}
        >
          <Radio className={`size-3.5 ${isLive ? 'animate-pulse-soft' : ''}`} /> LIVE
        </button>
      </div>
    </div>
  )
}
