import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { BottomNav } from './components/layout/BottomNav'
import { ToastViewport } from './components/ui/ToastViewport'
import { useAppEnvironment } from './hooks/useAppEnvironment'
import { useGameController } from './hooks/useGameController'
import { useLayoutMode } from './hooks/useLayoutMode'
import { useStore } from './hooks/useStore'
import { profileStore } from './stores/profileStore'
import type { MatchRecord } from './types/profile'
import type { ColorChoice } from './types/chess'
import type { LegendId } from './types/legend'
import { setThemeOverride } from './stores/themeOverrideStore'
import type { AppView } from './types/ui'
import { localDateKey } from './utils/date'
import { getDailyPuzzles } from './utils/puzzles'
import { claimableCount } from './utils/quests'
import { PlayView } from './views/PlayView'

// Secondary screens are code-split so the board loads first on slow mobile connections.
const PuzzlesView = lazy(() => import('./views/PuzzlesView').then((m) => ({ default: m.PuzzlesView })))
const ProfileView = lazy(() => import('./views/ProfileView').then((m) => ({ default: m.ProfileView })))
const ShopView = lazy(() => import('./views/ShopView').then((m) => ({ default: m.ShopView })))
const SettingsModal = lazy(() => import('./components/modals/SettingsModal').then((m) => ({ default: m.SettingsModal })))
const LegendsView = lazy(() => import('./views/LegendsView').then((m) => ({ default: m.LegendsView })))
const RushView = lazy(() => import('./views/RushView').then((m) => ({ default: m.RushView })))
const QuestsView = lazy(() => import('./views/QuestsView').then((m) => ({ default: m.QuestsView })))

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

  const navigate = useCallback((next: AppView) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Chronos Chess: launch a legend battle from the timeline.
  const challengeLegend = useCallback(
    (legendId: LegendId, options: { color: ColorChoice; timeControlId: string }) => {
      game.startNewGame({ ...game.gameSettings, mode: 'ai', legendId, playerColor: options.color, timeControlId: options.timeControlId })
      navigate('play')
    },
    [game, navigate],
  )

  // While a legend battle is on screen, the whole app wears that epoch's theme.
  const epochTheme = view === 'play' ? (game.epoch?.themeId ?? null) : null
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
          <PlayView
            game={game}
            active={view === 'play'}
            newGameOpen={newGameOpen}
            onNewGameOpenChange={setNewGameOpen}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
        <Suspense fallback={<ViewFallback />}>
          {view === 'legends' && <LegendsView onChallenge={challengeLegend} />}
          {view === 'rush' && <RushView active={view === 'rush'} />}
          {view === 'quests' && <QuestsView onNavigate={navigate} />}
          {view === 'puzzles' && <PuzzlesView />}
          {view === 'profile' && <ProfileView onReview={reviewMatch} />}
          {view === 'shop' && <ShopView onOpenLegends={() => navigate('legends')} />}
        </Suspense>
      </main>

      <BottomNav view={view} onNavigate={navigate} badges={{ puzzles: unsolvedDaily, quests: questRewards }} />
      {settingsOpen && (
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
      )}
      <ToastViewport />
    </div>
  )
}
