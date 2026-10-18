import { useCallback, useEffect, useRef } from 'react'
import { ParticleSystem } from './particles'

/** Called every frame while a stream is active: emit into `system`; return false to stop. */
export type ParticleStream = (system: ParticleSystem, size: { w: number; h: number }, dt: number, elapsed: number) => boolean

/**
 * A canvas particle layer you can fire bursts and timed streams into. The
 * animation loop runs only while particles are alive or a stream is active, so
 * it costs nothing at rest; `disabled` (battery saver) turns emitting off.
 */
export function useParticleLayer(capacity: number, disabled = false) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const systemRef = useRef<ParticleSystem | null>(null)
  const streamsRef = useRef<Array<{ fn: ParticleStream; start: number }>>([])
  const kickRef = useRef<() => void>(() => undefined)
  const sizeRef = useRef({ w: 0, h: 0 })
  const disabledRef = useRef(disabled)
  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const system = (systemRef.current ??= new ParticleSystem(capacity))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      sizeRef.current = { w: canvas.clientWidth, h: canvas.clientHeight }
      canvas.width = Math.round(sizeRef.current.w * dpr)
      canvas.height = Math.round(sizeRef.current.h * dpr)
    }
    resize()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    observer?.observe(canvas)
    let raf = 0
    let running = false
    let last = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      streamsRef.current = streamsRef.current.filter((s) => s.fn(system, sizeRef.current, dt, (now - s.start) / 1000))
      system.update(dt)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h)
      system.draw(ctx)
      if (system.alive === 0 && streamsRef.current.length === 0) {
        running = false
        return
      }
      raf = requestAnimationFrame(frame)
    }
    kickRef.current = () => {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    kickRef.current()
    return () => {
      cancelAnimationFrame(raf)
      running = false
      observer?.disconnect()
      kickRef.current = () => undefined
    }
  }, [capacity])

  /** One-off burst: emit now. */
  const burst = useCallback((emit: (system: ParticleSystem, size: { w: number; h: number }) => void) => {
    const system = systemRef.current
    if (!system || disabledRef.current) return
    emit(system, sizeRef.current)
    kickRef.current()
  }, [])

  /** A stream that emits every frame until it returns false. */
  const stream = useCallback((fn: ParticleStream) => {
    if (disabledRef.current) return
    streamsRef.current.push({ fn, start: performance.now() })
    kickRef.current()
  }, [])

  return { canvasRef, burst, stream }
}
