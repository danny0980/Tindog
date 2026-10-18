import { audioEngine } from './AudioEngine'

export interface ToneOptions {
  frequency: number
  /** Optional glide target reached at the end of the note. */
  frequencyEnd?: number
  type?: OscillatorType
  /** Seconds from now. */
  at?: number
  attack?: number
  decay: number
  gain: number
  detune?: number
  /** Amount sent to the reverb bus (0–1). */
  reverb?: number
  destination?: AudioNode | null
  filter?: { type: BiquadFilterType; frequency: number; q?: number }
}

/** Plays one enveloped oscillator voice. Safe no-op when audio is locked. */
export function tone(options: ToneOptions): void {
  const ctx = audioEngine.ready()
  const out = options.destination ?? audioEngine.sfxBus
  if (!ctx || !out) return
  const start = ctx.currentTime + (options.at ?? 0)
  const attack = options.attack ?? 0.005
  const end = start + attack + options.decay

  const osc = ctx.createOscillator()
  osc.type = options.type ?? 'sine'
  osc.frequency.setValueAtTime(options.frequency, start)
  if (options.frequencyEnd) osc.frequency.exponentialRampToValueAtTime(options.frequencyEnd, end)
  if (options.detune) osc.detune.value = options.detune

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, options.gain), start + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, end)

  let head: AudioNode = osc
  if (options.filter) {
    const f = ctx.createBiquadFilter()
    f.type = options.filter.type
    f.frequency.value = options.filter.frequency
    f.Q.value = options.filter.q ?? 0.7
    head.connect(f)
    head = f
  }
  head.connect(env)
  env.connect(out)
  const reverb = audioEngine.reverbBus
  if (options.reverb && reverb) {
    const send = ctx.createGain()
    send.gain.value = options.reverb
    env.connect(send).connect(reverb)
  }
  osc.start(start)
  osc.stop(end + 0.05)
}

export interface NoiseOptions {
  at?: number
  destination?: AudioNode | null
  duration: number
  gain: number
  filter: { type: BiquadFilterType; frequency: number; q?: number }
  reverb?: number
}

/** Filtered noise burst — the "body" of percussive impacts. */
export function noise(options: NoiseOptions): void {
  const ctx = audioEngine.ready()
  const out = options.destination ?? audioEngine.sfxBus
  const buffer = audioEngine.noiseBuffer
  if (!ctx || !out || !buffer) return
  const start = ctx.currentTime + (options.at ?? 0)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = options.filter.type
  filter.frequency.value = options.filter.frequency
  filter.Q.value = options.filter.q ?? 1
  const env = ctx.createGain()
  env.gain.setValueAtTime(Math.max(0.0002, options.gain), start)
  env.gain.exponentialRampToValueAtTime(0.0001, start + options.duration)
  src.connect(filter).connect(env).connect(out)
  const reverb = audioEngine.reverbBus
  if (options.reverb && reverb) {
    const send = ctx.createGain()
    send.gain.value = options.reverb
    env.connect(send).connect(reverb)
  }
  src.start(start, Math.random() * 0.5)
  src.stop(start + options.duration + 0.05)
}

export const midiToHz = (note: number): number => 440 * 2 ** ((note - 69) / 12)

/** ±spread random factor so repeated sounds feel organic rather than robotic. */
export const vary = (spread = 0.04): number => 1 + (Math.random() * 2 - 1) * spread
