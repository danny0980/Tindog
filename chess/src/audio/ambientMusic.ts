import type { MusicTexture } from '../types/legend'
import { audioEngine } from './AudioEngine'
import { midiToHz, noise, tone } from './synth'

type Pulse = { kind: 'arp' | 'pluck' | 'drum'; everySec: number } | null

interface Texture {
  /** Pad voicings (MIDI) for calm and tense moods, cycled one per bar. */
  calm: number[][]
  tense: number[][]
  /** Melodic scale for bells / plucks. */
  scaleCalm: number[]
  scaleTense: number[]
  padWaves: [OscillatorType, OscillatorType]
  padGain: number
  cutoff: number
  barSeconds: number
  bellWave: OscillatorType
  /** Rhythmic layer scheduled within each bar. */
  pulse: Pulse
}

/**
 * Era soundscapes. Each is a small generative recipe, not a recording:
 *  ancient  — drone fifths + harp plucks in Phrygian dominant (Egyptian colour)
 *  baroque  — harpsichord-like arpeggios over a I–V–vi–IV continuo (Newton's England)
 *  imperial — low brass pads with a military snare cadence (Napoleonic march)
 *  modern   — extended jazz harmony on a soft electric piano (early 20th century)
 */
const TEXTURES: Record<MusicTexture, Texture> = {
  default: {
    calm: [
      [48, 55, 64, 71],
      [45, 52, 60, 67],
      [41, 48, 57, 64],
      [43, 50, 59, 64],
    ],
    tense: [
      [45, 52, 60, 71],
      [41, 48, 56, 63],
      [38, 45, 53, 60],
      [40, 47, 56, 62],
    ],
    scaleCalm: [72, 74, 76, 79, 81, 84],
    scaleTense: [69, 72, 74, 75, 79, 81],
    padWaves: ['sawtooth', 'triangle'],
    padGain: 0.035,
    cutoff: 650,
    barSeconds: 9,
    bellWave: 'sine',
    pulse: null,
  },
  ancient: {
    calm: [
      [40, 47, 52],
      [40, 47, 53],
      [40, 47, 52],
      [41, 48, 53],
    ],
    tense: [
      [40, 46, 52],
      [41, 47, 53],
      [40, 46, 53],
      [39, 46, 52],
    ],
    // E Phrygian dominant: E F G# A B C D
    scaleCalm: [64, 65, 68, 69, 71, 72, 74, 76],
    scaleTense: [64, 65, 68, 70, 71, 72, 75, 76],
    padWaves: ['triangle', 'sine'],
    padGain: 0.04,
    cutoff: 900,
    barSeconds: 8,
    bellWave: 'triangle',
    pulse: { kind: 'pluck', everySec: 0.5 },
  },
  baroque: {
    calm: [
      [50, 57, 62, 66],
      [45, 57, 61, 64],
      [47, 54, 59, 62],
      [43, 55, 59, 62],
    ],
    tense: [
      [47, 54, 59, 62],
      [42, 54, 57, 61],
      [43, 55, 58, 62],
      [45, 52, 57, 61],
    ],
    scaleCalm: [74, 76, 78, 79, 81, 83, 85, 86],
    scaleTense: [71, 73, 74, 76, 78, 79, 81, 83],
    padWaves: ['triangle', 'sine'],
    padGain: 0.022,
    cutoff: 1400,
    barSeconds: 6,
    bellWave: 'triangle',
    pulse: { kind: 'arp', everySec: 0.25 },
  },
  imperial: {
    calm: [
      [36, 43, 48, 52],
      [41, 48, 53, 57],
      [43, 50, 55, 59],
      [36, 43, 48, 55],
    ],
    tense: [
      [36, 43, 48, 51],
      [41, 48, 53, 56],
      [43, 50, 55, 58],
      [38, 45, 50, 53],
    ],
    scaleCalm: [67, 72, 76, 79, 84],
    scaleTense: [67, 70, 72, 75, 79],
    padWaves: ['sawtooth', 'sawtooth'],
    padGain: 0.03,
    cutoff: 700,
    barSeconds: 8,
    bellWave: 'triangle',
    pulse: { kind: 'drum', everySec: 0.25 },
  },
  modern: {
    calm: [
      [48, 52, 55, 59, 62], // Cmaj9
      [45, 48, 55, 59, 62], // Am11
      [50, 53, 57, 60, 64], // Dm9
      [43, 47, 53, 57, 62], // G13
    ],
    tense: [
      [44, 48, 51, 54, 58],
      [49, 53, 56, 60, 63],
      [42, 46, 49, 52, 56],
      [43, 47, 53, 56, 61],
    ],
    scaleCalm: [72, 74, 76, 79, 81, 83, 86],
    scaleTense: [72, 73, 75, 78, 80, 82, 85],
    padWaves: ['sine', 'triangle'],
    padGain: 0.03,
    cutoff: 1100,
    barSeconds: 7,
    bellWave: 'sine',
    pulse: null,
  },
}

/** Snare cadence for the imperial march: 1 = accent, 0.5 = ghost, 0 = rest (16 steps). */
const MARCH = [1, 0, 0.5, 0.5, 1, 0, 0.5, 0, 1, 0.5, 0.5, 0.5, 1, 0, 1, 0]

/**
 * Generative ambient score. Long, overlapping pad chords through a slowly
 * breathing low-pass filter, with sparse melodic notes and an optional
 * rhythmic layer. `setTension` (0–1) morphs harmony, brightness and density;
 * `setTexture` switches era.
 */
class AmbientMusic {
  private running = false
  private timer: number | undefined
  private bar = 0
  private tension = 0
  private texture: MusicTexture = 'default'
  private filter: BiquadFilterNode | null = null
  private lfo: OscillatorNode | null = null
  private voices = new Set<OscillatorNode>()

  get isRunning(): boolean {
    return this.running
  }

  start(): void {
    const ctx = audioEngine.ready()
    const bus = audioEngine.musicBus
    if (this.running || !ctx || !bus) return
    this.running = true

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = this.cutoff()
    this.filter.Q.value = 0.6
    this.filter.connect(bus)
    const reverb = audioEngine.reverbBus
    if (reverb) {
      const send = ctx.createGain()
      send.gain.value = 0.7
      this.filter.connect(send).connect(reverb)
    }

    // Slow "breathing" of the filter cutoff.
    this.lfo = ctx.createOscillator()
    this.lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 260
    this.lfo.connect(lfoGain).connect(this.filter.frequency)
    this.lfo.start()

    this.scheduleBar()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    window.clearTimeout(this.timer)
    const now = audioEngine.context?.currentTime ?? 0
    this.voices.forEach((osc) => {
      try {
        osc.stop(now + 1.5)
      } catch {
        // already stopped
      }
    })
    this.voices.clear()
    const filter = this.filter
    const lfo = this.lfo
    window.setTimeout(() => {
      lfo?.stop()
      filter?.disconnect()
    }, 2000)
    this.filter = null
    this.lfo = null
  }

  setTension(value: number): void {
    this.tension = Math.min(1, Math.max(0, value))
    const ctx = audioEngine.context
    if (this.filter && ctx) this.filter.frequency.setTargetAtTime(this.cutoff(), ctx.currentTime, 2)
  }

  /** Switches era; the new texture starts on a fresh bar right away. */
  setTexture(texture: MusicTexture): void {
    if (texture === this.texture) return
    this.texture = texture
    this.bar = 0
    const ctx = audioEngine.context
    if (this.filter && ctx) this.filter.frequency.setTargetAtTime(this.cutoff(), ctx.currentTime, 0.5)
    if (this.running) {
      window.clearTimeout(this.timer)
      this.scheduleBar()
    }
  }

  private get spec(): Texture {
    return TEXTURES[this.texture]
  }

  private cutoff(): number {
    return this.spec.cutoff + this.tension * 900
  }

  private scheduleBar(): void {
    const ctx = audioEngine.ready()
    if (!this.running || !ctx || !this.filter) return
    const spec = this.spec
    const tense = this.tension > 0.55
    const progression = tense ? spec.tense : spec.calm
    const chord = progression[this.bar % progression.length] ?? spec.calm[0] ?? []
    const scale = tense ? spec.scaleTense : spec.scaleCalm
    const start = ctx.currentTime + 0.05

    for (const note of chord) this.pad(ctx, note, start, spec)

    if (spec.pulse) this.schedulePulse(ctx, start, chord, scale, spec)
    else {
      const bells = 1 + Math.round(this.tension * 3)
      for (let i = 0; i < bells; i += 1) {
        if (Math.random() < 0.65) {
          const note = scale[Math.floor(Math.random() * scale.length)] ?? 72
          this.bell(ctx, note, start + 1 + Math.random() * (spec.barSeconds - 2), spec.bellWave)
        }
      }
    }

    this.bar += 1
    this.timer = window.setTimeout(() => this.scheduleBar(), spec.barSeconds * 1000)
  }

  private schedulePulse(ctx: AudioContext, start: number, chord: number[], scale: number[], spec: Texture): void {
    const pulse = spec.pulse
    const bus = audioEngine.musicBus
    if (!pulse || !bus) return
    const steps = Math.floor(spec.barSeconds / pulse.everySec)
    const density = 0.35 + this.tension * 0.5
    for (let i = 0; i < steps; i += 1) {
      const at = start + i * pulse.everySec - ctx.currentTime
      if (pulse.kind === 'arp') {
        // Harpsichord-ish broken chord: bright, plucky, very short.
        const upper = chord.slice(1)
        const note = (upper[i % Math.max(1, upper.length)] ?? 62) + 12 * (Math.floor(i / upper.length) % 2)
        tone({ destination: bus, at, frequency: midiToHz(note), type: 'sawtooth', decay: 0.18, gain: 0.02, filter: { type: 'lowpass', frequency: 3200, q: 1 } })
      } else if (pulse.kind === 'pluck') {
        if (Math.random() > density * 0.6) continue
        const note = scale[Math.floor(Math.random() * scale.length)] ?? 64
        tone({ destination: bus, at, frequency: midiToHz(note), type: 'triangle', decay: 0.7, gain: 0.035, reverb: 0.5 })
      } else {
        const accent = MARCH[i % MARCH.length] ?? 0
        if (accent === 0 || Math.random() > density + 0.3) continue
        noise({ destination: bus, at, duration: accent === 1 ? 0.12 : 0.06, gain: 0.05 * accent, filter: { type: 'bandpass', frequency: 2400, q: 0.9 } })
      }
    }
  }

  private pad(ctx: AudioContext, note: number, start: number, spec: Texture): void {
    if (!this.filter) return
    const length = spec.barSeconds + 3
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.linearRampToValueAtTime(spec.padGain, start + 2.5)
    env.gain.setValueAtTime(spec.padGain, start + length - 3)
    env.gain.linearRampToValueAtTime(0.0001, start + length)
    env.connect(this.filter)
    spec.padWaves.forEach((wave, i) => {
      const osc = ctx.createOscillator()
      osc.type = wave
      osc.frequency.value = midiToHz(note)
      osc.detune.value = i === 0 ? -6 : 6
      osc.connect(env)
      osc.start(start)
      osc.stop(start + length + 0.1)
      this.voices.add(osc)
      osc.onended = () => this.voices.delete(osc)
    })
  }

  private bell(ctx: AudioContext, note: number, start: number, wave: OscillatorType): void {
    if (!this.filter) return
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.value = midiToHz(note)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.exponentialRampToValueAtTime(0.03, start + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, start + 3)
    osc.connect(env).connect(this.filter)
    osc.start(start)
    osc.stop(start + 3.1)
    this.voices.add(osc)
    osc.onended = () => this.voices.delete(osc)
  }
}

export const ambientMusic = new AmbientMusic()
