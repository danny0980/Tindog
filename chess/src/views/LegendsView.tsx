import { ArrowLeft, Brain, Crown, EyeOff, Flag, Ghost, Globe2, KeyRound, Layers, Landmark, GraduationCap, Hourglass, Infinity as InfinityIcon, Map as MapIcon, Shuffle, Swords, Trophy, WandSparkles } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { lazyWithRetry } from '../utils/lazyWithRetry'
import { runViewTransition } from '../utils/viewTransition'
import { ArtBackdrop } from '../components/fx/ArtBackdrop'
import type { ChallengeClock } from '../components/campaign/battleOptions'
import type { BattleLaunch } from '../hooks/useGameController'
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
import type { Boss, BossId } from '../types/campaign'
import type { LegendsScreen } from '../types/settings'
import type { TournamentEntrant } from '../types/rpg'
import { ArtIcon } from '../components/ui/ArtIcon'
import { type IconSlot, artStore, iconFor } from '../assets/artManifest'
import { ClassicView } from '../components/classic/ClassicView'
import { OpeningSchool } from '../components/openings/OpeningSchool'
import { VariantsView } from '../components/variants/VariantsView'
import { BattlesView } from '../components/battles/BattlesView'
import { MuseumView } from '../components/history/MuseumView'
import { QuizView } from '../components/history/QuizView'
import { GhostView } from '../components/ghost/GhostView'
import { WarView } from '../components/war/WarView'
import { CardChessView } from '../components/cards/CardChessView'
import { EscapeView } from '../components/escape/EscapeView'
import { RoyaleView } from '../components/royale/RoyaleView'
import { VanishView } from '../components/vanish/VanishView'
import type { BattleMode } from '../war/war'

// The Grand Campaign (map, dossier, archetype engine) is its own chunk; realm rosters load on top of it.
const GrandCampaign = lazyWithRetry(() => import('../components/campaign/GrandCampaign'), (m) => m.default)
const GauntletView = lazyWithRetry(() => import('../components/gauntlet/GauntletView'), (m) => m.default)
const TournamentView = lazyWithRetry(() => import('../components/tournament/TournamentView'), (m) => m.default)

interface LegendsViewProps {
  onChallenge: (legendId: LegendId, options: ChallengeOptions) => void
  onChallengeClassic: (classicId: string, options: ChallengeClock) => void
  onChallengeGhost: (options: ChallengeClock) => void
  onChallengeWar: (territoryId: string, mode: BattleMode, options: ChallengeClock) => void
  onChallengeBoss: (bossId: BossId, options: ChallengeClock, launch: BattleLaunch) => void
  onFightGauntlet: (boss: Boss) => void
  onFightTournament: (opponent: TournamentEntrant, round: number) => void
  onReturnToBoard: () => void
}

/** Default chapter for a campaign map: the next one to play, else the finale. */
function defaultChapter(campaign: CampaignId, defeated: Partial<Record<LegendId, string>>): LegendId {
  const legends = campaignLegends(campaign)
  return (nextChapter(campaign, defeated) ?? legends[legends.length - 1] ?? legends[0])?.id ?? 'cleopatra'
}

const HEADERS: Record<LegendsScreen, { title: string; subtitle: string; icon: typeof Hourglass; slot: IconSlot }> = {
  select: { title: 'CHRONOS CHESS', subtitle: 'Choose your path: classic chess, or the fantasy campaigns', icon: Hourglass, slot: 'chronos' },
  historical: { title: 'HISTORICAL TIMELINE', subtitle: 'Defeat each legend to open the next chapter of history', icon: Hourglass, slot: 'historical' },
  fantasy: { title: 'FANTASY REALM', subtitle: 'Earn the elves’ trust, then storm the Obsidian Spire', icon: WandSparkles, slot: 'fantasy' },
  freeplay: { title: 'FREE PLAY', subtitle: 'Quick battles against every legend you have defeated', icon: Swords, slot: 'free-play' },
  tournament: { title: 'CHRONOS TOURNAMENT', subtitle: 'A daily 8-player knockout bracket of legends near your rating', icon: Trophy, slot: 'tournament' },
  gauntlet: { title: 'ENDLESS GAUNTLET', subtitle: 'Back-to-back bosses on one clock — how far can you go?', icon: InfinityIcon, slot: 'gauntlet' },
  classic: { title: 'CLASSIC CHESS', subtitle: '100 historical opponents · pure chess, no spells or special rules', icon: Crown, slot: 'classic' },
  grand: { title: 'GRAND CAMPAIGN', subtitle: '100 bosses across 5 realms — conquer the map, earn relics', icon: MapIcon, slot: 'grand-campaign' },
  variants: { title: 'CHESS VARIANTS', subtitle: 'Chess960, King of the Hill and Three-Check against the computer', icon: Shuffle, slot: 'classic' },
  battles: { title: 'PLAY THE REAL BATTLE', subtitle: 'Thermopylae, Cannae and Waterloo as chess, with history’s own twists', icon: Flag, slot: 'classic' },
  museum: { title: 'TROPHY MUSEUM', subtitle: 'Your personal timeline of history, from 2300 BCE to today', icon: Landmark, slot: 'classic' },
  royale: { title: 'BATTLE ROYALE', subtitle: 'Four armies, one cross-shaped board: the last king standing wins', icon: Crown, slot: 'classic' },
  cards: { title: 'CARD CHESS', subtitle: 'Draft three tactical cards, then play them at the right moment', icon: Layers, slot: 'classic' },
  vanish: { title: 'VANISHING CHESS', subtitle: 'Rated blindfold chess: pieces fade from view as the game goes on', icon: EyeOff, slot: 'classic' },
  escape: { title: 'HISTORICAL ESCAPE ROOMS', subtitle: 'Four forced mates seal each room; every lock reveals a page of history', icon: KeyRound, slot: 'classic' },
  war: { title: 'HISTORICAL WORLD WAR', subtitle: 'Conquer 21 territories held by five empires, with an army of the legends you have beaten', icon: Globe2, slot: 'classic' },
  ghost: { title: 'GHOST OF YOURSELF', subtitle: 'An opponent built from your own games: your openings, your habits, your rating', icon: Ghost, slot: 'classic' },
  quiz: { title: 'HISTORY QUIZ', subtitle: 'Who is this? True facts about the people you have beaten', icon: Brain, slot: 'classic' },
  openings: { title: 'OPENING SCHOOL', subtitle: 'Learn the main openings move by move, taught by the masters', icon: GraduationCap, slot: 'classic' },
}

/** Chronos Chess hub: universe selector → campaign map + dossier, or free play. */
export function LegendsView({ onChallenge, onChallengeClassic, onChallengeGhost, onChallengeWar, onChallengeBoss, onFightGauntlet, onFightTournament, onReturnToBoard }: LegendsViewProps) {
  const progress = useStore(profileStore, (p) => p.legends)
  const campaignProgress = useStore(profileStore, (p) => p.campaign)
  const screen = useStore(settingsStore, (s) => s.legendsScreen)
  const [selection, setSelection] = useState<Partial<Record<CampaignId, LegendId>>>({})
  const [freeSelected, setFreeSelected] = useState<LegendId | null>(() => LEGENDS.find((l) => progress.defeated[l.id])?.id ?? null)

  const campaign: CampaignId | null = screen === 'historical' || screen === 'fantasy' ? screen : null
  const selected = campaign ? (selection[campaign] ?? defaultChapter(campaign, progress.defeated)) : null
  const previewLegend = selected ?? (screen === 'freeplay' ? freeSelected : null)
  const previewTheme = previewLegend ? getEpoch(getLegend(previewLegend).epoch).themeId : null

  // Preview the selected era/realm app-wide while browsing; the hub itself keeps your theme.
  // (The Grand Campaign previews its selected boss's zone itself.)
  useEffect(() => {
    if (screen !== 'grand') setThemeOverride(previewTheme)
  }, [previewTheme, screen])
  useEffect(() => () => setThemeOverride(null), [])

  const open = (next: LegendsScreen) => {
    // Drilling into a path zooms in; going back to the hub zooms out.
    runViewTransition(() => updateSettings({ legendsScreen: next }), next === 'select' ? 'back' : 'zoom')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const header = campaign ? { ...HEADERS[campaign], title: getCampaign(campaign).name.toUpperCase() } : HEADERS[screen]
  const Icon = header.icon
  // A spinning hourglass suits the vector icon, not a picture.
  const headerArt = useStore(artStore, (m) => iconFor(m, header.slot))

  return (
    <div className="safe-px mx-auto w-full max-w-6xl flex-1 space-y-4 pb-4">
      <header className="flex items-center gap-3">
        {screen !== 'select' && (
          <Button variant="ghost" size="sm" onClick={() => open('select')} icon={<ArrowLeft className="size-4" />} aria-label="Back to campaign select">
            <span className="hidden sm:inline">Paths</span>
          </Button>
        )}
        <div className={`idle-pause flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-ink-950 ${headerArt ? '' : 'animate-spin-slow'}`}>
          <ArtIcon slot={header.slot} fallback={<Icon className="size-6" />} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-extrabold tracking-wider text-white sm:text-2xl">{header.title}</h1>
          <p className="truncate text-xs text-slate-400 sm:text-sm">{header.subtitle}</p>
        </div>
      </header>

      {screen === 'select' && <ArtBackdrop slot="realm" fixed opacity={0.3} />}
      {screen === 'select' && <CampaignSelect defeated={progress.defeated} campaign={campaignProgress} onOpen={open} />}

      {screen === 'gauntlet' && (
        <ErrorBoundary scope="view" label="the Endless Gauntlet">
          <Suspense
            fallback={
              <div className="flex justify-center py-20" role="status" aria-label="Loading gauntlet">
                <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
              </div>
            }
          >
            <GauntletView onFight={onFightGauntlet} onReturnToBoard={onReturnToBoard} />
          </Suspense>
        </ErrorBoundary>
      )}

      {screen === 'tournament' && (
        <ErrorBoundary scope="view" label="the tournament">
          <Suspense
            fallback={
              <div className="flex justify-center py-20" role="status" aria-label="Loading tournament">
                <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
              </div>
            }
          >
            <TournamentView onFight={onFightTournament} />
          </Suspense>
        </ErrorBoundary>
      )}

      {screen === 'grand' && (
        <ErrorBoundary scope="view" label="the Grand Campaign">
        <Suspense
          fallback={
            <div className="flex justify-center py-20" role="status" aria-label="Loading campaign">
              <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
            </div>
          }
        >
          <GrandCampaign onChallenge={onChallengeBoss} />
        </Suspense>
        </ErrorBoundary>
      )}

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

      {screen === 'classic' && <ClassicView onPlay={onChallengeClassic} />}

      {screen === 'variants' && <VariantsView />}

      {screen === 'openings' && <OpeningSchool />}

      {screen === 'battles' && <BattlesView />}

      {screen === 'museum' && <MuseumView />}

      {screen === 'quiz' && <QuizView />}

      {screen === 'ghost' && <GhostView onPlay={onChallengeGhost} />}

      {screen === 'war' && <WarView onBattle={onChallengeWar} />}

      {screen === 'cards' && <CardChessView />}

      {screen === 'vanish' && <VanishView />}

      {screen === 'escape' && <EscapeView />}

      {screen === 'royale' && <RoyaleView />}

      {screen === 'freeplay' && <FreePlayPanel defeated={progress.defeated} selected={freeSelected} onSelect={setFreeSelected} onStart={onChallenge} />}
    </div>
  )
}
