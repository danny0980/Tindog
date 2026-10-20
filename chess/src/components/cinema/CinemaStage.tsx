import { type ReactNode, useEffect, useRef, useState } from 'react'
import { type Shot, focusOnScreen, shotKeyframes } from '../../cinema/director'
import type { Color } from '../../types/chess'

interface CinemaStageProps {
  /** The shot to play (played once per id). */
  shot: Shot | null
  orientation: Color
  /** Mate shots: the verdict under the title ("Napoleon falls"). */
  mateCaption?: string | null
  /** Mate shots: the colour the title glows (you won → gold). */
  youWon?: boolean
  /** Called when the shot ends or is cut short (a tap on the board). */
  onDone: (id: string) => void
  children: ReactNode
}

/**
 * The cinematic camera: pushes in on the action with a 3D tilt and roll, slows
 * the pieces down, blurs everything but the focus (depth of field), drops
 * letterbox bars, then snaps back. A tap on the board cuts straight back.
 */
export function CinemaStage({ shot, orientation, mateCaption = null, youWon = true, onDone, children }: CinemaStageProps) {
  const cameraRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<Animation | null>(null)
  // The shot currently on screen (its overlays are drawn only while it runs).
  const [live, setLive] = useState<Shot | null>(null)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const el = cameraRef.current
    if (!shot || !el || typeof el.animate !== 'function') return
    const anim = el.animate(shotKeyframes(shot, orientation), { duration: shot.duration, fill: 'none' })
    animRef.current = anim
    const start = window.setTimeout(() => setLive(shot), 0)
    const end = () => {
      setLive((s) => (s?.id === shot.id ? null : s))
      doneRef.current(shot.id)
    }
    anim.onfinish = end
    anim.oncancel = end
    return () => {
      window.clearTimeout(start)
      anim.onfinish = null
      anim.oncancel = null
      anim.cancel()
      setLive((s) => (s?.id === shot.id ? null : s))
    }
  }, [orientation, shot])

  const cut = () => animRef.current?.playState === 'running' && animRef.current.cancel()
  const focus = live ? focusOnScreen(live, orientation) : null
  const style = live ? { ['--cine-ms' as string]: `${live.duration}ms`, ['--fx' as string]: `${focus?.x ?? 50}%`, ['--fy' as string]: `${focus?.y ?? 50}%` } : undefined

  return (
    <div className={`relative [perspective:1100px] ${live || shot ? 'overflow-hidden rounded-xl' : ''}`} data-cinema={live ? live.kind : 'idle'} onPointerDownCapture={cut} style={style}>
      <div ref={cameraRef} className="origin-center [transform-style:preserve-3d] will-change-transform">
        {children}
      </div>
      {live && (
        <>
          {/* Depth of field: everything but the focus melts into a soft blur. */}
          <div className="cine-dof pointer-events-none absolute inset-0 z-20 rounded-xl" aria-hidden="true" />
          <div className="cine-bar cine-bar-top pointer-events-none absolute inset-x-0 top-0 z-30" aria-hidden="true" />
          <div className="cine-bar cine-bar-bottom pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-center" aria-hidden="true">
            {live.caption && live.kind !== 'mate' && <span className="cine-caption font-display text-xs font-extrabold uppercase tracking-[0.35em] text-amber-100 sm:text-sm">{live.caption}</span>}
          </div>
          {live.kind === 'mate' && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 -translate-y-1/2 text-center" role="status">
              <div className={`animate-killcam-title font-display text-3xl font-black uppercase sm:text-5xl ${youWon ? 'text-amber-200 drop-shadow-[0_0_24px_rgba(251,191,36,0.9)]' : 'text-red-300 drop-shadow-[0_0_24px_rgba(239,68,68,0.9)]'}`}>
                Checkmate
              </div>
              {mateCaption && <div className="animate-killcam-title mt-1 text-sm font-semibold text-white/90">{mateCaption}</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
