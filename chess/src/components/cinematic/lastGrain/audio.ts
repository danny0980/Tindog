// Score and sound design for "The Last Grain", synthesised (no audio files)
// and scheduled sample-accurately on the AudioContext clock from the cue
// sheet in timeline.ts:
//
//   0.95 grain strikes — celesta + glass tink     7.0  brass peak + taiko
//   2.2  string ostinato enters                   7.8  reverse cymbal → match cut
//   3.0–4.6 five material ticks (lapis, bronze,   9.6  silence · clock tick · glass harmonic
//        lacquer, rune stone, silver)             10.4 reversed swell + heartbeat
//   12.2 orchestral hit + chime (title locks)     13.0/13.4/13.8 UI clicks · 14.2 resolving chord
//
// Every voice runs through this film's own buses — including its reverb send —
// so skipping or leaving silences everything already scheduled, tails included.
import { audioEngine, focusSoundscape } from '../../../audio'
import type { FocusTrack } from '../../../audio/focusSounds'
import { midiToHz, noise, tone } from '../../../audio/synth'
import { CUES, FILM_LENGTH, T, type Cue } from './timeline'

export interface LastGrainAudio {
  /**
   * Schedules the score from the film's current time (read from `clock`, in s).
   * Restarting replaces the previous schedule. If the AudioContext is still
   * resuming after the unlocking tap, scheduling waits for it.
   */
  start: (clock: () => number) => void
  /** Silences the film's sound (keeps the audio engine running). */
  pause: () => void
  /** Silences the film and hands back to the player's chosen ambience. */
  stop: (restore: { track: FocusTrack; volume: number }) => void
}

interface Buses {
  ctx: AudioContext
  master: GainNode
  /** Orchestra: ducked to silence for the frozen second. */
  music: GainNode
  /** Close, dry-ish effects: impacts, ticks, clicks. */
  fx: GainNode
  /** Big wet space for celesta, glass and chimes. */
  hall: GainNode
}

// D minor world, resolving to D major at the menu.
const D_MINOR = [38, 45, 50, 53, 57, 62] as const
const B_FLAT = [34, 41, 46, 50, 53, 58] as const
const D_MAJOR = [38, 45, 50, 54, 57, 62, 66] as const
const OSTINATO = [62, 69, 65, 69, 62, 69, 65, 72] as const
const OSTINATO_STEP = 0.2

function makeBuses(): Buses | null {
  const ctx = audioEngine.ready()
  const out = audioEngine.sfxBus
  if (!ctx || !out) return null
  const gain = (value: number): GainNode => {
    const g = ctx.createGain()
    g.gain.value = value
    return g
  }
  const master = gain(0.9)
  const music = gain(1)
  const fx = gain(1)
  const hall = gain(1)
  master.connect(out)
  music.connect(master)
  fx.connect(master)
  hall.connect(master)
  const reverb = audioEngine.reverbBus
  if (reverb) {
    // Private sends: disconnecting `master` and the sends silences the tails too.
    const send = (from: GainNode, amount: number) => from.connect(gain(amount)).connect(reverb)
    send(music, 0.55)
    send(fx, 0.25)
    send(hall, 0.9)
  }
  return { ctx, master, music, fx, hall }
}

function teardown(b: Buses): void {
  const now = b.ctx.currentTime
  b.master.gain.cancelScheduledValues(now)
  b.master.gain.setValueAtTime(b.master.gain.value, now)
  b.master.gain.linearRampToValueAtTime(0, now + 0.12)
  for (const node of [b.music, b.fx, b.hall]) {
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(node.gain.value, now)
    node.gain.linearRampToValueAtTime(0, now + 0.12)
  }
  window.setTimeout(() => {
    for (const node of [b.master, b.music, b.fx, b.hall]) node.disconnect()
  }, 250)
}

/** A swelling noise that cuts dead at its peak — a reversed cymbal. */
function reverseSwell(b: Buses, at: number, length: number, gain: number, freq: number): void {
  const buffer = audioEngine.noiseBuffer
  if (!buffer || at + length <= 0) return
  const start = b.ctx.currentTime + Math.max(0, at)
  const end = b.ctx.currentTime + at + length
  const src = b.ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  const filter = b.ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(freq * 0.4, start)
  filter.frequency.exponentialRampToValueAtTime(freq, end)
  const env = b.ctx.createGain()
  const from = Math.max(0.0001, gain * Math.max(0, -at / length) ** 2)
  env.gain.setValueAtTime(from, start)
  env.gain.exponentialRampToValueAtTime(gain, end)
  env.gain.setValueAtTime(0.0001, end + 0.01)
  src.connect(filter).connect(env).connect(b.fx)
  src.start(start)
  src.stop(end + 0.05)
}

/** Schedules the sound for one cue, `at` seconds from now. */
function play(b: Buses, cue: Cue, at: number): void {
  const { music, fx, hall } = b
  const pad = (notes: readonly number[], when: number, decay: number, gain: number, attack = 0.8) => {
    for (const n of notes) {
      for (const detune of [-7, 7]) tone({ at: when, frequency: midiToHz(n), type: 'sawtooth', detune, attack, decay, gain: gain / (notes.length * 2), filter: { type: 'lowpass', frequency: 1100, q: 0.6 }, destination: music })
    }
  }
  const taiko = (when: number, gain: number) => {
    tone({ at: when, frequency: 82, frequencyEnd: 44, decay: 0.9, gain, destination: fx })
    noise({ at: when, duration: 0.18, gain: gain * 0.35, filter: { type: 'lowpass', frequency: 520 }, destination: fx })
  }
  const chime = (when: number, midi: number, gain: number) => {
    tone({ at: when, frequency: midiToHz(midi), type: 'sine', decay: 2.4, gain, destination: hall })
    tone({ at: when, frequency: midiToHz(midi) * 2.76, type: 'sine', decay: 0.9, gain: gain * 0.25, destination: hall })
  }

  switch (cue.kind) {
    case 'drone':
      // Low D and A breathing under the macro shot, plus a breath of air.
      tone({ at, frequency: midiToHz(26), type: 'sine', attack: 1.8, decay: 7.4, gain: 0.22, destination: music })
      tone({ at, frequency: midiToHz(33), type: 'triangle', attack: 2.4, decay: 6.8, gain: 0.06, filter: { type: 'lowpass', frequency: 400 }, destination: music })
      noise({ at, duration: 2.6, gain: 0.025, filter: { type: 'bandpass', frequency: 2400, q: 0.8 }, destination: hall })
      break
    case 'impact':
      // The grain strikes obsidian: celesta, glass tink, a soft body thump.
      chime(at, 93, 0.16)
      chime(at + 0.004, 100, 0.07)
      tone({ at, frequency: 3951, type: 'sine', decay: 0.18, gain: 0.08, destination: fx })
      tone({ at, frequency: 140, frequencyEnd: 60, decay: 0.45, gain: 0.32, destination: fx })
      noise({ at, duration: 0.08, gain: 0.08, filter: { type: 'highpass', frequency: 6000 }, destination: fx })
      break
    case 'ostinato': {
      // Strings in eighths, building to the queen; the harmony turns to B♭ at 5.0 s.
      const steps = Math.round((T.matchCut - 2.2) / OSTINATO_STEP)
      for (let i = 0; i < steps; i++) {
        const when = at + i * OSTINATO_STEP
        const shift = 2.2 + i * OSTINATO_STEP >= T.crackStart ? -4 : 0
        const note = (OSTINATO[i % OSTINATO.length] ?? 62) + shift
        const swell = 0.03 + 0.05 * (i / steps)
        tone({ at: when, frequency: midiToHz(note), type: 'sawtooth', attack: 0.012, decay: 0.24, gain: swell, filter: { type: 'lowpass', frequency: 1600 + i * 30, q: 0.8 }, destination: music })
        if (i % 4 === 0) tone({ at: when, frequency: midiToHz(note - 24), type: 'triangle', decay: 0.7, gain: swell * 1.4, destination: music })
      }
      pad(D_MINOR, at, 2.8, 0.12, 0.6)
      break
    }
    case 'ignite': {
      // Each era wakes with the sound of its material.
      const i = cue.index ?? 0
      if (i === 0) {
        tone({ at, frequency: 1568, type: 'triangle', decay: 0.5, gain: 0.07, destination: hall }) // lapis: glassy
        tone({ at, frequency: 2350, type: 'sine', decay: 0.3, gain: 0.04, destination: hall })
      } else if (i === 1) {
        tone({ at, frequency: 523, type: 'sine', decay: 1.1, gain: 0.08, destination: hall }) // bronze: inharmonic clang
        tone({ at, frequency: 1381, type: 'sine', decay: 0.6, gain: 0.05, destination: hall })
        tone({ at, frequency: 2210, type: 'sine', decay: 0.3, gain: 0.03, destination: fx })
      } else if (i === 2) {
        noise({ at, duration: 0.07, gain: 0.14, filter: { type: 'bandpass', frequency: 950, q: 3 }, destination: fx }) // lacquer: wood knock
        tone({ at, frequency: 233, frequencyEnd: 200, decay: 0.16, gain: 0.16, destination: fx })
      } else if (i === 3) {
        noise({ at, duration: 0.3, gain: 0.12, filter: { type: 'lowpass', frequency: 700 }, destination: fx }) // rune stone: grinding weight
        tone({ at, frequency: 98, frequencyEnd: 70, decay: 0.5, gain: 0.22, destination: fx })
        tone({ at: at + 0.04, frequency: midiToHz(81), type: 'triangle', decay: 0.9, gain: 0.04, destination: hall })
      } else {
        for (const [f, g] of [[1760, 0.06], [2637, 0.035], [4186, 0.02]] as const) tone({ at, frequency: f, decay: 1.4, gain: g, destination: hall }) // silver: bell
      }
      noise({ at: at + 0.03, duration: 0.35, gain: 0.04, filter: { type: 'highpass', frequency: 4500 }, destination: fx }) // ember puff
      break
    }
    case 'riser':
      tone({ at, frequency: 70, frequencyEnd: 280, type: 'sawtooth', attack: 2.6, decay: 0.4, gain: 0.07, filter: { type: 'lowpass', frequency: 700 }, destination: music })
      reverseSwell(b, at, T.flare - 4.0, 0.06, 5000)
      break
    case 'queen': {
      pad(B_FLAT, at, 2.6, 0.18, 1.2)
      // Molten gold cracking open: dry crackles that thicken as the fissures climb.
      for (let i = 0; i < 22; i++) {
        const when = at + (T.crackFull - T.crackStart) * (i / 22) ** 0.8 + ((i * 37) % 7) * 0.012
        noise({ at: when, duration: 0.035 + (i % 3) * 0.015, gain: 0.03 + i * 0.003, filter: { type: 'bandpass', frequency: 1800 + ((i * 613) % 2600), q: 5 }, destination: fx })
      }
      break
    }
    case 'flare':
      // Brass peak and taiko as the crown points flare.
      pad(D_MINOR, at, 1.6, 0.4, 0.04)
      for (const n of [50, 57, 62]) tone({ at, frequency: midiToHz(n), type: 'sawtooth', attack: 0.03, decay: 1.2, gain: 0.07, filter: { type: 'lowpass', frequency: 2400 }, destination: music })
      taiko(at, 0.55)
      taiko(at + 0.22, 0.4)
      chime(at, 98, 0.06)
      break
    case 'reverse':
      reverseSwell(b, at, T.matchCut - (T.flare + 0.05), 0.12, 7000)
      tone({ at: at + 0.75, frequency: 60, frequencyEnd: 32, decay: 1.2, gain: 0.4, destination: fx }) // the cut lands
      // A low bed under the dolly — so the freeze has something to cut dead.
      pad([26, 38, 45, 50], at + 0.75, 2.6, 0.34, 0.5)
      tone({ at: at + 0.75, frequency: midiToHz(26), type: 'sine', attack: 0.6, decay: 2.2, gain: 0.16, destination: music })
      // The last grain touches down by the king.
      chime(at + (T.lastGrainDrop - (T.flare + 0.05)), 96, 0.08)
      break
    case 'freeze': {
      // Time stops: the orchestra drops out; one clock tick and a glass harmonic hang.
      const t0 = b.ctx.currentTime + at
      const back = t0 + (T.restart - T.freeze)
      if (at < 0) {
        // Resumed inside the frozen second: stay silent until time restarts.
        b.music.gain.setValueAtTime(0.0001, b.ctx.currentTime)
        b.music.gain.setValueAtTime(0.0001, back - 0.02)
        b.music.gain.linearRampToValueAtTime(1, back)
        break
      }
      b.music.gain.setValueAtTime(1, t0)
      b.music.gain.linearRampToValueAtTime(0.0001, t0 + 0.05)
      b.music.gain.setValueAtTime(0.0001, back - 0.02)
      b.music.gain.linearRampToValueAtTime(1, back)
      noise({ at, duration: 0.025, gain: 0.18, filter: { type: 'bandpass', frequency: 3200, q: 4 }, destination: fx })
      tone({ at, frequency: 2093, type: 'sine', attack: 0.02, decay: 1.6, gain: 0.05, destination: hall })
      tone({ at, frequency: 2093 * 1.5, type: 'sine', attack: 0.02, decay: 1.2, gain: 0.02, destination: hall })
      break
    }
    case 'restart':
      // Reversed swell pulls time back into motion; a heartbeat restarts it.
      reverseSwell(b, at, T.restart - (T.restart - 0.5), 0.1, 4000)
      for (const beat of [0.5, 0.72, 1.3, 1.52]) tone({ at: at + beat, frequency: 58, frequencyEnd: 38, decay: 0.32, gain: beat < 1 ? 0.45 : 0.3, destination: fx })
      pad(D_MINOR, at + 0.5, 3, 0.3, 1.1)
      break
    case 'letter': {
      // Each letter of CHRONOS sets like a stone: a chime rising through the scale.
      const scale = [74, 76, 77, 79, 81, 84, 86]
      chime(at, scale[cue.index ?? 0] ?? 74, 0.05)
      noise({ at, duration: 0.05, gain: 0.05, filter: { type: 'lowpass', frequency: 900 }, destination: fx })
      break
    }
    case 'lock':
      // The light ray locks the title: orchestral hit and a high chime.
      pad(D_MINOR, at, 1.8, 0.45, 0.02)
      taiko(at, 0.6)
      noise({ at, duration: 1.4, gain: 0.07, filter: { type: 'highpass', frequency: 5000 }, destination: hall })
      chime(at + 0.02, 98, 0.1)
      // A bed that carries the menu rising into the final chord.
      pad([38, 45, 50, 57], at + 0.3, 3.2, 0.2, 0.8)
      break
    case 'chip':
      tone({ at, frequency: 1800 + (cue.index ?? 0) * 220, type: 'square', decay: 0.03, gain: 0.025, filter: { type: 'lowpass', frequency: 5000 }, destination: fx })
      tone({ at: at + 0.01, frequency: 2400 + (cue.index ?? 0) * 300, type: 'sine', decay: 0.12, gain: 0.03, destination: hall })
      break
    case 'resolve':
      // Picardy third: the film resolves to D major as "Tap to begin" appears.
      pad(D_MAJOR, at, 3.4, 0.3, 0.5)
      chime(at + 0.1, 90, 0.06)
      break
    case 'ambient':
      // A long, quiet bed under the live menu.
      pad([38, 45, 54, 57], at, 9, 0.08, 2)
      break
  }
}

export function createLastGrainAudio(): LastGrainAudio {
  let buses: Buses | null = null
  let generation = 0
  const halt = () => {
    generation += 1
    if (buses) teardown(buses)
    buses = null
  }
  const schedule = (from: number) => {
    buses = makeBuses()
    if (!buses || from >= FILM_LENGTH) return
    // The room tone gives way to the film's own score.
    focusSoundscape.play('off', 0)
    for (const cue of CUES) {
      // Cues already passed stay silent — except the freeze, whose bus automation still matters.
      if (cue.at < from - 0.02 && !(cue.kind === 'freeze' && from < T.restart)) continue
      play(buses, cue, cue.at - from)
    }
  }
  return {
    start(clock) {
      halt()
      const ctx = audioEngine.unlock()
      if (!ctx) return
      if (ctx.state === 'running') {
        schedule(clock())
        return
      }
      const mine = generation
      void ctx.resume().then(() => {
        if (mine === generation) schedule(clock())
      })
    },
    pause: halt,
    stop(restore) {
      halt()
      focusSoundscape.play(restore.track, restore.volume)
    },
  }
}
