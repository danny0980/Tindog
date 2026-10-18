import { Chess, DEFAULT_POSITION } from 'chess.js'
import { useCallback, useMemo, useRef, useState } from 'react'
import { type SpecialMove, type VariantEvent, isSpecialMove, repetitionCount, specialFromEvent, specialKindOf, toVariantEvent } from '../engine/variant'
import type { Color, GameResult, GameStatus, Move, MoveInput } from '../types/chess'
import { getBoardResult, hasMatingMaterial, pgnResultToken } from '../utils/chess'

interface Snapshot {
  fen: string
  history: Move[]
  boardResult: GameResult | null
  turn: Color
  inCheck: boolean
}

function takeSnapshot(chess: Chess, history: readonly Move[]): Snapshot {
  return {
    fen: chess.fen(),
    history: [...history],
    boardResult: getBoardResult(chess, repetitionCount(history, chess.fen())),
    turn: chess.turn(),
    inCheck: chess.inCheck(),
  }
}

export interface PgnHeaders {
  white: string
  black: string
  event?: string
  timeControl?: string
  opening?: string
}

const pgnDate = (date: Date) => `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`

/** Movetext tokens of a PGN (headers, comments, move numbers and results stripped). */
function pgnTokens(pgn: string): string[] {
  return pgn
    .replace(/^\[.*\]$/gm, '')
    .replace(/\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.(\.\.)?$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
    .map((t) => t.replace(/^\d+\.(\.\.)?/, ''))
    .filter(Boolean)
}

/**
 * Owns the authoritative game: a chess.js instance for the current position
 * plus the full move history. React state only ever holds an immutable
 * snapshot, so components stay pure and render from `fen`.
 *
 * The history is kept here (not in chess.js) so Chronos special plies —
 * diagonal charges, camel leaps and passes — can join it: they reload the
 * chess.js instance at their resulting FEN. Undo restores snapshots, and
 * threefold repetition is counted over the whole history.
 */
export function useChessGame() {
  const chessRef = useRef<Chess>(new Chess())
  const historyRef = useRef<Move[]>([])
  const [snapshot, setSnapshot] = useState<Snapshot>(() => takeSnapshot(new Chess(), []))
  const [externalResult, setExternalResult] = useState<GameResult | null>(null)

  const sync = useCallback(() => setSnapshot(takeSnapshot(chessRef.current, historyRef.current)), [])

  const makeMove = useCallback(
    (input: MoveInput): Move | null => {
      try {
        const move = chessRef.current.move(input)
        historyRef.current = [...historyRef.current, move]
        sync()
        return move
      } catch {
        return null
      }
    },
    [sync],
  )

  /** Plays a Chronos special ply (must have been generated from the current position). */
  const applySpecial = useCallback(
    (special: SpecialMove): Move | null => {
      if (special.move.before !== chessRef.current.fen()) return null
      try {
        chessRef.current = new Chess(special.move.after)
      } catch {
        return null
      }
      historyRef.current = [...historyRef.current, special.move]
      sync()
      return special.move
    },
    [sync],
  )

  const undo = useCallback(
    (plies: number): number => {
      const history = historyRef.current
      const undone = Math.min(plies, history.length)
      if (undone === 0) return 0
      const kept = history.slice(0, history.length - undone)
      chessRef.current = new Chess(kept[kept.length - 1]?.after ?? history[0]?.before ?? DEFAULT_POSITION)
      historyRef.current = kept
      setExternalResult(null)
      sync()
      return undone
    },
    [sync],
  )

  const reset = useCallback(() => {
    chessRef.current = new Chess()
    historyRef.current = []
    setExternalResult(null)
    sync()
  }, [sync])

  /** Loads a finished game (e.g. from match history) for review; `variant` restores special plies. */
  const loadGame = useCallback(
    (pgn: string, result: GameResult | null, variant: readonly VariantEvent[] = []): boolean => {
      let chess = new Chess()
      const history: Move[] = []
      try {
        if (variant.length === 0) {
          chess.loadPgn(pgn)
          history.push(...chess.history({ verbose: true }))
        } else {
          const tokens = pgnTokens(pgn)
          for (let i = 0; i < tokens.length; i++) {
            const event = variant.find((e) => e.ply === i + 1)
            if (event) {
              const special = specialFromEvent(event)
              if (!special) return false
              history.push(special.move)
              chess = new Chess(special.move.after)
            } else {
              history.push(chess.move(tokens[i] ?? ''))
            }
          }
        }
      } catch {
        return false
      }
      chessRef.current = chess
      historyRef.current = history
      setExternalResult(result)
      sync()
      return true
    },
    [sync],
  )

  /** Live (non-render) access for event handlers: is the current position already decided? */
  const getLiveBoardResult = useCallback(
    (): GameResult | null => getBoardResult(chessRef.current, repetitionCount(historyRef.current, chessRef.current.fen())),
    [],
  )

  const canColorMate = useCallback((color: Color): boolean => hasMatingMaterial(chessRef.current, color), [])

  const getFen = useCallback((): string => chessRef.current.fen(), [])
  const getLiveHistory = useCallback((): Move[] => historyRef.current, [])

  /** Special plies of the current game, for storing with the match. */
  const getVariantEvents = useCallback(
    (): VariantEvent[] =>
      historyRef.current.flatMap((m, i) => {
        if (!isSpecialMove(m)) return []
        return [toVariantEvent({ kind: specialKindOf(m), color: m.color, from: m.from, to: m.to, piece: m.piece, ...(m.captured ? { captured: m.captured } : {}), ...(m.promotion ? { promotion: m.promotion } : {}), san: m.san, move: m }, i + 1)]
      }),
    [],
  )

  const buildPgn = useCallback((headers: PgnHeaders, result: GameResult | null): string => {
    const history = historyRef.current
    const tags: Array<[string, string]> = [
      ['Event', headers.event ?? 'Chess Arena'],
      ['Site', 'Chess Arena'],
      ['Date', pgnDate(new Date())],
      ['White', headers.white],
      ['Black', headers.black],
      ['Result', pgnResultToken(result)],
      ...(headers.timeControl ? ([['TimeControl', headers.timeControl]] as Array<[string, string]>) : []),
      ...(headers.opening ? ([['Opening', headers.opening]] as Array<[string, string]>) : []),
    ]
    if (!history.some(isSpecialMove)) {
      // Standard game: let chess.js produce canonical PGN.
      const chess = new Chess()
      for (const move of history) chess.move(move.san)
      for (const [k, v] of tags) chess.setHeader(k, v)
      return chess.pgn()
    }
    // Chronos game: special plies are written as `e5~f6`, `Nb1~c4`, `--` and explained in comments.
    const movetext: string[] = []
    history.forEach((move, i) => {
      if (move.color === 'w' || i === 0) movetext.push(move.color === 'w' ? `${Math.floor(i / 2) + 1}.` : `${Math.floor(i / 2) + 1}...`)
      movetext.push(move.san)
      if (isSpecialMove(move)) movetext.push(`{Chronos ${specialKindOf(move)}}`)
    })
    movetext.push(pgnResultToken(result))
    return `${[...tags, ['Variant', 'Chronos Spells'] as [string, string]].map(([k, v]) => `[${k} "${v}"]`).join('\n')}\n\n${movetext.join(' ')}`
  }, [])

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
    applySpecial,
    undo,
    reset,
    loadGame,
    setExternalResult,
    getLiveBoardResult,
    canColorMate,
    getFen,
    getLiveHistory,
    getVariantEvents,
    buildPgn,
  }
}

export type ChessGame = ReturnType<typeof useChessGame>
