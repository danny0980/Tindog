/**
 * Owns the single AudioContext and the mixing graph:
 *
 *   sfx bus ──┐
 *   music bus ┼─► master ─► compressor ─► destination
 *   reverb ───┘    ▲
 *   (convolver) ◄──┴── reverb send (from sfx & music voices)
 *
 * The context is created lazily on the first user gesture (browsers and iOS
 * WebViews refuse to start audio otherwise) and suspended while hidden.
 */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfx: GainNode | null = null
  private music: GainNode | null = null
  private reverbIn: GainNode | null = null
  private noise: AudioBuffer | null = null
  private volume = 0.8
  private sfxOn = true
  private musicOn = false

  get context(): AudioContext | null {
    return this.ctx
  }

  /** Creates/resumes the context. Must be called from a user gesture at least once. */
  unlock(): AudioContext | null {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null
    if (!this.ctx) this.build(new window.AudioContext({ latencyHint: 'interactive' }))
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** Returns a running context, or null if audio hasn't been unlocked yet. */
  ready(): AudioContext | null {
    if (!this.ctx) return null
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  setVolume(volume: number): void {
    this.volume = volume
    this.ramp(this.master, volume)
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxOn = enabled
    this.ramp(this.sfx, enabled ? 1 : 0)
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicOn = enabled
    this.ramp(this.music, enabled ? 0.55 : 0)
  }

  get sfxEnabled(): boolean {
    return this.sfxOn && this.volume > 0
  }

  get sfxBus(): GainNode | null {
    return this.sfx
  }

  get musicBus(): GainNode | null {
    return this.music
  }

  get reverbBus(): GainNode | null {
    return this.reverbIn
  }

  get noiseBuffer(): AudioBuffer | null {
    return this.noise
  }

  private ramp(node: GainNode | null, value: number): void {
    if (!node || !this.ctx) return
    const now = this.ctx.currentTime
    node.gain.cancelScheduledValues(now)
    node.gain.setTargetAtTime(value, now, 0.05)
  }

  private build(ctx: AudioContext): void {
    this.ctx = ctx
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -14
    compressor.knee.value = 12
    compressor.ratio.value = 4
    compressor.connect(ctx.destination)

    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.master.connect(compressor)

    this.sfx = ctx.createGain()
    this.sfx.gain.value = this.sfxOn ? 1 : 0
    this.sfx.connect(this.master)

    this.music = ctx.createGain()
    this.music.gain.value = this.musicOn ? 0.55 : 0
    this.music.connect(this.master)

    const convolver = ctx.createConvolver()
    convolver.buffer = this.impulse(ctx, 2.4, 2.8)
    const reverbOut = ctx.createGain()
    reverbOut.gain.value = 0.45
    this.reverbIn = ctx.createGain()
    this.reverbIn.connect(convolver).connect(reverbOut).connect(this.master)

    const length = ctx.sampleRate
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
  }

  /** Synthetic stereo room impulse: exponentially decaying noise. */
  private impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay
    }
    return buffer
  }
}

export const audioEngine = new AudioEngine()
