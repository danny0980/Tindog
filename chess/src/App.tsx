import { useCallback, useState } from 'react'
import { ChessBoard } from './components/ChessBoard'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ControlPanel } from './components/ControlPanel'
import { GameOverModal } from './components/GameOverModal'
import { GameStatusBanner } from './components/GameStatusBanner'
import { Header } from './components/Header'
import { MoveHistory } from './components/MoveHistory'
import { NewGameModal } from './components/NewGameModal'
import { PlayerBar } from './components/PlayerBar'
import { DIFFICULTIES } from './constants/game'
import { useGameController } from './hooks/useGameController'
import type { Color, GameSettings } from './types/chess'
import { opposite } from './utils/chess'

export default function App() {
  const game = useGameController()
  const [newGameOpen, setNewGameOpen] = useState(false)
  const [confirmResign, setConfirmResign] = useState(false)

  const isAiMode = game.settings.mode === 'ai'
  const difficultyLabel = DIFFICULTIES.find((d) => d.id === game.settings.difficulty)?.label ?? ''
  const turn = game.status.kind === 'playing' ? game.status.turn : null

  const openNewGame = useCallback(() => {
    game.dismissGameOver()
    setNewGameOpen(true)
  }, [game])

  const startGame = useCallback(
    (settings: GameSettings) => {
      setNewGameOpen(false)
      game.startNewGame(settings)
    },
    [game],
  )

  const renderPlayer = (color: Color) => (
    <PlayerBar
      player={game.players[color]}
      isTurn={turn === color}
      thinking={game.aiThinking && game.players[color].isEngine}
      captured={game.captured[color]}
      advantage={color === 'w' ? game.captured.materialDiff : -game.captured.materialDiff}
      clock={{ enabled: game.clock.enabled, timeMs: game.clock.times[color], initialMs: game.timeControl.initialMs }}
    />
  )

  return (
    <div className="safe-pt safe-pb flex min-h-dvh flex-col">
      <Header
        mode={game.settings.mode}
        difficultyLabel={difficultyLabel}
        timeControl={game.timeControl}
        soundEnabled={game.soundEnabled}
        onToggleSound={game.toggleSound}
      />

      <main className="safe-px mx-auto grid w-full max-w-6xl flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        <section
          className="mx-auto flex w-full flex-col gap-2.5"
          style={{ maxWidth: 'min(100%, max(18rem, calc(100dvh - 15.5rem)), 46rem)' }}
          aria-label="Chess board"
        >
          {renderPlayer(opposite(game.orientation))}
          <ChessBoard
            fen={game.fen}
            orientation={game.orientation}
            lastMove={game.lastMove}
            status={game.status}
            movableColor={game.movableColor}
            onMove={game.applyMove}
          />
          {renderPlayer(game.orientation)}
        </section>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-7rem)]" aria-label="Game controls">
          <GameStatusBanner
            status={game.status}
            aiThinking={game.aiThinking}
            engineStatus={game.engineStatus}
            engineError={game.engineError}
            isAiMode={isAiMode}
          />
          <ControlPanel
            canUndo={game.canUndo}
            canResign={game.canResign}
            onNewGame={openNewGame}
            onFlip={game.flipBoard}
            onUndo={game.undo}
            onResign={() => setConfirmResign(true)}
          />
          <MoveHistory history={game.history} getPgn={game.getPgn} />
        </aside>
      </main>

      <NewGameModal
        open={newGameOpen}
        initialSettings={game.settings}
        onStart={startGame}
        onClose={() => setNewGameOpen(false)}
      />

      <ConfirmDialog
        open={confirmResign}
        title="Resign game?"
        message={
          isAiMode
            ? 'Stockfish will be awarded the win.'
            : `${turn === 'b' ? 'Black' : 'White'} resigns and ${turn === 'b' ? 'White' : 'Black'} wins.`
        }
        confirmLabel="Resign"
        onCancel={() => setConfirmResign(false)}
        onConfirm={() => {
          setConfirmResign(false)
          game.resign()
        }}
      />

      <GameOverModal
        open={game.showGameOver && !newGameOpen}
        result={game.result}
        mode={game.settings.mode}
        humanColor={game.humanColor}
        moveCount={game.history.length}
        onNewGame={openNewGame}
        onReview={game.dismissGameOver}
      />
    </div>
  )
}
