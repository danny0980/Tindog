import type { CSSProperties, ReactNode } from 'react'
import type { SquareVfx } from './boardVfx'

interface BoardSquareProps {
  style: CSSProperties | undefined
  vfx: SquareVfx | undefined
  /** Changes on every capture landing here: replays the flash. */
  captureKey: number | null
  children: ReactNode
}

/**
 * One board square with its VFX layers (status tile, trail, aura, check /
 * mate pulse, capture flash) drawn under the piece.
 */
export function BoardSquare({ style, vfx, captureKey, children }: BoardSquareProps) {
  // Always the same element tree, so a piece landing here is never remounted (which would cut its move animation).
  return (
    <div className={`vfx-square ${vfx?.selected ? 'vfx-raised' : ''}`} style={style}>
      {vfx?.tile && <span className={`vfx-layer vfx-tile vfx-${vfx.tile}`} data-vfx-tile={vfx.tile} />}
      {vfx?.lastFrom && <span className="vfx-layer vfx-trail-from" />}
      {vfx?.lastTo && <span className="vfx-layer vfx-trail-to" />}
      {vfx?.check && <span className="vfx-layer vfx-check" data-vfx-check />}
      {vfx?.mate && <span className="vfx-layer vfx-mate" data-vfx-mate />}
      {vfx?.selected && <span className="vfx-layer vfx-aura" />}
      <div className="vfx-piece">{children}</div>
      {captureKey !== null && <span key={captureKey} className="vfx-layer vfx-capture" data-vfx-capture />}
    </div>
  )
}
