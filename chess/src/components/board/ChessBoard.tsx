import { Chess } from 'chess.js'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Arrow, Chessboard, type PieceDropHandlerArgs, type PieceHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import type { Color, Move, MoveInput, PendingPromotion, PromotionPiece, Square } from '../../types/chess'
import type { BoardTheme, PieceSet } from '../../types/theme'
import { findKingSquare, isPromotionMove } from '../../utils/chess'
import { buildPieces } from '../../utils/pieces'
import { assetUrl } from '../../assets/artManifest'
import { useBoardArt, useImagesStatus, usePieceArt } from '../../assets/useArt'
import { useStore } from '../../hooks/useStore'
import { settingsStore } from '../../stores/settingsStore'
import { PromotionDialog } from './PromotionDialog'
import { BoardSquare } from './BoardSquare'
import { boardVfx, captureSquare, type TileKind } from './boardVfx'
import { useParticleLayer } from '../fx/useParticleLayer'
import { squareCenter } from '../../utils/boardGeometry'

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
  /** Extra animated status tiles (lava, poison, void rifts …) for rules that create them. */
  hazards?: Partial<Record<TileKind, readonly Square[]>>
  /** True when the arena forbids this (otherwise legal) move for you. */
  isBlocked: (move: Move) => boolean
}

export interface BoardPicker {
  squares: readonly Square[]
  tone: 'glue' | 'altar'
  onPick: (square: Square) => void
}

const PICK_STYLE: Record<BoardPicker['tone'], CSSProperties> = {
  glue: { boxShadow: 'inset 0 0 0 3px rgba(251,191,36,0.9)', backgroundColor: 'rgba(251,191,36,0.18)' },
  altar: { boxShadow: 'inset 0 0 0 3px rgba(244,63,94,0.95)', backgroundColor: 'rgba(244,63,94,0.22)' },
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
  const pieceArt = usePieceArt(pieceSet.id)
  const artPieceScale = useStore(settingsStore, (s) => s.artPieceScale)
  const pieces = useMemo(() => buildPieces(pieceSet, lowPower, pieceArt, artPieceScale), [lowPower, pieceArt, pieceSet, artPieceScale])

  // Art-pack board: a whole-board image, or tiled light/dark squares (+ optional frame).
  // Applied only once every file has loaded, so a broken file keeps the theme's colours.
  const boardArt = useBoardArt(theme.id)
  const artUrls = useMemo(() => {
    const b = boardArt?.board
    if (!b) return []
    return (b.board ? [b.board] : [b.light, b.dark]).filter((x): x is string => typeof x === 'string').map(assetUrl)
  }, [boardArt])
  const artStatus = useImagesStatus(artUrls)
  const art = boardArt && artStatus === 'ok' ? boardArt.board : null
  const frameUrl = art?.frame ? assetUrl(art.frame) : null
  const frameStatus = useImagesStatus(frameUrl ? [frameUrl] : [])
  const boardSkin = useMemo(() => {
    if (!art) return { light: theme.lightSquare, dark: theme.darkSquare, board: undefined }
    if (art.board) return { light: { backgroundColor: 'transparent' }, dark: { backgroundColor: 'transparent' }, board: assetUrl(art.board) }
    const tile = (path: string | undefined): CSSProperties => (path ? { backgroundImage: `url("${assetUrl(path)}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})
    return { light: tile(art.light), dark: tile(art.dark), board: undefined }
  }, [art, theme.darkSquare, theme.lightSquare])
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
        backgroundImage: 'radial-gradient(circle, transparent 40%, rgba(167,139,250,0.95) 44%, rgba(167,139,250,0.35) 56%, transparent 62%)',
        boxShadow: 'inset 0 0 14px rgba(167,139,250,0.6)',
      }),
    )
    // Arena tiles (frost, snow, glue, lava …) are drawn as animated VFX layers — see `vfx` below.
    if (picker) picker.squares.forEach((sq) => add(sq, { ...PICK_STYLE[picker.tone], animation: lowPower ? undefined : 'pulse-soft 1.4s ease-in-out infinite' }))
    if (hoverSquare && legalTargets.has(hoverSquare)) add(hoverSquare, h.hover)
    if (extraSquareStyles) Object.entries(extraSquareStyles).forEach(([square, style]) => add(square, style))
    return styles
  }, [extraSquareStyles, h, hoverSquare, lastMove, legalTargets, lowPower, picker, position, selected, showLegalMoves, specialFromSelected])

  // ── VFX: per-square layers, capture flashes and sparks ─────────────────────
  const inCheck = position.inCheck()
  const mate = position.isCheckmate()
  const vfx = useMemo(
    () =>
      boardVfx({
        selected,
        lastMove,
        kingInDanger: inCheck ? findKingSquare(position, position.turn()) : null,
        mate,
        tiles: {
          ...arena?.hazards,
          frost: arena?.frozen ?? [],
          snow: arena?.snow ?? [],
          glue: arena?.glue ?? [],
          stuck: arena?.stuck ?? [],
        },
      }),
    [arena, inCheck, lastMove, mate, position, selected],
  )
  const [capture, setCapture] = useState<{ id: number; square: Square } | null>(null)
  const prevFenRef = useRef<string | null>(null)
  const reducedMotion = useMemo(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const { canvasRef: sparkCanvasRef, burst: burstSparks } = useParticleLayer(160, lowPower || reducedMotion)
  useEffect(() => {
    const square = captureSquare(prevFenRef.current, fen, lastMove)
    prevFenRef.current = fen
    if (!square) return
    setCapture((c) => ({ id: (c?.id ?? 0) + 1, square }))
    const at = squareCenter(square, orientation)
    burstSparks((system, size) => {
      const cell = size.w / 8
      const x = (at.x / 100) * size.w
      const y = (at.y / 100) * size.h
      system.emit('shard', 16, { x, y, spread: cell * 2.4, life: 0.7, size: cell * 0.06, vy: -cell * 1.5 })
      system.emit('spark', 22, { x, y, spread: cell * 3, life: 0.5, size: cell * 0.035 })
    })
  }, [burstSparks, fen, lastMove, orientation])
  const squareRenderer = useCallback(
    ({ square, children }: { square: string; children?: ReactNode }) => (
      <BoardSquare style={squareStyles[square]} vfx={isSquare(square) ? vfx.get(square) : undefined} captureKey={capture?.square === square ? capture.id : null}>
        {children}
      </BoardSquare>
    ),
    [capture, squareStyles, vfx],
  )

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
      squareRenderer,
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
      boardStyle: { borderRadius: '0.75rem', overflow: pieceArt && artPieceScale > 1 ? 'visible' : 'hidden', ...(boardSkin.board ? { backgroundImage: `url("${boardSkin.board}")`, backgroundPosition: 'center', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' } : {}) },
      lightSquareStyle: boardSkin.light,
      darkSquareStyle: boardSkin.dark,
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
      squareRenderer,
      boardSkin,
      theme,
      pieceArt,
      artPieceScale,
    ],
  )

  return (
    <div
      key={shakeKey}
      className={`board-surface relative aspect-square w-full ${shakeKey > 0 ? 'animate-shake' : ''}`}
      data-vfx={lowPower ? 'static' : 'live'}
      data-lift={lowPower || picker ? undefined : (movableColor ?? undefined)}
      style={{ '--vfx-glow': `color-mix(in srgb, ${theme.accent} 80%, transparent)`, '--vfx-rim': theme.accent } as CSSProperties}
    >
      <div className="vfx-rim" data-state={mate ? 'mate' : inCheck ? 'check' : 'idle'} aria-hidden="true" />
      <div className="size-full rounded-xl transition-shadow duration-500" style={theme.boardFrame}>
        <Chessboard options={options} />
      </div>
      {frameUrl && frameStatus === 'ok' && (
        // Decorative frame art: transparent centre, sized for a 2304 px frame around a 2048 px board.
        <img src={frameUrl} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute -inset-[6.25%] z-0 size-[112.5%] max-w-none" />
      )}
      <canvas ref={sparkCanvasRef} className="pointer-events-none absolute inset-0 z-10 size-full" aria-hidden="true" data-capture-sparks />
      {children}
      {pendingPromotion && (
        <PromotionDialog color={pendingPromotion.color} pieceSet={pieceSet} onSelect={handlePromotionSelect} onCancel={cancelPromotion} />
      )}
    </div>
  )
}
