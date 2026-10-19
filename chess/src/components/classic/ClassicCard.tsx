import { ChevronRight, Crown } from 'lucide-react'
import { useMemo } from 'react'
import { CLASSIC_ROSTER } from '../../data/classic/roster'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { ArtIcon } from '../ui/ArtIcon'

/** Path-selector card for Classic Chess (pure chess, 100 historical opponents). */
export function ClassicCard({ onOpen }: { onOpen: () => void }) {
  const matches = useStore(profileStore, (p) => p.matches)
  const beaten = useMemo(() => {
    const won = new Set(matches.filter((m) => m.outcome === 'win').map((m) => m.opponent))
    return CLASSIC_ROSTER.filter((c) => won.has(c.name)).length
  }, [matches])
  return (
    <button
      type="button"
      onClick={onOpen}
      data-path="classic"
      className="glass group relative overflow-hidden rounded-3xl p-5 text-left shadow-[0_30px_80px_-30px_rgba(251,191,36,0.5)] transition duration-300 hover:-translate-y-1 hover:border-white/25 lg:col-span-3"
    >
      <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-gradient-to-br from-amber-200 via-amber-500 to-stone-700 opacity-20 blur-3xl transition group-hover:opacity-35" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 via-amber-300 to-amber-700 text-ink-950">
          <ArtIcon slot="classic" fallback={<Crown className="size-7" />} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200">Pure chess · no spells</div>
          <div className="font-display text-xl font-extrabold tracking-wide text-white">Classic Chess</div>
          <div className="text-xs text-slate-400">100 historical opponents — pharaohs to world champions — playing strictly by the rules of chess</div>
        </div>
        <span className="font-mono text-sm text-slate-300">{beaten}/100</span>
        <ChevronRight className="size-5 text-accent transition group-hover:translate-x-1" />
      </div>
    </button>
  )
}
