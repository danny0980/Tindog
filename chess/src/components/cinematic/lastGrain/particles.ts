// Every particle in the film — the two grains and their streaks, the crown
// splashes, era embers, the queen's sparks, golden dust, and the grains that
// stream together into the title — as a deterministic function of film time.
// Physics runs on worldTime(t), so everything hangs in the air during the freeze.
// Pure TypeScript (no three.js) so it can be tested headless.
import { firstGrainY, lastGrainY } from './camera'
import { ERA_PIECES, IMPACT, LAST_IMPACT, QUEEN, QUEEN_CROWN_FROM, type Vec3 } from './layout'
import { T, TITLE, clamp01, easeInOut, easeOut, letterLands, progress, worldTime } from './timeline'

export type Quality = 'high' | 'low'

const Kind = { Grain: 0, Splash: 1, Ember: 2, Dust: 3, Title: 4, Flare: 5, Spark: 6 } as const
type Kind = (typeof Kind)[keyof typeof Kind]

export interface ParticleCounts {
  splash: number
  ember: number
  spark: number
  dust: number
  title: number
}

export const COUNTS: Record<Quality, ParticleCounts> = {
  high: { splash: 56, ember: 30, spark: 90, dust: 380, title: 1500 },
  low: { splash: 28, ember: 14, spark: 40, dust: 140, title: 650 },
}

const GRAIN_TRAIL = 14
const GOLD: Vec3 = [3.0, 1.9, 0.62]

/** Small, fast, seedable PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let r = Math.imul(a ^ (a >>> 15), 1 | a)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Screen → world: writes the world point `depth` units along the camera ray through pixel (x, y). */
export type Unproject = (x: number, y: number, depth: number, out: [number, number, number]) => void

export interface TitleTargets {
  /** Pixel x, y per title particle (CSS px of the canvas). */
  xy: Float32Array
  /** Letter index per title particle. */
  letter: Uint8Array
}

/** How far in front of the camera the title particles assemble (world units). */
export const TITLE_DEPTH = 3

export class ParticleSim {
  readonly count: number
  readonly position: Float32Array
  readonly color: Float32Array
  readonly size: Float32Array
  readonly alpha: Float32Array

  private readonly kind: Uint8Array
  /** origin xyz, velocity xyz, t0, life, base size, seed, group */
  private readonly p: Float32Array
  private static readonly STRIDE = 11
  private readonly titleStart: number
  private readonly titleCount: number
  private targets: TitleTargets | null = null
  private readonly tmp: [number, number, number] = [0, 0, 0]

  constructor(quality: Quality) {
    const c = COUNTS[quality]
    const kinds: Kind[] = []
    const params: number[] = []
    const R = rng(1957)
    const push = (k: Kind, origin: Vec3, vel: Vec3, t0: number, life: number, size: number, group = 0) => {
      kinds.push(k)
      params.push(origin[0], origin[1], origin[2], vel[0], vel[1], vel[2], t0, life, size, R() * 1000, group)
    }

    // Two grains, each a bright head and a fading streak (motion blur).
    for (const [g, at] of [[0, IMPACT], [1, LAST_IMPACT]] as const) for (let i = 0; i < GRAIN_TRAIL; i++) push(Kind.Grain, at, [0, 0, 0], 0, 0, i === 0 ? 0.026 : 0.016 * (1 - i / GRAIN_TRAIL) + 0.005, g * 100 + i)

    // Crown splashes: droplets gathered into tines round a ring, like a milk crown made of light.
    for (const [group, at, t0] of [[0, IMPACT, T.impact], [1, LAST_IMPACT, T.lastGrainDrop]] as const) {
      const tines = 14
      for (let i = 0; i < c.splash; i++) {
        const tine = i % tines
        const a = (tine / tines) * Math.PI * 2 + (R() - 0.5) * 0.12
        const h = group === 0 ? 0.32 + R() * 0.22 : 0.9 + R() * 0.7
        const up = group === 0 ? 0.95 + R() * 0.4 : 2.3 + R() * 1.1
        const life = 1.6 + R() * 0.8
        const size = group === 0 ? 0.007 + R() * 0.008 : 0.012 + R() * 0.01
        // Each droplet trails two fainter ghosts a moment behind it: a streak of motion blur.
        for (let ghost = 0; ghost < 3; ghost++) push(Kind.Splash, at, [Math.cos(a) * h, up, Math.sin(a) * h], t0, life, size * (1 - ghost * 0.22), group + ghost * 10)
      }
    }

    // Embers puff off each era piece as it wakes, tinted by its material.
    ERA_PIECES.forEach((piece, gi) => {
      for (let i = 0; i < c.ember; i++) {
        const a = R() * Math.PI * 2
        const r = 0.12 + R() * 0.18
        push(Kind.Ember, [piece.at[0] + Math.cos(a) * r, 0.1 + R() * 0.75, piece.at[2] + Math.sin(a) * r], [Math.cos(a) * 0.25, 0.35 + R() * 0.55, Math.sin(a) * 0.25], piece.ignite + R() * 0.3, 1.4 + R() * 1.2, 0.01 + R() * 0.014, gi)
      }
    })

    // The queen sheds sparks as the fissures climb, then the crown points flare.
    for (let i = 0; i < c.spark; i++) {
      const a = R() * Math.PI * 2
      const y = 0.15 + R() * 1.1
      const r = 0.22 - y * 0.08
      const t0 = T.crackStart + 0.2 + (y / 1.3) * (T.crackFull - T.crackStart) + R() * 0.6
      push(Kind.Spark, [QUEEN[0] + Math.cos(a) * r, y, QUEEN[2] + Math.sin(a) * r], [Math.cos(a) * 0.4, 0.5 + R() * 0.6, Math.sin(a) * 0.4], t0, 1.2 + R() * 0.9, 0.01 + R() * 0.012, 0)
    }
    for (let i = 0; i < 9; i++) {
      // 8 crown-point glints and one great flare.
      const a = (i / 8) * Math.PI * 2
      const big = i === 8
      push(Kind.Flare, big ? [QUEEN[0], QUEEN_CROWN_FROM + 0.2, QUEEN[2]] : [QUEEN[0] + Math.cos(a) * 0.15, QUEEN_CROWN_FROM + 0.08, QUEEN[2] + Math.sin(a) * 0.15], [0, 0, 0], big ? T.flare : T.crownStart + i * 0.06, big ? 0.9 : 1.6, big ? 0.32 : 0.045, big ? 1 : 0)
    }

    // Golden dust hanging over the board.
    for (let i = 0; i < c.dust; i++) push(Kind.Dust, [(R() - 0.5) * 9.5, 0.05 + R() ** 1.6 * 2.6, (R() - 0.5) * 9.5], [R() - 0.5, R() - 0.5, R() - 0.5], 0, 0, 0.01 + R() * 0.018, 0)

    // The title grains: released by the last grain, suspended in the freeze, then they write the name.
    this.titleStart = kinds.length
    this.titleCount = c.title
    for (let i = 0; i < c.title; i++) {
      const a = R() * Math.PI * 2
      const r = 0.25 + R() ** 0.7 * 1.9
      const y = 0.08 + R() ** 1.3 * 1.7
      push(Kind.Title, [LAST_IMPACT[0] + Math.cos(a) * r, y, LAST_IMPACT[2] + Math.sin(a) * r * 0.8], [(R() - 0.5) * 0.25, 0.05 + R() * 0.12, (R() - 0.5) * 0.25], T.lastGrainDrop + R() * 0.35, 0, 0.012 + R() * 0.014, i % TITLE.length)
    }

    this.count = kinds.length
    this.kind = Uint8Array.from(kinds)
    this.p = Float32Array.from(params)
    this.position = new Float32Array(this.count * 3)
    this.color = new Float32Array(this.count * 3)
    this.size = new Float32Array(this.count)
    this.alpha = new Float32Array(this.count)
  }

  get titleParticles(): number {
    return this.titleCount
  }

  /** Pixel targets for the title particles (from the DOM title's letters); null clears them. */
  setTitleTargets(targets: TitleTargets | null): void {
    this.targets = targets && targets.letter.length === this.titleCount && targets.xy.length === this.titleCount * 2 ? targets : null
  }

  /**
   * Advances every particle to film time t. `pxWorld` is the world size of one
   * CSS pixel at TITLE_DEPTH (so assembled title grains stay a crisp size).
   */
  update(t: number, unproject: Unproject | null, pxWorld: number): void {
    const wt = worldTime(t)
    const S = ParticleSim.STRIDE
    const { p, position: pos, color: col, size, alpha } = this
    for (let i = 0; i < this.count; i++) {
      const o = i * S
      const ox = p[o]!
      const oy = p[o + 1]!
      const oz = p[o + 2]!
      const vx = p[o + 3]!
      const vy = p[o + 4]!
      const vz = p[o + 5]!
      const t0 = p[o + 6]!
      const life = p[o + 7]!
      const base = p[o + 8]!
      const seed = p[o + 9]!
      const group = p[o + 10]!
      let x = ox
      let y = oy
      let z = oz
      let a = 0
      let s = base
      let c: Vec3 = GOLD
      switch (this.kind[i] as Kind) {
        case Kind.Grain: {
          const second = group >= 100
          const lag = (group % 100) * 0.016
          const gy = second ? lastGrainY(wt - lag) : firstGrainY(wt - lag)
          const landing = second ? T.lastGrainDrop : T.impact
          const fall = second ? 0.6 : T.impact
          const shown = wt - lag > landing - fall - 0.001 && wt < landing
          y = gy + 0.02
          a = shown ? (group % 100 === 0 ? 1 : 0.7 * (1 - (group % 100) / GRAIN_TRAIL)) : 0
          c = group % 100 === 0 ? [4.5, 3, 1.2] : [2.2, 1.4, 0.5]
          break
        }
        case Kind.Splash: {
          // Slow motion for the macro shot; real time for the last grain.
          const ghost = Math.floor(group / 10)
          const first = group % 10 === 0
          const age = (wt - t0) * (first ? 0.5 : 1) - ghost * 0.018
          if (age < 0 || age > life) break
          const g = first ? 5.2 : 7.5
          x = ox + vx * age
          z = oz + vz * age
          y = Math.max(0.006, oy + vy * age - 0.5 * g * age * age)
          const landed = y <= 0.007
          a = (1 - age / life) * (landed ? 0.45 : 1) * clamp01(age * 30) * (ghost === 0 ? 1 : ghost === 1 ? 0.45 : 0.2)
          if (landed && ghost > 0) a = 0
          s = base * (1 + (landed ? 0.6 : 0))
          c = first ? [2.6, 1.7, 0.6] : [2.2, 1.5, 0.55]
          break
        }
        case Kind.Ember: {
          const age = wt - t0
          if (age < 0 || age > life) break
          const k = age / life
          x = ox + vx * age + Math.sin(seed + age * 2.1) * 0.08 * age
          y = oy + vy * age * (1 - k * 0.35)
          z = oz + vz * age + Math.cos(seed * 1.3 + age * 1.7) * 0.08 * age
          a = Math.sin(Math.PI * Math.min(1, k * 1.15)) * (0.7 + 0.3 * Math.sin(seed + age * 18))
          s = base * (1 - k * 0.5)
          c = ERA_PIECES[group]?.ember ?? GOLD
          a *= 0.6
          break
        }
        case Kind.Spark: {
          const age = wt - t0
          if (age < 0 || age > life) break
          const k = age / life
          x = ox + vx * age * (1 - k * 0.4)
          y = oy + vy * age - 0.25 * age * age
          z = oz + vz * age * (1 - k * 0.4)
          a = (1 - k) * (0.6 + 0.4 * Math.sin(seed + age * 25))
          c = [2.4, 1.0, 0.3]
          break
        }
        case Kind.Flare: {
          const age = wt - t0
          if (age < 0 || age > life) break
          if (group === 1) {
            // The great flare: a hot bloom that blooms out and decays.
            a = 0.7 * Math.exp(-age * 5) * clamp01(age * 25)
            s = base * (0.5 + easeOut(clamp01(age * 3)) * 0.8)
            c = [2.2, 1.5, 0.65]
          } else {
            a = clamp01(age * 4) * (0.65 + 0.35 * Math.sin(seed + age * 9)) * (1 - clamp01((age - 1.2) * 3))
            c = [2.8, 1.9, 0.75]
          }
          break
        }
        case Kind.Dust: {
          x = ox + Math.sin(seed + wt * 0.13) * 0.35 + vx * wt * 0.04
          y = oy + Math.sin(seed * 0.7 + wt * 0.21) * 0.12
          z = oz + Math.cos(seed + wt * 0.11) * 0.35 + vz * wt * 0.04
          // Dust catches the light once the board is awake.
          a = 0.35 * progress(t, 1.2, 3.2) * (0.55 + 0.45 * Math.sin(seed * 3 + wt * 1.6))
          c = [1.6, 1.1, 0.45]
          break
        }
        case Kind.Title: {
          const ti = i - this.titleStart
          const targets = this.targets
          const letter = targets ? (targets.letter[ti] ?? 0) : group
          const depart = T.lettersStart + letter * T.letterStep + ((seed % 1) * 0.12)
          const arrive = letterLands(letter) - ((seed * 7) % 1) * 0.1
          const born = wt - t0
          if (born < 0) break
          // Suspended glitter: lifted by the last grain, hanging still in the freeze.
          const drift = Math.min(born, 1.4)
          x = ox + vx * drift + Math.sin(seed + wt * 0.6) * 0.04
          y = oy + vy * drift + Math.sin(seed * 1.7 + wt * 0.8) * 0.03
          z = oz + vz * drift
          a = clamp01(born * 3) * 0.75
          s = base
          c = [2.2, 1.5, 0.6]
          if (t > depart && targets && unproject) {
            const k = easeInOut(progress(t, depart, arrive))
            unproject(targets.xy[ti * 2]!, targets.xy[ti * 2 + 1]!, TITLE_DEPTH, this.tmp)
            const [tx, ty, tz] = this.tmp
            // An arcing path: grains swirl as they stream in.
            const swirl = Math.sin(Math.PI * k) * 0.35
            x = x + (tx - x) * k + Math.sin(seed * 5) * swirl
            y = y + (ty - y) * k + swirl * 0.6
            z = z + (tz - z) * k + Math.cos(seed * 5) * swirl
            s = base + (pxWorld * 2.6 - base) * k
            // Each grain fades into its chiselled letter as it lands.
            a = Math.max(a * (1 - k) + k * 0.95, 0) * (1 - progress(t, arrive + 0.05, arrive + 0.5))
          } else if (t > depart) {
            // No targets (font still loading): the grains just melt away.
            a *= 1 - progress(t, depart, depart + 0.6)
          }
          break
        }
      }
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      col[i * 3] = c[0]
      col[i * 3 + 1] = c[1]
      col[i * 3 + 2] = c[2]
      size[i] = s
      alpha[i] = a
    }
  }
}
