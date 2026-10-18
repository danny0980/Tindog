import { Hourglass } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EpochSelector } from '../components/legends/EpochSelector'
import { LegendDossier } from '../components/legends/LegendDossier'
import { LEGENDS, getEpoch, getLegend, isLegendUnlocked } from '../data/historicalLegends'
import { useStore } from '../hooks/useStore'
import { profileStore } from '../stores/profileStore'
import { setThemeOverride } from '../stores/themeOverrideStore'
import type { ColorChoice } from '../types/chess'
import type { LegendId } from '../types/legend'

interface LegendsViewProps {
  onChallenge: (legendId: LegendId, options: { color: ColorChoice; timeControlId: string }) => void
}

/** Default selection: the current campaign chapter (first unlocked, undefeated legend). */
function currentChapter(defeated: Partial<Record<LegendId, string>>): LegendId {
  const ordered = [...LEGENDS].sort((a, b) => a.campaignOrder - b.campaignOrder)
  return (ordered.find((l) => isLegendUnlocked(l.id, defeated) && !defeated[l.id]) ?? ordered[ordered.length - 1] ?? ordered[0])?.id ?? 'cleopatra'
}

/** Chronos Chess: travel the timeline and challenge history's legends. */
export function LegendsView({ onChallenge }: LegendsViewProps) {
  const progress = useStore(profileStore, (p) => p.legends)
  const [selected, setSelected] = useState<LegendId>(() => currentChapter(progress.defeated))
  const legend = getLegend(selected)

  // Preview the selected era app-wide (board colours, accents, soundtrack) while browsing.
  useEffect(() => {
    setThemeOverride(getEpoch(legend.epoch).themeId)
  }, [legend.epoch])
  useEffect(() => () => setThemeOverride(null), [])

  return (
    <div className="safe-px mx-auto w-full max-w-6xl flex-1 space-y-4 pb-4">
      <header className="flex items-center gap-3">
        <div className="idle-pause flex size-12 animate-spin-slow items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-ink-950">
          <Hourglass className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-wider text-white sm:text-2xl">CHRONOS CHESS</h1>
          <p className="text-xs text-slate-400 sm:text-sm">Historical legends & eras · defeat each legend to open the next chapter</p>
        </div>
      </header>

      <EpochSelector selected={selected} defeated={progress.defeated} onSelect={setSelected} />
      <LegendDossier key={legend.id} legend={legend} progress={progress} onChallenge={(options) => onChallenge(legend.id, options)} />
    </div>
  )
}
