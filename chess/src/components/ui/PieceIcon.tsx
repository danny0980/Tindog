import { defaultPieces } from 'react-chessboard'
import type { Color, PieceSymbol } from '../../types/chess'
import type { PieceSet } from '../../types/theme'

interface PieceIconProps {
  color: Color
  type: PieceSymbol
  className?: string
  set?: PieceSet
}

/** Renders the board's SVG piece set at any size, optionally in a cosmetic style. */
export function PieceIcon({ color, type, className, set }: PieceIconProps) {
  const render = defaultPieces[`${color}${type.toUpperCase()}`]
  if (!render) return null
  const style = set ? (color === 'w' ? set.white : set.black) : null
  return (
    <span className={className} aria-hidden="true">
      {render({
        ...(style ? { fill: style.fill } : {}),
        svgStyle: { width: '100%', height: '100%', display: 'block', ...(style ? { filter: style.filter } : {}) },
      })}
    </span>
  )
}
