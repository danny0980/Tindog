import { ArrowLeft, Hourglass, Swords, WandSparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CampaignSelect } from '../components/legends/CampaignSelect'
import { EpochSelector } from '../components/legends/EpochSelector'
import { FreePlayPanel } from '../components/legends/FreePlayPanel'
import { LegendDossier } from '../components/legends/LegendDossier'
import { Button } from '../components/ui/Button'
import { LEGENDS, campaignLegends, getCampaign, getEpoch, getLegend, nextChapter } from '../data/legends'
import { useStore } from '../hooks/useStore'
import { profileStore } from '../stores/profileStore'
import { settingsStore, updateSettings } from '../stores/settingsStore'
import { setThemeOverride } from '../stores/themeOverrideStore'
import type { CampaignId, ChallengeOptions, LegendId } from '../types/legend'
import type { LegendsScreen } from '../types/settings'

interface LegendsViewProps {
  onChallenge: (legendId: LegendId, options: ChallengeOptions) => void
}

/** Default chapter for a campaign map: the next one to play, else the finale. */
function defaultChapter(campaign: CampaignId, defeated: Partial<Record<LegendId, string>>): LegendId {
  const legends = campaignLegends(campaign)
  return (nextChapter(campaign, defeated) ?? legends[legends.length - 1] ?? legends[0])?.id ?? 'cleopatra'
}

const HEADERS: Record<LegendsScreen, { title: string; subtitle: string; icon: typeof Hourglass }> = {
  select: { title: 'CHRONOS CHESS', subtitle: 'Choose your path: history, fantasy, or free play', icon: Hourglass },
  historical: { title: 'HISTORICAL TIMELINE', subtitle: 'Defeat each legend to open the next chapter of history', icon: Hourglass },
  fantasy: { title: 'FANTASY REALM', subtitle: 'Earn the elves’ trust, then storm the Obsidian Spire', icon: WandSparkles },
  freeplay: { title: 'FREE PLAY', subtitle: 'Quick battles against every legend you have defeated', icon: Swords },
}

/** Chronos Chess hub: universe selector → campaign map + dossier, or free play. */
export function LegendsView({ onChallenge }: LegendsViewProps) {
  const progress = useStore(profileStore, (p) => p.legends)
  const screen = useStore(settingsStore, (s) => s.legendsScreen)
  const [selection, setSelection] = useState<Partial<Record<CampaignId, LegendId>>>({})
  const [freeSelected, setFreeSelected] = useState<LegendId | null>(() => LEGENDS.find((l) => progress.defeated[l.id])?.id ?? null)

  const campaign: CampaignId | null = screen === 'historical' || screen === 'fantasy' ? screen : null
  const selected = campaign ? (selection[campaign] ?? defaultChapter(campaign, progress.defeated)) : null
  const previewLegend = selected ?? (screen === 'freeplay' ? freeSelected : null)
  const previewTheme = previewLegend ? getEpoch(getLegend(previewLegend).epoch).themeId : null

  // Preview the selected era/realm app-wide while browsing; the hub itself keeps your theme.
  useEffect(() => {
    setThemeOverride(previewTheme)
  }, [previewTheme])
  useEffect(() => () => setThemeOverride(null), [])

  const open = (next: LegendsScreen) => {
    updateSettings({ legendsScreen: next })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const header = campaign ? { ...HEADERS[campaign], title: getCampaign(campaign).name.toUpperCase() } : HEADERS[screen]
  const Icon = header.icon

  return (
    <div className="safe-px mx-auto w-full max-w-6xl flex-1 space-y-4 pb-4">
      <header className="flex items-center gap-3">
        {screen !== 'select' && (
          <Button variant="ghost" size="sm" onClick={() => open('select')} icon={<ArrowLeft className="size-4" />} aria-label="Back to campaign select">
            <span className="hidden sm:inline">Paths</span>
          </Button>
        )}
        <div className="idle-pause flex size-12 shrink-0 animate-spin-slow items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-ink-950">
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-extrabold tracking-wider text-white sm:text-2xl">{header.title}</h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">{header.subtitle}</p>
        </div>
      </header>

      {screen === 'select' && <CampaignSelect defeated={progress.defeated} onOpen={open} />}

      {campaign && selected && (
        <>
          <EpochSelector
            campaign={campaign}
            selected={selected}
            defeated={progress.defeated}
            onSelect={(id) => setSelection((prev) => ({ ...prev, [campaign]: id }))}
          />
          <LegendDossier key={selected} legend={getLegend(selected)} progress={progress} onChallenge={(options) => onChallenge(selected, options)} />
        </>
      )}

      {screen === 'freeplay' && <FreePlayPanel defeated={progress.defeated} selected={freeSelected} onSelect={setFreeSelected} onStart={onChallenge} />}
    </div>
  )
}
