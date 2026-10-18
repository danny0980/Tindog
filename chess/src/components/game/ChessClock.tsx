import { Timer } from 'lucide-react'
import { formatClock } from '../../utils/chess'

interface ChessClockProps {
  timeMs: number
  active: boolean
  initialMs: number
  size?: 'md' | 'lg'
}

export function ChessClock({ timeMs, active, initialMs, size = 'md' }: ChessClockProps) {
  const low = timeMs < Math.min(20_000, initialMs * 0.1)
  const flagged = timeMs <= 0
  const tone = flagged
    ? 'bg-red-500/25 text-red-200 ring-red-400/50'
    : active
      ? low
        ? 'bg-red-500/90 text-white ring-red-300/60 shadow-[0_0_24px_-4px_rgba(239,68,68,0.8)] animate-tension'
        : 'bg-slate-100 text-slate-900 ring-white/70 shadow-[0_0_24px_-6px_var(--accent)]'
      : 'bg-white/5 text-slate-400 ring-white/10'

  return (
    <div
      className={`flex items-center justify-end gap-1.5 rounded-lg font-mono font-bold tabular-nums ring-1 transition-all duration-300 ${
        size === 'lg' ? 'min-w-[7rem] px-3 py-2 text-2xl' : 'min-w-[5.75rem] px-2.5 py-1.5 text-lg sm:text-xl'
      } ${tone}`}
      role="timer"
      aria-live={active && low ? 'polite' : 'off'}
    >
      <Timer className={`size-4 ${active ? 'animate-pulse-soft' : 'opacity-50'}`} aria-hidden="true" />
      {formatClock(timeMs)}
    </div>
  )
}
