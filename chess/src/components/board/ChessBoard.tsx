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
  /** Fired when the user picks up / selects one of their pieces (haptics). */
  onPickup?: () => void
  /** Arena overlays (frost / snow / glue / stuck) and the move filter they impose. */
  arena?: BoardArena | null
  /** Square-picker mode (laying a glue trap, choosing the altar pawn): taps go to `onPick`. */
  picker?: BoardPicker | null
  /** Rule-bending moves currently available to the player (Knight's Boot, Vanguard Charge). */
  specialTargets?: ReadonlyArray<{ from: Square; to: Square; kind: string }>
  children?: ReactNode
}

export interface BoardArena {
  frozen: readonly Square[]
  snow: readonly Square[]
  glue: readonly Square[]
  stuck: readonly Square[]
  /** True when the arena forbids this (otherwise legal) move for you. */
  isBlocked: (move: Move) => boolean
}

export interface BoardPicker {
  squares: readonly Square[]
  tone: 'glue' | 'altar'
  onPick: (square: Square) => void
}

const FROST_STYLE: CSSProperties = {
  background:
    'repeating-linear-gradient(45deg, rgba(186,230,253,0.55) 0 6px, rgba(125,211,252,0.25) 6px 12px), radial-gradient(circle, rgba(224,242,254,0.9), rgba(56,189,248,0.4))',
  boxShadow: 'inset 0 0 0 3px rgba(125,211,252,0.95), inset 0 0 22px rgba(14,165,233,0.85)',
}
const SNOW_STYLE: CSSProperties = {
  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95) 0 3px, transparent 4px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.9) 0 2px, transparent 3px), radial-gradient(circle, rgba(241,245,249,0.75), rgba(203,213,225,0.45))',
  boxShadow: 'inset 0 0 16px rgba(255,255,255,0.8)',
}
const GLUE_STYLE: CSSProperties = {
  background: 'radial-gradient(circle, rgba(251,191,36,0.75) 0 30%, rgba(217,119,6,0.45) 45%, transparent 66%)',
  boxShadow: 'inset 0 0 0 2px rgba(245,158,11,0.7)',
}
const STUCK_STYLE: CSSProperties = { boxShadow: 'inset 0 0 0 4px rgba(245,158,11,0.95), inset 0 -18px 18px rgba(217,119,6,0.55)' }
const PICK_STYLE: Record<BoardPicker['tone'], CSSProperties> = {
  glue: { boxShadow: 'inset 0 0 0 3px rgba(251,191,36,0.9)', background: 'rgba(251,191,36,0.18)' },
  altar: { boxShadow: 'inset 0 0 0 3px rgba(244,63,94,0.95)', background: 'rgba(244,63,94,0.22)' },
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
  onPickup,
  arena = null,
  picker = null,
  specialTargets,
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
    const moves = position.moves({ square: selected, verbose: true }).filter((m) => !arena?.isBlocked(m))
    return new Map(moves.map((m) => [m.to, m] as const))
  }, [arena, position, selected])

  /** Destinations reachable only through a spell / tactic from the selected piece. */
  const specialFromSelected = useMemo(
    () => new Set<Square>(selected ? (specialTargets ?? []).filter((t) => t.from === selected && !legalTargets.has(t.to)).map((t) => t.to) : []),
    [legalTargets, selected, specialTargets],
  )

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
      if (!isSquare(square)) return
      if (picker) {
        if (picker.squares.includes(square)) picker.onPick(square)
        return
      }
      if (!movableColor) return
      if (selected && (legalTargets.has(square) || specialFromSelected.has(square))) {
        attemptMove(selected, square)
        return
      }
      if (canMoveFrom(square)) {
        if (selected !== square) onPickup?.()
        setSelection(selected === square ? null : { square, fen })
        return
      }
      // Tapping an illegal destination still reports it (puzzles give feedback).
      if (selected && square !== selected) attemptMove(selected, square)
      setSelection(null)
    },
    [attemptMove, canMoveFrom, fen, legalTargets, movableColor, onPickup, picker, selected, specialFromSelected],
  )

  const handlePieceDrag = useCallback(
    ({ square }: PieceHandlerArgs) => {
      if (!isSquare(square) || !canMoveFrom(square)) return
      if (selected !== square) onPickup?.()
      setSelection({ square, fen })
    },
    [canMoveFrom, fen, onPickup, selected],
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
    // Spell / tactic destinations: a violet rune ring, distinct from normal targets.
    specialFromSelected.forEach((square) =>
      add(square, {
        background: 'radial-gradient(circle, transparent 40%, rgba(167,139,250,0.95) 44%, rgba(167,139,250,0.35) 56%, transparent 62%)',
        boxShadow: 'inset 0 0 14px rgba(167,139,250,0.6)',
      }),
    )
    // Arena: snow drifts, honey-glue traps, stuck pieces and icy, pulsing frost seals.
    if (arena) {
      arena.snow.forEach((sq) => add(sq, SNOW_STYLE))
      arena.glue.forEach((sq) => add(sq, GLUE_STYLE))
      arena.stuck.forEach((sq) => add(sq, STUCK_STYLE))
      arena.frozen.forEach((sq) => add(sq, { ...FROST_STYLE, animation: lowPower ? undefined : 'pulse-soft 1.6s ease-in-out infinite' }))
    }
    if (picker) picker.squares.forEach((sq) => add(sq, { ...PICK_STYLE[picker.tone], animation: lowPower ? undefined : 'pulse-soft 1.4s ease-in-out infinite' }))
    if (hoverSquare && legalTargets.has(hoverSquare)) add(hoverSquare, h.hover)
    if (extraSquareStyles) Object.entries(extraSquareStyles).forEach(([square, style]) => add(square, style))
    return styles
  }, [arena, extraSquareStyles, h, hoverSquare, lastMove, legalTargets, lowPower, picker, position, selected, showLegalMoves, specialFromSelected])

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
      allowDragging: movableColor !== null && !picker,
      allowDrawingArrows: true,
      animationDurationInMs: lowPower ? 0 : 200,
      showAnimations: !lowPower,
      dragActivationDistance: 4,
      canDragPiece: ({ square }: PieceHandlerArgs) => !picker && isSquare(square) && canMoveFrom(square),
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
      picker,
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
