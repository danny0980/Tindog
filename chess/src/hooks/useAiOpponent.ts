import { useEffect, useRef } from 'react'
import { DIFFICULTY_CONFIGS } from '../constants/game'
import { chooseMove } from '../engine/personalities'
import type { Difficulty, MoveInput, Personality } from '../types/chess'
import { parseUciMove } from '../utils/chess'
import type { EngineHandle } from './useEngine'

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

interface AiOpponentOptions {
  engine: EngineHandle
  fen: string
  active: boolean
  difficulty: Difficulty
  personality: Personality
  gameId: number
  getFen: () => string
  onMove: (move: MoveInput) => void
}

/** Requests and plays the engine's move whenever it is the AI's turn. */
export function useAiOpponent({ engine, fen, active, difficulty, personality, gameId, getFen, onMove }: AiOpponentOptions): void {
  const onMoveRef = useRef(onMove)
  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  const { search, stop, status } = engine

  useEffect(() => {
    if (!active || status !== 'ready') return
    let cancelled = false
    const config = DIFFICULTY_CONFIGS[difficulty]
    const multiPv = personality === 'balanced' ? 1 : 4
    Promise.all([
      search(fen, { depth: config.depth, moveTimeMs: config.moveTimeMs, multiPv, skillLevel: config.skillLevel }),
      delay(config.minThinkMs),
    ])
      .then(([result]) => {
        // Ignore replies for positions that are no longer on the board (undo, new game…).
        if (cancelled || getFen() !== fen) return
        const uci = chooseMove(fen, result, personality, config)
        const parsed = parseUciMove(uci)
        if (parsed) onMoveRef.current(parsed)
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error('[stockfish]', err)
      })
    return () => {
      cancelled = true
      stop()
    }
  }, [active, difficulty, fen, gameId, getFen, personality, search, status, stop])
}
