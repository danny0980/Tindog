import type { QuoteTrigger } from '../types/legend'
import type { Persona } from '../types/persona'
import { createStore } from '../utils/store'

export interface DialogueLine {
  id: number
  /** Persona key of the speaker (routes the bubble to the right player bar). */
  speakerKey: string
  speaker: string
  trigger: QuoteTrigger
  text: string
}

export const dialogueStore = createStore<DialogueLine | null>(null)

/** Triggers that always speak, interrupting chatter. */
const PRIORITY = new Set<QuoteTrigger>(['intro', 'legendWins', 'legendLoses', 'draw'])
/** Minimum gap between casual remarks so the character doesn't monologue. */
const COOLDOWN_MS = 7000

let nextId = 1
let lastSpokeAt = 0
const recent = new Map<string, string[]>()

/**
 * Makes a character say something for `trigger`. `chance` (0–1) keeps
 * reactions occasional; repeats of the last few lines are avoided.
 */
export function personaSay(persona: Pick<Persona, 'key' | 'name' | 'quotes'>, trigger: QuoteTrigger, chance = 1): void {
  const priority = PRIORITY.has(trigger)
  const now = Date.now()
  if (!priority && (Math.random() > chance || now - lastSpokeAt < COOLDOWN_MS)) return
  const pool = persona.quotes[trigger]
  if (pool.length === 0) return
  const used = recent.get(persona.key) ?? []
  const fresh = pool.filter((q) => !used.includes(q))
  const options = fresh.length > 0 ? fresh : pool
  const text = options[Math.floor(Math.random() * options.length)] ?? pool[0] ?? ''
  recent.set(persona.key, [...used, text].slice(-6))
  lastSpokeAt = now
  dialogueStore.set({ id: nextId++, speakerKey: persona.key, speaker: persona.name, trigger, text })
}

export function clearDialogue(id?: number): void {
  dialogueStore.set((current) => (current && (id === undefined || current.id === id) ? null : current))
}
