import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ambientMusic, resolveMaterial, sfx } from '../audio'
import { DIFFICULTIES, PERSONALITIES, resolveTimeControl, standardOpponent } from '../constants/game'
import { getBoardTheme, getPieceSet } from '../constants/themes'
import { getEpoch, getLegend } from '../data/historicalLegends'
import { legendSay } from '../stores/dialogueStore'
import type { LegendId } from '../types/legend'
import { profileStore } from '../stores/profileStore'
import { settingsStore, updateSettings } from '../stores/settingsStore'
import { showToast } from '../stores/toastStore'
import type { GameAnalysis, PositionEval } from '../types/analysis'
import type { ClockTimes, Color, GameResult, GameSettings, Move, MoveInput, Outcome, TimeControl } from '../types/chess'
import type { AchievementDef, MatchRecord } from '../types/profile'
import { fenAtPly, getCapturedPieces, givesCheck, opposite } from '../utils/chess'
import { type Mood, deriveMood, gameTension } from '../utils/mood'
import { detectOpening } from '../utils/openings'
import { type MatchInput, applyAnalysis, applyLegendResult, applyMatch, matchQuestEvents, outcomeFor } from '../utils/progression'
import { trackQuestEvents } from '../stores/questActions'
import { usePageVisible } from './useAppEnvironment'
import { useAiOpponent } from './useAiOpponent'
import { useChessClock } from './useChessClock'
import { useChessGame } from './useChessGame'
import { useEngine } from './useEngine'
import { useEvaluation } from './useEvaluation'
import { useGameAnalysis } from './useGameAnalysis'
import { useStore } from './useStore'
import { useTimeMachine } from './useTimeMachine'

const UNTIMED: TimeControl = { id: 'none', label: 'Unlimited', category: 'none', initialMs: 0, incrementMs: 0 }

const resolveColor = (settings: GameSettings): Color =>
  settings.playerColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.playerColor

export interface PlayerInfo {
  color: Color
  name: string
  subtitle: string
  isEngine: boolean
  mood: Mood
  /** Set when this side is a historical legend (portrait + dialogue). */
  legendId: LegendId | null
}

export interface GameEndSummary {
  result: GameResult
  outcome: Outcome | null
  eloDelta: number | null
  eloAfter: number | null
  coins: number
  unlocked: AchievementDef[]
  matchId: string
  rated: boolean
  /** Chronos campaign outcome when the opponent was a legend. */
  legend: { name: string; firstDefeat: boolean; coins: number; rewards: string[] } | null
}

function announceAchievements(unlocked: AchievementDef[], delay: number): void {
  unlocked.forEach((a, i) =>
    window.setTimeout(() => {
      sfx.achievement()
      showToast('achievement', a.title, `${a.description} · +${a.reward} coins`, 5000)
    }, delay + i * 1100),
  )
}

export function useGameController({ active }: { active: boolean }) {
  const settings = useStore(settingsStore, (s) => s)
  const [gameSettings, setGameSettings] = useState<GameSettings>(() => settingsStore.get().game)
  const [humanColor, setHumanColor] = useState<Color>(() => resolveColor(gameSettings))
  const [orientation, setOrientation] = useState<Color>(() => (gameSettings.mode === 'ai' ? humanColor : 'w'))
  const [gameId, setGameId] = useState(0)
  const [casual, setCasual] = useState(false)
  const [gameOverDismissed, setGameOverDismissed] = useState(false)
  const [summary, setSummary] = useState<GameEndSummary | null>(null)
  const [review, setReview] = useState<MatchRecord | null>(null)
  const [celebration, setCelebration] = useState(0)
  const [analysisRequestedFor, setAnalysisRequestedFor] = useState<string | null>(null)

  const game = useChessGame()
  const visible = usePageVisible()
  const isAiMode = gameSettings.mode === 'ai' && review === null
  // Chronos Chess: a legend opponent brings their epoch's board, pieces and sound.
  const legend = isAiMode && gameSettings.legendId ? getLegend(gameSettings.legendId) : null
  const reviewLegend = review?.legendId ? getLegend(review.legendId) : null
  const epoch = legend || reviewLegend ? getEpoch((legend ?? reviewLegend)?.epoch ?? 'ancient') : null
  const theme = getBoardTheme(epoch?.themeId ?? settings.boardTheme)
  const pieceSet = getPieceSet(epoch?.pieceSetId ?? settings.pieceSet)
  const material = resolveMaterial(settings.soundMaterial, theme)
  const isPlaying = game.status.kind === 'playing' && review === null
  const aiColor = opposite(humanColor)
  const gameKey = review ? `review-${review.id}` : `game-${gameId}`
  const timeControl = useMemo(() => (review ? UNTIMED : resolveTimeControl(gameSettings)), [gameSettings, review])
  const difficultyLabel = DIFFICULTIES.find((d) => d.id === gameSettings.difficulty)?.label ?? ''
  const personality = PERSONALITIES.find((p) => p.id === gameSettings.personality) ?? PERSONALITIES[0]
  const opponent = useMemo(
    () => (legend ? legend.profile : standardOpponent(gameSettings.difficulty, gameSettings.personality)),
    [gameSettings.difficulty, gameSettings.personality, legend],
  )

  const clockSnapshotsRef = useRef<ClockTimes[]>([])
  const recordedGameRef = useRef<number | null>(null)
  const lastOpeningRef = useRef<string | null>(null)
  const summaryRef = useRef<GameEndSummary | null>(null)
  const reviewRef = useRef<MatchRecord | null>(null)
  useEffect(() => {
    summaryRef.current = summary
    reviewRef.current = review
  }, [review, summary])

  // ── Engines, time machine, evaluation & analysis ───────────────────────────
  const playEngine = useEngine('play', isAiMode)
  const timeMachine = useTimeMachine(game.history.length, gameKey)
  const analysisWanted = analysisRequestedFor === gameKey
  const analysisEngine = useEngine('analysis', active && (settings.showEvalBar || analysisWanted))
  const analysis = useGameAnalysis(analysisEngine, game.history, gameKey, settings.batterySaver ? 9 : 13)
  const displayPly = timeMachine.displayPly
  const displayFen = timeMachine.isLive ? game.fen : fenAtPly(game.history, displayPly)

  const analysisEvals: PositionEval[] | null =
    analysis.state.status === 'done' ? analysis.state.analysis.evals : analysis.state.status === 'running' ? analysis.state.partial : null
  const evalFromAnalysis = analysisEvals?.[displayPly] ?? null
  const liveEval = useEvaluation(
    analysisEngine,
    displayFen,
    settings.showEvalBar && active && visible && analysis.state.status !== 'running' && evalFromAnalysis === null,
    settings.batterySaver ? 8 : 14,
  )
  const evaluation = evalFromAnalysis ?? liveEval

  const opening = useMemo(() => detectOpening(game.history.slice(0, displayPly)), [displayPly, game.history])

  // ── Game end ───────────────────────────────────────────────────────────────
  const playerNames = useCallback(
    (color: Color): string => {
      if (gameSettings.mode !== 'ai') return color === 'w' ? 'White' : 'Black'
      if (color === humanColor) return profileStore.get().name
      if (legend) return legend.name
      return `Stockfish (${difficultyLabel}${personality && personality.id !== 'balanced' ? `, ${personality.name}` : ''})`
    },
    [difficultyLabel, gameSettings.mode, humanColor, legend, personality],
  )

  const finishGame = useCallback(
    (result: GameResult) => {
      if (recordedGameRef.current === gameId) return
      recordedGameRef.current = gameId
      const history = game.getLiveHistory()
      const openingName = detectOpening(history)?.name ?? null
      const pgn = game.buildPgn(
        {
          white: playerNames('w'),
          black: playerNames('b'),
          timeControl: timeControl.initialMs > 0 ? `${timeControl.initialMs / 1000}+${timeControl.incrementMs / 1000}` : '-',
          ...(openingName ? { opening: openingName } : {}),
        },
        result,
      )
      const ai = gameSettings.mode === 'ai'
      const matchInput: MatchInput = {
        mode: gameSettings.mode,
        opponent: ai ? playerNames(aiColor) : 'Local game',
        difficulty: ai ? (legend?.difficulty ?? gameSettings.difficulty) : null,
        personality: ai && !legend ? gameSettings.personality : null,
        humanColor: ai ? humanColor : null,
        result,
        pgn,
        history,
        timeControl,
        rated: ai && !casual,
        opening: openingName,
        legendId: legend?.id ?? null,
        ...(legend ? { opponentElo: legend.elo } : {}),
      }
      const out = applyMatch(profileStore.get(), matchInput)
      profileStore.set(out.profile)
      const outcome = ai ? outcomeFor(result, humanColor) : null

      // Chronos campaign: bounty, epoch cosmetics, historical trophies and a parting remark.
      let legendSummary: GameEndSummary['legend'] = null
      let unlocked = out.unlocked
      if (legend && outcome) {
        const lr = applyLegendResult(profileStore.get(), legend.id, outcome, history.filter((m) => m.color === humanColor).length)
        profileStore.set(lr.profile)
        legendSummary = { name: legend.name, firstDefeat: lr.firstDefeat, coins: lr.coins, rewards: lr.rewards }
        unlocked = [...unlocked, ...lr.unlocked]
        legendSay(legend, outcome === 'win' ? 'legendLoses' : outcome === 'loss' ? 'legendWins' : 'draw')
      }
      trackQuestEvents(matchQuestEvents(matchInput), 1400 + unlocked.length * 1100)
      setSummary({
        result,
        outcome,
        eloDelta: out.eloDelta,
        eloAfter: out.record.eloAfter,
        coins: out.coins,
        unlocked,
        matchId: out.record.id,
        rated: out.record.rated,
        legend: legendSummary,
      })
      setGameOverDismissed(false)

      if (result.kind === 'timeout') sfx.timeout()
      else if (result.kind === 'draw') sfx.draw()
      else if (!ai || outcome === 'win') sfx.victory()
      else sfx.defeat()
      if (ai ? outcome === 'win' : result.kind !== 'draw') setCelebration((c) => c + 1)
      if (out.coins > 0 || legendSummary?.coins) window.setTimeout(() => sfx.coins(), 900)
      announceAchievements(unlocked, 1400)
    },
    [aiColor, casual, game, gameId, gameSettings, humanColor, legend, playerNames, timeControl],
  )

  const handleFlag = useCallback(
    (color: Color) => {
      if (game.externalResult || game.getLiveBoardResult()) return
      const winner = opposite(color)
      const result: GameResult = game.canColorMate(winner) ? { kind: 'timeout', winner } : { kind: 'draw', reason: 'timeout-insufficient' }
      playEngine.stop()
      game.setExternalResult(result)
      finishGame(result)
    },
    [finishGame, game, playEngine],
  )

  const clock = useChessClock({
    timeControl,
    activeColor: game.turn,
    running: isPlaying && active && visible && game.history.length > 0,
    onFlag: handleFlag,
    tickMs: settings.batterySaver ? 250 : 100,
  })

  // ── Moves ──────────────────────────────────────────────────────────────────
  const applyMove = useCallback(
    (input: MoveInput): Move | null => {
      const before = clock.getTimes()
      const move = game.makeMove(input)
      if (!move) {
        sfx.error()
        return null
      }
      clockSnapshotsRef.current.push(before)
      clock.addIncrement(move.color)
      timeMachine.goTo(null)
      sfx.move(material, move, givesCheck(move))

      // In-character reactions from a legend opponent.
      if (legend) {
        const byLegend = move.color === aiColor
        if (givesCheck(move)) legendSay(legend, byLegend ? 'checkGiven' : 'inCheck', 0.8)
        else if (move.captured) legendSay(legend, byLegend ? 'legendCapture' : 'playerCapture', byLegend ? 0.5 : 0.4)
      }

      const detected = detectOpening(game.getLiveHistory())
      if (detected && detected.ply === game.getLiveHistory().length && detected.name !== lastOpeningRef.current) {
        lastOpeningRef.current = detected.name
        showToast('opening', detected.name, detected.eco, 2600)
      }

      const result = game.getLiveBoardResult()
      if (result) finishGame(result)
      return move
    },
    [aiColor, clock, finishGame, game, legend, material, timeMachine],
  )

  const isAiTurn = isAiMode && isPlaying && game.turn === aiColor
  useAiOpponent({
    engine: playEngine,
    fen: game.fen,
    active: isAiTurn && active && visible,
    profile: opponent,
    gameId,
    getFen: game.getFen,
    getHistory: game.getLiveHistory,
    onMove: applyMove,
    onThink: legend ? () => legendSay(legend, 'thinking', 0.12) : undefined,
  })
  const aiThinking = isAiTurn && playEngine.status === 'ready'

  // ── Adaptive soundtrack & low-time warning ─────────────────────────────────
  const humanClockColor: Color | null = isAiMode ? humanColor : isPlaying && game.status.kind === 'playing' ? game.status.turn : null
  const lowTime = clock.enabled && humanClockColor !== null && clock.times[humanClockColor] < 15_000
  const tension = gameTension(game.status, evaluation?.cp ?? null, lowTime)
  useEffect(() => {
    ambientMusic.setTension(tension)
  }, [tension])

  const lowTimeSecond =
    clock.enabled && isPlaying && humanClockColor === game.turn && clock.times[game.turn] < 10_000
      ? Math.ceil(clock.times[game.turn] / 1000)
      : null
  useEffect(() => {
    if (lowTimeSecond !== null && lowTimeSecond > 0) sfx.lowTime()
  }, [lowTimeSecond])

  // ── Legend reactions to the flow of the game ──────────────────────────────
  const legendAdvantage = legend && evaluation && isPlaying && timeMachine.isLive ? (aiColor === 'w' ? evaluation.cp : -evaluation.cp) : null
  const advantageBand = legendAdvantage === null ? null : legendAdvantage > 250 ? 'up' : legendAdvantage < -250 ? 'down' : 'even'
  const bandRef = useRef<string | null>(null)
  useEffect(() => {
    const previous = bandRef.current
    bandRef.current = advantageBand
    if (!legend || advantageBand === null || previous === null || previous === advantageBand) return
    if (advantageBand === 'up') legendSay(legend, 'advantage', 0.9)
    else if (advantageBand === 'down') legendSay(legend, 'disadvantage', 0.9)
  }, [advantageBand, legend])

  const playerToMove = Boolean(legend) && isPlaying && game.turn === humanColor && active && visible
  useEffect(() => {
    if (!playerToMove || !legend) return
    const id = window.setTimeout(() => legendSay(legend, 'playerSlow'), 25_000)
    return () => window.clearTimeout(id)
  }, [game.fen, legend, playerToMove])

  // ── Commands ───────────────────────────────────────────────────────────────
  const movableColor: Color | null =
    isPlaying && timeMachine.isLive && (!isAiMode || game.turn === humanColor) ? game.turn : null

  const undoPlies = (() => {
    if (!isPlaying) return 0
    if (!isAiMode) return game.history.length > 0 ? 1 : 0
    const plies = game.turn === humanColor ? 2 : 1
    return game.history.length >= plies ? plies : 0
  })()

  const undo = useCallback(() => {
    if (undoPlies === 0) return
    playEngine.stop()
    const undone = game.undo(undoPlies)
    const snapshots = clockSnapshotsRef.current
    const restoreTo = snapshots[snapshots.length - undone]
    snapshots.splice(snapshots.length - undone, undone)
    if (restoreTo) clock.restore(restoreTo)
    timeMachine.goTo(null)
    if (isAiMode && !casual) {
      setCasual(true)
      showToast('info', 'Casual game', 'Takebacks make this game unrated.', 2600)
    }
  }, [casual, clock, game, isAiMode, playEngine, timeMachine, undoPlies])

  const resign = useCallback(() => {
    if (!isPlaying) return
    const loser = isAiMode ? humanColor : game.turn
    const result: GameResult = { kind: 'resign', winner: opposite(loser) }
    playEngine.stop()
    game.setExternalResult(result)
    finishGame(result)
  }, [finishGame, game, humanColor, isAiMode, isPlaying, playEngine])

  const startNewGame = useCallback(
    (next: GameSettings) => {
      const color = resolveColor(next)
      updateSettings({ game: next })
      playEngine.stop()
      playEngine.newGame()
      analysis.cancel()
      setGameSettings(next)
      setHumanColor(color)
      setOrientation(next.mode === 'ai' ? color : 'w')
      game.reset()
      clockSnapshotsRef.current = []
      clock.reset(resolveTimeControl(next))
      lastOpeningRef.current = null
      setCasual(false)
      setSummary(null)
      setReview(null)
      setGameOverDismissed(false)
      setAnalysisRequestedFor(null)
      setGameId((id) => id + 1)
      if (next.mode === 'ai' && next.legendId) {
        const challenger = getLegend(next.legendId)
        sfx.timeTravel()
        window.setTimeout(() => legendSay(challenger, 'intro'), 1700)
      } else {
        sfx.notify()
      }
    },
    [analysis, clock, game, playEngine],
  )

  const loadReview = useCallback(
    (match: MatchRecord) => {
      playEngine.stop()
      analysis.cancel()
      if (!game.loadGame(match.pgn, match.result)) {
        showToast('warning', 'Could not open game', 'The saved PGN is invalid.')
        return
      }
      setReview(match)
      setOrientation(match.humanColor ?? 'w')
      setSummary(null)
      setGameOverDismissed(true)
      setGameId((id) => id + 1)
    },
    [analysis, game, playEngine],
  )

  const humanColorRef = useRef(humanColor)
  useEffect(() => {
    humanColorRef.current = humanColor
  }, [humanColor])

  const onAnalysisDone = useCallback((result: GameAnalysis) => {
    const s = summaryRef.current
    const r = reviewRef.current
    const color = r ? r.humanColor : s && s.outcome !== null ? humanColorRef.current : null
    const accuracy = color ? result.accuracy[color] : null
    const won = r ? r.outcome === 'win' : s?.outcome === 'win'
    const out = applyAnalysis(profileStore.get(), r?.id ?? s?.matchId ?? null, accuracy, won)
    profileStore.set(out.profile)
    announceAchievements(out.unlocked, 300)
    trackQuestEvents({ analyses: 1 }, 600)
  }, [])
  const requestAnalysis = useCallback(() => {
    setAnalysisRequestedFor(gameKey)
    setGameOverDismissed(true)
  }, [gameKey])

  const { run: runAnalysis, state: analysisState, engineReady: analysisReady } = analysis
  useEffect(() => {
    if (analysisWanted && analysisReady && analysisState.status === 'idle') void runAnalysis(onAnalysisDone)
  }, [analysisReady, analysisState.status, analysisWanted, onAnalysisDone, runAnalysis])

  const flipBoard = useCallback(() => setOrientation((o) => opposite(o)), [])
  const dismissGameOver = useCallback(() => setGameOverDismissed(true), [])

  const getPgn = useCallback(() => {
    if (review) return review.pgn
    const openingName = detectOpening(game.history)?.name
    return game.buildPgn({ white: playerNames('w'), black: playerNames('b'), ...(openingName ? { opening: openingName } : {}) }, game.result)
  }, [game, playerNames, review])

  // ── Derived view data ──────────────────────────────────────────────────────
  const visibleHistory = useMemo(() => game.history.slice(0, displayPly), [displayPly, game.history])
  const captured = useMemo(() => getCapturedPieces(visibleHistory), [visibleHistory])
  const lastMove = visibleHistory[visibleHistory.length - 1] ?? null

  const players: Record<Color, PlayerInfo> = useMemo(() => {
    const info = (color: Color): PlayerInfo => {
      const thinking = aiThinking && color === aiColor
      const isTurn = game.status.kind === 'playing' && game.status.turn === color
      const low = clock.enabled && clock.times[color] < 15_000
      const mood = deriveMood({ color, status: game.status, evalCp: evaluation?.cp ?? null, isTurn, thinking, lowTime: low })
      if (review) {
        const isHuman = review.mode === 'ai' && review.humanColor === color
        const isEngine = review.mode === 'ai' && !isHuman
        if (isEngine && reviewLegend) {
          return { color, name: reviewLegend.name, subtitle: reviewLegend.title, isEngine, mood, legendId: reviewLegend.id }
        }
        return {
          color,
          name: isHuman ? profileStore.get().name : isEngine ? 'Stockfish' : color === 'w' ? 'White' : 'Black',
          subtitle: isEngine ? review.opponent.replace(/^Stockfish \(|\)$/g, '') : review.mode === 'ai' ? 'Review' : 'Local player',
          isEngine,
          mood,
          legendId: null,
        }
      }
      if (legend && color === aiColor) {
        return { color, name: legend.name, subtitle: `${legend.title} · ~${legend.elo}`, isEngine: true, mood, legendId: legend.id }
      }
      if (isAiMode && color === aiColor) {
        return {
          legendId: null,
          color,
          name: 'Stockfish',
          subtitle: `${difficultyLabel} · ${personality?.name ?? 'Balanced'}`,
          isEngine: true,
          mood,
        }
      }
      if (isAiMode) {
        const profile = profileStore.get()
        return { color, name: profile.name, subtitle: `${profile.elo} Elo${casual ? ' · casual' : ''}`, isEngine: false, mood, legendId: null }
      }
      return { color, name: color === 'w' ? 'White' : 'Black', subtitle: 'Local player', isEngine: false, mood, legendId: null }
    }
    return { w: info('w'), b: info('b') }
  }, [aiColor, aiThinking, casual, clock.enabled, clock.times, difficultyLabel, evaluation, game.status, isAiMode, legend, personality, review, reviewLegend])

  const bestMoveArrow =
    !timeMachine.isLive && analysis.state.status === 'done' && evaluation?.bestMove
      ? { from: evaluation.bestMove.slice(0, 2), to: evaluation.bestMove.slice(2, 4) }
      : null

  return {
    settings,
    gameSettings,
    theme,
    pieceSet,
    legend,
    epoch,
    opponentName: legend?.name ?? 'Stockfish',
    timeControl,
    humanColor,
    orientation,
    gameKey,
    isAiMode,
    review,
    casual,
    fen: displayFen,
    liveFen: game.fen,
    history: game.history,
    status: game.status,
    result: game.result,
    lastMove,
    captured,
    players,
    clock: { times: clock.times, enabled: clock.enabled },
    engineStatus: playEngine.status,
    engineError: playEngine.error,
    aiThinking,
    movableColor,
    canUndo: undoPlies > 0,
    canResign: isPlaying && game.history.length > 0,
    showGameOver: game.status.kind === 'over' && !gameOverDismissed && summary !== null,
    summary,
    celebration,
    evaluation,
    evalEnabled: settings.showEvalBar,
    opening,
    timeMachine,
    analysis: analysis.state,
    analysisAvailable: game.status.kind === 'over' && game.history.length > 0,
    bestMoveArrow,
    applyMove,
    undo,
    resign,
    startNewGame,
    loadReview,
    requestAnalysis,
    flipBoard,
    dismissGameOver,
    getPgn,
    playerNames,
  }
}

export type GameController = ReturnType<typeof useGameController>
