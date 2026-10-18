import { useEffect } from 'react'
import { useStore } from '../../hooks/useStore'
import { settingsStore } from '../../stores/settingsStore'
import { useParticleLayer } from './useParticleLayer'

interface CelebrationParticlesProps {
  mood: 'victory' | 'defeat'
}

/**
 * Particle overlay for the game-over card: golden fountains and drifting
 * motes for a victory, slow rising embers for a defeat. Plays for a few
 * seconds and stops; off in battery saver and with reduced motion.
 */
export function CelebrationParticles({ mood }: CelebrationParticlesProps) {
  const batterySaver = useStore(settingsStore, (s) => s.batterySaver)
  const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const { canvasRef, burst, stream } = useParticleLayer(420, batterySaver || reduced)

  useEffect(() => {
    if (mood === 'victory') {
      burst((system, { w, h }) => {
        system.emit('spark', 60, { x: w / 2, y: h * 0.35, spread: w * 0.9, life: 1.1, size: 3, vy: -h * 0.4 })
        system.emit('dust', 40, { x: w / 2, y: h * 0.4, spread: w * 0.6, life: 2, size: 4 })
      })
      stream((system, { w, h }, dt, t) => {
        // Two fountains from the lower corners, then a gentle rain of golden motes.
        if (t < 2.2) {
          system.emit('spark', Math.round(120 * dt), { x: w * 0.1, y: h, spread: w * 0.12, life: 1.2, size: 2.5, vx: w * 0.35, vy: -h * 1.1 })
          system.emit('spark', Math.round(120 * dt), { x: w * 0.9, y: h, spread: w * 0.12, life: 1.2, size: 2.5, vx: -w * 0.35, vy: -h * 1.1 })
        }
        if (Math.random() < dt * 30) system.emit('dust', 1, { x: Math.random() * w, y: h * 0.1, spread: 10, life: 2.4, size: 3.5, vy: h * 0.08 })
        return t < 4.5
      })
    } else {
      stream((system, { w, h }, dt, t) => {
        if (Math.random() < dt * 40) system.emit('ember', 1, { x: Math.random() * w, y: h, spread: 12, life: 2.6, size: 3, vy: -h * 0.12 })
        return t < 5
      })
    }
  }, [burst, mood, stream])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 -z-0 size-full" aria-hidden="true" data-celebration={mood} />
}
