// Character voices: the characters' lines read aloud with the browser's own
// speech synthesis (no audio files, no network). Each character gets a stable
// voice of their own — a system voice of the right register, plus a pitch and
// pace from who they are — so Cleopatra never sounds like Genghis Khan.
// Picking the voice is pure (tested); speaking is a thin wrapper.
import { dialogueStore, type DialogueLine } from '../stores/dialogueStore'
import { settingsStore } from '../stores/settingsStore'
import type { TauntMood } from '../types/taunts'

export type VoiceMode = 'off' | 'key' | 'all'
export type Register = 'female' | 'male' | 'machine'

export interface VoiceProfile {
  register: Register
  /** 0–2 (1 = the voice's natural pitch). */
  pitch: number
  /** 0.1–10 (1 = normal speed). */
  rate: number
  /** Stable per character: picks among the voices of the right register. */
  seed: number
}

/** Women (and female-voiced figures) across the legends, campaign and Classic rosters. */
const FEMALE = new Set(
  [
    'Cleopatra VII', 'Queen Aerith', 'Joan of Arc', 'Queen Elizabeth I', 'Ada Lovelace', 'Marie Curie', 'Paradoxia', 'Entropia', 'Solara', 'Celestia Prime',
    'Nyx Overclock', 'Madame Kuroda', 'Seraph', 'Anne Bonny', "Grace O'Malley", 'Grace O’Malley', 'Mochizuki Chiyome', 'Athena', 'Lady Sylvaris', 'Morgana the Bone Witch',
    'The Banshee Queen', 'Sylphira the Storm Serpent', 'Vexmora the Hoard Queen', 'Hatshepsut', 'Boudica', 'Eleanor of Aquitaine', 'Wu Zetian', 'Isabella I of Castile',
    'Catherine the Great', 'Florence Nightingale', 'Harriet Tubman', 'Queen Victoria', 'Rosalind Franklin',
  ].map((n) => n.toLowerCase()),
)

/** Machines and AIs speak in a flatter, synthetic register. */
const MACHINE = new Set(['the clockwork oracle', 'glitch', 'oracle-7', 'helix', 'lattice', 'mirage', 'aegis prime', 'omnicore', 'the architect', 'mr. static', 'cipher', 'vanta proxy'])

/** Small, stable string hash (FNV-1a). */
export function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function registerOf(name: string): Register {
  const n = name.toLowerCase()
  if (MACHINE.has(n)) return 'machine'
  return FEMALE.has(n) ? 'female' : 'male'
}

/** A character's voice: register from who they are, a slight personal pitch and pace from their name. */
export function voiceProfile(name: string): VoiceProfile {
  const seed = hash(name)
  const register = registerOf(name)
  // ±8% pitch and ±6% pace, the same every time for the same character.
  const jitter = (bits: number, span: number) => (((seed >>> bits) & 0xff) / 255 - 0.5) * 2 * span
  const base = register === 'machine' ? { pitch: 0.55, rate: 0.92 } : register === 'female' ? { pitch: 1.12, rate: 1 } : { pitch: 0.86, rate: 0.96 }
  return { register, seed, pitch: round(base.pitch + jitter(0, 0.08)), rate: round(base.rate + jitter(8, 0.06)) }
}

/** The line's mood colours the delivery: anger is quicker, shock higher, calm unhurried. */
export function deliver(profile: VoiceProfile, mood: TauntMood): { pitch: number; rate: number } {
  const shift: Record<TauntMood, { pitch: number; rate: number }> = {
    smug: { pitch: 0, rate: -0.04 },
    angry: { pitch: -0.05, rate: 0.1 },
    shocked: { pitch: 0.12, rate: 0.06 },
    tense: { pitch: 0.03, rate: 0.05 },
    calm: { pitch: 0, rate: -0.03 },
  }
  const s = shift[mood]
  return { pitch: clamp(round(profile.pitch + s.pitch), 0.1, 2), rate: clamp(round(profile.rate + s.rate), 0.5, 1.6) }
}

const round = (x: number): number => Math.round(x * 100) / 100
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** What we need from a SpeechSynthesisVoice (so picking can be tested without a browser). */
export interface VoiceLike {
  name: string
  lang: string
  localService?: boolean
}

// System voices don't say whether they are female or male; these well-known names do.
const FEMALE_VOICES = /female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|susan|hazel|serena|allison|ava|kate|veena|catherine|libby|sonia|aria|jenny|michelle|emma|amy|joanna|salli|kimberly|ivy|kendra|nicole|olivia|natasha|clara|heera|google uk english female|google us english/i
const MALE_VOICES = /\bmale\b|\bman\b|daniel|alex\b|fred|david|mark|george|rishi|james|tom\b|oliver|arthur|guy|ryan|thomas|aaron|gordon|lee\b|matthew|brian|justin|joey|russell|geraint|google uk english male/i

/**
 * Picks the system voice for a profile: English voices of the right register
 * first (a machine takes any male-register voice), then any English voice
 * (pitch carries the register), then anything. Stable for a given voice list.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], profile: VoiceProfile): V | null {
  if (voices.length === 0) return null
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang))
  const pool = english.length > 0 ? english : voices
  const female = pool.filter((v) => FEMALE_VOICES.test(v.name) && !/\bmale\b/i.test(v.name))
  const male = pool.filter((v) => MALE_VOICES.test(v.name) && !FEMALE_VOICES.test(v.name.replace(/\bmale\b/i, '')))
  const matching = profile.register === 'female' ? female : male
  const candidates = matching.length > 0 ? matching : pool
  return candidates[profile.seed % candidates.length] ?? null
}

/** The lines a mode reads aloud: key moments only (greetings, the result, urgent reactions), or everything. */
export const shouldSpeak = (mode: VoiceMode, line: Pick<DialogueLine, 'urgent'>): boolean => mode === 'all' || (mode === 'key' && line.urgent)

/** Reads one line aloud in the character's voice (interrupting whatever was being said). */
export function speakLine(line: Pick<DialogueLine, 'speaker' | 'text' | 'mood'>, volume = 1): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  const profile = voiceProfile(line.speaker)
  const u = new SpeechSynthesisUtterance(line.text)
  const voice = pickVoice(synth.getVoices(), profile)
  if (voice) {
    u.voice = voice
    u.lang = voice.lang
  } else u.lang = 'en-GB'
  const { pitch, rate } = deliver(profile, line.mood)
  u.pitch = pitch
  u.rate = rate
  u.volume = clamp(volume, 0, 1)
  synth.cancel()
  synth.speak(u)
}

export const voicesSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window

let started = false

/** Starts reading characters' lines aloud as they appear (per the Character voices setting). */
export function startCharacterVoices(): void {
  if (started || !voicesSupported()) return
  started = true
  // Some browsers load their voice list late; asking once warms it up.
  window.speechSynthesis.getVoices()
  let lastId = 0
  dialogueStore.subscribe(() => {
    const line = dialogueStore.get()
    if (!line || line.id === lastId) return
    lastId = line.id
    const s = settingsStore.get()
    if (!s.sfxEnabled || !shouldSpeak(s.characterVoice, line)) return
    speakLine(line, s.sfxVolume)
  })
  // Leaving the page (or hiding it) shouldn't leave a character talking.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.speechSynthesis.cancel()
  })
}

/** Stops any line being read (e.g. when the voices are switched off). */
export function hushVoices(): void {
  if (voicesSupported()) window.speechSynthesis.cancel()
}
