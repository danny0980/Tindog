import { Globe, RotateCcw, Trophy } from 'lucide-react'
import { useCallback, useState } from 'react'
import { globalLeaderboard } from '../../services/leaderboard'
import type { LeaderboardEntry } from '../../types/gauntlet'

function Rows({ entries, highlight }: { entries: readonly LeaderboardEntry[]; highlight: string | null }) {
  if (entries.length === 0) return <p className="py-3 text-center text-xs text-slate-500">No runs yet — be the first.</p>
  return (
    <ol className="space-y-1">
      {entries.map((e, i) => (
        <li
          key={e.id}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${e.id === highlight ? 'bg-accent/15 text-white ring-1 ring-accent/50' : 'bg-white/[0.03] text-slate-300'}`}
        >
          <span className={`w-5 text-center font-mono font-bold ${i < 3 ? 'text-amber-300' : 'text-slate-500'}`}>{i + 1}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{e.name}</span>
            {e.title && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent/80">{e.title}</span>}
          </span>
          <span className="text-slate-500">{e.defeated} bosses</span>
          <span className="w-16 text-right font-mono font-bold text-white">{e.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  )
}

/** Local top 10, plus the global board when a server is configured (VITE_LEADERBOARD_URL). */
export function LeaderboardPanel({ local, highlight }: { local: readonly LeaderboardEntry[]; highlight: string | null }) {
  const [tab, setTab] = useState<'local' | 'global'>('local')
  const [global, setGlobal] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; entries: LeaderboardEntry[] }>({ status: 'idle', entries: [] })

  const load = useCallback(() => {
    if (!globalLeaderboard) return
    setGlobal((g) => ({ ...g, status: 'loading' }))
    globalLeaderboard
      .top(10)
      .then((entries) => setGlobal({ status: 'ready', entries }))
      .catch(() => setGlobal((g) => ({ ...g, status: 'error' })))
  }, [])

  const openTab = (t: 'local' | 'global') => {
    setTab(t)
    // Fetch the global board the first time it is opened.
    if (t === 'global' && global.status === 'idle') load()
  }

  return (
    <section className="glass rounded-3xl p-4" aria-label="Leaderboard">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="size-4 text-amber-300" />
        <h3 className="flex-1 text-sm font-bold text-white">Leaderboard</h3>
        <div className="flex rounded-lg bg-white/5 p-0.5 text-xs" role="tablist">
          {(['local', 'global'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => openTab(t)} className={`rounded-md px-2.5 py-1 font-semibold capitalize ${tab === t ? 'bg-accent text-ink-950' : 'text-slate-300'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === 'local' ? (
        <Rows entries={local} highlight={highlight} />
      ) : !globalLeaderboard ? (
        <p className="flex items-start gap-2 rounded-xl bg-white/5 p-3 text-xs text-slate-400">
          <Globe className="mt-0.5 size-4 shrink-0" />
          No global server is configured for this build. Set VITE_LEADERBOARD_URL to a leaderboard endpoint to enable worldwide rankings (see README).
        </p>
      ) : global.status === 'error' ? (
        <div className="space-y-2 text-center">
          <p className="text-xs text-slate-400">The global leaderboard couldn’t be reached.</p>
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
            <RotateCcw className="size-3.5" /> Retry
          </button>
        </div>
      ) : global.status === 'ready' ? (
        <Rows entries={global.entries} highlight={highlight} />
      ) : (
        <p className="py-3 text-center text-xs text-slate-500" role="status">
          Loading…
        </p>
      )}
    </section>
  )
}
