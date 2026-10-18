import { Chess } from 'chess.js'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { Color, GameResult, GameStatus, Move, PieceSymbol, Square } from '../types/chess'
import { getBoardResult, hasMatingMaterial, pgnResultToken } from '../utils/chess'

interface Snapshot {
  fen: string
  history: Move[]
  boardResult: GameResult | null
  turn: Color
  inCheck: boolean
}

function takeSnapshot(chess: Chess): Snapshot {
  return {
    fen: chess.fen(),
    history: chess.history({ verbose: true }),
    boardResult: getBoardResult(chess),
    turn: chess.turn(),
    inCheck: chess.inCheck(),
  }
}

export interface MoveInput {
  from: Square
  to: Square
  promotion?: PieceSymbol
}

export interface PgnHeaders {
  white: string
  black: string
}

/**
 * Owns the authoritative chess.js instance. React state only ever holds an
 * immutable snapshot of it, so components stay pure and render from `fen`.
 */
export function useChessGame() {
  const chessRef = useRef<Chess>(new Chess())
  const [snapshot, setSnapshot] = useState<Snapshot>(() => takeSnapshot(new Chess()))
  const [externalResult, setExternalResult] = useState<GameResult | null>(null)

  const sync = useCallback(() => setSnapshot(takeSnapshot(chessRef.current)), [])

  const makeMove = useCallback(
    (input: MoveInput): Move | null => {
      try {
        const move = chessRef.current.move(input)
        sync()
        return move
      } catch {
        return null
      }
    },
    [sync],
  )

  const undo = useCallback(
    (plies: number): number => {
      let undone = 0
      while (undone < plies && chessRef.current.undo()) undone += 1
      if (undone > 0) {
        setExternalResult(null)
        sync()
      }
      return undone
    },
    [sync],
  )

  const reset = useCallback(() => {
    chessRef.current = new Chess()
    setExternalResult(null)
    sync()
  }, [sync])

  /** Live (non-render) access for event handlers: is the current position already decided? */
  const getLiveBoardResult = useCallback((): GameResult | null => getBoardResult(chessRef.current), [])

  const canColorMate = useCallback((color: Color): boolean => hasMatingMaterial(chessRef.current, color), [])

  const getFen = useCallback((): string => chessRef.current.fen(), [])

  const buildPgn = useCallback(
    (headers: PgnHeaders, result: GameResult | null): string => {
      const chess = new Chess()
      chess.loadPgn(chessRef.current.pgn())
      const date = new Date()
      chess.setHeader('Event', 'Chess Arena')
      chess.setHeader('Site', 'Chess Arena')
      chess.setHeader(
        'Date',
        `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`,
      )
      chess.setHeader('White', headers.white)
      chess.setHeader('Black', headers.black)
      chess.setHeader('Result', pgnResultToken(result))
      return chess.pgn()
    },
    [],
  )

  const result = externalResult ?? snapshot.boardResult

  const status = useMemo<GameStatus>(
    () => (result ? { kind: 'over', result } : { kind: 'playing', turn: snapshot.turn, inCheck: snapshot.inCheck }),
    [result, snapshot.turn, snapshot.inCheck],
  )

  return {
    fen: snapshot.fen,
    history: snapshot.history,
    turn: snapshot.turn,
    status,
    result,
    externalResult,
    makeMove,
    undo,
    reset,
    setExternalResult,
    getLiveBoardResult,
    canColorMate,
    getFen,
    buildPgn,
  }
}

export type ChessGame = ReturnType<typeof useChessGame>
