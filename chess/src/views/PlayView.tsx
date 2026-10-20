import { BrainCircuit, Download, GitBranch, GraduationCap, History, Share2, X } from 'lucide-react'
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lazyWithRetry } from '../utils/lazyWithRetry'
import { importWithRetry } from '../utils/retry'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { sfx } from '../audio'
import { AnalysisPanel } from '../components/analysis/AnalysisPanel'
import { MoveInsightCard } from '../components/analysis/MoveInsightCard'
import { loadedLore } from '../data/classic/loreLoader'
import type { QuizQuestion } from '../data/classic/quiz'
import { type ClassicCharacter, getClassic } from '../data/classic/roster'
import { useBeatenClassics } from '../components/history/useBeaten'
import { BoardHologram } from '../components/board/BoardHologram'
import { ChessBoard } from '../components/board/ChessBoard'
import { EvalBar } from '../components/board/EvalBar'
import { CampaignBattleStrip } from '../components/campaign/CampaignBattleStrip'
import { SpellHud } from '../components/campaign/SpellHud'
import { ArenaBar } from '../components/roguelike/ArenaBar'
import { Battlefield } from '../components/cinema/Battlefield'
import { BrainPanel } from '../components/brain/BrainPanel'
import { WhatIfModal } from '../components/whatif/WhatIfModal'
import { brainArrows } from '../brain/brain'
import { useBrain } from '../brain/useBrain'
import { type CoachProfile, type Warning, coachProfile, detect, historyNote, warningsFor } from '../coach/patterns'
import { HighlightReelModal } from '../components/cinema/HighlightReelModal'
import { solidOf } from '../cinema/reelRenderer'
import { CinemaStage } from '../components/cinema/CinemaStage'
import { shotsFor } from '../cinema/director'
import { terrainFor } from '../cinema/terrain'
import { MoodBackdrop } from '../components/roguelike/MoodBackdrop'
import { WeatherOverlay } from '../components/roguelike/WeatherOverlay'
import { SpellParticles } from '../components/fx/SpellParticles'
import { ArenaBackdrop } from '../components/fx/ArtBackdrop'
import { Vignette } from '../components/fx/Vignette'
import { playFx } from '../components/fx/playFx'
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
import { useStore } from '../hooks/useStore'
import { type SwipeDirection, useSwipeGesture } from '../hooks/useSwipeGesture'
import { profileStore } from '../stores/profileStore'
import { updateSettings } from '../stores/settingsStore'
import { showToast } from '../stores/toastStore'
import type { Color, GameSettings, MoveInput, Square } from '../types/chess'
import { describeResult, givesCheck, opposite } from '../utils/chess'
import { pgnFilename, sharePgn, shareText } from '../utils/share'
import { statusSummary } from '../utils/status'

// The interview and the quiz need the characters' history: loaded when opened.
const InterviewModal = lazyWithRetry(() => import('../components/history/InterviewPanel'), (m) => m.InterviewModal)
const QuizPanel = lazyWithRetry(() => import('../components/history/QuizPanel'), (m) => m.QuizPanel)

interface PlayViewProps {
  game: GameController
  active: boolean
  newGameOpen: boolean
  onNewGameOpenChange: (open: boolean) => void
  onOpenSettings: () => void
  /** Opens the Grand Campaign world map. */
  onOpenCampaign: () => void
  onOpenWar: () => void
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

const NO_SQUARES: readonly Square[] = []

const SWIPE_LABELS: Record<SwipeDirection, string> = { left: 'Undo', right: 'Board flipped', up: 'Moves', down: 'Menu' }

/** Coach profiles by match list (the list is replaced, never mutated, when a game is saved). */
const coachCache = new WeakMap<object, CoachProfile>()
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
/** Plies between two coach warnings, so it never nags. */
const COACH_GAP = 6

export function PlayView({ game, active, newGameOpen, onNewGameOpenChange, onOpenSettings, onOpenCampaign, onOpenGauntlet, onOpenWar }: PlayViewProps) {
  const [confirmResign, setConfirmResign] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [movesOpen, setMovesOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [interviewing, setInterviewing] = useState<ClassicCharacter | null>(null)
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null)
  const [reelOpen, setReelOpen] = useState(false)
  const beatenClassics = useBeatenClassics()
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
  const potions = useStore(profileStore, (p) => p.inventory.potions)
  // Fog of war hides move hints and the evaluation bar for the whole battle.
  const fog = game.battle?.weather === 'fog' && !game.review && game.status.kind === 'playing'
  const showEval = game.evalEnabled && !fog
  const moodFx = settings.moodEffects && !settings.batterySaver
  // Post-processing bursts on the board: quake + chromatic aberration on
  // critical checks and mates, bloom when a spell or tactic flares.
  const boardFxRef = useRef<HTMLDivElement>(null)
  const boardLensRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moodFx || game.severeCheck === 0) return
    playFx(boardFxRef.current, 'quake')
    playFx(boardLensRef.current, 'chroma')
  }, [game.severeCheck, moodFx])
  // Cinematic camera: a shot for the move just played (each plays once), with slow motion while it runs.
  const reducedMotion = useMemo(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const cinemaMode = settings.batterySaver || reducedMotion ? 'off' : settings.cinematicCamera
  const shots = useMemo(() => shotsFor(game.history, cinemaMode), [cinemaMode, game.history])
  const [playedShots, setPlayedShots] = useState<readonly string[]>([])
  const candidate = active && timeMachine.isLive && !game.review && total > 0 ? (shots[total - 1] ?? null) : null
  const shotKey = candidate ? `${game.gameKey}|${candidate.id}` : null
  const shot = candidate && shotKey && !playedShots.includes(shotKey) ? candidate : null
  const onShotDone = useCallback(() => {
    if (shotKey) setPlayedShots((p) => (p.includes(shotKey) ? p : [...p.slice(-40), shotKey]))
  }, [shotKey])
  const terrain = useMemo(() => terrainFor(settings.battlefield, game.theme.id), [game.theme.id, settings.battlefield])
  const mateCam = game.killCam?.id ?? null
  useEffect(() => {
    if (moodFx && mateCam !== null) playFx(boardLensRef.current, 'chroma')
  }, [mateCam, moodFx])
  const flashId = game.spellFlash?.id ?? null
  useEffect(() => {
    if (moodFx && flashId !== null) playFx(boardLensRef.current, 'bloom')
  }, [flashId, moodFx])
  const inDanger = moodFx && game.isAiMode && game.status.kind === 'playing' && game.status.inCheck && game.status.turn === game.humanColor
  const playing = game.status.kind === 'playing' && !game.review
  const myClock = game.clock.enabled ? game.clock.times[game.humanColor] : Number.POSITIVE_INFINITY
  /** 0–1: drives the vignette (check, time trouble, a charging spell, a character battle). */
  const tension = playing
    ? Math.max(inDanger ? 1 : 0, game.status.kind === 'playing' && game.status.inCheck ? 0.6 : 0, myClock < 20_000 ? 0.8 : 0, game.effects?.warning ? 0.5 : 0, game.persona ? 0.2 : 0)
    : 0

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

  // Predictive coach: learns which traps cost you in your saved games (off the main thread of rendering).
  const savedMatches = useStore(profileStore, (p) => p.matches)
  const [coachProf, setCoachProf] = useState<CoachProfile | null>(null)
  useEffect(() => {
    if (settings.coachWarnings === 'off') return
    const t = window.setTimeout(() => {
      let prof = coachCache.get(savedMatches)
      if (!prof) {
        prof = coachProfile(savedMatches)
        coachCache.set(savedMatches, prof)
      }
      setCoachProf(prof)
    }, 250)
    return () => window.clearTimeout(t)
  }, [savedMatches, settings.coachWarnings])
  const [coachWarning, setCoachWarning] = useState<{ fen: string; move: MoveInput; warnings: Warning[] } | null>(null)
  const [lastWarnPly, setLastWarnPly] = useState(-COACH_GAP)
  const onMove = useCallback(
    (move: MoveInput) => {
      const mode = settings.coachWarnings
      if (mode !== 'off' && coachProf && timeMachine.isLive && !game.review && total - lastWarnPly >= COACH_GAP) {
        const found = warningsFor(detect(game.fen, move), coachProf, mode)
        if (found.length > 0) {
          setCoachWarning({ fen: game.fen, move, warnings: found })
          setLastWarnPly(total)
          return false
        }
      }
      setCoachWarning(null)
      return game.applyMove(move) !== null
    },
    [coachProf, game, lastWarnPly, settings.coachWarnings, timeMachine.isLive, total],
  )
  const coachShown = coachWarning && coachWarning.fen === game.fen ? coachWarning : null

  // Engine brain on the main board, and the What-If sandbox. In a rated game in progress both need your OK (the game turns casual).
  const [brainOn, setBrainOn] = useState(false)
  const [whatIfOpen, setWhatIfOpen] = useState(false)
  const engineLocked = game.isAiMode && game.status.kind === 'playing' && !game.review && !game.casual && !game.warInsight
  const brainLive = brainOn && !engineLocked && active
  const brain = useBrain(game.fen, brainLive)
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
  const reelLook = useMemo(
    () => ({ light: solidOf(game.theme.lightSquare.background, '#ecd3a8'), dark: solidOf(game.theme.darkSquare.background, '#a8744a'), accent: game.theme.accent }),
    [game.theme],
  )
  const reelClasses = useMemo(() => (analysisMoves ?? []).map((m) => m.classification), [analysisMoves])
  const currentMoveAnalysis = analysisMoves?.[timeMachine.displayPly - 1] ?? null
  const hintArrows = game.bestMoveArrow && !fog ? [{ ...game.bestMoveArrow, color: 'rgba(132, 204, 22, 0.85)' }] : []
  const arrows = brainLive ? [...hintArrows, ...brainArrows(brain.state)] : hintArrows

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
    <div ref={boardFxRef} className="flex items-stretch gap-2">
      {showEval && <EvalBar evaluation={game.evaluation} orientation={game.orientation} />}
      <div ref={boardLensRef} className="min-w-0 flex-1">
        <Battlefield terrain={terrain} lowPower={settings.batterySaver}>
        <CinemaStage shot={shot} orientation={game.orientation} mateCaption={game.killCam?.caption ?? null} youWon={game.killCam?.youWon ?? true} onDone={onShotDone}>
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
          showLegalMoves={settings.showLegalMoves && !fog}
          showCoordinates={settings.showCoordinates}
          arrows={arrows}
          arena={game.arena}
          picker={game.picker}
          specialTargets={game.specialTargets}
          pieceReactions={settings.pieceReactions}
          terrain={terrain}
          slowMo={shot?.slowMo ?? null}
        >
          {game.effects && game.battle && !game.review && <WeatherOverlay weather={game.effects.weather} lowPower={settings.batterySaver} />}
          <SpellParticles fx={game.boardFx} orientation={game.orientation} frozen={game.arena?.frozen ?? NO_SQUARES} lowPower={settings.batterySaver} />
          {hologram && !settings.batterySaver && candidate?.kind !== 'mate' && <BoardHologram key={`${game.gameKey}-${total}`} text={hologram.text} tone={hologram.tone} />}
          {coachShown && (
            <div className="absolute inset-x-2 bottom-2 z-40 rounded-2xl border border-amber-300/50 bg-ink-950/90 p-3 text-sm text-amber-50 shadow-2xl backdrop-blur" role="alert" data-coach-warning={coachShown.warnings[0]?.pattern}>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
                <GraduationCap className="size-3.5" /> Coach
              </div>
              <p>{coachShown.warnings[0]?.text}</p>
              {coachProf && coachShown.warnings[0] && historyNote(coachShown.warnings[0], coachProf) && <p className="mt-0.5 text-xs text-amber-100/80">{historyNote(coachShown.warnings[0], coachProf)}</p>}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button size="sm" variant="primary" onClick={() => setCoachWarning(null)} data-coach-rethink>
                  Rethink
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setCoachWarning(null)
                    game.applyMove(coachShown.move)
                  }}
                  data-coach-play
                >
                  Play it anyway
                </Button>
              </div>
            </div>
          )}
          {game.spellFlash && !settings.batterySaver && timeMachine.isLive && (
            <BoardHologram key={`spell-${game.spellFlash.id}`} text={game.spellFlash.text} tone={game.spellFlash.tone} />
          )}
        </ChessBoard>
        </CinemaStage>
        </Battlefield>
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

  // Classic Chess: a true fact about the opponent once the game is over (a different one game to game).
  const classicId = game.persona?.key.startsWith('classic:') ? game.persona.key.slice('classic:'.length) : null
  const classicFact = classicId ? (loadedLore()?.factFor(classicId, total) ?? null) : null
  const classicLesson = classicFact && game.persona ? { name: game.persona.name, fact: classicFact } : null
  // Beat a Classic character: interview them, or take a quick quiz about them and the others you have beaten.
  const beatenClassic = classicId && game.summary?.outcome === 'win' ? getClassic(classicId) : null
  const classicHistory = beatenClassic
    ? {
        name: beatenClassic.name,
        onInterview: () => {
          game.dismissGameOver()
          setInterviewing(beatenClassic)
        },
        onQuiz: () => {
          game.dismissGameOver()
          // The quiz loads on demand (with retries); offline, say so instead of doing nothing.
          importWithRetry(() => import('../data/classic/quiz'))
            .then((m) => setQuiz(m.postGameQuiz(beatenClassic, beatenClassics, total * 31 + beatenClassics.length)))
            .catch(() => showToast('warning', 'Couldn’t load the quiz', 'Check your connection and try again.'))
        },
      }
    : null

  const analysisHint = currentMoveAnalysis && !timeMachine.isLive && <MoveInsightCard move={currentMoveAnalysis} />

  const reviewTools = (defaultOpen: boolean): ReactNode => (
    <>
      <TimeMachine machine={timeMachine} total={total} />
      <div className="glass space-y-2 rounded-2xl p-3" data-mind-tools>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={brainOn ? 'primary' : 'secondary'}
            onClick={() => {
              if (!brainOn && engineLocked) game.makeCasual('The engine brain')
              setBrainOn(!brainOn)
            }}
            icon={<BrainCircuit className="size-4" />}
            data-brain-toggle
          >
            {brainOn ? 'Hide brain' : 'Engine brain'}
          </Button>
          <Button size="sm" onClick={() => setWhatIfOpen(true)} icon={<GitBranch className="size-4" />} data-whatif-open>
            What if…?
          </Button>
        </div>
        {!brainOn && engineLocked && <p className="text-[11px] text-slate-500">Rated game in progress: the engine brain makes it unrated.</p>}
        {brainLive && <BrainPanel state={brain.state} status={brain.status} />}
      </div>
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

  const arenaBar = (compact: boolean) =>
    game.battle && game.effects && !game.review && game.status.kind === 'playing' ? (
      <ArenaBar
        setup={game.battle}
        effects={game.effects}
        potions={potions}
        enabled={game.yourLiveTurn}
        pickMode={game.pickMode}
        altarSquares={game.altarSquares.length}
        onDrink={game.drinkPotion}
        onPickMode={game.setPickMode}
        compact={compact}
      />
    ) : null

  // The human's own colour sits at the bottom (the side being "held").
  const bottomColor = game.orientation
  const topColor = opposite(game.orientation)

  return (
    <>
      <ArenaBackdrop />
      {oneHanded ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="safe-px shrink-0 space-y-2" {...swipe}>
            {reviewBanner}
            {renderPlayer(topColor)}
            {spellHud(true)}
          </div>
          {/* Size container: the board takes the largest square the leftover space allows. */}
          <div className="safe-px flex min-h-0 flex-1 items-center justify-center py-2 [container-type:size]">
            <div className={showEval ? 'w-[min(100cqw,calc(100cqh+1.4rem))]' : 'w-[min(100cqw,100cqh)]'}>{board}</div>
          </div>
          {/* Potions & altar sit right above the thumb dock — in reach of one thumb. */}
          {game.battle && <div className="safe-px shrink-0 pb-1">{arenaBar(true)}</div>}
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
                onRetryEngine={game.retryEngine}
                isAiMode={game.isAiMode}
                isLive={timeMachine.isLive}
                isReview={game.review !== null}
                opponentName={game.opponentName}
                opening={game.opening}
              />
            </div>
            {campaignStrip}
            {spellHud(false)}
            {arenaBar(false)}
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

      {active && moodFx && <MoodBackdrop alignment={game.review ? null : game.alignment} danger={inDanger} />}
      {active && moodFx && <Vignette tension={tension} danger={inDanger} />}

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
        opponent={game.persona ? { spec: game.persona.portrait, label: game.persona.name } : null}
        lesson={classicLesson}
        history={classicHistory}
        onReel={() => {
          game.dismissGameOver()
          setReelOpen(true)
        }}
        isAiMode={game.isAiMode}
        moveCount={total}
        onNewGame={openNewGame}
        onRematch={() => game.startNewGame(game.gameSettings)}
        onOpenWar={() => {
          game.dismissGameOver()
          onOpenWar()
        }}
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
      {reelOpen && (
        <HighlightReelModal
          open
          onClose={() => setReelOpen(false)}
          history={game.history}
          classes={reelClasses}
          info={{
            white: game.players.w.name,
            black: game.players.b.name,
            result: game.result ? (game.result.kind === 'draw' ? '½–½' : game.result.winner === 'w' ? '1–0' : '0–1') : '',
            finalFen: game.fen,
            orientation: game.orientation,
          }}
          look={reelLook}
          pieceSet={pieceSet}
        />
      )}
      <WhatIfModal
        open={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        history={game.history}
        startFen={game.history[0]?.before ?? START_FEN}
        rootPly={timeMachine.displayPly}
        orientation={game.orientation}
        theme={game.theme}
        pieceSet={pieceSet}
        lowPower={settings.batterySaver}
        engineLocked={engineLocked}
        onUnlockEngine={() => game.makeCasual('Engine help in the What-If sandbox')}
      />
      {interviewing && (
        // A failed download closes the interview with a note, instead of breaking the screen.
        <ErrorBoundary label="the interview" onError={() => (setInterviewing(null), showToast('warning', 'Couldn’t open the interview', 'Check your connection and try again.'))}>
          <Suspense fallback={null}>
            <InterviewModal c={interviewing} onClose={() => setInterviewing(null)} />
          </Suspense>
        </ErrorBoundary>
      )}
      <Modal open={quiz !== null} title="History quiz" onClose={() => setQuiz(null)}>
        <ErrorBoundary label="the quiz" resetKey={quiz === null ? 0 : 1}>
          <Suspense fallback={<LoadingLine text="Loading the quiz…" />}>{quiz && <QuizPanel questions={quiz} />}</Suspense>
        </ErrorBoundary>
      </Modal>
    </>
  )
}

/** A one-line "loading" placeholder (for parts that download on demand). */
function LoadingLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 py-4 text-sm text-slate-300" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" aria-hidden="true" /> {text}
    </p>
  )
}
