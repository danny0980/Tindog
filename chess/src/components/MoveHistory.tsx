import { Check, ChevronDown, Copy, ListOrdered } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Move } from '../types/chess'

interface MoveHistoryProps {
  history: readonly Move[]
  getPgn: () => string
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for WebViews without the async clipboard API.
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  }
}

export function MoveHistory({ history, getPgn }: MoveHistoryProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const rows: Array<{ number: number; white: Move | undefined; black: Move | undefined }> = []
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ number: i / 2 + 1, white: history[i], black: history[i + 1] })
  }

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [history.length, open])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  const handleCopy = async () => {
    if (await copyText(getPgn())) setCopied(true)
  }

  const lastIndex = history.length - 1

  return (
    <section className="glass flex min-h-0 flex-col rounded-xl lg:flex-1">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left lg:pointer-events-none"
          aria-expanded={open}
          aria-controls="move-history-list"
        >
          <ListOrdered className="size-4 text-emerald-300" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-100">Moves</span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-slate-300">
            {history.length}
          </span>
          <ChevronDown
            className={`ml-auto size-4 text-slate-400 transition-transform lg:hidden ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={history.length === 0}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-35"
          title="Copy PGN"
        >
          {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'PGN'}
        </button>
      </header>

      <div
        id="move-history-list"
        ref={listRef}
        className={`scrollbar-thin max-h-56 overflow-y-auto border-t border-white/5 px-2 py-2 lg:block lg:max-h-none lg:min-h-48 lg:flex-1 ${
          open ? 'block' : 'hidden'
        }`}
      >
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500">No moves yet. White to play.</p>
        ) : (
          <ol className="grid grid-cols-[2.25rem_1fr_1fr] gap-x-1 gap-y-0.5 font-mono text-sm">
            {rows.map(({ number, white, black }) => (
              <li key={number} className="contents">
                <span className="py-1 pr-1 text-right text-slate-500">{number}.</span>
                <MoveCell move={white} active={(number - 1) * 2 === lastIndex} />
                <MoveCell move={black} active={(number - 1) * 2 + 1 === lastIndex} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function MoveCell({ move, active }: { move: Move | undefined; active: boolean }) {
  if (!move) return <span />
  return (
    <span
      className={`rounded-md px-2 py-1 transition-colors ${
        active ? 'bg-emerald-400/20 font-bold text-emerald-100' : 'text-slate-200 hover:bg-white/5'
      }`}
    >
      {move.san}
    </span>
  )
}
