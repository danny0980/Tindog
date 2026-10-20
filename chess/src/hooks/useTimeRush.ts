import { Chess } from 'chess.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveMaterial, sfx } from '../audio'
import { RUSH_LEVELS, RUSH_MATE_BONUS, RUSH_MAX_TIME_MS, RUSH_ROUND_BONUS_MS, RUSH_START_MS } from '../constants/rush'
import { getBoardTheme } from '../constants/themes'
import { HOURGLASS_BONUS_MS, SINGULARITY_FACTOR, activeRelics } from '../data/campaign/relics'
import { scoreToCp } from '../engine/scoring'
import { profileStore } from '../stores/profileStore'
import { trackQuestEvents } from '../stores/questActions'
import { settingsStore } from '../stores/settingsStore'
import { showToast } from '../stores/toastStore'
import type { MoveClassification } from '../types/analysis'
import type { Move, MoveInput } from '../types/chess'
import type { RelicId } from '../types/campaign'
import type { RushEndReason, RushPhase, RushStats, ScorePopup } from '../types/rush'
import { givesCheck, parseUciMove } from '../utils/chess'
import { applyRushResult } from '../utils/progression'
import { scoreRushMove } from '../utils/rushScoring'
import { usePageVisible } from './useAppEnvironment'
import { useEngine } from './useEngine'

const PLAYER = 'w'
const AI_MIN_DELAY_MS = 260
const POPUP_MS = 1300

interface Snapshot {
  fen: string
  lastMove: Move | null
  turn: 'w' | 'b'
}

export interface RushSummary {
  score: number
  round: number
  reason: RushEndReason
  stats: RushStats
  coins: number
  newBest: boolean
}

const EMPTY_STATS: RushStats = { moves: 0, perfectMoves: 0, captures: 0, bestCombo: 0, roundsWon: 0 }

const snapshotOf = (chess: Chess): Snapshot => {
  const history = chess.history({ verbose: true })
  return { fen: chess.fen(), lastMove: history[history.length - 1] ?? null, turn: chess.turn() }
}

const playSound = (move: Move) => {
  const s = settingsStore.get()
  sfx.move(resolveMaterial(s.soundMaterial, getBoardTheme(s.boardTheme)), move, givesCheck(move))
}

/**
 * Time Rush arcade mode. The player (White) races a countdown that only runs
 * on their turn. Each move is graded from the engine evaluation before/after
 * it — the opponent's own search supplies the "after" score, so grading costs
 * no extra engine time — and scored with speed, combo and round multipliers.
 * Checkmating the AI wins the round (+time, harder opponent).
 */
export function useTimeRush(active: boolean) {
  const engine = useEngine('play', active)
  const visible = usePageVisible()
  const chessRef = useRef(new Chess())
  const [snapshot, setSnapshot] = useState<Snapshot>(() => snapshotOf(new Chess()))
  const [phase, setPhase] = useState<RushPhase>('ready')
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [round, setRound] = useState(1)
  const [timeLeft, setTimeLeft] = useState(RUSH_START_MS)
  const [stats, setStats] = useState<RushStats>(EMPTY_STATS)
  const [popups, setPopups] = useState<ScorePopup[]>([])
  const [lastQuality, setLastQuality] = useState<MoveClassification | null>(null)
  const [summary, setSummary] = useState<RushSummary | null>(null)
  const [runId, setRunId] = useState(0)

  // Mutable per-run bookkeeping that never needs to trigger renders.
  const run = useRef({
    evalCp: 30,
    moveStartedAt: 0,
    pending: null as { move: Move; thinkMs: number; beforeCp: number } | null,
    combo: 0,
    score: 0,
    round: 1,
    stats: EMPTY_STATS,
    popupId: 0,
    /** Campaign relics equipped when the run started. */
    relics: [] as RelicId[],
    smokeUsed: false,
  })

  const sync = useCallback(() => setSnapshot(snapshotOf(chessRef.current)), [])

  const pushPopup = useCallback((points: number, label: string, tone: ScorePopup['tone']) => {
    const id = ++run.current.popupId
    setPopups((prev) => [...prev.slice(-3), { id, points, label, tone }])
    window.setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), POPUP_MS)
  }, [])

  /** Points after relic bonuses (Singularity Core). */
  const boost = useCallback((points: number) => Math.round(points * (run.current.relics.includes('singularity-core') ? SINGULARITY_FACTOR : 1)), [])

  const addScore = useCallback((points: number) => {
    run.current.score += points
    setScore(run.current.score)
  }, [])

  const addTime = useCallback((ms: number) => {
    setTimeLeft((t) => Math.max(0, Math.min(RUSH_MAX_TIME_MS, t + ms)))
  }, [])

  const finish = useCallback(
    (reason: RushEndReason) => {
      engine.stop()
      const r = run.current
      const out = applyRushResult(profileStore.get(), r.score, r.round)
      profileStore.set(out.profile)
      trackQuestEvents({ rush_runs: 1, rush_points: r.score }, 1500)
      setSummary({ score: r.score, round: r.round, reason, stats: r.stats, coins: out.coins, newBest: out.newBest && r.score > 0 })
      setPhase('over')
      if (out.newBest && r.score > 0) sfx.victory()
      else if (reason === 'mated') sfx.defeat()
      else sfx.timeout()
      if (out.coins > 0) window.setTimeout(() => sfx.coins(), 900)
      out.unlocked.forEach((a, i) =>
        window.setTimeout(() => {
          sfx.achievement()
          showToast('achievement', a.title, `${a.description} · +${a.reward} coins`, 5000)
        }, 1400 + i * 1100),
      )
    },
    [engine],
  )

  const newBoard = useCallback(() => {
    chessRef.current = new Chess()
    run.current.evalCp = 30
    run.current.pending = null
    run.current.moveStartedAt = performance.now()
    engine.newGame()
    sync()
  }, [engine, sync])

  const start = useCallback(() => {
    const { relics: owned, equipped } = profileStore.get().campaign
    const relics = activeRelics(owned, equipped)
    run.current = { ...run.current, combo: 0, score: 0, round: 1, stats: EMPTY_STATS, relics, smokeUsed: false }
    setScore(0)
    setCombo(0)
    setRound(1)
    setTimeLeft(RUSH_START_MS + (relics.includes('hourglass-of-time') ? HOURGLASS_BONUS_MS : 0))
    setStats(EMPTY_STATS)
    setPopups([])
    setLastQuality(null)
    setSummary(null)
    setPhase('playing')
    setRunId((id) => id + 1)
    newBoard()
    sfx.notify()
  }, [newBoard])

  const nextRound = useCallback(
    (won: boolean) => {
      const r = run.current
      if (won) {
        r.round += 1
        r.stats = { ...r.stats, roundsWon: r.stats.roundsWon + 1 }
        setStats(r.stats)
        setRound(r.round)
        addTime(RUSH_ROUND_BONUS_MS)
        pushPopup(0, `ROUND ${r.round} · +${RUSH_ROUND_BONUS_MS / 1000}s`, 'bonus')
      } else {
        pushPopup(0, 'DRAW · NEW BOARD', 'good')
      }
      window.setTimeout(() => {
        if (run.current.round === r.round) newBoard()
      }, 1100)
    },
    [addTime, newBoard, pushPopup],
  )

  const level = RUSH_LEVELS[Math.min(round - 1, RUSH_LEVELS.length - 1)] ?? RUSH_LEVELS[0]

  // ── Player move ────────────────────────────────────────────────────────────
  const onMove = useCallback(
    (input: MoveInput): boolean => {
      const chess = chessRef.current
      if (phase !== 'playing' || chess.turn() !== PLAYER) return false
      let move: Move
      try {
        move = chess.move(input)
      } catch {
        sfx.error()
        return false
      }
      const thinkMs = performance.now() - run.current.moveStartedAt
      playSound(move)
      sync()

      if (chess.isCheckmate()) {
        const bonus = boost(RUSH_MATE_BONUS * run.current.round * (1 + Math.max(0, 10_000 - thinkMs) / 10_000))
        addScore(bonus)
        pushPopup(bonus, 'CHECKMATE!', 'bonus')
        sfx.victory()
        nextRound(true)
      } else if (chess.isDraw()) {
        nextRound(false)
      } else {
        // Graded once the engine has searched the resulting position.
        run.current.pending = { move, thinkMs, beforeCp: run.current.evalCp }
      }
      return true
    },
    [addScore, boost, nextRound, phase, pushPopup, sync],
  )

  // ── Engine reply + grading ─────────────────────────────────────────────────
  const { search, stop, status: engineStatus } = engine
  useEffect(() => {
    if (phase !== 'playing' || snapshot.turn === PLAYER || engineStatus !== 'ready' || !active) return
    let cancelled = false
    const fen = snapshot.fen
    const startedAt = performance.now()
    search(fen, { depth: level?.depth ?? 8, moveTimeMs: level?.moveTimeMs ?? 250, multiPv: 1, skillLevel: level?.skillLevel ?? 0 })
      .then((result) => {
        if (cancelled || chessRef.current.fen() !== fen) return
        const line = result.lines[0]
        // Engine score is from the AI's view; negate for the player.
        const afterCp = line ? -scoreToCp(line.score) : run.current.evalCp
        const r = run.current
        const pending = r.pending
        r.pending = null
        if (pending) {
          let graded = scoreRushMove({ ...pending, afterCp, combo: r.combo, round: r.round })
          // Smoke Veil of Iga: the first blunder of a run costs no time and keeps the combo.
          const veiled = graded.quality === 'blunder' && r.relics.includes('smoke-veil') && !r.smokeUsed
          if (veiled) {
            r.smokeUsed = true
            graded = { ...graded, combo: r.combo, timeDeltaMs: Math.max(0, graded.timeDeltaMs), labels: [...graded.labels, 'SMOKE VEIL'] }
          }
          graded = { ...graded, points: boost(graded.points) }
          r.combo = graded.combo
          r.stats = {
            moves: r.stats.moves + 1,
            perfectMoves: r.stats.perfectMoves + (graded.quality === 'best' || graded.quality === 'excellent' ? 1 : 0),
            captures: r.stats.captures + (pending.move.captured ? 1 : 0),
            bestCombo: Math.max(r.stats.bestCombo, graded.combo),
            roundsWon: r.stats.roundsWon,
          }
          setCombo(graded.combo)
          setStats(r.stats)
          setLastQuality(graded.quality)
          addScore(graded.points)
          if (graded.timeDeltaMs) addTime(graded.timeDeltaMs)
          const tone: ScorePopup['tone'] =
            graded.quality === 'best' || graded.quality === 'excellent' ? 'great' : graded.quality === 'good' ? 'good' : 'bad'
          const timeLabel = graded.timeDeltaMs ? ` ${graded.timeDeltaMs > 0 ? '+' : ''}${graded.timeDeltaMs / 1000}s` : ''
          pushPopup(graded.points, `${graded.quality.toUpperCase()}${timeLabel}${graded.labels.length ? ` · ${graded.labels.join(' · ')}` : ''}`, tone)
          if (tone === 'bad') sfx.error()
          else sfx.score(graded.combo)
        }
        r.evalCp = afterCp

        const wait = Math.max(0, AI_MIN_DELAY_MS - (performance.now() - startedAt))
        window.setTimeout(() => {
          if (cancelled || chessRef.current.fen() !== fen) return
          const parsed = parseUciMove(result.bestMove)
          if (!parsed) return
          const chess = chessRef.current
          let reply: Move
          try {
            reply = chess.move(parsed)
          } catch {
            return
          }
          playSound(reply)
          sync()
          run.current.moveStartedAt = performance.now()
          if (chess.isCheckmate()) finish('mated')
          else if (chess.isDraw()) nextRound(false)
        }, wait)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      stop()
    }
  }, [active, addScore, addTime, boost, engineStatus, finish, level, nextRound, phase, pushPopup, search, snapshot.fen, snapshot.turn, stop, sync])

  // ── Countdown (only on the player's turn) ──────────────────────────────────
  const ticking = phase === 'playing' && snapshot.turn === PLAYER && active && visible
  useEffect(() => {
    if (!ticking) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const delta = now - last
      last = now
      setTimeLeft((t) => Math.max(0, t - delta))
    }, 100)
    return () => window.clearInterval(id)
  }, [ticking])

  // Pausing (tab hidden) must not count as thinking time for the speed bonus.
  useEffect(() => {
    if (ticking) run.current.moveStartedAt = performance.now()
  }, [ticking])

  const outOfTime = phase === 'playing' && timeLeft <= 0
  useEffect(() => {
    if (outOfTime) finish('timeout')
  }, [finish, outOfTime])

  const lowSecond = ticking && timeLeft < 10_000 ? Math.ceil(timeLeft / 1000) : null
  useEffect(() => {
    if (lowSecond !== null && lowSecond > 0) sfx.lowTime()
  }, [lowSecond])

  const quit = useCallback(() => {
    if (phase === 'playing') finish('quit')
  }, [finish, phase])

  return {
    phase,
    fen: snapshot.fen,
    lastMove: snapshot.lastMove,
    movable: phase === 'playing' && snapshot.turn === PLAYER,
    aiThinking: phase === 'playing' && snapshot.turn !== PLAYER,
    score,
    combo,
    round,
    level,
    timeLeft,
    stats,
    popups,
    lastQuality,
    summary,
    runId,
    engineStatus,
    engineError: engine.error,
    retryEngine: engine.retry,
    start,
    quit,
    onMove,
  }
}
