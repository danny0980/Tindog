import { type ReactNode, useEffect, useRef } from 'react'
import { type Terrain, lifeAlpha, seedDrift, stepDrift } from '../../cinema/terrain'

/**
 * Living battlefield around the board: the ground glows under it and the
 * terrain's particles (sand, snow, spray, embers…) drift across the field.
 * Static (ground only) in battery saver and with reduced motion.
 */
export function Battlefield({ terrain, lowPower, children }: { terrain: Terrain | null; lowPower: boolean; children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!terrain || lowPower || !canvas || !ctx) return
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let drift = seedDrift(terrain, 1, 1)
    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      drift = seedDrift(terrain, w, h)
    }
    resize()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    observer?.observe(canvas)
    const { color, alpha } = terrain.ambient
    let raf = 0
    let last = performance.now()
    const start = last
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) {
        last = now
        return
      }
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      stepDrift(drift, terrain, dt, w, h, (now - start) / 1000)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      for (const p of drift) {
        const a = alpha * lifeAlpha(p.life)
        if (a <= 0.01) continue
        ctx.fillStyle = `rgba(${color}, ${a.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [lowPower, terrain])

  if (!terrain) return <>{children}</>
  return (
    <div className="relative" data-battlefield={terrain.id}>
      <div className="pointer-events-none absolute -inset-4 -z-0 rounded-[1.75rem] blur-md sm:-inset-6" style={{ background: terrain.ground }} aria-hidden="true" />
      <div className="relative">{children}</div>
      <canvas ref={canvasRef} className="pointer-events-none absolute -inset-3 z-30 size-[calc(100%+1.5rem)] sm:-inset-5 sm:size-[calc(100%+2.5rem)]" aria-hidden="true" />
    </div>
  )
}
