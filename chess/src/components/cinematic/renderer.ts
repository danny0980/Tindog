// Canvas renderer for the intro cinematic. Each frame it draws, back to front:
// the room, the perspective board (as thin textured strips), the rift crack
// and morph front, lit piece sprites with contact shadows, volumetric light,
// shockwave, particles, an emissive bloom pass, vignette and letterbox.
// All timing comes from `timeline.ts`; quality adapts to the device.
import { ParticleSystem, QUALITY, QualityGovernor } from '../fx/particles'
import { BOARD_EXTENT, PIECE_HEIGHT, type SpriteStyle, classicBoardTexture, makeCanvas, pieceSprite, realmBoardTextures } from './textures'
import {
  INTRO_TIMES,
  type Camera,
  type IntroBeat,
  type PieceColor,
  type PieceType,
  cameraAt,
  clamp01,
  morphAt,
  piecesAt,
  project,
  riftIntensity,
  squareToWorld,
} from './timeline'

/** Where the temporal crack opens (between e4 and e5), in world units. */
const RIFT_ORIGIN = { x: 0.5, z: 0 } as const

interface CrackSegment {
  x1: number
  z1: number
  x2: number
  z2: number
  /** Distance along the crack where this segment starts (0–1 reveal order). */
  order: number
}

/** Seeded lightning-like branches radiating from the rift origin. */
export function buildCrack(seed: number): CrackSegment[] {
  let s = seed >>> 0
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out: CrackSegment[] = []
  const branch = (x: number, z: number, angle: number, length: number, depth: number, order: number) => {
    const steps = 7
    let cx = x
    let cz = z
    for (let i = 0; i < steps; i++) {
      const a = angle + (rand() - 0.5) * 1.1
      const step = length / steps
      const nx = cx + Math.cos(a) * step
      const nz = cz + Math.sin(a) * step
      out.push({ x1: cx, z1: cz, x2: nx, z2: nz, order: order + (i / steps) * (1 - order) * 0.6 })
      if (depth < 2 && rand() < 0.28) branch(nx, nz, a + (rand() < 0.5 ? -0.9 : 0.9), length * 0.45, depth + 1, order + (i / steps) * 0.5)
      cx = nx
      cz = nz
    }
  }
  for (let i = 0; i < 5; i++) branch(RIFT_ORIGIN.x, RIFT_ORIGIN.z, (i / 5) * Math.PI * 2 + rand() * 0.6, 3 + rand() * 1.4, 0, 0)
  return out
}

type SpriteKey = `${PieceType}${PieceColor}${SpriteStyle}`

export class IntroRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly governor: QualityGovernor
  readonly particles: ParticleSystem
  private width = 1
  private height = 1
  private dpr = 1
  private classic: HTMLCanvasElement | null = null
  private realm: { color: HTMLCanvasElement; emissive: HTMLCanvasElement } | null = null
  private blend: HTMLCanvasElement | null = null
  private glow: HTMLCanvasElement
  private glowCtx: CanvasRenderingContext2D
  private sprites = new Map<SpriteKey, HTMLCanvasElement>()
  private crack = buildCrack(1805)
  /** Whether the bloom buffer is in use this frame (off at low quality). */
  private bloom = true
  private last = 0

  constructor(canvas: HTMLCanvasElement, mobile: boolean) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('2D canvas is unavailable')
    this.ctx = ctx
    this.governor = new QualityGovernor(mobile ? 2 : 3)
    this.particles = new ParticleSystem(QUALITY[3].particles)
    this.particles.limit = QUALITY[this.governor.level].particles
    this.glow = makeCanvas(1, 1)
    const g = this.glow.getContext('2d')
    if (!g) throw new Error('2D canvas is unavailable')
    this.glowCtx = g
  }

  get quality(): 1 | 2 | 3 {
    return this.governor.level
  }

  /** Paints the board textures and sprites (call once, before the first frame). */
  prepare(mobile: boolean): void {
    const size = mobile ? 512 : 768
    this.classic = classicBoardTexture(size)
    this.realm = realmBoardTextures(size)
    this.blend = makeCanvas(size, size)
    for (const type of ['k', 'q', 'r', 'b', 'n', 'p'] as const) {
      for (const color of ['w', 'b'] as const) {
        for (const style of ['classic', 'realm'] as const) this.sprites.set(`${type}${color}${style}`, pieceSprite(type, color, style))
      }
    }
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, QUALITY[this.governor.level].dpr)
    this.width = Math.max(1, Math.round(cssWidth))
    this.height = Math.max(1, Math.round(cssHeight))
    this.canvas.width = Math.round(this.width * this.dpr)
    this.canvas.height = Math.round(this.height * this.dpr)
    // Bloom buffer at quarter resolution: upscaling it is the blur.
    this.glow.width = Math.max(1, Math.round(this.width / 4))
    this.glow.height = Math.max(1, Math.round(this.height / 4))
  }

  /** Bursts of particles and shatters for the sequence's beats. */
  onBeat(beat: IntroBeat): void {
    const cam = cameraAt(beat.at)
    const at = (square: string) => {
      const w = squareToWorld(square)
      return project(cam, this.width, this.height, w.x, 0, w.z)
    }
    if (beat.kind === 'land') {
      const p = at(beat.square)
      this.particles.emit(beat.realm ? 'ember' : 'dust', beat.realm ? 26 : 14, { x: p.x, y: p.y, spread: beat.realm ? 140 : 50, life: beat.realm ? 1.1 : 1.6, size: beat.realm ? 2.6 : 1.6 })
    } else if (beat.kind === 'capture') {
      const p = at(beat.square)
      this.particles.emit('shard', 46, { x: p.x, y: p.y - p.scale * 0.5, vy: -180, spread: 260, life: 1.2, size: 5 })
      this.particles.emit('spark', 30, { x: p.x, y: p.y - p.scale * 0.4, spread: 320, life: 0.7, size: 2.4 })
    } else if (beat.kind === 'check') {
      const p = at(beat.square)
      this.particles.emit('spark', 40, { x: p.x, y: p.y - p.scale * 0.6, spread: 380, life: 0.8, size: 2.8 })
    } else if (beat.kind === 'shockwave') {
      const p = project(cam, this.width, this.height, RIFT_ORIGIN.x, 0, RIFT_ORIGIN.z)
      this.particles.emit('spark', 120, { x: p.x, y: p.y, spread: 900, life: 1.1, size: 3 })
      this.particles.emit('rune', 50, { x: p.x, y: p.y, spread: 500, life: 1.8, size: 3.2 })
    }
  }

  /** Draws the frame for time `t` (seconds); `dt` drives particles and the quality governor. */
  render(t: number, dt: number): void {
    const frameStart = performance.now()
    const { ctx } = this
    const w = this.width
    const h = this.height
    const q = QUALITY[this.governor.level]
    const morph = morphAt(t)
    const rift = riftIntensity(t)
    const cam = cameraAt(t)

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.bloom = q.bloom
    this.glowCtx.setTransform(0.25, 0, 0, 0.25, 0, 0)
    if (this.bloom) this.glowCtx.clearRect(0, 0, w, h)
    const shakeX = (Math.random() - 0.5) * cam.shake
    const shakeY = (Math.random() - 0.5) * cam.shake
    this.drawBackground(t, morph)
    ctx.save()
    ctx.translate(shakeX, shakeY)

    this.drawBoard(t, cam, morph, rift, q.strips)
    this.drawRuneCircle(t, cam, morph)
    this.drawPieces(t, cam, morph)
    if (morph < 1) this.drawLightShaft(t, 1 - morph)
    this.drawShockwave(t, cam)
    this.emitAmbient(t, cam, morph, dt)
    this.particles.update(dt)
    this.particles.draw(ctx)
    ctx.restore()

    if (q.bloom) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.9
      ctx.drawImage(this.glow, 0, 0, w, h)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
    this.drawFlash(t)
    this.drawVignette(t, morph)
    this.drawLetterbox(t)

    // Adaptive quality: measured on the CPU time of this frame plus its pacing.
    const cost = performance.now() - frameStart
    if (this.governor.sample(Math.max(cost, dt * 1000)) && this.last !== this.governor.level) {
      this.last = this.governor.level
      this.particles.limit = QUALITY[this.governor.level].particles
      this.resize(w, h)
    }
  }

  // ── Layers ────────────────────────────────────────────────────────────────

  private drawBackground(t: number, morph: number): void {
    const { ctx } = this
    const w = this.width
    const h = this.height
    // The study: warm lamplight and dark panelling.
    const room = ctx.createRadialGradient(w * 0.3, h * 0.05, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.9)
    room.addColorStop(0, '#5a3a22')
    room.addColorStop(0.45, '#22140c')
    room.addColorStop(1, '#070403')
    ctx.fillStyle = room
    ctx.fillRect(0, 0, w, h)
    if (morph <= 0) return
    // The realm: a burning violet sky.
    ctx.globalAlpha = morph
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#12051f')
    sky.addColorStop(0.45, '#3b0d2c')
    sky.addColorStop(0.75, '#7a1d12')
    sky.addColorStop(1, '#140405')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    // Slow aurora bands.
    for (let i = 0; i < 3; i++) {
      const y = h * (0.12 + i * 0.09) + Math.sin(t * 0.4 + i) * h * 0.02
      const band = ctx.createLinearGradient(0, y - h * 0.06, 0, y + h * 0.06)
      band.addColorStop(0, 'rgba(120,80,255,0)')
      band.addColorStop(0.5, `rgba(${i === 1 ? '255,120,60' : '120,200,255'},${0.12 * morph})`)
      band.addColorStop(1, 'rgba(120,80,255,0)')
      ctx.fillStyle = band
      ctx.fillRect(0, y - h * 0.06, w, h * 0.12)
    }
    ctx.globalAlpha = 1
  }

  /** The texture the board shows now: classic, realm, or the crack + morph composite. */
  private boardSource(t: number, morph: number, rift: number): HTMLCanvasElement | null {
    const classic = this.classic
    const realm = this.realm
    const blend = this.blend
    if (!classic || !realm || !blend) return null
    if (morph >= 1) return realm.color
    if (t < INTRO_TIMES.rift) return classic
    const b = blend.getContext('2d')
    if (!b) return classic
    const size = blend.width
    const toTex = (x: number, z: number) => ({ u: ((x + BOARD_EXTENT / 2) / BOARD_EXTENT) * size, v: ((BOARD_EXTENT / 2 - z) / BOARD_EXTENT) * size })
    b.globalCompositeOperation = 'source-over'
    b.drawImage(classic, 0, 0)
    const origin = toTex(RIFT_ORIGIN.x, RIFT_ORIGIN.z)
    if (morph > 0) {
      // The realm floods out from the rift as an expanding, glowing front.
      const r = morph * size * 1.05
      b.save()
      b.beginPath()
      b.arc(origin.u, origin.v, r, 0, Math.PI * 2)
      b.clip()
      b.drawImage(realm.color, 0, 0)
      b.restore()
      b.lineWidth = size * 0.02
      b.strokeStyle = 'rgba(255,214,120,0.9)'
      b.beginPath()
      b.arc(origin.u, origin.v, r, 0, Math.PI * 2)
      b.stroke()
      b.lineWidth = size * 0.006
      b.strokeStyle = 'rgba(160,230,255,1)'
      b.stroke()
    }
    // The temporal crack, revealed branch by branch as the rift builds.
    const reveal = t < INTRO_TIMES.shockwave ? clamp01((t - INTRO_TIMES.rift) / (INTRO_TIMES.shockwave - INTRO_TIMES.rift)) : 1
    const fade = morph > 0 ? 1 - morph : 1
    if (fade > 0) {
      b.lineCap = 'round'
      for (const pass of [0, 1]) {
        b.strokeStyle = pass === 0 ? `rgba(80,170,255,${0.35 * fade})` : `rgba(255,240,190,${0.95 * fade})`
        b.lineWidth = pass === 0 ? size * 0.016 : size * 0.004 * (1 + rift)
        b.beginPath()
        for (const seg of this.crack) {
          if (seg.order > reveal) continue
          const a = toTex(seg.x1, seg.z1)
          const c = toTex(seg.x2, seg.z2)
          b.moveTo(a.u, a.v)
          b.lineTo(c.u, c.v)
        }
        b.stroke()
      }
    }
    return blend
  }

  /**
   * Perspective board: the texture is drawn as horizontal strips, one per
   * slice of board depth — exact for a camera without yaw or roll.
   */
  private drawBoard(t: number, cam: Camera, morph: number, rift: number, strips: number): void {
    const src = this.boardSource(t, morph, rift)
    if (!src) return
    const { ctx } = this
    const w = this.width
    const h = this.height
    const half = BOARD_EXTENT / 2
    // Board thickness: the front edge of the table-top block.
    const nearL = project(cam, w, h, -half, 0, -half)
    const nearR = project(cam, w, h, half, 0, -half)
    const lowL = project(cam, w, h, -half, -0.35, -half)
    const lowR = project(cam, w, h, half, -0.35, -half)
    ctx.fillStyle = morph >= 0.5 ? '#1a0c12' : '#2a160b'
    ctx.beginPath()
    ctx.moveTo(nearL.x, nearL.y)
    ctx.lineTo(nearR.x, nearR.y)
    ctx.lineTo(lowR.x, lowR.y)
    ctx.lineTo(lowL.x, lowL.y)
    ctx.closePath()
    ctx.fill()
    // Soft contact shadow of the whole board on the table.
    const shadow = ctx.createRadialGradient(w / 2, nearL.y, 0, w / 2, nearL.y, (nearR.x - nearL.x) * 0.7)
    shadow.addColorStop(0, 'rgba(0,0,0,0.5)')
    shadow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = shadow
    ctx.fillRect(0, nearL.y, w, h - nearL.y)

    const size = src.width
    // Clip to the exact projected outline so the strip edges never stair-step.
    const farL = project(cam, w, h, -half, 0, half)
    const farR = project(cam, w, h, half, 0, half)
    // About one strip per 1.2 px of on-screen board height (capped by quality).
    const n = Math.round(Math.min(strips, Math.max(24, (nearL.y - farL.y) / 1.2)))
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(farL.x, farL.y)
    ctx.lineTo(farR.x, farR.y)
    ctx.lineTo(nearR.x, nearR.y)
    ctx.lineTo(nearL.x, nearL.y)
    ctx.closePath()
    ctx.clip()
    for (let i = 0; i < n; i++) {
      const v0 = i / n
      const v1 = (i + 1) / n
      const zFar = half - v0 * BOARD_EXTENT
      const zNear = half - v1 * BOARD_EXTENT
      const far = project(cam, w, h, -half, 0, zFar)
      const near = project(cam, w, h, -half, 0, zNear)
      // The strip's nearer (wider) edge covers the trapezoid; the clip trims it.
      const width = (w / 2 - near.x) * 2
      const y = far.y
      const sh = near.y - far.y + 0.75
      if (sh <= 0) continue
      ctx.drawImage(src, 0, v0 * size, size, (v1 - v0) * size, near.x, y, width, sh)
      // The lava glows (and blooms) in the realm.
      if (morph > 0 && this.realm) {
        const pulse = 0.55 + 0.35 * Math.sin(t * 2.4 + v0 * 9)
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = morph * pulse * 0.6
        ctx.drawImage(this.realm.emissive, 0, v0 * size, size, (v1 - v0) * size, near.x, y, width, sh)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
        if (this.bloom) {
          this.glowCtx.globalAlpha = morph * pulse
          this.glowCtx.drawImage(this.realm.emissive, 0, v0 * size, size, (v1 - v0) * size, near.x, y, width, sh)
          this.glowCtx.globalAlpha = 1
        }
      }
    }
    ctx.restore()
    // Studio key light: a warm specular pool across the varnish.
    if (morph < 1) {
      const pool = project(cam, w, h, -1.2, 0, 1.5)
      const g = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, w * 0.45)
      g.addColorStop(0, `rgba(255,230,190,${0.22 * (1 - morph)})`)
      g.addColorStop(1, 'rgba(255,230,190,0)')
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }
    // The crack glows in the bloom pass too.
    if (rift > 0 && morph < 1 && this.bloom) {
      const p = project(cam, w, h, RIFT_ORIGIN.x, 0, RIFT_ORIGIN.z)
      const r = p.scale * (1.5 + rift * 3)
      const g = this.glowCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
      g.addColorStop(0, `rgba(140,210,255,${0.8 * rift})`)
      g.addColorStop(1, 'rgba(140,210,255,0)')
      this.glowCtx.fillStyle = g
      this.glowCtx.fillRect(p.x - r, p.y - r, r * 2, r * 2)
    }
  }

  /** A slowly turning rune circle burnt into the realm board. */
  private drawRuneCircle(t: number, cam: Camera, morph: number): void {
    if (morph <= 0) return
    const { ctx } = this
    const c = project(cam, this.width, this.height, 0, 0.01, 0)
    const edge = project(cam, this.width, this.height, 3.2, 0.01, 0)
    const top = project(cam, this.width, this.height, 0, 0.01, 3.2)
    const rx = edge.x - c.x
    const ry = Math.max(4, c.y - top.y)
    for (const target of this.bloom ? [ctx, this.glowCtx] : [ctx]) {
      target.save()
      target.globalAlpha = morph * 0.75
      target.strokeStyle = 'rgba(150,215,255,0.9)'
      target.lineWidth = 2
      target.beginPath()
      target.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2)
      target.stroke()
      target.beginPath()
      target.ellipse(c.x, c.y, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2)
      target.stroke()
      // Rune ticks spinning between the rings.
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + t * 0.35
        const x1 = c.x + Math.cos(a) * rx * 0.84
        const y1 = c.y + Math.sin(a) * ry * 0.84
        const x2 = c.x + Math.cos(a) * rx * 0.97
        const y2 = c.y + Math.sin(a) * ry * 0.97
        target.beginPath()
        target.moveTo(x1, y1)
        target.lineTo(x2, y2)
        target.stroke()
      }
      target.restore()
    }
  }

  private drawPieces(t: number, cam: Camera, morph: number): void {
    const { ctx } = this
    const w = this.width
    const h = this.height
    for (const piece of piecesAt(t)) {
      const base = project(cam, w, h, piece.x + piece.tremor, 0, piece.z)
      // Captured pieces shatter (the beat emits the shards); the sprite is gone.
      if (piece.capturedFor !== null) continue
      const heightPx = PIECE_HEIGHT[piece.type] * base.scale
      const spritePx = heightPx / 0.86
      const lifted = piece.lift * base.scale
      // Contact shadow: tighter and darker when the piece is down.
      ctx.fillStyle = `rgba(0,0,0,${0.45 - piece.lift * 0.4})`
      ctx.beginPath()
      ctx.ellipse(base.x + base.scale * 0.08, base.y, base.scale * (0.32 + piece.lift * 0.15), base.scale * 0.11, 0, 0, Math.PI * 2)
      ctx.fill()
      const x = base.x - spritePx / 2
      const y = base.y - spritePx * 0.96 - lifted
      const classic = this.sprites.get(`${piece.type}${piece.color}classic`)
      const realm = this.sprites.get(`${piece.type}${piece.color}realm`)
      if (classic && morph < 1) {
        ctx.globalAlpha = 1 - morph
        ctx.drawImage(classic, x, y, spritePx, spritePx)
      }
      if (realm && morph > 0) {
        ctx.globalAlpha = morph
        ctx.drawImage(realm, x, y, spritePx, spritePx)
        // Rune aura in the bloom pass.
        if (this.bloom) this.glowCtx.globalAlpha = morph * (0.5 + 0.2 * Math.sin(t * 3 + piece.x))
        if (this.bloom) this.glowCtx.drawImage(realm, x, y, spritePx, spritePx)
        this.glowCtx.globalAlpha = 1
      }
      ctx.globalAlpha = 1
    }
  }

  /** Volumetric key light: a dusty beam of lamplight falling across the study. */
  private drawLightShaft(t: number, strength: number): void {
    const { ctx } = this
    const w = this.width
    const h = this.height
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < 3; i++) {
      const spread = 0.12 + i * 0.07
      const beam = ctx.createLinearGradient(w * 0.05, -h * 0.1, w * 0.55, h * 0.85)
      beam.addColorStop(0, `rgba(255,220,160,${(0.16 - i * 0.04) * strength})`)
      beam.addColorStop(1, 'rgba(255,220,160,0)')
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(w * (0.02 + i * 0.02), -h * 0.1)
      ctx.lineTo(w * (0.18 + spread), -h * 0.1)
      ctx.lineTo(w * (0.75 + spread + Math.sin(t * 0.3) * 0.01), h * 1.05)
      ctx.lineTo(w * (0.3 - spread), h * 1.05)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  private drawShockwave(t: number, cam: Camera): void {
    const since = t - INTRO_TIMES.shockwave
    if (since < 0 || since > 1.1) return
    const { ctx } = this
    const c = project(cam, this.width, this.height, RIFT_ORIGIN.x, 0.02, RIFT_ORIGIN.z)
    const reach = 1 + since * 9
    const edge = project(cam, this.width, this.height, RIFT_ORIGIN.x + reach, 0.02, RIFT_ORIGIN.z)
    const far = project(cam, this.width, this.height, RIFT_ORIGIN.x, 0.02, RIFT_ORIGIN.z + reach)
    const rx = Math.abs(edge.x - c.x)
    const ry = Math.max(3, Math.abs(c.y - far.y))
    const alpha = 1 - since / 1.1
    for (const target of this.bloom ? [ctx, this.glowCtx] : [ctx]) {
      target.save()
      target.globalCompositeOperation = 'lighter'
      target.lineWidth = 10 * alpha + 2
      target.strokeStyle = `rgba(255,205,110,${alpha})`
      target.beginPath()
      target.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2)
      target.stroke()
      target.lineWidth = 4 * alpha + 1
      target.strokeStyle = `rgba(110,200,255,${alpha})`
      target.beginPath()
      target.ellipse(c.x, c.y, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2)
      target.stroke()
      target.restore()
    }
  }

  /** Continuous emitters: dust motes in the lamplight, embers and spell motes in the realm. */
  private emitAmbient(t: number, cam: Camera, morph: number, dt: number): void {
    const w = this.width
    const h = this.height
    const rate = dt * 60
    if (morph < 1 && Math.random() < 0.5 * rate * (1 - morph)) {
      this.particles.emit('dust', 1, { x: w * (0.15 + Math.random() * 0.5), y: h * (0.1 + Math.random() * 0.7), vx: 6, vy: 4, spread: 6, life: 4, size: 1.4 })
    }
    if (morph > 0) {
      if (Math.random() < 1.6 * rate * morph) {
        const sx = (Math.random() - 0.5) * BOARD_EXTENT
        const sz = (Math.random() - 0.5) * BOARD_EXTENT
        const p = project(cam, w, h, sx, 0, sz)
        this.particles.emit('ember', 1, { x: p.x, y: p.y, vy: -40 - Math.random() * 60, spread: 20, life: 2.2, size: 2 })
      }
      if (Math.random() < 0.35 * rate * morph) {
        this.particles.emit('rune', 1, { x: Math.random() * w, y: h * (0.2 + Math.random() * 0.6), vy: -12, spread: 14, life: 3, size: 1.8 })
      }
    }
    if (t > INTRO_TIMES.finale && Math.random() < 0.8 * rate) {
      this.particles.emit('spark', 1, { x: w * (0.3 + Math.random() * 0.4), y: h * 0.42, vy: -30, spread: 40, life: 1.2, size: 1.6 })
    }
  }

  private drawFlash(t: number): void {
    const since = t - INTRO_TIMES.shockwave
    if (since < 0 || since > 0.9) return
    const { ctx } = this
    ctx.fillStyle = `rgba(255,248,230,${(1 - since / 0.9) ** 2 * 0.85})`
    ctx.fillRect(0, 0, this.width, this.height)
  }

  private drawVignette(t: number, morph: number): void {
    const { ctx } = this
    const w = this.width
    const h = this.height
    const fadeIn = clamp01(t / 1.2)
    const v = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.75)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, morph > 0.5 ? 'rgba(20,0,10,0.85)' : 'rgba(0,0,0,0.82)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, w, h)
    if (fadeIn < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - fadeIn})`
      ctx.fillRect(0, 0, w, h)
    }
  }

  /** Cinematic letterbox bars that open up for the finale. */
  private drawLetterbox(t: number): void {
    const open = clamp01((t - INTRO_TIMES.finale) / 1.2)
    const bar = this.height * 0.07 * (1 - open)
    if (bar <= 0.5) return
    this.ctx.fillStyle = '#000'
    this.ctx.fillRect(0, 0, this.width, bar)
    this.ctx.fillRect(0, this.height - bar, this.width, bar)
  }
}
