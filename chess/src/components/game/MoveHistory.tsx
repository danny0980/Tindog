import { ChevronDown, ListOrdered } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MoveAnalysis } from '../../types/analysis'
import type { Move } from '../../types/chess'
import { ClassificationBadge } from '../analysis/ClassificationBadge'

interface MoveHistoryProps {
  history: readonly Move[]
  currentPly: number
  analysis: readonly MoveAnalysis[] | null
  onSelect: (ply: number) => void
}

export function MoveHistory({ history, currentPly, analysis, onSelect }: MoveHistoryProps) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const rows: Array<{ number: number; white: Move | undefined; black: Move | undefined }> = []
  for (let i = 0; i < history.length; i += 2) rows.push({ number: i / 2 + 1, white: history[i], black: history[i + 1] })

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-current="true"]')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentPly, open])

  const cell = (move: Move | undefined, ply: number) => {
    if (!move) return <span />
    const active = ply === currentPly
    const cls = analysis?.[ply - 1]?.classification
    return (
      <button
        type="button"
        data-current={active}
        onClick={() => onSelect(ply)}
        className={`flex items-center justify-between gap-1 rounded-md px-2 py-1 text-left transition-colors ${
          active ? 'bg-accent/25 font-bold text-white' : 'text-slate-200 hover:bg-white/5'
        }`}
      >
        <span className="truncate">{move.san}</span>
        {cls && cls !== 'good' && cls !== 'excellent' && <ClassificationBadge classification={cls} size="xs" />}
      </button>
    )
  }

  return (
    <section className="glass flex flex-col rounded-xl">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left lg:pointer-events-none"
          aria-expanded={open}
          aria-controls="move-history-list"
        >
          <ListOrdered className="size-4 text-accent" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-100">Moves</span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300">{history.length}</span>
          <ChevronDown className={`ml-auto size-4 text-slate-400 transition-transform lg:hidden ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </header>
      <div
        id="move-history-list"
        ref={listRef}
        className={`scrollbar-thin max-h-56 overflow-y-auto border-t border-white/5 px-2 py-2 lg:block lg:max-h-80 lg:min-h-32 ${open ? 'block' : 'hidden'}`}
      >
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">No moves yet. White to play.</p>
        ) : (
          <ol className="grid grid-cols-[2.25rem_1fr_1fr] gap-x-1 gap-y-0.5 font-mono text-sm">
            {rows.map(({ number, white, black }) => (
              <li key={number} className="contents">
                <span className="py-1 pr-1 text-right text-slate-500">{number}.</span>
                {cell(white, number * 2 - 1)}
                {cell(black, number * 2)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}
