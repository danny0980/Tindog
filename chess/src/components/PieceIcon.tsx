import { defaultPieces } from 'react-chessboard'
import type { Color, PieceSymbol } from '../types/chess'

interface PieceIconProps {
  color: Color
  type: PieceSymbol
  className?: string
}

/** Renders the same SVG piece set the board uses, at any size. */
export function PieceIcon({ color, type, className }: PieceIconProps) {
  const render = defaultPieces[`${color}${type.toUpperCase()}`]
  if (!render) return null
  return (
    <span className={className} aria-hidden="true">
      {render({ svgStyle: { width: '100%', height: '100%', display: 'block' } })}
    </span>
  )
}
