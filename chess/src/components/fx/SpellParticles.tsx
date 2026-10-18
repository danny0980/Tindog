import { useEffect, useRef } from 'react'
import type { Color, Square } from '../../types/chess'
import { squareCenter } from '../../utils/boardGeometry'
import { type BoardFx, burstsFor } from './boardFx'
import { ParticleSystem } from './particles'

interface SpellParticlesProps {
  fx: BoardFx | null
  orientation: Color
  /** Frost-sealed squares: they shed a slow drift of ice crystals. */
  frozen: readonly Square[]
  lowPower: boolean
}

/**
 * Canvas particle layer over the board: bursts for spells, frost, glue,
 * potions, the altar and checks, plus an ambient frost drift on sealed
 * squares. The loop only runs while something is alive (zero cost at rest).
 */
export function SpellParticles({ fx, orientation, frozen, lowPower }: SpellParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const systemRef = useRef(new ParticleSystem(360))
  const frozenRef = useRef<readonly Square[]>(frozen)
  const orientationRef = useRef(orientation)
  const kickRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    frozenRef.current = lowPower ? [] : frozen
    orientationRef.current = orientation
    kickRef.current()
  }, [frozen, lowPower, orientation])

  // Loop + sizing.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let running = false
    let last = 0
    let size = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      size = canvas.clientWidth
      canvas.width = Math.round(size * dpr)
      canvas.height = Math.round(size * dpr)
    }
    resize()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    observer?.observe(canvas)
    const system = systemRef.current
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const cell = size / 8
      for (const sq of frozenRef.current) {
        if (Math.random() < dt * 9) {
          const c = squareCenter(sq, orientationRef.current)
          system.emit('frost', 1, { x: ((c.x + (Math.random() - 0.5) * 10) / 100) * size, y: ((c.y + (Math.random() - 0.5) * 10) / 100) * size, vy: -cell * 0.3, spread: cell * 0.25, life: 1.4, size: cell * 0.045 })
        }
      }
      system.update(dt)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      system.draw(ctx)
      if (system.alive === 0 && frozenRef.current.length === 0) {
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
  }, [])

  // Bursts.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!fx || lowPower || !canvas) return
    const size = canvas.clientWidth
    const cell = size / 8
    const c = fx.square ? squareCenter(fx.square, orientationRef.current) : { x: 50, y: 50 }
    for (const b of burstsFor(fx.kind, cell)) systemRef.current.emit(b.particle, b.count, { ...b.options, x: (c.x / 100) * size, y: (c.y / 100) * size })
    kickRef.current()
  }, [fx, lowPower])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full rounded-xl" aria-hidden="true" data-spell-particles />
}
