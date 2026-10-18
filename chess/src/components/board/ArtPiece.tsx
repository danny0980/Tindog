import { type CSSProperties, type ReactNode, useState } from 'react'
import { type ArtPieceSet, type PieceCode, assetUrl, sheetBackground } from '../../assets/artManifest'

interface ArtPieceProps {
  code: PieceCode
  art: ArtPieceSet
  /** The built-in vector piece, shown if the image can't be loaded. */
  fallback: ReactNode
  style?: CSSProperties
}

/**
 * One piece from an art-pack set: a single image file or a cell of a sprite
 * sheet. If the file is missing or broken, the vector piece takes over.
 */
export function ArtPiece({ code, art, fallback, style }: ArtPieceProps) {
  const [failed, setFailed] = useState(false)
  if (failed) return <>{fallback}</>
  const file = art.files?.[code]
  if (file) {
    return (
      <img
        src={assetUrl(file)}
        alt=""
        draggable={false}
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none', userSelect: 'none', ...style }}
      />
    )
  }
  if (art.sheet) {
    // A square box of its own: the board's piece slot has no intrinsic height for a bare div.
    return <div role="presentation" style={{ width: '100%', aspectRatio: '1 / 1', maxHeight: '100%', margin: 'auto', backgroundRepeat: 'no-repeat', ...sheetBackground(code, art.sheet), ...style }} />
  }
  return <>{fallback}</>
}
