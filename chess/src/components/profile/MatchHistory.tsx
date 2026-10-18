import { Bot, Copy, Download, Eye, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MatchRecord } from '../../types/profile'
import { formatShortDate } from '../../utils/date'
import { copyText, downloadText } from '../../utils/share'
import { showToast } from '../../stores/toastStore'

interface MatchHistoryProps {
  matches: readonly MatchRecord[]
  onReview: (match: MatchRecord) => void
}

const OUTCOME_STYLE = {
  win: 'bg-emerald-400/15 text-emerald-300',
  loss: 'bg-red-500/15 text-red-300',
  draw: 'bg-sky-400/15 text-sky-300',
} as const

export function MatchHistory({ matches, onReview }: MatchHistoryProps) {
  if (matches.length === 0) {
    return <div className="rounded-xl bg-white/[0.03] p-6 text-center text-sm text-slate-500">No games yet. Your finished games appear here with full PGN.</div>
  }
  return (
    <ul className="divide-y divide-white/5">
      {matches.map((m) => {
        const outcome = m.outcome
        const label = outcome ? outcome.toUpperCase() : m.result.kind === 'draw' ? 'DRAW' : m.result.winner === 'w' ? '1-0' : '0-1'
        const delta = m.eloBefore !== null && m.eloAfter !== null ? m.eloAfter - m.eloBefore : null
        return (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <span className={`w-12 shrink-0 rounded-md py-1 text-center text-[10px] font-black tracking-wider ${outcome ? OUTCOME_STYLE[outcome] : 'bg-white/10 text-slate-300'}`}>
              {label}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                {m.mode === 'ai' ? <Bot className="size-3.5 shrink-0 text-slate-400" /> : <Users className="size-3.5 shrink-0 text-slate-400" />}
                <span className="truncate">{m.opponent}</span>
              </div>
              <div className="truncate text-xs text-slate-500">
                {formatShortDate(m.date)} · {Math.ceil(m.plies / 2)} moves · {m.timeControl}
                {m.opening ? ` · ${m.opening}` : ''}
                {m.accuracy !== null ? ` · ${m.accuracy}%` : ''}
              </div>
            </div>
            {delta !== null && (
              <span className={`hidden font-mono text-xs font-bold sm:block ${delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {delta >= 0 ? '+' : ''}
                {delta}
              </span>
            )}
            <div className="flex shrink-0 items-center gap-0.5">
              <IconAction label="Review game" onClick={() => onReview(m)} icon={<Eye className="size-4" />} />
              <IconAction
                label="Copy PGN"
                onClick={() => void copyText(m.pgn).then((ok) => ok && showToast('success', 'PGN copied'))}
                icon={<Copy className="size-4" />}
              />
              <IconAction label="Download PGN" onClick={() => downloadText(`chess-arena-${m.id}.pgn`, m.pgn)} icon={<Download className="size-4" />} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function IconAction({ label, onClick, icon }: { label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label={label} title={label}>
      {icon}
    </button>
  )
}
