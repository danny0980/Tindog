export type SoundEffect = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'game-end' | 'illegal' | 'low-time'

type ToneStep = { frequency: number; duration: number; type?: OscillatorType; gain?: number; delay?: number }

const EFFECTS: Record<SoundEffect, ToneStep[]> = {
  move: [{ frequency: 520, duration: 0.06, type: 'triangle', gain: 0.18 }],
  capture: [
    { frequency: 300, duration: 0.05, type: 'square', gain: 0.08 },
    { frequency: 180, duration: 0.08, type: 'triangle', gain: 0.2, delay: 0.03 },
  ],
  castle: [
    { frequency: 480, duration: 0.05, type: 'triangle', gain: 0.16 },
    { frequency: 560, duration: 0.05, type: 'triangle', gain: 0.16, delay: 0.08 },
  ],
  check: [
    { frequency: 740, duration: 0.08, type: 'sawtooth', gain: 0.06 },
    { frequency: 880, duration: 0.12, type: 'triangle', gain: 0.14, delay: 0.07 },
  ],
  promote: [
    { frequency: 520, duration: 0.07, type: 'triangle', gain: 0.15 },
    { frequency: 660, duration: 0.07, type: 'triangle', gain: 0.15, delay: 0.07 },
    { frequency: 880, duration: 0.1, type: 'triangle', gain: 0.15, delay: 0.14 },
  ],
  'game-end': [
    { frequency: 660, duration: 0.14, type: 'sine', gain: 0.2 },
    { frequency: 495, duration: 0.14, type: 'sine', gain: 0.2, delay: 0.14 },
    { frequency: 392, duration: 0.3, type: 'sine', gain: 0.2, delay: 0.28 },
  ],
  illegal: [{ frequency: 140, duration: 0.09, type: 'square', gain: 0.05 }],
  'low-time': [{ frequency: 1000, duration: 0.05, type: 'sine', gain: 0.1 }],
}

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null
  context ??= new window.AudioContext()
  if (context.state === 'suspended') void context.resume()
  return context
}

/** Plays a tiny synthesized sound effect — no audio assets needed, works offline in native shells. */
export function playSound(effect: SoundEffect): void {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  for (const step of EFFECTS[effect]) {
    const start = now + (step.delay ?? 0)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = step.type ?? 'sine'
    osc.frequency.setValueAtTime(step.frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(step.gain ?? 0.15, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + step.duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + step.duration + 0.02)
  }
}

export function soundForMove(san: string, isCapture: boolean, isCastle: boolean, isPromotion: boolean): SoundEffect {
  if (san.includes('#') || san.includes('+')) return 'check'
  if (isPromotion) return 'promote'
  if (isCastle) return 'castle'
  if (isCapture) return 'capture'
  return 'move'
}

/** Short vibration on supported devices (Android WebView / browsers). iOS ignores it silently. */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern)
  }
}
