import { Angry, Annoyed, Laugh, MessageCircle, X, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../../hooks/useStore'
import { clearDialogue, dialogueStore } from '../../stores/dialogueStore'
import type { TauntMood } from '../../types/taunts'

const VISIBLE_MS = 5600
const URGENT_EXTRA_MS = 1800

const MOODS: Record<TauntMood, { icon: typeof X; border: string; label: string; motion: string }> = {
  smug: { icon: Laugh, border: 'border-accent/50', label: 'text-accent', motion: '' },
  angry: { icon: Angry, border: 'border-red-400/70', label: 'text-red-300', motion: 'animate-shake' },
  shocked: { icon: Zap, border: 'border-amber-300/70', label: 'text-amber-200', motion: '' },
  tense: { icon: Annoyed, border: 'border-orange-400/60', label: 'text-orange-200', motion: '' },
  calm: { icon: MessageCircle, border: 'border-white/20', label: 'text-slate-300', motion: '' },
}
const CHAR_MS = 22

/**
 * Speech bubble for a character's remarks (legend or campaign boss). Overlays
 * the board edge (absolute) so it never shifts the layout — important in the
 * fixed one-handed screen.
 */
export function LegendDialogue({ speakerKey, placement = 'below' }: { speakerKey: string; placement?: 'below' | 'above' }) {
  const line = useStore(dialogueStore, (d) => d)
  const mine = line && line.speakerKey === speakerKey ? line : null
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
    const hide = window.setTimeout(() => clearDialogue(mine.id), VISIBLE_MS + total * 10 + (mine.urgent ? URGENT_EXTRA_MS : 0))
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(hide)
    }
  }, [mine])

  if (!mine) return null
  const shown = typed.id === mine.id ? mine.text.slice(0, typed.count) : ''
  const mood = MOODS[mine.mood]
  const MoodIcon = mood.icon
  return (
    <div
      className={`absolute inset-x-2 z-30 flex animate-pop-in ${placement === 'below' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}
      role="status"
      aria-live="polite"
    >
      <div
        key={mine.id}
        data-mood={mine.mood}
        className={`glass-strong relative w-full rounded-2xl border px-3.5 py-2.5 pr-8 shadow-2xl ${mood.border} ${mood.motion} ${mine.urgent ? 'ring-1 ring-white/10' : ''}`}
      >
        <span
          className={`absolute left-6 size-3 rotate-45 bg-[rgb(14_16_22/0.95)] ${mood.border} ${placement === 'below' ? '-top-1.5 border-t border-l' : '-bottom-1.5 border-r border-b'}`}
          aria-hidden="true"
        />
        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ${mood.label}`}>
          <MoodIcon className="size-3.5" aria-hidden="true" />
          {mine.speaker}
        </div>
        <p className={`mt-0.5 font-serif leading-snug text-slate-100 italic ${mine.urgent ? 'text-base' : 'text-sm'}`}>
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
