// Acoustic focus soundscapes: procedurally synthesised rain, a crackling
// fireplace and a cosmic hum — no audio files. Each track is a small Web
// Audio graph that fades in and out on the focus bus.
import { audioEngine } from './AudioEngine'

export type FocusTrack = 'off' | 'rain' | 'fireplace' | 'cosmic'

export const FOCUS_TRACKS: ReadonlyArray<{ id: FocusTrack; name: string; description: string }> = [
  { id: 'off', name: 'Off', description: 'Silence (or the adaptive soundtrack).' },
  { id: 'rain', name: 'Rain', description: 'Steady rain on a window, with distant rumble.' },
  { id: 'fireplace', name: 'Fireplace', description: 'A warm hearth: low roar and soft crackles.' },
  { id: 'cosmic', name: 'Cosmic hum', description: 'A slow, deep drone drifting through the stars.' },
]

const FADE_S = 1.2

interface Voice {
  output: GainNode
  stop: (at: number) => void
}

function noiseSource(ctx: AudioContext, buffer: AudioBuffer, rate = 1): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  src.playbackRate.value = rate
  return src
}

function lfo(ctx: AudioContext, target: AudioParam, hz: number, depth: number): OscillatorNode {
  const osc = ctx.createOscillator()
  osc.frequency.value = hz
  const amount = ctx.createGain()
  amount.gain.value = depth
  osc.connect(amount).connect(target)
  return osc
}

function rain(ctx: AudioContext, buffer: AudioBuffer, out: GainNode): Voice {
  const sources: AudioScheduledSourceNode[] = []
  // Patter: bright band-passed noise breathing slowly.
  const patter = noiseSource(ctx, buffer, 1)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 3200
  band.Q.value = 0.6
  const patterGain = ctx.createGain()
  patterGain.gain.value = 0.22
  patter.connect(band).connect(patterGain).connect(out)
  sources.push(patter, lfo(ctx, patterGain.gain, 0.13, 0.06))
  // Rumble: deep low-passed noise.
  const rumble = noiseSource(ctx, buffer, 0.5)
  const low = ctx.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 380
  const rumbleGain = ctx.createGain()
  rumbleGain.gain.value = 0.35
  rumble.connect(low).connect(rumbleGain).connect(out)
  sources.push(rumble)
  sources.forEach((s) => s.start())
  return { output: out, stop: (at) => sources.forEach((s) => s.stop(at)) }
}

function fireplace(ctx: AudioContext, buffer: AudioBuffer, out: GainNode): Voice {
  const sources: AudioScheduledSourceNode[] = []
  const roar = noiseSource(ctx, buffer, 0.35)
  const low = ctx.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 520
  const roarGain = ctx.createGain()
  roarGain.gain.value = 0.4
  roar.connect(low).connect(roarGain).connect(out)
  sources.push(roar, lfo(ctx, roarGain.gain, 0.21, 0.12), lfo(ctx, low.frequency, 0.07, 160))
  sources.forEach((s) => s.start())
  // Crackles: short, bright noise pops at random intervals.
  let timer: ReturnType<typeof setTimeout> | undefined
  const crackle = () => {
    const t = ctx.currentTime
    const pop = noiseSource(ctx, buffer, 1.5 + Math.random())
    const high = ctx.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 1800 + Math.random() * 2500
    const env = ctx.createGain()
    const peak = 0.08 + Math.random() * 0.22
    env.gain.setValueAtTime(peak, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.06)
    pop.connect(high).connect(env).connect(out)
    pop.start(t, Math.random())
    pop.stop(t + 0.12)
    timer = setTimeout(crackle, 60 + Math.random() * (Math.random() < 0.2 ? 900 : 260))
  }
  crackle()
  return {
    output: out,
    stop: (at) => {
      if (timer !== undefined) clearTimeout(timer)
      sources.forEach((s) => s.stop(at))
    },
  }
}

function cosmic(ctx: AudioContext, buffer: AudioBuffer, out: GainNode): Voice {
  const sources: AudioScheduledSourceNode[] = []
  const pad = ctx.createBiquadFilter()
  pad.type = 'lowpass'
  pad.frequency.value = 600
  pad.Q.value = 4
  pad.connect(out)
  for (const [hz, type, gain] of [[55, 'sine', 0.3], [82.4, 'sine', 0.18], [110.3, 'sawtooth', 0.05], [164.8, 'triangle', 0.05]] as const) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = hz
    const g = ctx.createGain()
    g.gain.value = gain
    osc.connect(g).connect(pad)
    sources.push(osc, lfo(ctx, osc.detune, 0.05 + Math.random() * 0.05, 8))
  }
  sources.push(lfo(ctx, pad.frequency, 0.03, 380))
  // Faint stellar wind.
  const wind = noiseSource(ctx, buffer, 0.25)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 900
  band.Q.value = 8
  const windGain = ctx.createGain()
  windGain.gain.value = 0.05
  wind.connect(band).connect(windGain).connect(out)
  sources.push(wind, lfo(ctx, band.frequency, 0.02, 500))
  sources.forEach((s) => s.start())
  return { output: out, stop: (at) => sources.forEach((s) => s.stop(at)) }
}

const BUILDERS: Readonly<Record<Exclude<FocusTrack, 'off'>, (ctx: AudioContext, buffer: AudioBuffer, out: GainNode) => Voice>> = { rain, fireplace, cosmic }

class FocusSoundscape {
  private voice: Voice | null = null
  private track: FocusTrack = 'off'
  private volume = 0.5

  get current(): FocusTrack {
    return this.track
  }

  /** Starts (or crossfades to) a track; 'off' fades out. Needs an unlocked audio context. */
  play(track: FocusTrack, volume: number): void {
    this.volume = volume
    if (track === this.track && this.voice) {
      this.setVolume(volume)
      return
    }
    this.stop()
    this.track = track
    if (track === 'off') return
    const ctx = audioEngine.ready()
    const bus = audioEngine.focusBus
    const buffer = audioEngine.noiseBuffer
    if (!ctx || !bus || !buffer) return
    const out = ctx.createGain()
    out.gain.setValueAtTime(0.0001, ctx.currentTime)
    out.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + FADE_S)
    out.connect(bus)
    this.voice = BUILDERS[track](ctx, buffer, out)
  }

  setVolume(volume: number): void {
    this.volume = volume
    const ctx = audioEngine.context
    if (!ctx || !this.voice) return
    this.voice.output.gain.setTargetAtTime(Math.max(0.0001, volume), ctx.currentTime, 0.2)
  }

  stop(): void {
    const ctx = audioEngine.context
    const voice = this.voice
    this.voice = null
    if (!voice || !ctx) return
    const end = ctx.currentTime + FADE_S
    voice.output.gain.setTargetAtTime(0.0001, ctx.currentTime, FADE_S / 4)
    voice.stop(end + 0.1)
    setTimeout(() => voice.output.disconnect(), (FADE_S + 0.3) * 1000)
  }

  /** Restarts the last track after the audio context was unlocked or resumed. */
  resume(): void {
    if (this.track !== 'off' && !this.voice) {
      const track = this.track
      this.track = 'off'
      this.play(track, this.volume)
    }
  }
}

export const focusSoundscape = new FocusSoundscape()
