import { Check, ChevronsRight, Lock } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { EPOCHS, LEGENDS, getEpoch, isLegendUnlocked } from '../../data/historicalLegends'
import type { LegendId } from '../../types/legend'
import { LegendPortrait } from './LegendPortrait'

interface EpochSelectorProps {
  selected: LegendId
  defeated: Partial<Record<LegendId, string>>
  onSelect: (id: LegendId) => void
}

const CHAPTERS = ['I', 'II', 'III', 'IV']

const formatYear = (year: number) => (year < 0 ? `${Math.abs(year)} BCE` : `AD ${year}`)

/**
 * The time-travel map: a horizontal timeline of epochs, each guarded by its
 * legend. Swipe/scroll on phones (snap points), a full row on wider screens.
 * Gaps between stops show how many years the jump covers.
 */
export function EpochSelector({ selected, defeated, onSelect }: EpochSelectorProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const legends = [...LEGENDS].sort((a, b) => a.campaignOrder - b.campaignOrder)

  // Keep the selected stop centred on narrow screens.
  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>(`[data-legend="${selected}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [selected])

  return (
    <nav aria-label="Epochs" className="relative">
      <div
        ref={scroller}
        className="scrollbar-thin -mx-4 flex snap-x snap-mandatory items-stretch gap-0 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0"
      >
        {legends.map((legend, i) => {
          const epoch = getEpoch(legend.epoch)
          const unlocked = isLegendUnlocked(legend.id, defeated)
          const won = Boolean(defeated[legend.id])
          const active = selected === legend.id
          const next = legends[i + 1]
          const gap = next ? getEpoch(next.epoch).year - epoch.year : 0
          return (
            <div key={legend.id} className="flex shrink-0 items-center sm:flex-1">
              <button
                type="button"
                data-legend={legend.id}
                onClick={() => onSelect(legend.id)}
                aria-pressed={active}
                aria-label={`${epoch.name}: ${legend.name}${unlocked ? '' : ' (locked)'}`}
                className={`relative flex w-[68vw] max-w-60 snap-center flex-col items-center rounded-3xl border p-4 text-center transition duration-300 sm:w-full ${
                  active
                    ? 'scale-[1.02] border-accent bg-accent/10 shadow-[0_0_40px_-12px_var(--accent)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <span className="font-mono text-[10px] tracking-[0.3em] text-slate-400">CHAPTER {CHAPTERS[i]}</span>
                <LegendPortrait legendId={legend.id} size="lg" locked={!unlocked} defeated={won} className="mt-2" />
                <span className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{epoch.name}</span>
                <span className="text-sm font-bold text-white">{legend.name}</span>
                <span className="font-mono text-[11px] text-slate-500">{formatYear(epoch.year)}</span>
                <span
                  className={`mt-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    won ? 'bg-amber-300/15 text-amber-200' : unlocked ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {won ? <Check className="size-3" /> : !unlocked ? <Lock className="size-3" /> : null}
                  {won ? 'Defeated' : unlocked ? 'Challenge' : 'Locked'}
                </span>
              </button>
              {next && (
                <div className="flex w-16 shrink-0 flex-col items-center px-1 text-center sm:w-auto sm:flex-1" aria-hidden="true">
                  <div className="relative h-px w-full bg-gradient-to-r from-accent/70 to-accent-2/70">
                    <ChevronsRight className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-accent" />
                  </div>
                  <span className="mt-2 font-mono text-[9px] leading-tight text-slate-500">+{gap.toLocaleString()} yrs</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-center text-[11px] text-slate-500">
        {EPOCHS.length} epochs · {Object.keys(defeated).length}/{LEGENDS.length} legends defeated
      </p>
    </nav>
  )
}
