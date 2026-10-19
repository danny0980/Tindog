import { ChevronRight, Trophy } from 'lucide-react'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { localDateKey } from '../../utils/date'
import { ROUND_NAMES, currentMatch } from '../../utils/tournament'
import { ArtIcon } from '../ui/ArtIcon'

/** Path-selector card for today's auto-tournament. */
export function TournamentCard({ onOpen }: { onOpen: () => void }) {
  const tournament = useStore(profileStore, (p) => p.tournament)
  const won = useStore(profileStore, (p) => p.tournamentsWon)
  const today = tournament?.date === localDateKey() ? tournament : null
  const pending = today ? currentMatch(today) : null
  const status = !today
    ? 'A fresh 8-player bracket of legends every day'
    : today.status === 'won'
      ? 'Champion today! Come back tomorrow'
      : today.status === 'eliminated'
        ? 'Knocked out today — a new bracket tomorrow'
        : pending
          ? `${ROUND_NAMES[pending.round] ?? 'Next round'} vs ${pending.opponent.name}`
          : 'In progress'
  return (
    <button
      type="button"
      onClick={onOpen}
      data-path="tournament"
      className="glass group relative overflow-hidden rounded-3xl p-5 text-left shadow-[0_30px_80px_-30px_rgba(56,189,248,0.5)] transition duration-300 hover:-translate-y-1 hover:border-white/25 lg:col-span-3"
    >
      <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-gradient-to-br from-sky-300 via-blue-500 to-amber-300 opacity-20 blur-3xl transition group-hover:opacity-35" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-300 via-blue-500 to-amber-300 text-ink-950">
          <ArtIcon slot="tournament" fallback={<Trophy className="size-7" />} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Daily event</div>
          <div className="font-display text-xl font-extrabold tracking-wide text-white">Chronos Tournament</div>
          <div className="text-xs text-slate-400">{status}</div>
        </div>
        <span className="flex items-center gap-1 font-mono text-sm text-slate-300">
          <Trophy className="size-4 text-amber-300" /> {won}
        </span>
        <ChevronRight className="size-5 text-accent transition group-hover:translate-x-1" />
      </div>
    </button>
  )
}
