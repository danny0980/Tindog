import type { MusicTexture } from '../types/legend'
import { audioEngine } from './AudioEngine'
import { midiToHz, noise, tone } from './synth'

type Pulse = { kind: 'arp' | 'pluck' | 'drum' | 'wardrum' | 'koto' | 'harp' | 'heartbeat'; everySec: number } | null

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
  /** Vowel formants (Hz) applied to the pads — a wordless choir "aah". */
  padFormants?: readonly number[]
  /** Melody voiced as a breathy bamboo flute instead of bells. */
  flute?: boolean
  /** Occasional low cinematic impacts. */
  booms?: boolean
}

/**
 * Era soundscapes. Each is a small generative recipe, not a recording:
 *  ancient  — drone fifths + harp plucks in Phrygian dominant (Egyptian colour)
 *  baroque  — harpsichord-like arpeggios over a I–V–vi–IV continuo (Newton's England)
 *  imperial — low brass pads with a military snare cadence (Napoleonic march)
 *  modern   — extended jazz harmony on a soft electric piano (early 20th century)
 *  nordic   — open-fifth drones, horn-like pads and pounding war drums (Viking Age)
 *  japanese — In-scale koto plucks and a breathy shakuhachi-style flute (feudal Japan)
 *  elven    — Lydian choir pads with cascading harp runs (Elven Kingdom)
 *  shadow   — dissonant low clusters, a heartbeat pulse and distant booms (Realm of Shadows)
 *  nautical — rolling Dorian drones and slow plucked "shanty" figures (Age of Discovery)
 *  cyber    — minor-key synthwave pads under a fast sawtooth arpeggio (Cyberpunk Neon)
 *  cosmic   — vast suspended pads, a celestial choir and slow bell constellations (Cosmic Pantheon)
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
  nordic: {
    calm: [
      [38, 45, 50, 57],
      [34, 41, 46, 53],
      [36, 43, 48, 55],
      [38, 45, 50, 57],
    ],
    tense: [
      [38, 45, 50, 56],
      [37, 44, 49, 56],
      [34, 41, 46, 52],
      [33, 40, 45, 52],
    ],
    scaleCalm: [62, 65, 67, 69, 72, 74],
    scaleTense: [62, 63, 67, 68, 70, 74],
    padWaves: ['sawtooth', 'triangle'],
    padGain: 0.03,
    cutoff: 600,
    barSeconds: 8,
    bellWave: 'triangle',
    pulse: { kind: 'wardrum', everySec: 0.25 },
  },
  japanese: {
    calm: [
      [38, 50, 57],
      [43, 50, 55],
      [38, 45, 50],
      [41, 48, 53],
    ],
    tense: [
      [38, 51, 57],
      [39, 46, 51],
      [43, 50, 56],
      [38, 44, 51],
    ],
    // D In scale (miyako-bushi): D Eb G A Bb
    scaleCalm: [62, 63, 67, 69, 70, 74, 75],
    scaleTense: [62, 63, 66, 69, 70, 74],
    padWaves: ['sine', 'triangle'],
    padGain: 0.02,
    cutoff: 900,
    barSeconds: 9,
    bellWave: 'sine',
    pulse: { kind: 'koto', everySec: 0.375 },
    flute: true,
  },
  elven: {
    calm: [
      [53, 60, 64, 69, 71],
      [50, 57, 62, 65, 69],
      [55, 62, 67, 71, 74],
      [48, 55, 60, 64, 67],
    ],
    tense: [
      [53, 60, 63, 68],
      [49, 56, 61, 65],
      [51, 58, 63, 66],
      [48, 55, 60, 63],
    ],
    // F Lydian
    scaleCalm: [77, 79, 81, 83, 84, 86, 88],
    scaleTense: [77, 78, 80, 83, 84, 85],
    padWaves: ['sawtooth', 'sawtooth'],
    padGain: 0.028,
    cutoff: 2000,
    barSeconds: 9,
    bellWave: 'sine',
    pulse: { kind: 'harp', everySec: 0.14 },
    padFormants: [700, 1150],
  },
  shadow: {
    calm: [
      [36, 37, 43],
      [34, 40, 46],
      [36, 39, 42, 45],
      [33, 39, 44],
    ],
    tense: [
      [36, 37, 42, 43],
      [35, 36, 41],
      [33, 34, 40, 46],
      [31, 37, 38, 44],
    ],
    scaleCalm: [60, 61, 63, 65, 67, 68, 70],
    scaleTense: [60, 61, 64, 66, 67, 70],
    padWaves: ['sawtooth', 'square'],
    padGain: 0.026,
    cutoff: 450,
    barSeconds: 10,
    bellWave: 'sine',
    pulse: { kind: 'heartbeat', everySec: 1.1 },
    booms: true,
  },
  nautical: {
    calm: [
      [38, 45, 50, 57],
      [36, 43, 48, 55],
      [41, 48, 53, 57],
      [43, 50, 55, 59],
    ],
    tense: [
      [38, 45, 50, 56],
      [37, 44, 49, 55],
      [34, 41, 46, 53],
      [33, 40, 45, 52],
    ],
    // D Dorian: D E F G A B C
    scaleCalm: [62, 64, 65, 67, 69, 71, 72, 74],
    scaleTense: [62, 63, 65, 67, 68, 70, 72, 74],
    padWaves: ['sawtooth', 'triangle'],
    padGain: 0.026,
    cutoff: 1000,
    barSeconds: 7,
    bellWave: 'triangle',
    pulse: { kind: 'pluck', everySec: 0.6 },
  },
  cyber: {
    calm: [
      [45, 52, 57, 60, 64],
      [41, 48, 53, 57, 60],
      [36, 43, 48, 52, 55],
      [43, 50, 55, 59, 62],
    ],
    tense: [
      [45, 52, 56, 60, 63],
      [44, 51, 56, 59, 62],
      [42, 49, 54, 57, 61],
      [40, 47, 52, 56, 59],
    ],
    // A natural minor
    scaleCalm: [69, 71, 72, 74, 76, 77, 79, 81],
    scaleTense: [69, 70, 72, 75, 76, 77, 80, 81],
    padWaves: ['sawtooth', 'square'],
    padGain: 0.024,
    cutoff: 1600,
    barSeconds: 6,
    bellWave: 'square',
    pulse: { kind: 'arp', everySec: 0.125 },
  },
  cosmic: {
    calm: [
      [36, 43, 50, 55, 62],
      [41, 48, 55, 60, 67],
      [38, 45, 52, 57, 64],
      [43, 50, 57, 62, 69],
    ],
    tense: [
      [36, 42, 49, 54, 61],
      [37, 44, 51, 56, 63],
      [35, 42, 48, 54, 60],
      [34, 41, 47, 53, 59],
    ],
    // C Lydian with high, sparse bells
    scaleCalm: [79, 81, 83, 84, 86, 88, 90, 91],
    scaleTense: [79, 80, 83, 85, 86, 89, 90],
    padWaves: ['sine', 'sawtooth'],
    padGain: 0.03,
    cutoff: 1300,
    barSeconds: 12,
    bellWave: 'sine',
    pulse: null,
    padFormants: [600, 1040],
    booms: true,
  },
}

/** Taiko-style war-drum pattern (16 steps): accent strength per step. */
const WAR_DRUM = [1, 0, 0, 0, 0.6, 0, 1, 0, 1, 0, 0, 0, 0.6, 0, 0.8, 0.5]

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
    if (!spec.pulse || spec.flute) {
      const notes = 1 + Math.round(this.tension * (spec.flute ? 1 : 3))
      for (let i = 0; i < notes; i += 1) {
        if (Math.random() < 0.65) {
          const note = scale[Math.floor(Math.random() * scale.length)] ?? 72
          const at = start + 1 + Math.random() * (spec.barSeconds - 3)
          if (spec.flute) this.flute(ctx, note, at)
          else this.bell(ctx, note, at, spec.bellWave)
        }
      }
    }
    if (spec.booms && Math.random() < 0.45 + this.tension * 0.4) this.boom(ctx, start + Math.random() * (spec.barSeconds - 2))

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
      } else if (pulse.kind === 'wardrum') {
        const accent = WAR_DRUM[i % WAR_DRUM.length] ?? 0
        if (accent === 0) continue
        tone({ destination: bus, at, frequency: 110, frequencyEnd: 46, decay: 0.38, gain: 0.2 * accent * (0.7 + this.tension * 0.5) })
        noise({ destination: bus, at, duration: 0.05, gain: 0.06 * accent, filter: { type: 'lowpass', frequency: 400 } })
      } else if (pulse.kind === 'koto') {
        if (Math.random() > density * 0.45) continue
        const note = scale[Math.floor(Math.random() * scale.length)] ?? 62
        const f = midiToHz(note)
        // Plucked string with the characteristic slight downward bend.
        tone({ destination: bus, at, frequency: f, frequencyEnd: f * 0.985, type: 'triangle', decay: 0.9, gain: 0.04, reverb: 0.35 })
        if (Math.random() < 0.25) tone({ destination: bus, at: at + 0.09, frequency: f * 1.122, type: 'triangle', decay: 0.6, gain: 0.025 })
      } else if (pulse.kind === 'harp') {
        // Cascading run at the start of each bar only, then let it ring.
        if (i > 13) continue
        const note = (scale[i % scale.length] ?? 77) - 12 + 12 * (Math.floor(i / scale.length) % 2)
        tone({ destination: bus, at, frequency: midiToHz(note), type: 'triangle', decay: 1.3, gain: 0.022, reverb: 0.6 })
      } else if (pulse.kind === 'heartbeat') {
        const strength = 0.12 + this.tension * 0.12
        tone({ destination: bus, at, frequency: 62, frequencyEnd: 40, decay: 0.22, gain: strength })
        tone({ destination: bus, at: at + 0.2, frequency: 55, frequencyEnd: 38, decay: 0.26, gain: strength * 0.8 })
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
    if (spec.padFormants?.length) {
      // Choir: route the pad through vowel formant band-passes (plus a quiet dry path).
      for (const frequency of spec.padFormants) {
        const formant = ctx.createBiquadFilter()
        formant.type = 'bandpass'
        formant.frequency.value = frequency
        formant.Q.value = 5
        const lift = ctx.createGain()
        lift.gain.value = 2.2
        env.connect(formant).connect(lift).connect(this.filter)
      }
      const dry = ctx.createGain()
      dry.gain.value = 0.25
      env.connect(dry).connect(this.filter)
    } else {
      env.connect(this.filter)
    }
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

  /** Breathy end-blown flute: soft sine with vibrato plus filtered breath noise. */
  private flute(ctx: AudioContext, note: number, start: number): void {
    if (!this.filter) return
    const f = midiToHz(note)
    const osc = ctx.createOscillator()
    osc.frequency.value = f
    const vibrato = ctx.createOscillator()
    vibrato.frequency.value = 5
    const depth = ctx.createGain()
    depth.gain.value = f * 0.006
    vibrato.connect(depth).connect(osc.frequency)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.linearRampToValueAtTime(0.028, start + 0.45)
    env.gain.setValueAtTime(0.028, start + 1.6)
    env.gain.exponentialRampToValueAtTime(0.0001, start + 2.6)
    osc.connect(env).connect(this.filter)
    for (const node of [osc, vibrato]) {
      node.start(start)
      node.stop(start + 2.7)
      this.voices.add(node)
      node.onended = () => this.voices.delete(node)
    }
    const bus = audioEngine.musicBus
    if (bus) noise({ destination: bus, at: start - ctx.currentTime, duration: 1.4, gain: 0.012, filter: { type: 'bandpass', frequency: f * 2, q: 6 } })
  }

  /** Distant cinematic impact. */
  private boom(ctx: AudioContext, start: number): void {
    const bus = audioEngine.musicBus
    if (!bus) return
    const at = start - ctx.currentTime
    tone({ destination: bus, at, frequency: 55, frequencyEnd: 28, decay: 1.8, gain: 0.28, reverb: 0.8 })
    noise({ destination: bus, at, duration: 1.1, gain: 0.08, filter: { type: 'lowpass', frequency: 220 }, reverb: 0.7 })
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
