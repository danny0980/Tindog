import { Download, History, Share2, X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { sfx } from '../audio'
import { AnalysisPanel } from '../components/analysis/AnalysisPanel'
import { BoardHologram } from '../components/board/BoardHologram'
import { ChessBoard } from '../components/board/ChessBoard'
import { EvalBar } from '../components/board/EvalBar'
import { CampaignBattleStrip } from '../components/campaign/CampaignBattleStrip'
import { SpellHud } from '../components/campaign/SpellHud'
import { ConfettiCanvas } from '../components/effects/ConfettiCanvas'
import { ChessClock } from '../components/game/ChessClock'
import { ControlPanel } from '../components/game/ControlPanel'
import { GameMenuSheet } from '../components/game/GameMenuSheet'
import { GameStatusBanner } from '../components/game/GameStatusBanner'
import { MoveHistory } from '../components/game/MoveHistory'
import { PlayerBar } from '../components/game/PlayerBar'
import { ThumbDock } from '../components/game/ThumbDock'
import { TimeMachine } from '../components/game/TimeMachine'
import { GameOverModal } from '../components/modals/GameOverModal'
import { NewGameModal } from '../components/modals/NewGameModal'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { GestureGuide } from '../components/ui/GestureGuide'
import { LegendDialogue } from '../components/legends/LegendDialogue'
import { TimeWarpOverlay } from '../components/legends/TimeWarpOverlay'
import { Modal } from '../components/ui/Modal'
import { SwipeFeedback } from '../components/ui/SwipeFeedback'
import type { GameController } from '../hooks/useGameController'
import { useLayoutMode } from '../hooks/useLayoutMode'
import { type SwipeDirection, useSwipeGesture } from '../hooks/useSwipeGesture'
import { updateSettings } from '../stores/settingsStore'
import { showToast } from '../stores/toastStore'
import type { Color, GameSettings, MoveInput } from '../types/chess'
import { describeResult, givesCheck, opposite } from '../utils/chess'
import { pgnFilename, sharePgn, shareText } from '../utils/share'
import { statusSummary } from '../utils/status'

interface PlayViewProps {
  game: GameController
  active: boolean
  newGameOpen: boolean
  onNewGameOpenChange: (open: boolean) => void
  onOpenSettings: () => void
  /** Opens the Grand Campaign world map. */
  onOpenCampaign: () => void
  /** Opens the Endless Gauntlet screen. */
  onOpenGauntlet: () => void
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

const SWIPE_LABELS: Record<SwipeDirection, string> = { left: 'Undo', right: 'Board flipped', up: 'Moves', down: 'Menu' }

export function PlayView({ game, active, newGameOpen, onNewGameOpenChange, onOpenSettings, onOpenCampaign, onOpenGauntlet }: PlayViewProps) {
  const [confirmResign, setConfirmResign] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [movesOpen, setMovesOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  // Game key whose time-travel intro has already played.
  const [warpFor, setWarpFor] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ id: number; direction: SwipeDirection; label: string } | null>(null)
  const { oneHanded, gestures } = useLayoutMode()
  const settings = game.settings
  // Legend battles use their epoch's pieces; otherwise the player's equipped set.
  const pieceSet = game.pieceSet
  const turn = game.status.kind === 'playing' ? game.status.turn : null
  const { timeMachine } = game
  const total = game.history.length

  // First-run gesture tutorial on touch layouts.
  const showGuide = guideOpen || (active && gestures && !settings.gestureHintSeen && !newGameOpen)
  const closeGuide = useCallback(() => {
    setGuideOpen(false)
    updateSettings({ gestureHintSeen: true })
  }, [])

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
  const onPickup = useCallback(() => sfx.pickup(), [])

  const share = useCallback(async () => {
    const result = await shareText('Chess Arena game', buildShareSummary(game))
    if (result === 'copied') showToast('success', 'Copied to clipboard', 'Game summary and PGN copied.')
  }, [game])

  const exportPgn = useCallback(async () => {
    const result = await sharePgn(pgnFilename(game.players.w.name, game.players.b.name), game.getPgn())
    if (result === 'downloaded') showToast('success', 'PGN exported')
  }, [game])

  // Campaign battles: a takeback spends the Shield of Kings or caps the win at
  // one star, so swipes and buttons both ask first.
  const requestUndo = useCallback(() => {
    if (game.undoCost) setConfirmUndo(true)
    else game.undo()
  }, [game])

  // ── Swipe gestures (on bars / dock, never on the board) ─────────────────────
  const handleSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (direction === 'left') {
        if (!game.canUndo) {
          sfx.error()
          setFeedback({ id: Date.now(), direction, label: 'Nothing to undo' })
          return
        }
        if (game.undoCost) {
          setConfirmUndo(true)
          return
        }
        game.undo()
      } else if (direction === 'right') game.flipBoard()
      else if (direction === 'up') setMovesOpen(true)
      else setMenuOpen((open) => !open)
      sfx.swipe()
      setFeedback({ id: Date.now(), direction, label: SWIPE_LABELS[direction] })
    },
    [game],
  )
  const swipe = useSwipeGesture({ enabled: gestures && active, onSwipe: handleSwipe })

  useEffect(() => {
    if (!feedback) return
    const id = window.setTimeout(() => setFeedback(null), 950)
    return () => window.clearTimeout(id)
  }, [feedback])

  // Keyboard time machine: ← → Home End.
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

  const renderPlayer = (color: Color, hideClock = false) => {
    const character = game.players[color].character
    return (
      <div className="relative">
        <PlayerBar
          player={game.players[color]}
          isTurn={turn === color}
          thinking={game.aiThinking && game.players[color].isEngine}
          captured={game.captured[color]}
          advantage={color === 'w' ? game.captured.materialDiff : -game.captured.materialDiff}
          pieceSet={pieceSet}
          hideClock={hideClock}
          clock={{ enabled: game.clock.enabled, timeMs: game.clock.times[color], initialMs: game.timeControl.initialMs }}
        />
        {/* Character remarks float over the board edge next to their bar. */}
        {character && <LegendDialogue speakerKey={character.key} placement={color === game.orientation ? 'above' : 'below'} />}
      </div>
    )
  }

  const board = (
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
          onPickup={onPickup}
          theme={game.theme}
          pieceSet={pieceSet}
          lowPower={settings.batterySaver}
          showLegalMoves={settings.showLegalMoves}
          showCoordinates={settings.showCoordinates}
          arrows={arrows}
          frozenSquare={game.frozenSquare}
          specialTargets={game.specialTargets}
        >
          {hologram && !settings.batterySaver && <BoardHologram key={`${game.gameKey}-${total}`} text={hologram.text} tone={hologram.tone} />}
          {game.spellFlash && !settings.batterySaver && timeMachine.isLive && (
            <BoardHologram key={`spell-${game.spellFlash.id}`} text={game.spellFlash.text} tone={game.spellFlash.tone} />
          )}
        </ChessBoard>
      </div>
    </div>
  )

  const reviewBanner = game.review && (
    <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
      <History className="size-4 text-accent" />
      <span className="flex-1 truncate text-slate-200">Reviewing saved game · {game.review.opponent}</span>
      <Button size="sm" variant="ghost" onClick={openNewGame} icon={<X className="size-4" />}>
        Exit
      </Button>
    </div>
  )

  const analysisHint = currentMoveAnalysis && !timeMachine.isLive && currentMoveAnalysis.bestMoveSan && (
    <div className="glass animate-fade-in rounded-xl px-3 py-2 text-center text-xs text-slate-300">
      {currentMoveAnalysis.san} was a <span className="font-bold capitalize text-white">{currentMoveAnalysis.classification}</span> — best was{' '}
      <span className="font-mono font-bold text-lime-300">{currentMoveAnalysis.bestMoveSan}</span>
    </div>
  )

  const reviewTools = (defaultOpen: boolean): ReactNode => (
    <>
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
      <MoveHistory history={game.history} currentPly={timeMachine.displayPly} analysis={analysisMoves} onSelect={timeMachine.goTo} defaultOpen={defaultOpen} />
    </>
  )

  const campaignStrip = game.boss && !game.review && (
    <CampaignBattleStrip
      boss={game.boss}
      relics={game.battleRelics}
      movesPlayed={game.history.filter((m) => m.color === game.humanColor).length}
      casual={game.casual}
      shieldUsed={game.shieldUsed}
    />
  )

  const spellHud = (compact: boolean) =>
    game.battle && game.effects && !game.review ? <SpellHud setup={game.battle} effects={game.effects} opponentName={game.opponentName} compact={compact} /> : null

  // The human's own colour sits at the bottom (the side being "held").
  const bottomColor = game.orientation
  const topColor = opposite(game.orientation)

  return (
    <>
      {oneHanded ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="safe-px shrink-0 space-y-2" {...swipe}>
            {reviewBanner}
            {renderPlayer(topColor)}
            {spellHud(true)}
          </div>
          {/* Size container: the board takes the largest square the leftover space allows. */}
          <div className="safe-px flex min-h-0 flex-1 items-center justify-center py-2 [container-type:size]">
            <div className={game.evalEnabled ? 'w-[min(100cqw,calc(100cqh+1.4rem))]' : 'w-[min(100cqw,100cqh)]'}>{board}</div>
          </div>
          <ThumbDock
            swipe={swipe}
            gestures={gestures}
            status={statusSummary(game.status, {
              aiThinking: game.aiThinking,
              opponentName: game.opponentName,
              isLive: timeMachine.isLive,
              engineLoading: game.isAiMode && game.engineStatus === 'loading',
            })}
            thinking={game.aiThinking}
            clock={
              game.clock.enabled ? (
                <ChessClock timeMs={game.clock.times[bottomColor]} active={turn === bottomColor} initialMs={game.timeControl.initialMs} size="lg" />
              ) : null
            }
            player={renderPlayer(bottomColor, true)}
            canUndo={game.canUndo}
            onUndo={requestUndo}
            onNewGame={openNewGame}
            onMoves={() => setMovesOpen(true)}
            onMenu={() => setMenuOpen(true)}
          />
        </div>
      ) : (
        <div className="safe-px mx-auto grid w-full max-w-7xl flex-1 gap-4 pb-4 short:grid-cols-[auto_minmax(16rem,1fr)] short:items-start lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6">
          <section
            className="mx-auto flex w-full max-w-[min(100%,max(18rem,calc(100dvh-16rem)),48rem)] flex-col gap-2.5 short:mx-0 short:w-[calc(100dvh-5.5rem)] short:max-w-none"
            aria-label="Chess board"
          >
            {reviewBanner}
            <div className="short:hidden" {...swipe}>
              {renderPlayer(topColor)}
            </div>
            {board}
            <div className="short:hidden" {...swipe}>
              {renderPlayer(bottomColor)}
            </div>
            {analysisHint}
          </section>

          <aside
            className="scrollbar-thin flex flex-col gap-3 short:sticky short:top-2 short:max-h-[calc(100dvh-5rem)] short:overflow-y-auto lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1 [&>*]:shrink-0"
            aria-label="Game controls"
          >
            {/* Landscape phones: player bars move beside the board. */}
            <div className="hidden space-y-2 short:block" {...swipe}>
              {renderPlayer(topColor)}
              {renderPlayer(bottomColor)}
            </div>
            <div {...swipe}>
              <GameStatusBanner
                status={game.status}
                aiThinking={game.aiThinking}
                engineStatus={game.engineStatus}
                engineError={game.engineError}
                isAiMode={game.isAiMode}
                isLive={timeMachine.isLive}
                isReview={game.review !== null}
                opponentName={game.opponentName}
                opening={game.opening}
              />
            </div>
            {campaignStrip}
            {spellHud(false)}
            <ControlPanel
              canUndo={game.canUndo}
              canResign={game.canResign}
              onNewGame={openNewGame}
              onFlip={game.flipBoard}
              onUndo={requestUndo}
              onResign={() => setConfirmResign(true)}
            />
            {reviewTools(false)}
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
      )}

      {feedback && <SwipeFeedback key={feedback.id} direction={feedback.direction} label={feedback.label} />}

      <Modal open={movesOpen && active} title="Moves & analysis" onClose={() => setMovesOpen(false)} size="md">
        <div className="space-y-3 pb-2">
          {game.opening && (
            <div className="text-xs text-slate-400">
              <span className="font-mono font-bold text-accent">{game.opening.eco}</span> {game.opening.name}
            </div>
          )}
          {oneHanded && campaignStrip}
          {oneHanded && analysisHint}
          {reviewTools(true)}
        </div>
      </Modal>

      <GameMenuSheet
        open={menuOpen && active}
        onClose={() => setMenuOpen(false)}
        canResign={game.canResign}
        canExport={total > 0}
        oneHanded={settings.oneHanded}
        onNewGame={openNewGame}
        onFlip={game.flipBoard}
        onResign={() => setConfirmResign(true)}
        onExport={() => void exportPgn()}
        onShare={() => void share()}
        onOpenSettings={onOpenSettings}
        onToggleOneHanded={(value) => updateSettings({ oneHanded: value })}
        onShowGestures={() => setGuideOpen(true)}
      />

      <GestureGuide open={showGuide} onClose={closeGuide} />

      {game.persona && !settings.batterySaver && warpFor !== game.gameKey && game.history.length === 0 && active && (
        <TimeWarpOverlay key={game.gameKey} persona={game.persona} onDone={() => setWarpFor(game.gameKey)} />
      )}

      <ConfettiCanvas burst={game.celebration} colors={game.theme.particles} disabled={settings.batterySaver} />

      <NewGameModal open={newGameOpen} initialSettings={game.gameSettings} onStart={startGame} onClose={() => onNewGameOpenChange(false)} />

      <ConfirmDialog
        open={confirmUndo && active}
        title="Take back your move?"
        message={
          game.undoCost === 'shield'
            ? 'Your Shield of Kings will absorb this takeback: the battle stays rated and keeps its stars, but the shield is spent for this battle.'
            : 'Taking back a move in a campaign battle makes it unrated and caps a win at one star.'
        }
        confirmLabel={game.undoCost === 'shield' ? 'Use the Shield' : 'Take back'}
        confirmVariant={game.undoCost === 'shield' ? 'primary' : 'danger'}
        onConfirm={() => {
          setConfirmUndo(false)
          game.undo()
        }}
        onCancel={() => setConfirmUndo(false)}
      />

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
        onRematch={() => game.startNewGame(game.gameSettings)}
        onOpenCampaign={() => {
          game.dismissGameOver()
          onOpenCampaign()
        }}
        onOpenGauntlet={() => {
          game.dismissGameOver()
          onOpenGauntlet()
        }}
        onReview={game.dismissGameOver}
        onAnalyze={game.requestAnalysis}
        onShare={() => void share()}
      />
    </>
  )
}
