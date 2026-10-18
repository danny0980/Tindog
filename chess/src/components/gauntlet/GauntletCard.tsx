import { ChevronRight, Infinity as InfinityIcon, Trophy } from 'lucide-react'
import { useStore } from '../../hooks/useStore'
import { gauntletStore } from '../../stores/gauntletStore'
import { formatClock } from '../../utils/chess'

/** Path-selector card for the Endless Gauntlet (shows a run in progress). */
export function GauntletCard({ onOpen }: { onOpen: () => void }) {
  const { run, record } = useStore(gauntletStore, (s) => s)
  const live = run && run.phase !== 'over' ? run : null
  return (
    <button
      type="button"
      onClick={onOpen}
      data-path="gauntlet"
      className="glass group relative overflow-hidden rounded-3xl p-5 text-left shadow-[0_30px_80px_-30px_rgba(217,70,239,0.55)] transition duration-300 hover:-translate-y-1 hover:border-white/25 lg:col-span-3"
    >
      <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-gradient-to-br from-fuchsia-400 via-violet-500 to-cyan-400 opacity-20 blur-3xl transition group-hover:opacity-35" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 via-violet-500 to-cyan-400 text-ink-950">
          <InfinityIcon className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Survival mode</div>
          <div className="font-display text-xl font-extrabold tracking-wide text-white">Endless Gauntlet</div>
          <div className="text-xs text-slate-400">
            {live ? `Run in progress · round ${live.round} · ${formatClock(live.bankMs)} left · score ${live.score.toLocaleString()}` : 'Back-to-back bosses on one carried clock, boons between fights'}
          </div>
        </div>
        <span className="flex items-center gap-1 font-mono text-sm text-slate-300">
          <Trophy className="size-4 text-amber-300" /> {record.bestScore.toLocaleString()}
        </span>
        <ChevronRight className="size-5 text-accent transition group-hover:translate-x-1" />
      </div>
    </button>
  )
}
