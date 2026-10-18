// Synthesised score for the intro: a quiet study (fireplace room tone and
// weighty wooden piece thocks), the rift (rising tear, glitch blips, a
// sub-bass impact) and the realm (an orchestral ensemble in D minor —
// low brass, strings, choir and timpani). No audio files.
import { audioEngine, focusSoundscape, haptic } from '../../audio'
import { playPieceSound } from '../../audio/pieceSounds'
import { midiToHz, noise, tone } from '../../audio/synth'
import type { FocusTrack } from '../../audio/focusSounds'
import type { IntroBeat } from './timeline'

/** D minor → B♭ → F → C: four bars of the realm theme (MIDI roots). */
const PROGRESSION: ReadonlyArray<readonly number[]> = [
  [38, 50, 53, 57, 62],
  [34, 46, 50, 53, 58],
  [41, 53, 57, 60, 65],
  [36, 48, 52, 55, 60],
]
const BAR_SECONDS = 2.2

export interface IntroAudio {
  start: () => void
  beat: (beat: IntroBeat) => void
  stop: (restore: { track: FocusTrack; volume: number }) => void
}

function brass(notes: readonly number[], at: number, gain: number): void {
  for (const n of notes.slice(0, 3)) {
    for (const detune of [-9, 0, 9]) {
      tone({ at, frequency: midiToHz(n), type: 'sawtooth', detune, attack: 0.35, decay: BAR_SECONDS * 1.1, gain: gain / 9, filter: { type: 'lowpass', frequency: 900, q: 0.9 }, reverb: 0.6 })
    }
  }
}

function strings(notes: readonly number[], at: number, gain: number): void {
  for (const n of notes.slice(1)) {
    for (const detune of [-6, 6]) {
      tone({ at, frequency: midiToHz(n + 12), type: 'triangle', detune, attack: 0.6, decay: BAR_SECONDS * 1.2, gain: gain / 8, reverb: 0.7 })
    }
  }
}

function choir(notes: readonly number[], at: number, gain: number): void {
  for (const n of notes.slice(2)) tone({ at, frequency: midiToHz(n + 12), type: 'sine', attack: 0.9, decay: BAR_SECONDS * 1.3, gain: gain / 3, reverb: 0.9 })
}

function timpani(at: number, gain: number): void {
  tone({ at, frequency: 98, frequencyEnd: 60, type: 'sine', decay: 0.9, gain })
  noise({ at, duration: 0.12, gain: gain * 0.2, filter: { type: 'lowpass', frequency: 400 } })
}

export function createIntroAudio(): IntroAudio {
  let timer: ReturnType<typeof setInterval> | null = null
  let bar = 0
  let realm = false

  const playBar = () => {
    const chord = PROGRESSION[bar % PROGRESSION.length] ?? PROGRESSION[0] ?? []
    brass(chord, 0, 0.42)
    strings(chord, 0.1, 0.3)
    choir(chord, 0.2, 0.18)
    timpani(0, 0.35)
    timpani(BAR_SECONDS * 0.75, 0.22)
    bar += 1
  }

  return {
    start() {
      audioEngine.unlock()
      // Room tone for the study.
      focusSoundscape.play('fireplace', 0.45)
    },
    beat(beat) {
      switch (beat.kind) {
        case 'land':
          playPieceSound(beat.realm ? 'ember' : 'wood', 'move')
          haptic('move')
          break
        case 'capture':
          playPieceSound(realm ? 'ember' : 'wood', 'capture')
          noise({ duration: 0.4, gain: 0.12, filter: { type: 'highpass', frequency: 3500 } })
          haptic('capture')
          break
        case 'check':
          tone({ frequency: 1175, type: 'triangle', decay: 0.3, gain: 0.12, reverb: 0.5 })
          tone({ frequency: 62, frequencyEnd: 40, type: 'sine', decay: 0.8, gain: 0.3 })
          haptic('check')
          break
        case 'rift':
          // A tear opening in time: rising filtered noise and detuned glitch blips.
          noise({ duration: 2, gain: 0.06, filter: { type: 'bandpass', frequency: 1800, q: 6 }, reverb: 0.5 })
          for (let i = 0; i < 10; i++) tone({ at: 0.2 + i * 0.17, frequency: 400 + ((i * 337) % 1400), type: 'square', decay: 0.05, gain: 0.03 })
          tone({ frequency: 55, frequencyEnd: 110, type: 'sawtooth', attack: 1.5, decay: 0.5, gain: 0.08, filter: { type: 'lowpass', frequency: 500 } })
          focusSoundscape.play('off', 0)
          break
        case 'shockwave':
          tone({ frequency: 70, frequencyEnd: 28, type: 'sine', decay: 1.6, gain: 0.5 })
          noise({ duration: 1.2, gain: 0.16, filter: { type: 'lowpass', frequency: 1200 }, reverb: 0.8 })
          ;[86, 93, 98].forEach((n, i) => tone({ at: 0.05 + i * 0.05, frequency: midiToHz(n), type: 'triangle', decay: 1.4, gain: 0.05, reverb: 0.9 }))
          haptic('error', 'heavy')
          break
        case 'realm':
          realm = true
          focusSoundscape.play('cosmic', 0.25)
          playBar()
          timer = setInterval(playBar, BAR_SECONDS * 1000)
          break
        case 'title':
          timpani(0, 0.5)
          timpani(0.18, 0.4)
          tone({ at: 0.36, frequency: midiToHz(74), type: 'sawtooth', attack: 0.05, decay: 1.8, gain: 0.08, filter: { type: 'lowpass', frequency: 2200 }, reverb: 0.8 })
          break
      }
    },
    stop(restore) {
      if (timer !== null) clearInterval(timer)
      timer = null
      focusSoundscape.play(restore.track, restore.volume)
    },
  }
}
