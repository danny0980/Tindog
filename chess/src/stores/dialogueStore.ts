import { TAUNTS, fillTemplate } from '../data/taunts'
import type { QuoteTrigger } from '../types/legend'
import type { Persona } from '../types/persona'
import type { TauntEvent, TauntMood } from '../types/taunts'
import { createStore } from '../utils/store'

export interface DialogueLine {
  id: number
  /** Persona key of the speaker (routes the bubble to the right player bar). */
  speakerKey: string
  speaker: string
  text: string
  /** Emotional colour of the line (bubble styling). */
  mood: TauntMood
  /** Important lines are shown longer and with emphasis. */
  urgent: boolean
}

export const dialogueStore = createStore<DialogueLine | null>(null)

/** Triggers that always speak, interrupting chatter. */
const PRIORITY = new Set<QuoteTrigger>(['intro', 'legendWins', 'legendLoses', 'draw'])
const TRIGGER_MOOD: Record<QuoteTrigger, TauntMood> = {
  intro: 'calm',
  thinking: 'calm',
  playerSlow: 'smug',
  legendCapture: 'smug',
  playerCapture: 'angry',
  checkGiven: 'smug',
  inCheck: 'tense',
  advantage: 'smug',
  disadvantage: 'tense',
  legendWins: 'smug',
  legendLoses: 'shocked',
  draw: 'calm',
}
/** Minimum gap between casual remarks so the character doesn't monologue. */
const COOLDOWN_MS = 7000
/** Taunts at or above this priority interrupt chatter and skip the cooldown. */
export const URGENT_PRIORITY = 80

let nextId = 1
let lastSpokeAt = 0
const recent = new Map<string, string[]>()

function speak(persona: Pick<Persona, 'key' | 'name'>, pool: readonly string[], mood: TauntMood, urgent: boolean, fill: (t: string) => string = (t) => t): void {
  if (pool.length === 0) return
  const used = recent.get(persona.key) ?? []
  const fresh = pool.filter((q) => !used.includes(q))
  const options = fresh.length > 0 ? fresh : pool
  const template = options[Math.floor(Math.random() * options.length)] ?? pool[0] ?? ''
  recent.set(persona.key, [...used, template].slice(-8))
  lastSpokeAt = Date.now()
  dialogueStore.set({ id: nextId++, speakerKey: persona.key, speaker: persona.name, text: fill(template), mood, urgent })
}

/**
 * Makes a character say one of its hand-written lines for `trigger`.
 * `chance` (0–1) keeps reactions occasional; recent lines aren't repeated.
 */
export function personaSay(persona: Pick<Persona, 'key' | 'name' | 'quotes'>, trigger: QuoteTrigger, chance = 1): void {
  const priority = PRIORITY.has(trigger)
  if (!priority && (Math.random() > chance || Date.now() - lastSpokeAt < COOLDOWN_MS)) return
  speak(persona, persona.quotes[trigger], TRIGGER_MOOD[trigger], priority)
}

/**
 * Dynamic reaction to a board event: a tone-specific line with the concrete
 * piece / square / spell filled in. Urgent events (queen sacrifices, blunders,
 * promotions…) interrupt; minor ones respect the cooldown and fire by chance.
 */
export function personaTaunt(persona: Pick<Persona, 'key' | 'name' | 'tone'>, event: TauntEvent, chance = 1): void {
  const urgent = event.priority >= URGENT_PRIORITY
  if (!urgent && (Math.random() > chance || Date.now() - lastSpokeAt < COOLDOWN_MS)) return
  speak(persona, TAUNTS[persona.tone][event.kind], event.mood, urgent, (t) => fillTemplate(t, event.vars))
}

/** A scripted line (e.g. the boss's answer to your parley choice); always shown. */
export function personaLine(persona: Pick<Persona, 'key' | 'name'>, text: string, mood: TauntMood): void {
  speak(persona, [text], mood, true)
}

export function clearDialogue(id?: number): void {
  dialogueStore.set((current) => (current && (id === undefined || current.id === id) ? null : current))
}
