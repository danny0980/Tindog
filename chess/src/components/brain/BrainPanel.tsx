import { BrainCircuit, Loader2, XCircle } from 'lucide-react'
import type { BrainState } from '../../brain/brain'
import { BRAIN_DEPTH } from '../../brain/useBrain'

const RANK_TEXT = ['text-emerald-300', 'text-amber-300', 'text-sky-300', 'text-violet-300']

/** What Stockfish is thinking: depth, candidate plans and the plans it just dropped. */
export function BrainPanel({ state, status }: { state: BrainState; status: string }) {
  const pct = Math.min(100, Math.round((state.depth / BRAIN_DEPTH) * 100))
  return (
    <div className="space-y-2" data-brain-panel data-brain-depth={state.depth}>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
        <BrainCircuit className="size-3.5" /> Engine brain
        <span className="ml-auto font-mono text-slate-400">
          depth {state.depth}/{BRAIN_DEPTH}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-label={`Search depth ${state.depth} of ${BRAIN_DEPTH}`}>
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      {state.lines.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          {status === 'error' ? 'The engine could not start.' : (<><Loader2 className="size-3.5 animate-spin" /> Thinking…</>)}
        </p>
      ) : (
        <ol className="space-y-1">
          {state.lines.map((l) => (
            <li key={l.rank} className="flex items-baseline gap-2 rounded-lg bg-white/[0.04] px-2 py-1 text-xs" data-brain-line={l.rank}>
              <span className={`w-12 shrink-0 font-mono font-bold ${RANK_TEXT[(l.rank - 1) % RANK_TEXT.length]}`}>{l.score}</span>
              <span className="truncate font-mono text-slate-200">{l.san.join(' ')}</span>
            </li>
          ))}
        </ol>
      )}
      {state.discarded.length > 0 && (
        <ul className="space-y-0.5" aria-label="Plans the engine dropped">
          {state.discarded.map((d) => (
            <li key={`${d.uci}-${d.depth}`} className="flex items-center gap-1.5 text-[11px] text-red-300/80">
              <XCircle className="size-3 shrink-0" /> {d.san} dropped at depth {d.depth} ({d.score})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
