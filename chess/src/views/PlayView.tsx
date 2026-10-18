import { Download, History, Share2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnalysisPanel } from '../components/analysis/AnalysisPanel'
import { BoardHologram } from '../components/board/BoardHologram'
import { ChessBoard } from '../components/board/ChessBoard'
import { EvalBar } from '../components/board/EvalBar'
import { ConfettiCanvas } from '../components/effects/ConfettiCanvas'
import { ControlPanel } from '../components/game/ControlPanel'
import { GameStatusBanner } from '../components/game/GameStatusBanner'
import { MoveHistory } from '../components/game/MoveHistory'
import { PlayerBar } from '../components/game/PlayerBar'
import { TimeMachine } from '../components/game/TimeMachine'
import { GameOverModal } from '../components/modals/GameOverModal'
import { NewGameModal } from '../components/modals/NewGameModal'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { getPieceSet } from '../constants/themes'
import type { GameController } from '../hooks/useGameController'
import { showToast } from '../stores/toastStore'
import type { Color, GameSettings, MoveInput } from '../types/chess'
import { describeResult, givesCheck, opposite } from '../utils/chess'
import { pgnFilename, sharePgn, shareText } from '../utils/share'

interface PlayViewProps {
  game: GameController
  active: boolean
  newGameOpen: boolean
  onNewGameOpenChange: (open: boolean) => void
}

function buildShareSummary(game: GameController): string {
  const lines = ['♞ Chess Arena']
  if (game.result) {
    const { title, detail } = describeResult(game.result)
    lines.push(`${title} ${detail} — ${Math.ceil(game.history.length / 2)} moves`)
  }
  lines.push(`${game.players.w.name} (White) vs ${game.players.b.name} (Black)`)
  if (game.opening) lines.push(`Opening: ${game.opening.name} (${game.opening.eco})`)
  if (game.analysis.status === 'done') {
    lines.push(`Accuracy — White ${game.analysis.analysis.accuracy.w.toFixed(1)}% · Black ${game.analysis.analysis.accuracy.b.toFixed(1)}%`)
  }
  if (game.summary?.eloAfter) lines.push(`Rating: ${game.summary.eloAfter} (${(game.summary.eloDelta ?? 0) >= 0 ? '+' : ''}${game.summary.eloDelta ?? 0})`)
  lines.push('', game.getPgn())
  return lines.join('\n')
}

export function PlayView({ game, active, newGameOpen, onNewGameOpenChange }: PlayViewProps) {
  const [confirmResign, setConfirmResign] = useState(false)
  const settings = game.settings
  const pieceSet = getPieceSet(settings.pieceSet)
  const turn = game.status.kind === 'playing' ? game.status.turn : null
  const { timeMachine } = game
  const total = game.history.length

  const openNewGame = useCallback(() => {
    game.dismissGameOver()
    onNewGameOpenChange(true)
  }, [game, onNewGameOpenChange])

  const startGame = useCallback(
    (next: GameSettings) => {
      onNewGameOpenChange(false)
      game.startNewGame(next)
    },
    [game, onNewGameOpenChange],
  )

  const onMove = useCallback((move: MoveInput) => game.applyMove(move) !== null, [game])

  const share = useCallback(async () => {
    const result = await shareText('Chess Arena game', buildShareSummary(game))
    if (result === 'copied') showToast('success', 'Copied to clipboard', 'Game summary and PGN copied.')
  }, [game])

  const exportPgn = useCallback(async () => {
    const result = await sharePgn(pgnFilename(game.players.w.name, game.players.b.name), game.getPgn())
    if (result === 'downloaded') showToast('success', 'PGN exported')
  }, [game])

  // Keyboard time machine: ← → Home End, space to replay.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || document.querySelector('[role="dialog"]')) return
      if (e.key === 'ArrowLeft') timeMachine.step(-1)
      else if (e.key === 'ArrowRight') timeMachine.step(1)
      else if (e.key === 'Home') timeMachine.goTo(0)
      else if (e.key === 'End') timeMachine.goTo(null)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, timeMachine])

  // Holographic callouts for the live position.
  const hologram = useMemo(() => {
    if (!timeMachine.isLive || !game.lastMove) return null
    if (game.result?.kind === 'checkmate') return { text: 'Checkmate', tone: 'gold' as const }
    if (game.result?.kind === 'timeout') return { text: 'Time!', tone: 'danger' as const }
    if (game.result?.kind === 'draw' && game.result.reason === 'stalemate') return { text: 'Stalemate', tone: 'accent' as const }
    if (givesCheck(game.lastMove)) return { text: 'Check', tone: 'danger' as const }
    return null
  }, [game.lastMove, game.result, timeMachine.isLive])

  const analysisMoves = game.analysis.status === 'done' ? game.analysis.analysis.moves : null
  const currentMoveAnalysis = analysisMoves?.[timeMachine.displayPly - 1] ?? null
  const arrows = game.bestMoveArrow ? [{ ...game.bestMoveArrow, color: 'rgba(132, 204, 22, 0.85)' }] : []

  const renderPlayer = (color: Color) => (
    <PlayerBar
      player={game.players[color]}
      isTurn={turn === color}
      thinking={game.aiThinking && game.players[color].isEngine}
      captured={game.captured[color]}
      advantage={color === 'w' ? game.captured.materialDiff : -game.captured.materialDiff}
      pieceSet={pieceSet}
      clock={{ enabled: game.clock.enabled, timeMs: game.clock.times[color], initialMs: game.timeControl.initialMs }}
    />
  )

  return (
    <>
      <div className="safe-px mx-auto grid w-full max-w-7xl flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6">
        <section className="mx-auto flex w-full flex-col gap-2.5" style={{ maxWidth: 'min(100%, max(18rem, calc(100dvh - 16rem)), 48rem)' }} aria-label="Chess board">
          {game.review && (
            <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <History className="size-4 text-accent" />
              <span className="flex-1 truncate text-slate-200">Reviewing saved game · {game.review.opponent}</span>
              <Button size="sm" variant="ghost" onClick={openNewGame} icon={<X className="size-4" />}>
                Exit
              </Button>
            </div>
          )}
          {renderPlayer(opposite(game.orientation))}
          <div className="flex items-stretch gap-2">
            {game.evalEnabled && <EvalBar evaluation={game.evaluation} orientation={game.orientation} />}
            <div className="min-w-0 flex-1">
              <ChessBoard
                id="play-board"
                fen={game.fen}
                orientation={game.orientation}
                lastMove={game.lastMove}
                movableColor={game.movableColor}
                onMove={onMove}
                theme={game.theme}
                pieceSet={pieceSet}
                lowPower={settings.batterySaver}
                showLegalMoves={settings.showLegalMoves}
                showCoordinates={settings.showCoordinates}
                arrows={arrows}
              >
                {hologram && !settings.batterySaver && <BoardHologram key={`${game.gameKey}-${total}`} text={hologram.text} tone={hologram.tone} />}
              </ChessBoard>
            </div>
          </div>
          {renderPlayer(game.orientation)}
          {currentMoveAnalysis && !timeMachine.isLive && currentMoveAnalysis.bestMoveSan && (
            <div className="glass animate-fade-in rounded-xl px-3 py-2 text-center text-xs text-slate-300">
              {currentMoveAnalysis.san} was a <span className="font-bold capitalize text-white">{currentMoveAnalysis.classification}</span> — best was{' '}
              <span className="font-mono font-bold text-lime-300">{currentMoveAnalysis.bestMoveSan}</span>
            </div>
          )}
        </section>

        <aside className="scrollbar-thin flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1 [&>*]:shrink-0" aria-label="Game controls">
          <GameStatusBanner
            status={game.status}
            aiThinking={game.aiThinking}
            engineStatus={game.engineStatus}
            engineError={game.engineError}
            isAiMode={game.isAiMode}
            isLive={timeMachine.isLive}
            isReview={game.review !== null}
            opening={game.opening}
          />
          <ControlPanel
            canUndo={game.canUndo}
            canResign={game.canResign}
            onNewGame={openNewGame}
            onFlip={game.flipBoard}
            onUndo={game.undo}
            onResign={() => setConfirmResign(true)}
          />
          <TimeMachine machine={timeMachine} total={total} />
          <AnalysisPanel
            state={game.analysis}
            available={game.analysisAvailable}
            totalPlies={total}
            currentPly={timeMachine.displayPly}
            names={{ w: game.players.w.name, b: game.players.b.name }}
            onAnalyze={game.requestAnalysis}
            onSelect={timeMachine.goTo}
          />
          <MoveHistory history={game.history} currentPly={timeMachine.displayPly} analysis={analysisMoves} onSelect={timeMachine.goTo} />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => void exportPgn()} disabled={total === 0} icon={<Download className="size-4" />}>
              Export PGN
            </Button>
            <Button size="sm" onClick={() => void share()} disabled={total === 0} icon={<Share2 className="size-4" />}>
              Share
            </Button>
          </div>
        </aside>
      </div>

      <ConfettiCanvas burst={game.celebration} colors={game.theme.particles} disabled={settings.batterySaver} />

      <NewGameModal open={newGameOpen} initialSettings={game.gameSettings} onStart={startGame} onClose={() => onNewGameOpenChange(false)} />

      <ConfirmDialog
        open={confirmResign}
        title="Resign game?"
        message={
          game.isAiMode
            ? `Stockfish will be awarded the win${game.casual ? '' : ' and your rating will change'}.`
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
        open={game.showGameOver && !newGameOpen && active}
        summary={game.summary}
        isAiMode={game.isAiMode}
        moveCount={total}
        onNewGame={openNewGame}
        onReview={game.dismissGameOver}
        onAnalyze={game.requestAnalysis}
        onShare={() => void share()}
      />
    </>
  )
}

