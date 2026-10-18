import { Flame, Gauge, Timer, Trophy } from 'lucide-react'
import { DIFFICULTIES } from '../../constants/game'
import type { Difficulty } from '../../types/chess'
import { formatClock } from '../../utils/chess'

interface RushHudProps {
  timeLeft: number
  score: number
  combo: number
  round: number
  difficulty: Difficulty
  best: number
}

/** Arcade heads-up display: countdown, score, combo meter and round. */
export function RushHud({ timeLeft, score, combo, round, difficulty, best }: RushHudProps) {
  const urgent = timeLeft < 15_000
  const comboPct = Math.min(100, (combo / 8) * 100)
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-3xl font-bold tabular-nums ring-1 transition-colors ${
            urgent ? 'idle-pause animate-urgent bg-red-500/90 text-white ring-red-300/60' : 'bg-white/5 text-white ring-white/10'
          }`}
          role="timer"
          aria-label="Time left"
        >
          <Timer className="size-6" /> {formatClock(timeLeft)}
        </div>
        <div className="min-w-0 flex-1 text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Score</div>
          <div className="holo-text font-display text-3xl font-extrabold tabular-nums">{score.toLocaleString()}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-white/[0.04] py-1.5">
          <div className="flex items-center justify-center gap-1 text-slate-400">
            <Gauge className="size-3.5" /> Round
          </div>
          <div className="font-bold text-white">
            {round} · {DIFFICULTIES.find((d) => d.id === difficulty)?.label}
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.04] py-1.5">
          <div className="flex items-center justify-center gap-1 text-slate-400">
            <Flame className={`size-3.5 ${combo >= 3 ? 'text-orange-300' : ''}`} /> Combo
          </div>
          <div className={`font-mono font-bold ${combo >= 3 ? 'text-orange-300' : 'text-white'}`}>×{(1 + Math.min(combo, 8) * 0.25).toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-white/[0.04] py-1.5">
          <div className="flex items-center justify-center gap-1 text-slate-400">
            <Trophy className="size-3.5" /> Best
          </div>
          <div className="font-mono font-bold text-white">{best.toLocaleString()}</div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full bg-gradient-to-r from-orange-400 to-accent-2 transition-[width] duration-300" style={{ width: `${comboPct}%` }} />
      </div>
    </div>
  )
}
