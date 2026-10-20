// A variant game against the computer: the pure VariantGame rules, Stockfish
// for ideas (in Chess960 mode when needed), the variant judgement in ai.ts,
// and the app's sounds.
import { useCallback, useEffect, useState } from 'react'
import { resolveMaterial, sfx } from '../audio'
import { playCheck } from '../audio/fanfares'
import { playPieceSound } from '../audio/pieceSounds'
import { getBoardTheme } from '../constants/themes'
import { useEngine } from '../hooks/useEngine'
import { applyFeat } from '../stores/featActions'
import { settingsStore } from '../stores/settingsStore'
import { recordBattleResult, recordVanish, recordVariantResult } from '../utils/feats'
import type { Battle } from '../data/battles'
import type { Color, MoveInput, Square } from '../types/chess'
import { type Candidate, chooseVariantMove } from './ai'
import { type VMove, VariantGame, type VariantId, random960 } from './rules'

export type VariantLevel = 'beginner' | 'club' | 'master'

export const LEVELS: Record<VariantLevel, { name: string; depth: number; skill: number; tolerance: number; elo: string; rating: number }> = {
  beginner: { name: 'Beginner', depth: 3, skill: 2, tolerance: 150, elo: '~800', rating: 800 },
  club: { name: 'Club', depth: 8, skill: 9, tolerance: 45, elo: '~1500', rating: 1500 },
  master: { name: 'Master', depth: 14, skill: 20, tolerance: 0, elo: '2200+', rating: 2200 },
}

export interface VariantSetup {
  variant: VariantId
  color: Color | 'random'
  level: VariantLevel
  /** Chess960 start position (random if omitted). */
  position960?: number
  /** A historic battle (variant 'battle'). */
  battle?: Battle
}

export interface VariantView {
  game: VariantGame | null
  /** Bumps on every change (the game object itself is mutable). */
  version: number
  myColor: Color
  level: VariantLevel
  thinking: boolean
  /** It is the computer's turn but its engine isn't running (starting, restarting or failed). */
  waitingForEngine: boolean
  engineStatus: 'idle' | 'loading' | 'ready' | 'error'
  engineError: string | null
}

function sound(game: VariantGame, move: VMove, wasCapture: boolean): void {
  const s = settingsStore.get()
  const material = resolveMaterial(s.soundMaterial, getBoardTheme(s.boardTheme))
  playPieceSound(material, move.castle || move.san.startsWith('O-O') ? 'castle' : move.promotion ? 'promote' : wasCapture ? 'capture' : 'move')
  if (game.inCheck) playCheck()
}

export function useVariantGame(active: boolean) {
  // The game object is mutated move by move; `version` re-renders after each change.
  const [game, setGame] = useState<VariantGame | null>(null)
  const [version, setVersion] = useState(0)
  const [myColor, setMyColor] = useState<Color>('w')
  const [level, setLevel] = useState<VariantLevel>('club')
  const [battle, setBattle] = useState<Battle | null>(null)
  const engine = useEngine('variant', active && game !== null)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const finish = useCallback((game: VariantGame, me: Color) => {
    const r = game.result
    if (!r) return
    if (r.winner === null) sfx.draw()
    else if (r.winner === me) sfx.victory()
    else sfx.defeat()
    applyFeat((p) =>
      battle
        ? recordBattleResult(p, battle.id, me, r.winner === me)
        : game.variant === 'vanish'
          ? recordVanish(p, r.winner === null ? 0.5 : r.winner === me ? 1 : 0, LEVELS[level].rating)
          : recordVariantResult(p, game.variant, r.winner === me, r.reason),
    )
  }, [battle, level])

  const apply = useCallback(
    (game: VariantGame, move: VMove): boolean => {
      const capture = move.san.includes('x')
      if (!game.play(move)) return false
      sound(game, move, capture)
      finish(game, myColor)
      bump()
      return true
    },
    [bump, finish, myColor],
  )

  const start = useCallback(
    (setup: VariantSetup) => {
      const color: Color = setup.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : setup.color
      setGame(setup.battle ? VariantGame.battleGame(setup.battle.setup) : new VariantGame(setup.variant, setup.variant === 'chess960' ? (setup.position960 ?? random960()) : 518))
      setBattle(setup.battle ?? null)
      setMyColor(color)
      setLevel(setup.level)
      engine.newGame()
      bump()
    },
    [bump, engine],
  )

  const move = useCallback(
    (input: MoveInput): boolean => {
      if (!game || game.result || game.turn !== myColor) return false
      const m = game.find(input)
      return m ? apply(game, m) : false
    },
    [apply, game, myColor],
  )

  const resign = useCallback(() => {
    if (!game || game.result) return
    game.resign(myColor)
    finish(game, myColor)
    bump()
  }, [bump, finish, game, myColor])

  const leave = useCallback(() => {
    setGame(null)
  }, [])

  // The computer's turn.
  const aiToMove = Boolean(active && game && !game.result && game.turn !== myColor && engine.status === 'ready')
  useEffect(() => {
    if (!aiToMove || !game) return
    let cancelled = false
    const cfg = LEVELS[level]
    const startedAt = Date.now()
    const run = async () => {
      let candidates: Candidate[] = []
      try {
        const result = await engine.search(game.engineFen(), { depth: cfg.depth, multiPv: 4, skillLevel: cfg.skill, chess960: game.variant === 'chess960', moveTimeMs: 2500 })
        candidates = result.lines.flatMap((l) => (l.pv[0] ? [{ uci: l.pv[0], cp: l.score.type === 'mate' ? Math.sign(l.score.value) * (10_000 - Math.abs(l.score.value)) : l.score.value }] : []))
      } catch {
        candidates = []
      }
      // A moment's thought even when the engine is instant.
      const wait = Math.max(0, 450 - (Date.now() - startedAt))
      await new Promise((r) => window.setTimeout(r, wait))
      if (cancelled || game.result) return
      const choice = chooseVariantMove(game, candidates, cfg.tolerance)
      if (choice) apply(game, choice)
    }
    void run()
    return () => {
      cancelled = true
    }
    // version: re-run after every move.
  }, [aiToMove, apply, engine, game, level, version])

  /** Chess960 castles for the board: king onto its rook, from the king's square. */
  const castleTargets: Array<{ from: Square; to: Square; kind: string }> =
    game && game.variant === 'chess960' && game.turn === myColor ? game.legalMoves().flatMap((m) => (m.castle ? [{ from: m.from, to: m.to, kind: 'castle' }] : [])) : []

  // The computer is "thinking" whenever it is its turn.
  const waitingForEngine = Boolean(active && game && !game.result && game.turn !== myColor && engine.status !== 'ready')
  const view: VariantView = { game, version, myColor, level, thinking: aiToMove, waitingForEngine, engineStatus: engine.status, engineError: engine.error }
  return { ...view, battle, castleTargets, start, move, resign, leave, retryEngine: engine.retry }
}
