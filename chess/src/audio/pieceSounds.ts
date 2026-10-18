import type { SoundMaterial } from '../types/theme'
import { noise, tone, vary } from './synth'

export type PieceSoundKind = 'move' | 'capture' | 'castle' | 'promote'

/** One physical "impact" of a piece on the board, voiced by material. */
function impact(material: SoundMaterial, at: number, strength: number, pitch: number): void {
  const p = pitch * vary(0.035)
  switch (material) {
    case 'wood':
      noise({ at, duration: 0.05, gain: 0.55 * strength, filter: { type: 'bandpass', frequency: 950 * p, q: 1.3 } })
      tone({ at, frequency: 150 * p, frequencyEnd: 85 * p, decay: 0.1, gain: 0.55 * strength })
      tone({ at, frequency: 430 * p, type: 'triangle', decay: 0.045, gain: 0.14 * strength })
      break
    case 'marble':
      noise({ at, duration: 0.03, gain: 0.45 * strength, filter: { type: 'bandpass', frequency: 3200 * p, q: 2 } })
      tone({ at, frequency: 1850 * p, decay: 0.2, gain: 0.12 * strength, reverb: 0.25 })
      tone({ at, frequency: 2960 * p, decay: 0.11, gain: 0.06 * strength })
      tone({ at, frequency: 220 * p, frequencyEnd: 140 * p, decay: 0.06, gain: 0.3 * strength })
      break
    case 'metal': {
      // Inharmonic partials of a struck metal bar.
      const partials: Array<[number, number, number]> = [
        [1, 0.6, 0.16],
        [2.76, 0.42, 0.09],
        [5.4, 0.26, 0.05],
        [8.93, 0.16, 0.025],
      ]
      for (const [ratio, decay, gain] of partials) {
        tone({ at, frequency: 520 * p * ratio, decay, gain: gain * strength, reverb: 0.3 })
      }
      noise({ at, duration: 0.015, gain: 0.3 * strength, filter: { type: 'highpass', frequency: 4000 } })
      break
    }
    case 'synth':
      tone({
        at,
        frequency: 880 * p,
        frequencyEnd: 440 * p,
        type: 'square',
        decay: 0.09,
        gain: 0.1 * strength,
        filter: { type: 'lowpass', frequency: 2600, q: 4 },
        reverb: 0.2,
      })
      tone({ at, frequency: 110 * p, decay: 0.07, gain: 0.35 * strength })
      break
    case 'soft':
      tone({ at, frequency: 620 * p, decay: 0.07, gain: 0.2 * strength })
      noise({ at, duration: 0.03, gain: 0.18 * strength, filter: { type: 'lowpass', frequency: 1600 } })
      break
  }
}

export function playPieceSound(material: SoundMaterial, kind: PieceSoundKind): void {
  switch (kind) {
    case 'move':
      impact(material, 0, 1, 1)
      break
    case 'capture':
      impact(material, 0, 1.35, 0.85)
      impact(material, 0.045, 0.8, 1.15)
      break
    case 'castle':
      impact(material, 0, 0.9, 1)
      impact(material, 0.11, 0.9, 1.08)
      break
    case 'promote':
      impact(material, 0, 1, 1)
      ;[784, 988, 1319].forEach((f, i) =>
        tone({ at: 0.08 + i * 0.07, frequency: f, type: 'triangle', decay: 0.25, gain: 0.12, reverb: 0.4 }),
      )
      break
  }
}
