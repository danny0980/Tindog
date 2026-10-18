import { audioEngine } from './AudioEngine'
import { midiToHz } from './synth'

/** Calm voicings (MIDI) and their tense counterparts, cycled every bar. */
const CALM: number[][] = [
  [48, 55, 64, 71], // Cmaj7
  [45, 52, 60, 67], // Am7
  [41, 48, 57, 64], // Fmaj7
  [43, 50, 59, 64], // G6
]
const TENSE: number[][] = [
  [45, 52, 60, 71], // Am(add9)
  [41, 48, 56, 63], // Fm7
  [38, 45, 53, 60], // Dm7
  [40, 47, 56, 62], // E7
]
const PENTATONIC_CALM = [72, 74, 76, 79, 81, 84]
const PENTATONIC_TENSE = [69, 72, 74, 75, 79, 81]

const BAR_SECONDS = 9

/**
 * Generative ambient score. Long, overlapping pad chords through a slowly
 * breathing low-pass filter, with sparse bell notes. `setTension` (0–1) morphs
 * harmony, brightness and bell density to follow the game.
 */
class AmbientMusic {
  private running = false
  private timer: number | undefined
  private bar = 0
  private tension = 0
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
    const ctx = audioEngine.context
    const now = ctx?.currentTime ?? 0
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

  private cutoff(): number {
    return 650 + this.tension * 900
  }

  private scheduleBar(): void {
    const ctx = audioEngine.ready()
    if (!this.running || !ctx || !this.filter) return
    const tense = this.tension > 0.55
    const progression = tense ? TENSE : CALM
    const chord = progression[this.bar % progression.length] ?? CALM[0] ?? []
    const start = ctx.currentTime + 0.05

    for (const note of chord) this.pad(ctx, note, start)
    const bells = 1 + Math.round(this.tension * 3)
    const scale = tense ? PENTATONIC_TENSE : PENTATONIC_CALM
    for (let i = 0; i < bells; i += 1) {
      if (Math.random() < 0.65) {
        const note = scale[Math.floor(Math.random() * scale.length)] ?? 72
        this.bell(ctx, note, start + 1 + Math.random() * (BAR_SECONDS - 2))
      }
    }

    this.bar += 1
    this.timer = window.setTimeout(() => this.scheduleBar(), BAR_SECONDS * 1000)
  }

  private pad(ctx: AudioContext, note: number, start: number): void {
    if (!this.filter) return
    const length = BAR_SECONDS + 3
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.linearRampToValueAtTime(0.035, start + 3)
    env.gain.setValueAtTime(0.035, start + length - 3.5)
    env.gain.linearRampToValueAtTime(0.0001, start + length)
    env.connect(this.filter)
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator()
      osc.type = detune < 0 ? 'sawtooth' : 'triangle'
      osc.frequency.value = midiToHz(note)
      osc.detune.value = detune
      osc.connect(env)
      osc.start(start)
      osc.stop(start + length + 0.1)
      this.voices.add(osc)
      osc.onended = () => this.voices.delete(osc)
    }
  }

  private bell(ctx: AudioContext, note: number, start: number): void {
    if (!this.filter) return
    const osc = ctx.createOscillator()
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
