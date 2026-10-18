import { Suspense, useCallback, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppHeader } from './components/layout/AppHeader'
import { BottomNav } from './components/layout/BottomNav'
import { ToastViewport } from './components/ui/ToastViewport'
import { useAppEnvironment } from './hooks/useAppEnvironment'
import { type BattleLaunch, useGameController } from './hooks/useGameController'
import { useLayoutMode } from './hooks/useLayoutMode'
import { useStore } from './hooks/useStore'
import { profileLoadReport, profileStore } from './stores/profileStore'
import { showToast } from './stores/toastStore'
import { lazyWithRetry } from './utils/lazyWithRetry'
import { updateSettings } from './stores/settingsStore'
import type { MatchRecord } from './types/profile'
import type { ChallengeClock } from './components/campaign/battleOptions'
import type { TournamentEntrant } from './types/rpg'
import type { Boss, BossId } from './types/campaign'
import { beginGauntletBattle } from './stores/gauntletActions'
import { gauntletStore } from './stores/gauntletStore'
import { BASE_INCREMENT_MS, BOSS_CLOCK_MS } from './utils/gauntlet'
import type { ChallengeOptions, LegendId } from './types/legend'
import { setThemeOverride } from './stores/themeOverrideStore'
import type { AppView } from './types/ui'
import { localDateKey } from './utils/date'
import { getDailyPuzzles } from './utils/puzzles'
import { claimableCount } from './utils/quests'
import { PlayView } from './views/PlayView'

// Secondary screens are code-split so the board loads first on slow mobile connections;
// failed chunk downloads are retried and, failing that, caught by a view ErrorBoundary.
const PuzzlesView = lazyWithRetry(() => import('./views/PuzzlesView'), (m) => m.PuzzlesView)
const ProfileView = lazyWithRetry(() => import('./views/ProfileView'), (m) => m.ProfileView)
const ShopView = lazyWithRetry(() => import('./views/ShopView'), (m) => m.ShopView)
const SettingsModal = lazyWithRetry(() => import('./components/modals/SettingsModal'), (m) => m.SettingsModal)
const LegendsView = lazyWithRetry(() => import('./views/LegendsView'), (m) => m.LegendsView)
const RushView = lazyWithRetry(() => import('./views/RushView'), (m) => m.RushView)
const QuestsView = lazyWithRetry(() => import('./views/QuestsView'), (m) => m.QuestsView)

function ViewFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-20" role="status" aria-label="Loading">
      <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<AppView>('play')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newGameOpen, setNewGameOpen] = useState(false)
  useAppEnvironment()
  const layout = useLayoutMode()
  // The one-handed layout is a fixed-height screen (board flexes, dock pinned to the thumb zone).
  const lockViewport = view === 'play' && layout.oneHanded

  // The game lives at the app level so it survives tab switches; its clock pauses off-screen.
  const game = useGameController({ active: view === 'play' })

  const solved = useStore(profileStore, (p) => p.puzzles.solved)
  const questProgress = useStore(profileStore, (p) => p.quests)
  const today = localDateKey()
  const unsolvedDaily = getDailyPuzzles(today).filter((p) => !solved[p.id]).length
  const questRewards = claimableCount(questProgress, today)

  // One-time notice when saved progress had to be recovered or upgraded.
  useEffect(() => {
    if (profileLoadReport.source === 'backup') showToast('warning', 'Progress restored', 'Your save was unreadable, so the backup from your last session was loaded.', 7000)
    else if (profileLoadReport.source === 'reset') showToast('warning', 'Save data unreadable', 'Starting fresh — the damaged save was kept aside, not deleted.', 7000)
  }, [])

  const navigate = useCallback((next: AppView) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Chronos Chess: launch a legend battle from the timeline.
  const challengeLegend = useCallback(
    (legendId: LegendId, options: ChallengeOptions) => {
      game.startNewGame({
        ...game.gameSettings,
        mode: 'ai',
        legendId,
        bossId: null,
        legendStrength: options.strength,
        playerColor: options.color,
        timeControlId: options.timeControlId,
        ...(options.customMinutes !== undefined ? { customMinutes: options.customMinutes } : {}),
        ...(options.customIncrementSeconds !== undefined ? { customIncrementSeconds: options.customIncrementSeconds } : {}),
      })
      navigate('play')
    },
    [game, navigate],
  )

  // Grand Campaign: launch a boss battle from the world map (its realm chunk is already loaded).
  const challengeBoss = useCallback(
    (bossId: BossId, options: ChallengeClock, launch: BattleLaunch) => {
      game.startNewGame(
        {
          ...game.gameSettings,
          mode: 'ai',
          bossId,
          legendId: null,
          legendStrength: 'authentic',
          playerColor: options.color,
          timeControlId: options.timeControlId,
          ...(options.customMinutes !== undefined ? { customMinutes: options.customMinutes } : {}),
          ...(options.customIncrementSeconds !== undefined ? { customIncrementSeconds: options.customIncrementSeconds } : {}),
        },
        launch,
      )
      navigate('play')
    },
    [game, navigate],
  )

  // Daily tournament: a rated 5 + 3 game against your bracket opponent; colours alternate by round.
  const fightTournament = useCallback(
    (opponent: TournamentEntrant, round: number) => {
      if (!opponent.legendId) return
      game.startNewGame(
        {
          ...game.gameSettings,
          mode: 'ai',
          legendId: opponent.legendId,
          bossId: null,
          legendStrength: opponent.strength,
          playerColor: round % 2 === 0 ? 'w' : 'b',
          timeControlId: 'blitz-5-3',
        },
        { kind: 'tournament', tactics: [] },
      )
      navigate('play')
    },
    [game, navigate],
  )

  // Endless Gauntlet: your bank vs the boss's clock, boons applied, colours alternate.
  const fightGauntlet = useCallback(
    (boss: Boss) => {
      const run = gauntletStore.get().run
      if (!run) return
      beginGauntletBattle(boss)
      game.startNewGame(
        {
          ...game.gameSettings,
          mode: 'ai',
          bossId: boss.id,
          legendId: null,
          legendStrength: 'authentic',
          playerColor: run.round % 2 === 1 ? 'w' : 'b',
          timeControlId: 'custom',
          customMinutes: BOSS_CLOCK_MS / 60_000,
          customIncrementSeconds: (BASE_INCREMENT_MS + run.boons.incrementMs) / 1000,
        },
        { kind: 'gauntlet', tactics: run.boons.tactics, humanClockMs: run.bankMs, emp: run.boons.empBattles > 0, freeUndos: run.boons.shields },
      )
      navigate('play')
    },
    [game, navigate],
  )

  const openGauntlet = useCallback(() => {
    updateSettings({ legendsScreen: 'gauntlet' })
    navigate('legends')
  }, [navigate])

  const openCampaignMap = useCallback(() => {
    updateSettings({ legendsScreen: 'grand' })
    navigate('legends')
  }, [navigate])

  // While a legend battle is on screen, the whole app wears that epoch's theme.
  const epochTheme = view === 'play' ? (game.stage?.themeId ?? null) : null
  useEffect(() => {
    if (view !== 'legends') setThemeOverride(epochTheme)
  }, [epochTheme, view])

  const reviewMatch = useCallback(
    (match: MatchRecord) => {
      game.loadReview(match)
      navigate('play')
    },
    [game, navigate],
  )

  return (
    <div
      className={`safe-pt flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] short:pb-[env(safe-area-inset-bottom)] short:pl-[calc(5rem+env(safe-area-inset-left))] lg:pb-4 ${
        lockViewport ? 'h-dvh overflow-hidden' : 'min-h-dvh'
      }`}
    >
      <AppHeader view={view} onNavigate={navigate} onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex min-h-0 flex-1 flex-col">
        {/* PlayView stays mounted (hidden) so board state and animations persist. */}
        <div className={view === 'play' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          <ErrorBoundary scope="view" label="the game screen">
          <PlayView
            game={game}
            active={view === 'play'}
            newGameOpen={newGameOpen}
            onNewGameOpenChange={setNewGameOpen}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenCampaign={openCampaignMap}
            onOpenGauntlet={openGauntlet}
          />
          </ErrorBoundary>
        </div>
        <ErrorBoundary scope="view" resetKey={view} label={`the ${view} screen`}>
        <Suspense fallback={<ViewFallback />}>
          {view === 'legends' && <LegendsView onChallenge={challengeLegend} onChallengeBoss={challengeBoss} onFightGauntlet={fightGauntlet} onFightTournament={fightTournament} onReturnToBoard={() => navigate('play')} />}
          {view === 'rush' && <RushView active={view === 'rush'} />}
          {view === 'quests' && <QuestsView onNavigate={navigate} />}
          {view === 'puzzles' && <PuzzlesView />}
          {view === 'profile' && <ProfileView onReview={reviewMatch} />}
          {view === 'shop' && <ShopView onOpenLegends={() => navigate('legends')} />}
        </Suspense>
        </ErrorBoundary>
      </main>

      <BottomNav view={view} onNavigate={navigate} badges={{ puzzles: unsolvedDaily, quests: questRewards }} />
      {settingsOpen && (
        <ErrorBoundary scope="view" label="settings">
        <Suspense fallback={null}>
          <SettingsModal
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            onOpenShop={() => {
              setSettingsOpen(false)
              navigate('shop')
            }}
          />
        </Suspense>
        </ErrorBoundary>
      )}
      <ToastViewport />
    </div>
  )
}
