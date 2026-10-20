import type { CSSProperties, ReactNode } from 'react'
import type { PieceState } from '../../cinema/pieceStates'
import type { SquareVfx } from './boardVfx'

interface BoardSquareProps {
  style: CSSProperties | undefined
  vfx: SquareVfx | undefined
  /** Changes on every capture landing here: replays the flash. */
  captureKey: number | null
  /** The piece reacting to the position, if any. */
  state?: PieceState | undefined
  /** The captured piece, drawn once more as it disintegrates. */
  ghost?: ReactNode
  /** Vanishing Chess: how visible the piece is. */
  opacity?: number | undefined
  children: ReactNode
}

/**
 * One board square with its VFX layers (status tile, trail, aura, check /
 * mate pulse, capture flash) drawn under the piece.
 */
export function BoardSquare({ style, vfx, captureKey, state, ghost = null, opacity, children }: BoardSquareProps) {
  // Always the same element tree, so a piece landing here is never remounted (which would cut its move animation).
  return (
    <div className={`vfx-square ${vfx?.selected ? 'vfx-raised' : ''}`} style={style}>
      {vfx?.tile && <span className={`vfx-layer vfx-tile vfx-${vfx.tile}`} data-vfx-tile={vfx.tile} />}
      {vfx?.lastFrom && <span className="vfx-layer vfx-trail-from" />}
      {vfx?.lastTo && <span className="vfx-layer vfx-trail-to" />}
      {vfx?.check && <span className="vfx-layer vfx-check" data-vfx-check />}
      {vfx?.mate && <span className="vfx-layer vfx-mate" data-vfx-mate />}
      {vfx?.selected && <span className="vfx-layer vfx-aura" />}
      <div className={`vfx-piece ${state ? `vfx-piece-${state}` : ''}`} data-piece-state={state} data-opacity={opacity} style={opacity === undefined ? undefined : { opacity, transition: 'opacity 0.6s ease' }}>
        {children}
      </div>
      {captureKey !== null && <span key={captureKey} className="vfx-layer vfx-capture" data-vfx-capture />}
      {captureKey !== null && ghost && (
        <span key={`g${captureKey}`} className="vfx-layer vfx-disintegrate" data-vfx-disintegrate aria-hidden="true">
          {ghost}
        </span>
      )}
    </div>
  )
}
