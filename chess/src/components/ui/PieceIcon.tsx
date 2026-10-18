import { defaultPieces } from 'react-chessboard'
import type { Color, PieceSymbol } from '../../types/chess'
import type { PieceSet } from '../../types/theme'
import { PIECE_CODES, type PieceCode } from '../../assets/artManifest'
import { usePieceArt } from '../../assets/useArt'
import { ArtPiece } from '../board/ArtPiece'

const isPieceCode = (code: string): code is PieceCode => (PIECE_CODES as readonly string[]).includes(code)

interface PieceIconProps {
  color: Color
  type: PieceSymbol
  className?: string
  set?: PieceSet
}

/** Renders a piece at any size: art-pack image when available, else the cosmetic SVG style. */
export function PieceIcon({ color, type, className, set }: PieceIconProps) {
  const code = `${color}${type.toUpperCase()}`
  const art = usePieceArt(set?.id ?? 'standard')
  const render = defaultPieces[code]
  if (!render) return null
  const style = set ? (color === 'w' ? set.white : set.black) : null
  const vector = render({
    ...(style ? { fill: style.fill } : {}),
    svgStyle: { width: '100%', height: '100%', display: 'block', ...(style ? { filter: style.filter } : {}) },
  })
  return (
    <span className={className} aria-hidden="true">
      {art && isPieceCode(code) ? <ArtPiece code={code} art={art.set} fallback={vector} /> : vector}
    </span>
  )
}
