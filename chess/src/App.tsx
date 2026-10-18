import { Suspense, lazy, useCallback, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { BottomNav } from './components/layout/BottomNav'
import { SettingsModal } from './components/modals/SettingsModal'
import { ToastViewport } from './components/ui/ToastViewport'
import { useAppEnvironment } from './hooks/useAppEnvironment'
import { useGameController } from './hooks/useGameController'
import { useStore } from './hooks/useStore'
import { profileStore } from './stores/profileStore'
import type { MatchRecord } from './types/profile'
import type { AppView } from './types/ui'
import { localDateKey } from './utils/date'
import { getDailyPuzzles } from './utils/puzzles'
import { PlayView } from './views/PlayView'

// Secondary screens are code-split so the board loads first on slow mobile connections.
const PuzzlesView = lazy(() => import('./views/PuzzlesView').then((m) => ({ default: m.PuzzlesView })))
const ProfileView = lazy(() => import('./views/ProfileView').then((m) => ({ default: m.ProfileView })))
const ShopView = lazy(() => import('./views/ShopView').then((m) => ({ default: m.ShopView })))

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

  // The game lives at the app level so it survives tab switches; its clock pauses off-screen.
  const game = useGameController({ active: view === 'play' })

  const solved = useStore(profileStore, (p) => p.puzzles.solved)
  const unsolvedDaily = getDailyPuzzles(localDateKey()).some((p) => !solved[p.id])

  const navigate = useCallback((next: AppView) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const reviewMatch = useCallback(
    (match: MatchRecord) => {
      game.loadReview(match)
      navigate('play')
    },
    [game, navigate],
  )

  return (
    <div className="safe-pt flex min-h-dvh flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-4">
      <AppHeader view={view} onNavigate={navigate} onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex flex-1 flex-col">
        {/* PlayView stays mounted (hidden) so board state and animations persist. */}
        <div className={view === 'play' ? 'flex flex-1 flex-col' : 'hidden'}>
          <PlayView game={game} active={view === 'play'} newGameOpen={newGameOpen} onNewGameOpenChange={setNewGameOpen} />
        </div>
        <Suspense fallback={<ViewFallback />}>
          {view === 'puzzles' && <PuzzlesView />}
          {view === 'profile' && <ProfileView onReview={reviewMatch} />}
          {view === 'shop' && <ShopView />}
        </Suspense>
      </main>

      <BottomNav view={view} onNavigate={navigate} badges={{ puzzles: unsolvedDaily }} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenShop={() => {
          setSettingsOpen(false)
          navigate('shop')
        }}
      />
      <ToastViewport />
    </div>
  )
}
