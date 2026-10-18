import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SETTINGS, DIFFICULTIES, ENGINE_CONFIGS, STORAGE_KEYS, getTimeControl } from '../constants/game'
import type { ClockTimes, Color, GameResult, GameSettings, Move } from '../types/chess'
import { getCapturedPieces, opposite, parseUciMove } from '../utils/chess'
import { playSound, soundForMove, vibrate } from '../utils/sound'
import { loadJSON, saveJSON } from '../utils/storage'
import { useChessClock } from './useChessClock'
import { type MoveInput, useChessGame } from './useChessGame'
import { useStockfish } from './useStockfish'

const isSettings = (value: unknown): value is GameSettings => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.mode === 'ai' || v.mode === 'local') &&
    DIFFICULTIES.some((d) => d.id === v.difficulty) &&
    (v.playerColor === 'w' || v.playerColor === 'b' || v.playerColor === 'random') &&
    typeof v.timeControlId === 'string'
  )
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

const resolveColor = (settings: GameSettings): Color =>
  settings.playerColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.playerColor

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

export interface PlayerInfo {
  color: Color
  name: string
  subtitle: string
  isEngine: boolean
}

export function useGameController() {
  const [settings, setSettings] = useState<GameSettings>(() =>
    loadJSON(STORAGE_KEYS.settings, DEFAULT_SETTINGS, isSettings),
  )
  const [humanColor, setHumanColor] = useState<Color>(() => resolveColor(settings))
  const [orientation, setOrientation] = useState<Color>(() => (settings.mode === 'ai' ? humanColor : 'w'))
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => loadJSON(STORAGE_KEYS.sound, true, isBoolean))
  const [gameOverDismissed, setGameOverDismissed] = useState(false)
  const [gameId, setGameId] = useState(0)

  const game = useChessGame()
  const engine = useStockfish(settings.mode === 'ai')
  const timeControl = useMemo(() => getTimeControl(settings.timeControlId), [settings.timeControlId])
  const clockSnapshotsRef = useRef<ClockTimes[]>([])

  const soundRef = useRef(soundEnabled)
  useEffect(() => {
    soundRef.current = soundEnabled
    saveJSON(STORAGE_KEYS.sound, soundEnabled)
  }, [soundEnabled])

  const sfx = useCallback((effect: Parameters<typeof playSound>[0]) => {
    if (soundRef.current) playSound(effect)
  }, [])

  const isPlaying = game.status.kind === 'playing'
  const isAiMode = settings.mode === 'ai'
  const aiColor = opposite(humanColor)

  const handleFlag = useCallback(
    (color: Color) => {
      if (game.externalResult || game.getLiveBoardResult()) return
      const winner = opposite(color)
      const result: GameResult = game.canColorMate(winner)
        ? { kind: 'timeout', winner }
        : { kind: 'draw', reason: 'timeout-insufficient' }
      engine.stop()
      game.setExternalResult(result)
      sfx('game-end')
      vibrate([60, 40, 120])
    },
    [engine, game, sfx],
  )

  const clock = useChessClock({
    timeControl,
    activeColor: game.turn,
    running: isPlaying && game.history.length > 0,
    onFlag: handleFlag,
  })

  const applyMove = useCallback(
    (input: MoveInput): Move | null => {
      const before = clock.getTimes()
      const move = game.makeMove(input)
      if (!move) {
        sfx('illegal')
        return null
      }
      clockSnapshotsRef.current.push(before)
      clock.addIncrement(move.color)
      if (game.getLiveBoardResult()) {
        sfx('game-end')
        vibrate([40, 30, 80])
      } else {
        sfx(soundForMove(move.san, move.isCapture(), move.isKingsideCastle() || move.isQueensideCastle(), move.isPromotion()))
        vibrate(12)
      }
      return move
    },
    [clock, game, sfx],
  )

  // ── AI turn ────────────────────────────────────────────────────────────────
  const isAiTurn = isAiMode && isPlaying && game.turn === aiColor
  const aiThinking = isAiTurn && engine.status === 'ready'
  const applyMoveRef = useRef(applyMove)
  useEffect(() => {
    applyMoveRef.current = applyMove
  }, [applyMove])

  const { getBestMove, stop: stopEngine } = engine
  const getFen = game.getFen
  const fen = game.fen
  useEffect(() => {
    if (!isAiTurn || engine.status !== 'ready') return
    let cancelled = false
    const config = ENGINE_CONFIGS[settings.difficulty]
    Promise.all([getBestMove(fen, config), delay(config.minThinkMs)])
      .then(([uci]) => {
        // Ignore replies for positions that are no longer on the board (undo, new game…).
        if (cancelled || getFen() !== fen) return
        const parsed = parseUciMove(uci)
        if (parsed) applyMoveRef.current(parsed)
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error('[stockfish]', err)
      })
    return () => {
      cancelled = true
      stopEngine()
    }
  }, [isAiTurn, engine.status, fen, settings.difficulty, gameId, getBestMove, stopEngine, getFen])

  // ── Commands ───────────────────────────────────────────────────────────────
  const humanCanMove = (color: Color) => isPlaying && (!isAiMode || color === humanColor)
  const movableColor: Color | null = isPlaying && humanCanMove(game.turn) ? game.turn : null

  const undoPlies = (() => {
    if (game.externalResult) return 0 // no take-backs after resignation / flag
    if (!isAiMode) return game.history.length > 0 ? 1 : 0
    const plies = game.turn === humanColor ? 2 : 1
    return game.history.length >= plies ? plies : 0
  })()

  const undo = useCallback(() => {
    if (undoPlies === 0) return
    engine.stop()
    const undone = game.undo(undoPlies)
    const snapshots = clockSnapshotsRef.current
    const restoreTo = snapshots[snapshots.length - undone]
    snapshots.splice(snapshots.length - undone, undone)
    if (restoreTo) clock.restore(restoreTo)
    setGameOverDismissed(false)
    sfx('move')
  }, [clock, engine, game, sfx, undoPlies])

  const resign = useCallback(() => {
    if (!isPlaying) return
    const loser = isAiMode ? humanColor : game.turn
    engine.stop()
    game.setExternalResult({ kind: 'resign', winner: opposite(loser) })
    setGameOverDismissed(false)
    sfx('game-end')
  }, [engine, game, humanColor, isAiMode, isPlaying, sfx])

  const startNewGame = useCallback(
    (next: GameSettings) => {
      const color = resolveColor(next)
      saveJSON(STORAGE_KEYS.settings, next)
      engine.stop()
      engine.newGame()
      setSettings(next)
      setHumanColor(color)
      setOrientation(next.mode === 'ai' ? color : 'w')
      game.reset()
      clockSnapshotsRef.current = []
      clock.reset(getTimeControl(next.timeControlId))
      setGameOverDismissed(false)
      setGameId((id) => id + 1)
      sfx('castle')
    },
    [clock, engine, game, sfx],
  )

  const flipBoard = useCallback(() => setOrientation((o) => opposite(o)), [])
  const toggleSound = useCallback(() => setSoundEnabled((s) => !s), [])
  const dismissGameOver = useCallback(() => setGameOverDismissed(true), [])

  // ── Derived view data ──────────────────────────────────────────────────────
  const captured = useMemo(() => getCapturedPieces(game.history), [game.history])
  const lastMove = game.history[game.history.length - 1] ?? null
  const difficultyLabel = DIFFICULTIES.find((d) => d.id === settings.difficulty)?.label ?? ''

  const players: Record<Color, PlayerInfo> = useMemo(() => {
    const info = (color: Color): PlayerInfo => {
      if (isAiMode && color === aiColor) {
        return { color, name: 'Stockfish', subtitle: difficultyLabel, isEngine: true }
      }
      if (isAiMode) return { color, name: 'You', subtitle: color === 'w' ? 'White' : 'Black', isEngine: false }
      return { color, name: color === 'w' ? 'White' : 'Black', subtitle: 'Local player', isEngine: false }
    }
    return { w: info('w'), b: info('b') }
  }, [aiColor, difficultyLabel, isAiMode])

  const getPgn = useCallback(
    () =>
      game.buildPgn(
        {
          white: players.w.isEngine ? `Stockfish (${difficultyLabel})` : players.w.name,
          black: players.b.isEngine ? `Stockfish (${difficultyLabel})` : players.b.name,
        },
        game.result,
      ),
    [difficultyLabel, game, players],
  )

  return {
    settings,
    timeControl,
    humanColor,
    orientation,
    soundEnabled,
    fen: game.fen,
    history: game.history,
    status: game.status,
    result: game.result,
    lastMove,
    captured,
    players,
    clock: { times: clock.times, enabled: clock.enabled },
    engineStatus: engine.status,
    engineError: engine.error,
    aiThinking,
    movableColor,
    canUndo: undoPlies > 0,
    canResign: isPlaying && game.history.length > 0,
    showGameOver: game.status.kind === 'over' && !gameOverDismissed,
    applyMove,
    undo,
    resign,
    startNewGame,
    flipBoard,
    toggleSound,
    dismissGameOver,
    getPgn,
  }
}

export type GameController = ReturnType<typeof useGameController>
