import { Chess } from 'chess.js'
import { useEffect, useRef } from 'react'
import { chooseMove, repertoireMove } from '../engine/personalities'
import type { Move, MoveInput } from '../types/chess'
import type { OpponentProfile } from '../types/engine'
import { parseUciMove } from '../utils/chess'
import type { EngineHandle } from './useEngine'

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

interface AiOpponentOptions {
  engine: EngineHandle
  fen: string
  active: boolean
  profile: OpponentProfile
  gameId: number
  getFen: () => string
  getHistory: () => Move[]
  onMove: (move: MoveInput) => void
  /** Called when the opponent starts thinking about a new position. */
  onThink?: () => void
}

/**
 * Requests and plays the engine's move whenever it is the AI's turn: first
 * from the opponent's opening repertoire, then from a (style-filtered) search.
 */
export function useAiOpponent({ engine, fen, active, profile, gameId, getFen, getHistory, onMove, onThink }: AiOpponentOptions): void {
  const onMoveRef = useRef(onMove)
  const onThinkRef = useRef(onThink)
  const profileRef = useRef(profile)
  useEffect(() => {
    onMoveRef.current = onMove
    onThinkRef.current = onThink
    profileRef.current = profile
  }, [onMove, onThink, profile])

  const { search, stop, status } = engine

  useEffect(() => {
    if (!active || status !== 'ready') return
    let cancelled = false
    const p = profileRef.current
    onThinkRef.current?.()

    // Opening repertoire: play the book move after a human-like pause.
    const side = fen.split(' ')[1] === 'b' ? 'b' : 'w'
    const book = sanToInput(fen, repertoireMove(getHistory().map((m) => m.san), p.repertoire?.[side]))
    if (book) {
      void delay(p.minThinkMs).then(() => {
        if (!cancelled && getFen() === fen) onMoveRef.current(book)
      })
      return () => {
        cancelled = true
      }
    }

    Promise.all([
      search(fen, { depth: p.depth, moveTimeMs: p.moveTimeMs, multiPv: p.multiPv, skillLevel: p.skillLevel }),
      delay(p.minThinkMs),
    ])
      .then(([result]) => {
        // Ignore replies for positions that are no longer on the board (undo, new game…).
        if (cancelled || getFen() !== fen) return
        const parsed = parseUciMove(chooseMove(fen, result, p))
        if (parsed) onMoveRef.current(parsed)
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error('[stockfish]', err)
      })
    return () => {
      cancelled = true
      stop()
    }
  }, [active, fen, gameId, getFen, getHistory, search, status, stop])
}

/** Resolves a SAN book move to squares; null if absent or illegal (then the engine searches instead). */
function sanToInput(fen: string, san: string | null): MoveInput | null {
  if (!san) return null
  try {
    const move = new Chess(fen).move(san)
    return { from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) }
  } catch {
    return null
  }
}
