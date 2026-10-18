import { Volume2, VolumeX } from 'lucide-react'
import type { GameMode, TimeControl } from '../types/chess'

interface HeaderProps {
  mode: GameMode
  difficultyLabel: string
  timeControl: TimeControl
  soundEnabled: boolean
  onToggleSound: () => void
}

export function Header({ mode, difficultyLabel, timeControl, soundEnabled, onToggleSound }: HeaderProps) {
  return (
    <header className="safe-px mx-auto flex w-full max-w-6xl items-center gap-3 py-3">
      <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 text-xl text-ink-950 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.8)]">
        <span aria-hidden="true">♞</span>
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-extrabold leading-tight tracking-tight text-white">Chess Arena</h1>
        <p className="truncate text-xs text-slate-400">
          {mode === 'ai' ? `vs Stockfish · ${difficultyLabel}` : 'Local pass & play'} ·{' '}
          {timeControl.initialMs > 0 ? timeControl.label : 'Untimed'}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggleSound}
        className="glass flex size-10 items-center justify-center rounded-xl text-slate-300 transition hover:text-white active:scale-95"
        aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        aria-pressed={soundEnabled}
      >
        {soundEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
      </button>
    </header>
  )
}
