import { Chess } from 'chess.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { resolveMaterial, sfx } from '../audio'
import { getBoardTheme } from '../constants/themes'
import { settingsStore } from '../stores/settingsStore'
import type { Move, MoveInput } from '../types/chess'
import type { Puzzle } from '../types/puzzle'
import { givesCheck, moveToUci, parseUciMove } from '../utils/chess'

export type PuzzleStatus = 'solving' | 'opponent' | 'solved' | 'revealing' | 'revealed'

interface SessionState {
  puzzleId: string
  applied: string[]
  status: PuzzleStatus
  mistakes: number
  hintLevel: 0 | 1 | 2
  shake: number
}

const initialState = (puzzle: Puzzle): SessionState => ({ puzzleId: puzzle.id, applied: [], status: 'solving', mistakes: 0, hintLevel: 0, shake: 0 })

function replay(fen: string, moves: readonly string[]): { fen: string; lastMove: Move | null } {
  const chess = new Chess(fen)
  let lastMove: Move | null = null
  for (const uci of moves) {
    const parsed = parseUciMove(uci)
    if (!parsed) break
    try {
      lastMove = chess.move(parsed)
    } catch {
      break
    }
  }
  return { fen: chess.fen(), lastMove }
}

const playMoveSound = (move: Move | null) => {
  if (!move) return
  const settings = settingsStore.get()
  sfx.move(resolveMaterial(settings.soundMaterial, getBoardTheme(settings.boardTheme)), move, givesCheck(move))
}

/**
 * Drives one puzzle: validates the solver's moves against the verified
 * solution (any mating move is accepted on the final move), auto-plays the
 * defender's replies, and supports hints and a step-by-step reveal.
 */
export function usePuzzleSession(puzzle: Puzzle, onSolved: (assisted: boolean) => void) {
  const [raw, setState] = useState<SessionState>(() => initialState(puzzle))
  const state = raw.puzzleId === puzzle.id ? raw : initialState(puzzle)
  const { fen, lastMove } = useMemo(() => replay(puzzle.fen, state.applied), [puzzle.fen, state.applied])
  const ply = state.applied.length
  const solverColor = puzzle.fen.split(' ')[1] === 'b' ? 'b' : 'w'

  const update = useCallback((fn: (s: SessionState) => SessionState) => setState((prev) => fn(prev.puzzleId === puzzle.id ? prev : initialState(puzzle))), [puzzle])

  const onMove = useCallback(
    (input: MoveInput): boolean => {
      if (state.status !== 'solving') return false
      const expected = puzzle.solution[ply]
      const chess = new Chess(fen)
      let move: Move
      try {
        move = chess.move(input)
      } catch {
        return false
      }
      const uci = moveToUci(move)
      const isFinal = ply === puzzle.solution.length - 1
      const correct = uci === expected || (isFinal && chess.isCheckmate())
      if (!correct) {
        sfx.error()
        update((s) => ({ ...s, mistakes: s.mistakes + 1, shake: s.shake + 1 }))
        return false
      }
      playMoveSound(move)
      const applied = [...state.applied, uci]
      if (applied.length >= puzzle.solution.length) {
        update((s) => ({ ...s, applied, status: 'solved' }))
        window.setTimeout(() => sfx.puzzleSolved(), 250)
        onSolved(state.mistakes > 0 || state.hintLevel > 0)
      } else {
        update((s) => ({ ...s, applied, status: 'opponent', hintLevel: 0 }))
      }
      return true
    },
    [fen, onSolved, ply, puzzle.solution, state.applied, state.hintLevel, state.mistakes, state.status, update],
  )

  // Defender reply / reveal playback.
  useEffect(() => {
    if (state.status !== 'opponent' && state.status !== 'revealing') return
    const next = puzzle.solution[ply]
    const id = window.setTimeout(
      () => {
        if (!next) {
          update((s) => ({ ...s, status: s.status === 'revealing' ? 'revealed' : 'solving' }))
          return
        }
        const { lastMove: played } = replay(fen, [next])
        playMoveSound(played)
        update((s) => {
          const applied = [...s.applied, next]
          if (s.status === 'revealing') return { ...s, applied, status: applied.length >= puzzle.solution.length ? 'revealed' : 'revealing' }
          return { ...s, applied, status: 'solving' }
        })
      },
      state.status === 'revealing' ? 700 : 450,
    )
    return () => window.clearTimeout(id)
  }, [fen, ply, puzzle.solution, state.status, update])

  const hint = useCallback(() => update((s) => (s.status === 'solving' ? { ...s, hintLevel: s.hintLevel === 0 ? 1 : 2 } : s)), [update])
  const reveal = useCallback(() => update((s) => (s.status === 'solving' ? { ...s, status: 'revealing', hintLevel: 0 } : s)), [update])
  const retry = useCallback(() => update(() => initialState(puzzle)), [puzzle, update])

  const expected = puzzle.solution[ply]
  const hintMove = state.status === 'solving' && state.hintLevel > 0 && expected ? { from: expected.slice(0, 2), to: expected.slice(2, 4) } : null

  return {
    fen,
    lastMove,
    status: state.status,
    mistakes: state.mistakes,
    hintLevel: state.hintLevel,
    hintMove,
    shake: state.shake,
    solverColor: solverColor as 'w' | 'b',
    movesLeft: Math.ceil((puzzle.solution.length - ply) / 2),
    onMove,
    hint,
    reveal,
    retry,
  }
}
