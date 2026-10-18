import { Crown, Map as MapIcon, Skull, Swords, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import type { PlayerProfile } from '../../types/profile'
import { buildChronicle } from '../../utils/chronicle'
import { formatShortDate } from '../../utils/date'

const ICON = { victory: Swords, realm: Crown, timeline: MapIcon, ironman: Skull, tournament: Trophy } as const

/** The Chronicles Log: your saga as a lore book. */
export function ChroniclePanel({ profile }: { profile: PlayerProfile }) {
  const c = useMemo(() => buildChronicle(profile), [profile])
  return (
    <div className="space-y-3" data-chronicle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Victories" value={String(c.victories)} />
        <Fact label="Brilliant moves" value={c.brilliantPct !== null ? `${c.brilliantPct}%` : '—'} hint={`${c.brilliantMoves} total`} />
        <Fact label="Timelines" value={`${c.timelinesConquered}/${c.timelinesTotal}`} />
        <Fact label="Realms" value={`${c.realmsConquered.length}/5`} />
      </div>
      <ol className="relative space-y-2 border-l border-amber-300/20 pl-4 font-serif">
        {c.entries.length === 0 && <li className="text-xs text-slate-400">Your chronicle is unwritten. Defeat a legend or a boss to begin it.</li>}
        {c.entries.map((e, i) => {
          const Icon = ICON[e.kind]
          return (
            <li key={`${e.date}-${i}`} className="relative">
              <span className="absolute -left-[1.6rem] top-0.5 flex size-5 items-center justify-center rounded-full bg-ink-900 ring-1 ring-amber-300/40">
                <Icon className="size-3 text-amber-200" />
              </span>
              <div className="text-sm font-semibold text-amber-50">{e.title}</div>
              <div className="text-xs text-slate-400">
                {e.date.startsWith('1970') ? '' : `${formatShortDate(e.date)} · `}
                {e.detail}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-amber-300/[0.06] p-2 text-center ring-1 ring-amber-300/15">
      <div className="font-mono text-lg font-bold text-amber-100">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </div>
  )
}
