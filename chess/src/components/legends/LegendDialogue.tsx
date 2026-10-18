import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getLegend } from '../../data/historicalLegends'
import { useStore } from '../../hooks/useStore'
import { clearDialogue, dialogueStore } from '../../stores/dialogueStore'
import type { LegendId } from '../../types/legend'

const VISIBLE_MS = 5600
const CHAR_MS = 22

/**
 * Speech bubble for a legend's remarks. Overlays the board edge (absolute) so
 * it never shifts the layout — important in the fixed one-handed screen.
 */
export function LegendDialogue({ legendId, placement = 'below' }: { legendId: LegendId; placement?: 'below' | 'above' }) {
  const line = useStore(dialogueStore, (d) => d)
  const mine = line && line.legendId === legendId ? line : null
  const [typed, setTyped] = useState({ id: 0, count: 0 })

  // Typewriter reveal, then auto-dismiss.
  useEffect(() => {
    if (!mine) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('battery-saver')
    const total = mine.text.length
    let count = reduce ? total : 0
    const tick = window.setInterval(() => {
      count = Math.min(total, count + 2)
      setTyped({ id: mine.id, count })
      if (count >= total) window.clearInterval(tick)
    }, CHAR_MS)
    const hide = window.setTimeout(() => clearDialogue(mine.id), VISIBLE_MS + total * 10)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(hide)
    }
  }, [mine])

  if (!mine) return null
  const legend = getLegend(legendId)
  const shown = typed.id === mine.id ? mine.text.slice(0, typed.count) : ''
  return (
    <div
      className={`absolute inset-x-2 z-30 flex animate-pop-in ${placement === 'below' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}
      role="status"
      aria-live="polite"
    >
      <div className="glass-strong relative w-full rounded-2xl border border-accent/40 px-3.5 py-2.5 pr-8 shadow-2xl">
        <span
          className={`absolute left-6 size-3 rotate-45 border-accent/40 bg-[rgb(14_16_22/0.95)] ${placement === 'below' ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-r border-b'}`}
          aria-hidden="true"
        />
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{legend.name}</div>
        <p className="mt-0.5 font-serif text-sm leading-snug text-slate-100 italic">
          “{shown}
          {shown.length < mine.text.length ? <span className="animate-pulse-soft">▍</span> : '”'}
        </p>
        <button
          type="button"
          onClick={() => clearDialogue(mine.id)}
          className="absolute top-1.5 right-1.5 rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
