import { audioEngine } from './AudioEngine'
import { midiToHz, noise, tone } from './synth'

/** Interface & reward sounds go to the UI track so they can be mixed separately. */
const ui = () => audioEngine.uiBus

/** Check alert: urgent two-tone ping. */
export function playCheck(): void {
  tone({ frequency: 880, type: 'triangle', decay: 0.12, gain: 0.16, reverb: 0.2 })
  tone({ at: 0.08, frequency: 1175, type: 'triangle', decay: 0.2, gain: 0.16, reverb: 0.3 })
  tone({ frequency: 880, type: 'sawtooth', decay: 0.1, gain: 0.04, filter: { type: 'lowpass', frequency: 2000 } })
}

function chord(notes: number[], at: number, decay: number, gain: number, type: OscillatorType = 'sawtooth', cutoff = 1800): void {
  for (const note of notes) {
    for (const detune of [-7, 7]) {
      tone({
        at,
        frequency: midiToHz(note),
        type,
        detune,
        attack: 0.04,
        decay,
        gain: gain / notes.length,
        filter: { type: 'lowpass', frequency: cutoff, q: 0.8 },
        reverb: 0.5,
      })
    }
  }
}

/** Triumphant rising arpeggio resolving to a major chord with shimmer. */
export function playVictory(): void {
  const arp = [60, 64, 67, 72, 76, 79]
  arp.forEach((n, i) => tone({ at: i * 0.085, frequency: midiToHz(n), type: 'triangle', decay: 0.35, gain: 0.16, reverb: 0.4 }))
  chord([48, 60, 64, 67, 72], 0.55, 1.8, 0.5, 'sawtooth', 2400)
  tone({ at: 0.55, frequency: midiToHz(84), decay: 1.4, gain: 0.08, reverb: 0.7 })
  noise({ at: 0.55, duration: 1.2, gain: 0.05, filter: { type: 'highpass', frequency: 7000 }, reverb: 0.6 })
}

/** Sombre descending phrase into a low minor chord. */
export function playDefeat(): void {
  ;[69, 65, 62].forEach((n, i) =>
    tone({ at: i * 0.22, frequency: midiToHz(n), type: 'triangle', attack: 0.02, decay: 0.45, gain: 0.15, reverb: 0.5 }),
  )
  chord([38, 50, 53, 57], 0.7, 2.2, 0.45, 'triangle', 900)
}

/** Neutral suspended chord resolving gently — stalemate and draws. */
export function playDraw(): void {
  chord([55, 60, 62], 0, 0.9, 0.4, 'triangle', 1400)
  chord([55, 59, 62], 0.6, 1.4, 0.4, 'triangle', 1400)
}

/** Clock ticks followed by a falling alarm sweep. */
export function playTimeout(): void {
  for (let i = 0; i < 3; i += 1) noise({ at: i * 0.16, duration: 0.03, gain: 0.4, filter: { type: 'bandpass', frequency: 3500, q: 6 } })
  tone({ at: 0.5, frequency: 700, frequencyEnd: 140, type: 'sawtooth', decay: 0.8, gain: 0.12, filter: { type: 'lowpass', frequency: 1800 } })
  tone({ at: 0.5, frequency: 350, frequencyEnd: 70, type: 'square', decay: 0.8, gain: 0.05, filter: { type: 'lowpass', frequency: 900 } })
}

/** Sparkling bell triad for achievements. */
export function playAchievement(): void {
  ;[88, 92, 95, 100].forEach((n, i) => tone({ destination: ui(), at: i * 0.07, frequency: midiToHz(n), decay: 0.9, gain: 0.08, reverb: 0.6 }))
  noise({ destination: ui(), duration: 0.6, gain: 0.04, filter: { type: 'highpass', frequency: 8000 }, reverb: 0.5 })
}

export function playCoins(): void {
  tone({ destination: ui(), frequency: 1319, type: 'square', decay: 0.08, gain: 0.05, filter: { type: 'lowpass', frequency: 5000 } })
  tone({ destination: ui(), at: 0.07, frequency: 1760, type: 'square', decay: 0.22, gain: 0.05, filter: { type: 'lowpass', frequency: 5000 }, reverb: 0.3 })
}

export function playPuzzleSolved(): void {
  ;[72, 76, 79, 84].forEach((n, i) => tone({ destination: ui(), at: i * 0.06, frequency: midiToHz(n), type: 'triangle', decay: 0.4, gain: 0.13, reverb: 0.4 }))
}

export function playError(): void {
  tone({ frequency: 150, type: 'square', decay: 0.08, gain: 0.06, filter: { type: 'lowpass', frequency: 800 } })
  tone({ at: 0.1, frequency: 120, type: 'square', decay: 0.12, gain: 0.06, filter: { type: 'lowpass', frequency: 800 } })
}

export function playNotify(): void {
  tone({ destination: ui(), frequency: 988, decay: 0.3, gain: 0.07, reverb: 0.4 })
}

export function playTap(): void {
  tone({ destination: ui(), frequency: 1400, decay: 0.025, gain: 0.04 })
}

export function playLowTime(): void {
  tone({ destination: ui(), frequency: 1000, decay: 0.05, gain: 0.08 })
}

/** Short swipe "whoosh" for gesture feedback. */
export function playSwipe(): void {
  noise({ destination: ui(), duration: 0.12, gain: 0.12, filter: { type: 'bandpass', frequency: 1800, q: 0.8 } })
}

/** Rising ping for arcade score popups; pitch climbs with the combo. */
export function playScore(combo: number): void {
  const base = 660 * 2 ** (Math.min(combo, 12) / 12)
  tone({ destination: ui(), frequency: base, type: 'triangle', decay: 0.12, gain: 0.08 })
  tone({ destination: ui(), at: 0.05, frequency: base * 1.5, type: 'triangle', decay: 0.18, gain: 0.07, reverb: 0.2 })
}

/** Time-travel "warp": rising filtered sweep, shimmering bells and a low arrival boom. */
export function playTimeTravel(): void {
  const ctx = audioEngine.ready()
  const out = audioEngine.sfxBus
  const buffer = audioEngine.noiseBuffer
  if (ctx && out && buffer) {
    const start = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 3
    filter.frequency.setValueAtTime(180, start)
    filter.frequency.exponentialRampToValueAtTime(5200, start + 1.3)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, start)
    env.gain.exponentialRampToValueAtTime(0.22, start + 0.9)
    env.gain.exponentialRampToValueAtTime(0.0001, start + 1.5)
    src.connect(filter).connect(env).connect(out)
    const reverb = audioEngine.reverbBus
    if (reverb) env.connect(reverb)
    src.start(start)
    src.stop(start + 1.6)
  }
  ;[76, 83, 88, 95].forEach((n, i) => tone({ at: 0.5 + i * 0.12, frequency: midiToHz(n), decay: 1.1, gain: 0.07, reverb: 0.7 }))
  tone({ at: 1.3, frequency: 70, frequencyEnd: 38, decay: 0.9, gain: 0.35 })
}
