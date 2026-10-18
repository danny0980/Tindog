import { ChevronRight, Hourglass, Swords, WandSparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { CAMPAIGNS, LEGENDS, campaignLegends, isCampaignComplete, isLegendUnlocked, nextChapter } from '../../data/legends'
import type { CampaignProgress } from '../../types/campaign'
import type { CampaignId, LegendId } from '../../types/legend'
import { GrandCampaignCard } from '../campaign/GrandCampaignCard'
import { GauntletCard } from '../gauntlet/GauntletCard'
import type { LegendsScreen } from '../../types/settings'
import { LegendPortrait } from './LegendPortrait'

interface CampaignSelectProps {
  defeated: Partial<Record<LegendId, string>>
  campaign: CampaignProgress
  onOpen: (screen: LegendsScreen) => void
}

const STYLE: Record<CampaignId, { icon: ReactNode; gradient: string; glow: string }> = {
  historical: {
    icon: <Hourglass className="size-7" />,
    gradient: 'from-amber-300 via-orange-400 to-sky-500',
    glow: 'shadow-[0_30px_80px_-30px_rgba(251,191,36,0.55)]',
  },
  fantasy: {
    icon: <WandSparkles className="size-7" />,
    gradient: 'from-emerald-300 via-violet-400 to-orange-500',
    glow: 'shadow-[0_30px_80px_-30px_rgba(167,139,250,0.6)]',
  },
}

/** Universe switcher: pick a campaign path or jump into free play. */
export function CampaignSelect({ defeated, campaign, onOpen }: CampaignSelectProps) {
  const unlockedCount = LEGENDS.filter((l) => defeated[l.id]).length
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <GrandCampaignCard progress={campaign} onOpen={() => onOpen('grand')} />
      <GauntletCard onOpen={() => onOpen('gauntlet')} />
      {CAMPAIGNS.map((campaign) => {
        const legends = campaignLegends(campaign.id)
        const done = legends.filter((l) => defeated[l.id]).length
        const next = nextChapter(campaign.id, defeated)
        const complete = isCampaignComplete(campaign.id, defeated)
        const style = STYLE[campaign.id]
        return (
          <button
            key={campaign.id}
            type="button"
            onClick={() => onOpen(campaign.id)}
            className={`glass group relative flex flex-col overflow-hidden rounded-3xl p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-white/25 ${style.glow}`}
          >
            <div className={`pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-gradient-to-br ${style.gradient} opacity-25 blur-3xl transition group-hover:opacity-40`} aria-hidden="true" />
            <div className="relative flex items-center gap-3">
              <div className={`flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ${style.gradient} text-ink-950`}>{style.icon}</div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Campaign</div>
                <div className="font-display text-lg font-extrabold tracking-wide text-white">{campaign.name}</div>
                <div className="text-xs text-slate-400">{campaign.tagline}</div>
              </div>
            </div>
            <p className="relative mt-3 text-sm text-slate-300">{campaign.description}</p>
            <div className="relative mt-4 flex flex-wrap gap-1.5">
              {legends.map((legend) => (
                <LegendPortrait
                  key={legend.id}
                  legendId={legend.id}
                  size="sm"
                  locked={!isLegendUnlocked(legend.id, defeated)}
                  defeated={Boolean(defeated[legend.id])}
                />
              ))}
            </div>
            <div className="relative mt-4">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{complete ? 'Campaign complete!' : `Next: ${next?.name ?? '—'}`}</span>
                <span className="font-mono">
                  {done}/{legends.length}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full bg-gradient-to-r ${style.gradient}`} style={{ width: `${(done / legends.length) * 100}%` }} />
              </div>
            </div>
            <span className="relative mt-4 flex items-center gap-1 text-sm font-bold text-accent">
              {done === 0 ? 'Begin the journey' : complete ? 'Revisit the campaign' : 'Continue'} <ChevronRight className="size-4 transition group-hover:translate-x-1" />
            </span>
          </button>
        )
      })}

      <button
        type="button"
        onClick={() => onOpen('freeplay')}
        className="glass group relative flex flex-col overflow-hidden rounded-3xl p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-white/25"
      >
        <div className="relative flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-500 text-ink-950">
            <Swords className="size-7" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Quick battle</div>
            <div className="font-display text-lg font-extrabold tracking-wide text-white">Free Play</div>
            <div className="text-xs text-slate-400">Any defeated legend, your rules</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Rematch any character you have defeated in either campaign — choose their strength (Novice, Authentic or Mythic), your colour and any time control.
        </p>
        <div className="mt-4 font-mono text-2xl font-bold text-white">
          {unlockedCount}
          <span className="text-sm text-slate-500"> / {LEGENDS.length} unlocked</span>
        </div>
        <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-bold text-accent">
          {unlockedCount > 0 ? 'Choose an opponent' : 'Defeat a legend to unlock'} <ChevronRight className="size-4 transition group-hover:translate-x-1" />
        </span>
      </button>
    </div>
  )
}
