import { BookOpen, CircleAlert, CircleCheck, Info } from 'lucide-react'
import { useMemo } from 'react'
import { profileStore } from '../../stores/profileStore'
import type { MatchRecord } from '../../types/profile'
import { buildNotebook } from '../../utils/notebook'

const TONE = {
  good: { Icon: CircleCheck, cls: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' },
  warn: { Icon: CircleAlert, cls: 'border-amber-300/30 bg-amber-300/10 text-amber-100' },
  info: { Icon: Info, cls: 'border-sky-300/30 bg-sky-400/10 text-sky-100' },
} as const

/** Personal notebook: weaknesses, blunder patterns, opening scorecard, advice and your own notes. */
export function NotebookPanel({ matches, notes }: { matches: readonly MatchRecord[]; notes: string }) {
  const book = useMemo(() => buildNotebook(matches), [matches])
  const phases = book.errorsByPhase
  const phaseMax = Math.max(1, phases.opening, phases.middlegame, phases.endgame)
  return (
    <div className="space-y-3" data-notebook>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Cell label="Games" value={String(book.games)} />
        <Cell label="Analysed" value={String(book.analysed)} />
        <Cell label="Avg accuracy" value={book.averageAccuracy !== null ? `${book.averageAccuracy}%` : '—'} />
      </div>

      {book.insights.length > 0 ? (
        <div className="space-y-1.5">
          {book.insights.map((i) => {
            const { Icon, cls } = TONE[i.tone]
            return (
              <div key={i.title} className={`flex gap-2 rounded-xl border p-2.5 text-xs ${cls}`}>
                <Icon className="mt-0.5 size-4 shrink-0" />
                <div>
                  <div className="font-bold">{i.title}</div>
                  <div className="opacity-90">{i.detail}</div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-white/5 p-3 text-xs text-slate-400">Play and analyse a few games against the engine — the notebook will spot your patterns.</p>
      )}

      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Errors by phase</div>
        {(['opening', 'middlegame', 'endgame'] as const).map((p) => (
          <div key={p} className="flex items-center gap-2 text-xs">
            <span className="w-20 capitalize text-slate-400">{p}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
              <span className="block h-full rounded-full bg-gradient-to-r from-amber-300 to-red-400" style={{ width: `${(phases[p] / phaseMax) * 100}%` }} />
            </span>
            <span className="w-6 text-right font-mono text-slate-300">{phases[p]}</span>
          </div>
        ))}
        {book.blunderPieces.length > 0 && (
          <div className="mt-1 text-[11px] text-slate-400">Blunders by piece: {book.blunderPieces.map((b) => `${b.piece} ${b.count}`).join(' · ')}</div>
        )}
      </div>

      {book.openings.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Opening scorecard</div>
          <div className="space-y-1">
            {book.openings.slice(0, 8).map((o) => (
              <div key={`${o.color}:${o.name}`} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1 text-xs">
                <span className={`size-2.5 shrink-0 rounded-full ${o.color === 'w' ? 'bg-slate-100' : 'bg-slate-700 ring-1 ring-slate-400'}`} />
                <span className="min-w-0 flex-1 truncate text-slate-200">{o.name}</span>
                <span className="font-mono text-slate-400">
                  {o.wins}-{o.draws}-{o.losses}
                </span>
                <span className={`w-10 text-right font-mono font-bold ${o.score >= 60 ? 'text-emerald-300' : o.score <= 35 ? 'text-red-300' : 'text-slate-200'}`}>{o.score}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {book.recommendations.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Recommendations</div>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-300">
            {book.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <label className="block">
        <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          <BookOpen className="size-3" /> Your notes
        </span>
        <textarea
          defaultValue={notes}
          maxLength={4000}
          rows={4}
          placeholder="Plans, ideas, lines to study…"
          onBlur={(e) => {
            const text = e.currentTarget.value
            profileStore.set((p) => (p.notebook.notes === text ? p : { ...p, notebook: { notes: text } }))
          }}
          className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none"
        />
      </label>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-2">
      <div className="font-mono text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  )
}
