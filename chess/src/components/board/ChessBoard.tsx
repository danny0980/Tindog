import { Chess } from 'chess.js'
import { type CSSProperties, type ReactNode, useCallback, useMemo, useState } from 'react'
import { type Arrow, Chessboard, type PieceDropHandlerArgs, type PieceHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import type { Color, Move, MoveInput, PendingPromotion, PromotionPiece, Square } from '../../types/chess'
import type { BoardTheme, PieceSet } from '../../types/theme'
import { findKingSquare, isPromotionMove } from '../../utils/chess'
import { buildPieces } from '../../utils/pieces'
import { PromotionDialog } from './PromotionDialog'

export interface BoardArrow {
  from: string
  to: string
  color?: string
}

interface ChessBoardProps {
  id: string
  fen: string
  orientation: Color
  lastMove: Pick<Move, 'from' | 'to'> | null
  /** Colour the local user may currently move, or null when input is locked. */
  movableColor: Color | null
  /** Returns true when the move was accepted. */
  onMove: (move: MoveInput) => boolean
  theme: BoardTheme
  pieceSet: PieceSet
  lowPower: boolean
  showLegalMoves: boolean
  showCoordinates: boolean
  extraSquareStyles?: Record<string, CSSProperties>
  arrows?: BoardArrow[]
  /** Changing this value plays a "wrong move" shake. */
  shakeKey?: number
  children?: ReactNode
}

const SQUARE_PATTERN = /^[a-h][1-8]$/
const isSquare = (value: string | null): value is Square => value !== null && SQUARE_PATTERN.test(value)
const merge = (...styles: Array<CSSProperties | undefined>): CSSProperties => Object.assign({}, ...styles)

export function ChessBoard({
  id,
  fen,
  orientation,
  lastMove,
  movableColor,
  onMove,
  theme,
  pieceSet,
  lowPower,
  showLegalMoves,
  showCoordinates,
  extraSquareStyles,
  arrows,
  shakeKey = 0,
  children,
}: ChessBoardProps) {
  // Selection is tied to the position it was made in, so it clears itself whenever the FEN changes.
  const [selection, setSelection] = useState<{ square: Square; fen: string } | null>(null)
  const [promotion, setPromotion] = useState<(PendingPromotion & { fen: string }) | null>(null)
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null)

  const position = useMemo(() => new Chess(fen), [fen])
  const selected = selection?.fen === fen && movableColor ? selection.square : null
  const pendingPromotion = promotion?.fen === fen && movableColor ? promotion : null
  const pieces = useMemo(() => buildPieces(pieceSet, lowPower), [lowPower, pieceSet])
  const h = theme.highlights

  const legalTargets = useMemo(() => {
    if (!selected) return new Map<Square, Move>()
    return new Map(position.moves({ square: selected, verbose: true }).map((m) => [m.to, m] as const))
  }, [position, selected])

  const canMoveFrom = useCallback(
    (square: Square): boolean => movableColor !== null && position.get(square)?.color === movableColor,
    [movableColor, position],
  )

  const attemptMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!movableColor) return false
      if (isPromotionMove(position, from, to)) {
        setPromotion({ from, to, color: movableColor, fen })
        return false
      }
      const accepted = onMove({ from, to })
      setSelection(null)
      return accepted
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
      // Tapping an illegal destination still reports it (puzzles give feedback).
      if (selected && square !== selected) attemptMove(selected, square)
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
      add(lastMove.from, h.lastMove)
      add(lastMove.to, h.lastMove)
    }
    if (position.inCheck()) {
      const king = findKingSquare(position, position.turn())
      if (king) add(king, h.check)
    }
    if (selected) add(selected, h.selected)
    if (showLegalMoves) legalTargets.forEach((move, square) => add(square, move.isCapture() ? h.captureTarget : h.target))
    if (hoverSquare && legalTargets.has(hoverSquare)) add(hoverSquare, h.hover)
    if (extraSquareStyles) Object.entries(extraSquareStyles).forEach(([square, style]) => add(square, style))
    return styles
  }, [extraSquareStyles, h, hoverSquare, lastMove, legalTargets, position, selected, showLegalMoves])

  const boardArrows = useMemo<Arrow[]>(
    () =>
      (arrows ?? []).map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color ?? 'rgba(52, 211, 153, 0.85)' })),
    [arrows],
  )

  const options = useMemo(
    () => ({
      id,
      pieces,
      position: fen,
      boardOrientation: orientation === 'w' ? ('white' as const) : ('black' as const),
      squareStyles,
      arrows: boardArrows,
      showNotation: showCoordinates,
      allowDragging: movableColor !== null,
      allowDrawingArrows: true,
      animationDurationInMs: lowPower ? 0 : 200,
      showAnimations: !lowPower,
      dragActivationDistance: 4,
      canDragPiece: ({ square }: PieceHandlerArgs) => isSquare(square) && canMoveFrom(square),
      onPieceDrop: handlePieceDrop,
      onPieceDrag: handlePieceDrag,
      onSquareClick: handleSquareClick,
      onMouseOverSquare: ({ square }: SquareHandlerArgs) => setHoverSquare(isSquare(square) ? square : null),
      onMouseOutSquare: () => setHoverSquare(null),
      boardStyle: { borderRadius: '0.75rem', overflow: 'hidden' },
      lightSquareStyle: theme.lightSquare,
      darkSquareStyle: theme.darkSquare,
      dropSquareStyle: h.hover,
      lightSquareNotationStyle: { color: theme.notationLight, fontWeight: 700, opacity: 0.9 },
      darkSquareNotationStyle: { color: theme.notationDark, fontWeight: 700, opacity: 0.9 },
      draggingPieceStyle: { transform: 'scale(1.18)', filter: 'drop-shadow(0 12px 14px rgba(0,0,0,0.5))' },
      draggingPieceGhostStyle: { opacity: 0.3 },
    }),
    [
      boardArrows,
      canMoveFrom,
      fen,
      h.hover,
      handlePieceDrag,
      handlePieceDrop,
      handleSquareClick,
      id,
      lowPower,
      movableColor,
      orientation,
      pieces,
      showCoordinates,
      squareStyles,
      theme,
    ],
  )

  return (
    <div key={shakeKey} className={`board-surface relative aspect-square w-full ${shakeKey > 0 ? 'animate-shake' : ''}`}>
      <div className="size-full rounded-xl transition-shadow duration-500" style={theme.boardFrame}>
        <Chessboard options={options} />
      </div>
      {children}
      {pendingPromotion && (
        <PromotionDialog color={pendingPromotion.color} pieceSet={pieceSet} onSelect={handlePromotionSelect} onCancel={cancelPromotion} />
      )}
    </div>
  )
}
