import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ambientMusic, resolveMaterial, sfx } from '../audio'
import { DIFFICULTIES, PERSONALITIES, resolveTimeControl, standardOpponent } from '../constants/game'
import { getBoardTheme, getPieceSet } from '../constants/themes'
import { getCachedBoss, loadRealmRoster, rosterStore } from '../data/campaign/loader'
import { realmOfBoss } from '../data/campaign/realms'
import { EMBER_BONUS_MS, FIREWALL_ELO_CAP, SHIELD_MOVE_LIMIT, activeRelics, applyRelicsToProfile } from '../data/campaign/relics'
import { getLegend, strengthInfo } from '../data/legends'
import { bossPersona, legendPersona } from '../data/personas'
import { personaSay } from '../stores/dialogueStore'
import type { GrandRealmId, RelicDef, RelicId, StarCount } from '../types/campaign'
import type { Persona, PortraitSpec } from '../types/persona'
import { applyBossResult } from '../utils/campaign'
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
  /** Set when this side is a character (legend or campaign boss): portrait + dialogue routing. */
  character: { key: string; name: string; portrait: PortraitSpec } | null
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
  /** Grand Campaign outcome when the opponent was a boss. */
  campaign: {
    bossName: string
    stars: StarCount
    previousStars: StarCount
    firstClear: boolean
    coins: number
    relic: RelicDef | null
    realmCleared: GrandRealmId | null
    rewards: string[]
  } | null
}

const characterOf = (p: Persona): PlayerInfo['character'] => ({ key: p.key, name: p.name, portrait: p.portrait })

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
  // Grand Campaign: relics snapshotted at the start of a boss battle.
  const [battleRelics, setBattleRelics] = useState<RelicId[]>([])
  const [shieldUsed, setShieldUsed] = useState(false)

  const game = useChessGame()
  const visible = usePageVisible()
  const isAiMode = gameSettings.mode === 'ai' && review === null
  // Character battles: a Chronos legend or a Grand Campaign boss brings its own
  // board, pieces, soundtrack, portrait and dialogue (one Persona code path).
  // Boss rosters load lazily; subscribing re-renders once the realm chunk arrives.
  const boss = useStore(rosterStore, () => (isAiMode && gameSettings.bossId ? getCachedBoss(gameSettings.bossId) : null))
  const legend = isAiMode && !gameSettings.bossId && gameSettings.legendId ? getLegend(gameSettings.legendId) : null
  const reviewBoss = useStore(rosterStore, () => (review?.bossId ? getCachedBoss(review.bossId) : null))
  const reviewLegend = review?.legendId ? getLegend(review.legendId) : null
  const persona = useMemo<Persona | null>(
    () => (boss ? bossPersona(boss) : legend ? legendPersona(legend, gameSettings.legendStrength) : null),
    [boss, gameSettings.legendStrength, legend],
  )
  const reviewPersona = useMemo<Persona | null>(
    () => (reviewBoss ? bossPersona(reviewBoss) : reviewLegend ? legendPersona(reviewLegend, 'authentic') : null),
    [reviewBoss, reviewLegend],
  )
  /** Whoever sets the scene (theme, pieces, music): the live opponent or the reviewed one. */
  const stage = persona ?? reviewPersona
  const theme = getBoardTheme(stage?.themeId ?? settings.boardTheme)
  const pieceSet = getPieceSet(stage?.pieceSetId ?? settings.pieceSet)
  const material = resolveMaterial(settings.soundMaterial, theme)
  const isPlaying = game.status.kind === 'playing' && review === null
  const aiColor = opposite(humanColor)
  const gameKey = review ? `review-${review.id}` : `game-${gameId}`
  const timeControl = useMemo(() => (review ? UNTIMED : resolveTimeControl(gameSettings)), [gameSettings, review])
  const difficultyLabel = DIFFICULTIES.find((d) => d.id === gameSettings.difficulty)?.label ?? ''
  const personality = PERSONALITIES.find((p) => p.id === gameSettings.personality) ?? PERSONALITIES[0]
  const opponent = useMemo(
    () =>
      boss && persona
        ? applyRelicsToProfile(persona.profile, battleRelics)
        : persona
          ? persona.profile
          : standardOpponent(gameSettings.difficulty, gameSettings.personality),
    [battleRelics, boss, gameSettings.difficulty, gameSettings.personality, persona],
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
      if (persona) return persona.name
      return `Stockfish (${difficultyLabel}${personality && personality.id !== 'balanced' ? `, ${personality.name}` : ''})`
    },
    [difficultyLabel, gameSettings.mode, humanColor, persona, personality],
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
        difficulty: ai ? (persona?.difficulty ?? gameSettings.difficulty) : null,
        personality: ai && !persona ? gameSettings.personality : null,
        humanColor: ai ? humanColor : null,
        result,
        pgn,
        history,
        timeControl,
        rated: ai && !casual,
        opening: openingName,
        legendId: legend?.id ?? null,
        bossId: boss?.id ?? null,
        ...(persona ? { opponentElo: persona.elo } : {}),
        ...(boss && battleRelics.includes('firewall-core') ? { eloLossCap: FIREWALL_ELO_CAP } : {}),
      }
      const out = applyMatch(profileStore.get(), matchInput)
      profileStore.set(out.profile)
      const outcome = ai ? outcomeFor(result, humanColor) : null

      // Chronos campaign: bounty, epoch cosmetics, historical trophies and a parting remark.
      let legendSummary: GameEndSummary['legend'] = null
      let unlocked = out.unlocked
      if (legend && outcome) {
        const lr = applyLegendResult(
          profileStore.get(),
          legend.id,
          outcome,
          history.filter((m) => m.color === humanColor).length,
          new Date(),
          gameSettings.legendStrength,
        )
        profileStore.set(lr.profile)
        legendSummary = { name: legend.name, firstDefeat: lr.firstDefeat, coins: lr.coins, rewards: lr.rewards }
        unlocked = [...unlocked, ...lr.unlocked]
      }

      // Grand Campaign: stars, bounty, relics and realm progression.
      let campaignSummary: GameEndSummary['campaign'] = null
      if (boss && outcome) {
        const br = applyBossResult(profileStore.get(), boss, {
          outcome,
          humanMoves: history.filter((m) => m.color === humanColor).length,
          clean: !casual,
          relics: battleRelics,
        })
        profileStore.set(br.profile)
        campaignSummary = {
          bossName: boss.name,
          stars: br.stars,
          previousStars: br.previousStars,
          firstClear: br.firstClear,
          coins: br.coins,
          relic: br.relic,
          realmCleared: br.realmCleared,
          rewards: br.rewards,
        }
        unlocked = [...unlocked, ...br.unlocked]
      }
      if (persona && outcome) personaSay(persona, outcome === 'win' ? 'legendLoses' : outcome === 'loss' ? 'legendWins' : 'draw')
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
        campaign: campaignSummary,
      })
      setGameOverDismissed(false)

      if (result.kind === 'timeout') sfx.timeout()
      else if (result.kind === 'draw') sfx.draw()
      else if (!ai || outcome === 'win') sfx.victory()
      else sfx.defeat()
      if (ai ? outcome === 'win' : result.kind !== 'draw') setCelebration((c) => c + 1)
      if (out.coins > 0 || legendSummary?.coins || campaignSummary?.coins) window.setTimeout(() => sfx.coins(), 900)
      announceAchievements(unlocked, 1400)
    },
    [aiColor, battleRelics, boss, casual, game, gameId, gameSettings, humanColor, legend, persona, playerNames, timeControl],
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

      // In-character reactions from a legend or boss opponent.
      if (persona) {
        const byOpponent = move.color === aiColor
        if (givesCheck(move)) personaSay(persona, byOpponent ? 'checkGiven' : 'inCheck', 0.8)
        else if (move.captured) personaSay(persona, byOpponent ? 'legendCapture' : 'playerCapture', byOpponent ? 0.5 : 0.4)
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
    [aiColor, clock, finishGame, game, material, persona, timeMachine],
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
    onThink: persona ? () => personaSay(persona, 'thinking', 0.12) : undefined,
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

  // ── Character reactions to the flow of the game ───────────────────────────
  const legendAdvantage = persona && evaluation && isPlaying && timeMachine.isLive ? (aiColor === 'w' ? evaluation.cp : -evaluation.cp) : null
  const advantageBand = legendAdvantage === null ? null : legendAdvantage > 250 ? 'up' : legendAdvantage < -250 ? 'down' : 'even'
  const bandRef = useRef<string | null>(null)
  useEffect(() => {
    const previous = bandRef.current
    bandRef.current = advantageBand
    if (!persona || advantageBand === null || previous === null || previous === advantageBand) return
    if (advantageBand === 'up') personaSay(persona, 'advantage', 0.9)
    else if (advantageBand === 'down') personaSay(persona, 'disadvantage', 0.9)
  }, [advantageBand, persona])

  const playerToMove = Boolean(persona) && isPlaying && game.turn === humanColor && active && visible
  useEffect(() => {
    if (!playerToMove || !persona) return
    const id = window.setTimeout(() => personaSay(persona, 'playerSlow'), 25_000)
    return () => window.clearTimeout(id)
  }, [game.fen, persona, playerToMove])

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
      // Shield of Kings: one free takeback early in a campaign battle.
      const shieldReady = Boolean(boss) && battleRelics.includes('shield-of-kings') && !shieldUsed && Math.ceil(game.history.length / 2) <= SHIELD_MOVE_LIMIT
      if (shieldReady) {
        setShieldUsed(true)
        showToast('info', 'Shield of Kings', 'The relic absorbed this takeback — the battle stays rated.', 2800)
      } else {
        setCasual(true)
        showToast('info', 'Casual game', boss ? 'Takebacks make this battle unrated and cap it at one star.' : 'Takebacks make this game unrated.', 2800)
      }
    }
  }, [battleRelics, boss, casual, clock, game, isAiMode, playEngine, shieldUsed, timeMachine, undoPlies])

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
      const tc = resolveTimeControl(next)
      clock.reset(tc)
      // Campaign relics are fixed for the whole battle.
      const challengerBoss = next.mode === 'ai' && next.bossId ? getCachedBoss(next.bossId) : null
      const campaign = profileStore.get().campaign
      const relics = challengerBoss ? activeRelics(campaign.relics, campaign.equipped) : []
      setBattleRelics(relics)
      setShieldUsed(false)
      if (relics.includes('dragonheart-ember') && tc.initialMs > 0) {
        clock.restore({ w: tc.initialMs, b: tc.initialMs, [color]: tc.initialMs + EMBER_BONUS_MS })
      }
      lastOpeningRef.current = null
      setCasual(false)
      setSummary(null)
      setReview(null)
      setGameOverDismissed(false)
      setAnalysisRequestedFor(null)
      setGameId((id) => id + 1)
      const challenger = challengerBoss
        ? bossPersona(challengerBoss)
        : next.mode === 'ai' && next.legendId
          ? legendPersona(getLegend(next.legendId), next.legendStrength)
          : null
      if (challenger) {
        sfx.timeTravel()
        window.setTimeout(() => personaSay(challenger, 'intro'), 1700)
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
      // Campaign reviews show the boss once its realm chunk arrives.
      if (match.bossId) void loadRealmRoster(realmOfBoss(match.bossId))
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
        if (isEngine && reviewPersona) {
          return { color, name: reviewPersona.name, subtitle: reviewPersona.title, isEngine, mood, character: characterOf(reviewPersona) }
        }
        return {
          color,
          name: isHuman ? profileStore.get().name : isEngine ? 'Stockfish' : color === 'w' ? 'White' : 'Black',
          subtitle: isEngine ? review.opponent.replace(/^Stockfish \(|\)$/g, '') : review.mode === 'ai' ? 'Review' : 'Local player',
          isEngine,
          mood,
          character: null,
        }
      }
      if (persona && color === aiColor) {
        const strength = gameSettings.legendStrength
        const tier = boss || strength === 'authentic' ? '' : ` · ${strengthInfo(strength).label}`
        return { color, name: persona.name, subtitle: `${persona.title} · ~${persona.elo}${tier}`, isEngine: true, mood, character: characterOf(persona) }
      }
      if (isAiMode && color === aiColor) {
        return {
          character: null,
          color,
          name: 'Stockfish',
          subtitle: `${difficultyLabel} · ${personality?.name ?? 'Balanced'}`,
          isEngine: true,
          mood,
        }
      }
      if (isAiMode) {
        const profile = profileStore.get()
        return { color, name: profile.name, subtitle: `${profile.elo} Elo${casual ? ' · casual' : ''}`, isEngine: false, mood, character: null }
      }
      return { color, name: color === 'w' ? 'White' : 'Black', subtitle: 'Local player', isEngine: false, mood, character: null }
    }
    return { w: info('w'), b: info('b') }
  }, [aiColor, aiThinking, boss, casual, clock.enabled, clock.times, difficultyLabel, evaluation, game.status, gameSettings.legendStrength, isAiMode, persona, personality, review, reviewPersona])

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
    boss,
    persona,
    stage,
    battleRelics,
    shieldUsed,
    opponentName: persona?.name ?? 'Stockfish',
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
