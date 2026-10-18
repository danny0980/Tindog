import { type MouseEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef } from 'react'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

interface SwipeOptions {
  enabled: boolean
  onSwipe: (direction: SwipeDirection) => void
  /** Minimum travel in px. */
  threshold?: number
  /** Maximum gesture duration in ms (longer = a drag, not a swipe). */
  maxDurationMs?: number
}

/**
 * Lightweight pointer-based swipe recogniser (touch, pen and mouse). Returns
 * props to spread on the gesture surface. The gesture may end anywhere on
 * screen (the release is tracked on `window`, so no pointer capture is needed
 * and buttons inside the surface keep working). A recognised swipe swallows
 * the click that follows it, so swiping across a button never presses it.
 */
export function useSwipeGesture({ enabled, onSwipe, threshold = 48, maxDurationMs = 700 }: SwipeOptions) {
  const swallowClick = useRef(false)
  const cleanup = useRef<(() => void) | null>(null)
  const onSwipeRef = useRef(onSwipe)
  useEffect(() => {
    onSwipeRef.current = onSwipe
  }, [onSwipe])
  useEffect(() => () => cleanup.current?.(), [])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return
      cleanup.current?.()
      swallowClick.current = false
      const start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }

      const onUp = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== start.id) return
        cleanup.current?.()
        const dx = ev.clientX - start.x
        const dy = ev.clientY - start.y
        const ax = Math.abs(dx)
        const ay = Math.abs(dy)
        if (performance.now() - start.t > maxDurationMs || Math.max(ax, ay) < threshold) return
        // Require a clearly dominant axis to avoid diagonal misfires.
        let direction: SwipeDirection
        if (ax > ay * 1.4) direction = dx < 0 ? 'left' : 'right'
        else if (ay > ax * 1.4) direction = dy < 0 ? 'up' : 'down'
        else return
        swallowClick.current = true
        // Reset shortly after in case no click follows (release outside the surface).
        window.setTimeout(() => {
          swallowClick.current = false
        }, 400)
        onSwipeRef.current(direction)
      }
      const onCancel = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId === start.id) cleanup.current?.()
      }
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      cleanup.current = () => {
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        cleanup.current = null
      }
    },
    [enabled, maxDurationMs, threshold],
  )

  const onClickCapture = useCallback((e: MouseEvent<HTMLElement>) => {
    if (!swallowClick.current) return
    swallowClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }, [])

  return useMemo(
    () => ({
      onPointerDown,
      onClickCapture,
      // Hand vertical/horizontal swipes on this surface to us instead of scrolling.
      style: enabled ? ({ touchAction: 'none' } as const) : undefined,
    }),
    [enabled, onClickCapture, onPointerDown],
  )
}
