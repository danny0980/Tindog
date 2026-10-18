import type { CSSProperties, ReactNode } from 'react'
import type { KillCam } from '../../hooks/useGameController'
import type { Color } from '../../types/chess'
import { squareCenter } from '../../utils/boardGeometry'

/**
 * Cinematic checkmate: the board slow-zooms onto the mated king while a
 * vignette closes in and the verdict is stamped across it.
 */
export function KillCamStage({ cam, orientation, children }: { cam: KillCam | null; orientation: Color; children: ReactNode }) {
  if (!cam || !cam.king) return <>{children}</>
  const { x, y } = squareCenter(cam.king, orientation)
  const zoom: CSSProperties = { transformOrigin: `${x}% ${y}%` }
  return (
    <div className="relative" data-killcam="active">
      <div className="animate-killcam" style={zoom}>
        {children}
      </div>
      <div
        className="pointer-events-none absolute inset-0 rounded-xl"
        aria-hidden
        style={{ background: `radial-gradient(circle at ${x}% ${y}%, transparent 8%, rgba(0,0,0,0.25) 18%, rgba(0,0,0,0.8) 55%)` }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center" role="status">
        <div className={`animate-killcam-title font-display text-3xl font-black uppercase sm:text-5xl ${cam.youWon ? 'text-amber-200 drop-shadow-[0_0_24px_rgba(251,191,36,0.9)]' : 'text-red-300 drop-shadow-[0_0_24px_rgba(239,68,68,0.9)]'}`}>
          Checkmate
        </div>
        <div className="animate-killcam-title mt-1 text-sm font-semibold text-white/90">
          {cam.move ? `${cam.move.san} · ` : ''}
          {cam.caption}
        </div>
      </div>
    </div>
  )
}
