// A small, allocation-free particle system for canvas effects (cinematic
// intro, spell bursts). Particles live in fixed-size typed arrays and are
// recycled, so a busy frame never triggers garbage collection.

/** Visual families; each has its own physics and colour ramp. */
export type ParticleKind = 'dust' | 'spark' | 'ember' | 'frost' | 'shard' | 'rune' | 'bubble'

const KINDS: readonly ParticleKind[] = ['dust', 'spark', 'ember', 'frost', 'shard', 'rune', 'bubble']

interface KindPhysics {
  gravity: number
  drag: number
  /** Colour stops (rgb) from birth to death. */
  from: readonly [number, number, number]
  to: readonly [number, number, number]
  /** Additive ("glowing") or normal blending. */
  glow: boolean
}

export const PHYSICS: Readonly<Record<ParticleKind, KindPhysics>> = {
  dust: { gravity: -4, drag: 0.6, from: [255, 236, 200], to: [255, 214, 160], glow: true },
  spark: { gravity: 220, drag: 1.6, from: [255, 246, 200], to: [255, 140, 40], glow: true },
  ember: { gravity: -60, drag: 0.4, from: [255, 200, 90], to: [200, 40, 10], glow: true },
  frost: { gravity: 30, drag: 1.2, from: [235, 250, 255], to: [80, 180, 255], glow: true },
  shard: { gravity: 420, drag: 0.8, from: [255, 255, 255], to: [120, 160, 255], glow: false },
  rune: { gravity: -30, drag: 0.9, from: [190, 230, 255], to: [140, 90, 255], glow: true },
  bubble: { gravity: -90, drag: 1, from: [190, 255, 200], to: [60, 200, 120], glow: true },
}

export interface EmitOptions {
  x: number
  y: number
  vx?: number
  vy?: number
  /** Random velocity spread (px/s). */
  spread?: number
  life?: number
  size?: number
}

export class ParticleSystem {
  readonly capacity: number
  private x: Float32Array
  private y: Float32Array
  private vx: Float32Array
  private vy: Float32Array
  private life: Float32Array
  private maxLife: Float32Array
  private size: Float32Array
  private kind: Uint8Array
  private next = 0
  /** Upper bound on simultaneously live particles (quality governor). */
  limit: number
  private readonly random: () => number

  constructor(capacity: number, random: () => number = Math.random) {
    this.capacity = capacity
    this.limit = capacity
    this.random = random
    this.x = new Float32Array(capacity)
    this.y = new Float32Array(capacity)
    this.vx = new Float32Array(capacity)
    this.vy = new Float32Array(capacity)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)
    this.size = new Float32Array(capacity)
    this.kind = new Uint8Array(capacity)
  }

  /** Live particle count. */
  get alive(): number {
    let n = 0
    for (let i = 0; i < this.capacity; i++) if ((this.life[i] ?? 0) > 0) n += 1
    return n
  }

  /** Spawns `count` particles; recycles the oldest slot when full or over the limit. */
  emit(kind: ParticleKind, count: number, o: EmitOptions): void {
    const spread = o.spread ?? 60
    const slots = Math.min(this.limit, this.capacity)
    for (let n = 0; n < count; n++) {
      if (this.next >= slots) this.next = 0
      const i = this.next
      this.next = (this.next + 1) % slots
      const angle = this.random() * Math.PI * 2
      const speed = this.random() * spread
      this.x[i] = o.x
      this.y[i] = o.y
      this.vx[i] = (o.vx ?? 0) + Math.cos(angle) * speed
      this.vy[i] = (o.vy ?? 0) + Math.sin(angle) * speed
      const life = (o.life ?? 1) * (0.6 + this.random() * 0.8)
      this.life[i] = life
      this.maxLife[i] = life
      this.size[i] = (o.size ?? 3) * (0.5 + this.random())
      this.kind[i] = KINDS.indexOf(kind)
    }
  }

  /** Advances the simulation by `dt` seconds. */
  update(dt: number): void {
    for (let i = 0; i < this.capacity; i++) {
      const life = this.life[i] ?? 0
      if (life <= 0) continue
      const phys = PHYSICS[KINDS[this.kind[i] ?? 0] ?? 'dust']
      const damp = Math.max(0, 1 - phys.drag * dt)
      const vx = (this.vx[i] ?? 0) * damp
      const vy = (this.vy[i] ?? 0) * damp + phys.gravity * dt
      this.life[i] = life - dt
      this.vx[i] = vx
      this.vy[i] = vy
      this.x[i] = (this.x[i] ?? 0) + vx * dt
      this.y[i] = (this.y[i] ?? 0) + vy * dt
    }
  }

  clear(): void {
    this.life.fill(0)
  }

  /** Draws every live particle (glowing kinds additively). */
  draw(ctx: CanvasRenderingContext2D, scale = 1): void {
    const previous = ctx.globalCompositeOperation
    for (let i = 0; i < this.capacity; i++) {
      const life = this.life[i] ?? 0
      if (life <= 0) continue
      const kind = KINDS[this.kind[i] ?? 0] ?? 'dust'
      const phys = PHYSICS[kind]
      const t = 1 - life / (this.maxLife[i] || 1)
      const r = Math.round(phys.from[0] + (phys.to[0] - phys.from[0]) * t)
      const g = Math.round(phys.from[1] + (phys.to[1] - phys.from[1]) * t)
      const b = Math.round(phys.from[2] + (phys.to[2] - phys.from[2]) * t)
      const alpha = kind === 'dust' ? Math.sin(Math.PI * Math.min(1, t)) * 0.55 : 1 - t
      ctx.globalCompositeOperation = phys.glow ? 'lighter' : 'source-over'
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`
      const s = (this.size[i] ?? 1) * scale * (kind === 'spark' ? 1 - t * 0.5 : 1)
      const px = (this.x[i] ?? 0) * scale
      const py = (this.y[i] ?? 0) * scale
      if (kind === 'shard' || kind === 'frost') {
        ctx.fillRect(px - s / 2, py - s / 2, s, s * (kind === 'shard' ? 0.6 : 1))
      } else {
        ctx.beginPath()
        ctx.arc(px, py, s, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalCompositeOperation = previous
  }
}

/**
 * Adaptive quality: watches frame times and steps the render quality down
 * when the device can't hold ~60 fps (and back up when it has headroom).
 */
export class QualityGovernor {
  /** 1 = low, 2 = medium, 3 = high. */
  level: 1 | 2 | 3
  private ema = 16.7
  private strain = 0
  private ease = 0

  constructor(initial: 1 | 2 | 3) {
    this.level = initial
  }

  /** Feed one frame duration (ms). Returns true when the level changed. */
  sample(frameMs: number): boolean {
    const ms = Math.min(100, Math.max(1, frameMs))
    this.ema = this.ema * 0.9 + ms * 0.1
    if (this.ema > 22) {
      this.strain += 1
      this.ease = 0
    } else if (this.ema < 14) {
      this.ease += 1
      this.strain = 0
    } else {
      this.strain = Math.max(0, this.strain - 1)
      this.ease = 0
    }
    if (this.strain >= 30 && this.level > 1) {
      this.level = (this.level - 1) as 1 | 2
      this.strain = 0
      return true
    }
    if (this.ease >= 240 && this.level < 3) {
      this.level = (this.level + 1) as 2 | 3
      this.ease = 0
      return true
    }
    return false
  }

  get averageMs(): number {
    return this.ema
  }
}

/** Settings each quality level maps to. */
export const QUALITY: Readonly<Record<1 | 2 | 3, { dpr: number; particles: number; strips: number; bloom: boolean }>> = {
  // `strips`: the most board strips per frame (the renderer uses ~1 per 1.2 px of board height).
  1: { dpr: 1, particles: 140, strips: 160, bloom: false },
  2: { dpr: 1.5, particles: 320, strips: 300, bloom: true },
  3: { dpr: 2, particles: 600, strips: 480, bloom: true },
}
