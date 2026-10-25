import { ChevronRight, FastForward } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { sfx } from '../../audio'
import { assetUrl } from '../../assets/artManifest'
import { classicPortrait, getClassic } from '../../data/classic/roster'
import type { Panel, Speaker } from '../../journey/story'
import type { PortraitSpec } from '../../types/persona'
import { PortraitEmblem } from '../legends/PortraitEmblem'

const KEEPER: PortraitSpec = { icon: 'hourglass', from: '#fbbf24', to: '#1e3a8a', monogram: 'Χ' }
const GHOST: PortraitSpec = { icon: 'ghost', from: '#94a3b8', to: '#0f172a', monogram: 'You' }

function speakerOf(s: Speaker): { name: string; spec: PortraitSpec | null } {
  if (s === 'narrator') return { name: '', spec: null }
  if (s === 'keeper') return { name: 'Chronos, Keeper of Time', spec: KEEPER }
  if (s === 'ghost') return { name: 'Your Ghost', spec: GHOST }
  const c = getClassic(s.classic)
  return c ? { name: c.name, spec: classicPortrait(c) } : { name: '', spec: null }
}

/** A story scene: panels of dialogue over the chapter's backdrop, typed out; tap to continue. */
export function Cutscene({ title, era, backdrop, panels, onDone }: { title: string; era: string; backdrop: string; panels: readonly Panel[]; onDone: () => void }) {
  // The panel on screen and how many of its letters are typed out so far.
  const [at, setAt] = useState({ index: 0, shown: 0 })
  const { index, shown } = at
  const panel = panels[index]
  const text = panel?.text ?? ''
  const typing = shown < text.length
  useEffect(() => {
    if (!typing) return
    const id = window.setTimeout(() => setAt((a) => ({ ...a, shown: Math.min(text.length, a.shown + 2) })), 18)
    return () => window.clearTimeout(id)
  }, [shown, text.length, typing])
  const advance = () => {
    if (typing) return setAt({ index, shown: text.length })
    if (index + 1 >= panels.length) return onDone()
    sfx.pickup()
    setAt({ index: index + 1, shown: 0 })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      if (e.key === 'Enter' || e.key === ' ') advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!panel) return null
  const who = speakerOf(panel.speaker)
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={title} data-cutscene={title}>
      <img src={assetUrl(backdrop)} alt="" className="absolute inset-0 size-full scale-105 object-cover opacity-55" onError={(e) => (e.currentTarget.style.display = 'none')} />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/70" aria-hidden="true" />
      <div className="safe-px relative flex items-start justify-between gap-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <div className="text-[11px] font-bold tracking-[0.3em] text-amber-200 uppercase">{era}</div>
          <div className="font-display text-xl font-extrabold sm:text-3xl">{title}</div>
        </div>
        <button type="button" onClick={onDone} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 pointer-coarse:min-h-10" data-cutscene-skip>
          <FastForward className="size-3.5" /> Skip
        </button>
      </div>
      <button type="button" className="relative flex-1" onClick={advance} aria-label="Continue" />
      <div className="safe-px relative mx-auto w-full max-w-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div key={index} className="animate-panel-in rounded-3xl border border-white/15 bg-black/70 p-4 backdrop-blur-md sm:p-6" onClick={advance}>
          {who.spec ? (
            <div className="mb-2 flex items-center gap-3">
              <PortraitEmblem spec={who.spec} label={who.name} size="md" ring="ring-amber-300/60" />
              <div className="font-display text-base font-bold text-amber-100">{who.name}</div>
            </div>
          ) : null}
          <p className={`min-h-[4.5rem] text-base leading-relaxed sm:text-lg ${who.spec ? '' : 'text-center italic text-slate-200'}`} aria-live="polite">
            {text.slice(0, shown)}
            {typing && <span className="opacity-50">▍</span>}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>
              {index + 1} / {panels.length}
            </span>
            <span className="flex items-center gap-1 font-semibold text-amber-200">
              {index + 1 >= panels.length && !typing ? 'Begin' : 'Tap to continue'} <ChevronRight className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
