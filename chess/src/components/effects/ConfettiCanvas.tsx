import { useEffect, useRef } from 'react'

interface ConfettiCanvasProps {
  /** Increment to fire a new burst. 0 = idle. */
  burst: number
  colors: string[]
  disabled?: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  rotation: number
  spin: number
  color: string
  shape: 'rect' | 'circle' | 'spark'
  life: number
}

const DURATION_MS = 3600

/**
 * Full-screen celebratory particle system. The render loop only exists while a
 * burst is alive and is capped at ~60 fps, so it costs nothing when idle.
 */
export function ConfettiCanvas({ burst, colors, disabled = false }: ConfettiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (burst === 0 || disabled) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const w = window.innerWidth
    const h = window.innerHeight
    const count = Math.min(220, Math.round((w * h) / 6000))
    const pick = () => colors[Math.floor(Math.random() * colors.length)] ?? '#ffffff'
    const particles: Particle[] = []
    // Two cannons from the bottom corners plus a sparkle shower from the top.
    for (let i = 0; i < count; i += 1) {
      const fromLeft = i % 3 === 0
      const fromRight = i % 3 === 1
      const angle = fromLeft ? -Math.PI / 3 + (Math.random() - 0.5) * 0.6 : fromRight ? (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.6 : Math.PI / 2
      const speed = fromLeft || fromRight ? 9 + Math.random() * 9 : 1 + Math.random() * 2
      particles.push({
        x: fromLeft ? 0 : fromRight ? w : Math.random() * w,
        y: fromLeft || fromRight ? h : -20 - Math.random() * h * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 6,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        color: pick(),
        shape: i % 7 === 0 ? 'spark' : i % 2 === 0 ? 'rect' : 'circle',
        life: 1,
      })
    }

    let frame = 0
    let last = performance.now()
    const start = last
    const step = (now: number) => {
      const dt = Math.min(2.5, (now - last) / 16.67)
      last = now
      const elapsed = now - start
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.vy += 0.18 * dt
        p.vx *= 0.992
        p.vy *= 0.992
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rotation += p.spin * dt
        p.life = Math.max(0, 1 - elapsed / DURATION_MS)
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        else if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.shadowColor = p.color
          ctx.shadowBlur = 12
          ctx.fillRect(-p.size, -0.75, p.size * 2, 1.5)
          ctx.fillRect(-0.75, -p.size, 1.5, p.size * 2)
        }
        ctx.restore()
      }
      if (elapsed < DURATION_MS) frame = requestAnimationFrame(step)
      else ctx.clearRect(0, 0, w, h)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [burst, colors, disabled])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[55] size-full" aria-hidden="true" />
}
