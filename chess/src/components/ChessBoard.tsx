import { Chess } from 'chess.js'
import { type CSSProperties, useCallback, useMemo, useState } from 'react'
import { Chessboard, type PieceDropHandlerArgs, type PieceHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import type { MoveInput } from '../hooks/useChessGame'
import type { Color, GameStatus, Move, PendingPromotion, PromotionPiece, Square } from '../types/chess'
import { findKingSquare, isPromotionMove } from '../utils/chess'
import { PromotionDialog } from './PromotionDialog'

interface ChessBoardProps {
  fen: string
  orientation: Color
  lastMove: Move | null
  status: GameStatus
  /** Colour the local user may currently move, or null when input is locked. */
  movableColor: Color | null
  onMove: (move: MoveInput) => Move | null
}

const SQUARE_PATTERN = /^[a-h][1-8]$/
const isSquare = (value: string | null): value is Square => value !== null && SQUARE_PATTERN.test(value)

const STYLES = {
  lastMove: { backgroundColor: 'rgba(250, 204, 21, 0.38)' },
  selected: { backgroundColor: 'rgba(52, 211, 153, 0.55)' },
  hover: { boxShadow: 'inset 0 0 0 4px rgba(255, 255, 255, 0.55)' },
  check: {
    background:
      'radial-gradient(circle, rgba(255, 64, 64, 0.95) 0%, rgba(239, 68, 68, 0.65) 35%, rgba(220, 38, 38, 0) 75%)',
  },
  target: {
    background: 'radial-gradient(circle, rgba(15, 23, 42, 0.38) 22%, transparent 24%)',
  },
  captureTarget: {
    background: 'radial-gradient(circle, transparent 58%, rgba(15, 23, 42, 0.42) 60%, rgba(15, 23, 42, 0.42) 72%, transparent 74%)',
  },
} satisfies Record<string, CSSProperties>

const merge = (...styles: Array<CSSProperties | undefined>): CSSProperties => Object.assign({}, ...styles)

export function ChessBoard({ fen, orientation, lastMove, status, movableColor, onMove }: ChessBoardProps) {
  // Selection is tied to the position it was made in, so it clears itself whenever the FEN changes.
  const [selection, setSelection] = useState<{ square: Square; fen: string } | null>(null)
  const [promotion, setPromotion] = useState<(PendingPromotion & { fen: string }) | null>(null)
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null)

  const position = useMemo(() => new Chess(fen), [fen])
  const selected = selection?.fen === fen ? selection.square : null
  const pendingPromotion = promotion?.fen === fen && movableColor ? promotion : null

  const legalTargets = useMemo(() => {
    if (!selected) return new Map<Square, Move>()
    return new Map(position.moves({ square: selected, verbose: true }).map((m) => [m.to, m] as const))
  }, [position, selected])

  const canMoveFrom = useCallback(
    (square: Square): boolean => {
      if (!movableColor) return false
      const piece = position.get(square)
      return piece?.color === movableColor
    },
    [movableColor, position],
  )

  const attemptMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!movableColor) return false
      if (isPromotionMove(position, from, to)) {
        setPromotion({ from, to, color: movableColor, fen })
        return false
      }
      const move = onMove({ from, to })
      if (move) setSelection(null)
      return move !== null
    },
    [fen, movableColor, onMove, position],
  )

  const handleSquareClick = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (!isSquare(square) || !movableColor) return
      if (selected && legalTargets.has(square)) {
        attemptMove(selected, square)
        return
      }
      if (canMoveFrom(square)) {
        setSelection(selected === square ? null : { square, fen })
        return
      }
      setSelection(null)
    },
    [attemptMove, canMoveFrom, fen, legalTargets, movableColor, selected],
  )

  const handlePieceDrag = useCallback(
    ({ square }: PieceHandlerArgs) => {
      if (isSquare(square) && canMoveFrom(square)) setSelection({ square, fen })
    },
    [canMoveFrom, fen],
  )

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!isSquare(sourceSquare) || !isSquare(targetSquare) || sourceSquare === targetSquare) return false
      return attemptMove(sourceSquare, targetSquare)
    },
    [attemptMove],
  )

  const handlePromotionSelect = useCallback(
    (piece: PromotionPiece) => {
      if (!pendingPromotion) return
      onMove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece })
      setPromotion(null)
      setSelection(null)
    },
    [onMove, pendingPromotion],
  )

  const cancelPromotion = useCallback(() => setPromotion(null), [])

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    const add = (square: string, style: CSSProperties) => {
      styles[square] = merge(styles[square], style)
    }

    if (lastMove) {
      add(lastMove.from, STYLES.lastMove)
      add(lastMove.to, STYLES.lastMove)
    }

    const inCheck = status.kind === 'playing' ? status.inCheck : status.result.kind === 'checkmate'
    if (inCheck) {
      const king = findKingSquare(position, position.turn())
      if (king) add(king, STYLES.check)
    }

    if (selected) add(selected, STYLES.selected)

    legalTargets.forEach((move, square) => {
      add(square, move.isCapture() ? STYLES.captureTarget : STYLES.target)
    })

    if (hoverSquare && legalTargets.has(hoverSquare)) add(hoverSquare, STYLES.hover)

    return styles
  }, [hoverSquare, lastMove, legalTargets, position, selected, status])

  const options = useMemo(
    () => ({
      id: 'main-board',
      position: fen,
      boardOrientation: orientation === 'w' ? ('white' as const) : ('black' as const),
      squareStyles,
      allowDragging: movableColor !== null,
      allowDrawingArrows: true,
      animationDurationInMs: 220,
      dragActivationDistance: 4,
      canDragPiece: ({ square }: PieceHandlerArgs) => isSquare(square) && canMoveFrom(square),
      onPieceDrop: handlePieceDrop,
      onPieceDrag: handlePieceDrag,
      onSquareClick: handleSquareClick,
      onMouseOverSquare: ({ square }: SquareHandlerArgs) => setHoverSquare(isSquare(square) ? square : null),
      onMouseOutSquare: () => setHoverSquare(null),
      boardStyle: {
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 30px 60px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.06)',
      },
      lightSquareStyle: { backgroundColor: '#dee3e6' },
      darkSquareStyle: { backgroundColor: '#8ca2ad' },
      dropSquareStyle: { boxShadow: 'inset 0 0 0 4px rgba(52, 211, 153, 0.85)' },
      lightSquareNotationStyle: { color: '#788a94', fontWeight: 600 },
      darkSquareNotationStyle: { color: '#eef2f4', fontWeight: 600 },
      draggingPieceStyle: { transform: 'scale(1.15)', filter: 'drop-shadow(0 10px 12px rgba(0,0,0,0.45))' },
      draggingPieceGhostStyle: { opacity: 0.35 },
    }),
    [canMoveFrom, fen, handlePieceDrag, handlePieceDrop, handleSquareClick, movableColor, orientation, squareStyles],
  )

  return (
    <div className="board-surface relative aspect-square w-full">
      <Chessboard options={options} />
      {pendingPromotion && (
        <PromotionDialog color={pendingPromotion.color} onSelect={handlePromotionSelect} onCancel={cancelPromotion} />
      )}
    </div>
  )
}
