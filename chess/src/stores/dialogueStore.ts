import type { Legend, LegendId, QuoteTrigger } from '../types/legend'
import { createStore } from '../utils/store'

export interface DialogueLine {
  id: number
  legendId: LegendId
  trigger: QuoteTrigger
  text: string
}

export const dialogueStore = createStore<DialogueLine | null>(null)

/** Triggers that always speak, interrupting chatter. */
const PRIORITY = new Set<QuoteTrigger>(['intro', 'legendWins', 'legendLoses', 'draw'])
/** Minimum gap between casual remarks so the legend doesn't monologue. */
const COOLDOWN_MS = 7000

let nextId = 1
let lastSpokeAt = 0
const recent = new Map<LegendId, string[]>()

/**
 * Makes a legend say something for `trigger`. `chance` (0–1) keeps reactions
 * occasional; repeats of the last few lines are avoided.
 */
export function legendSay(legend: Legend, trigger: QuoteTrigger, chance = 1): void {
  const priority = PRIORITY.has(trigger)
  const now = Date.now()
  if (!priority && (Math.random() > chance || now - lastSpokeAt < COOLDOWN_MS)) return
  const pool = legend.quotes[trigger]
  if (pool.length === 0) return
  const used = recent.get(legend.id) ?? []
  const fresh = pool.filter((q) => !used.includes(q))
  const options = fresh.length > 0 ? fresh : pool
  const text = options[Math.floor(Math.random() * options.length)] ?? pool[0] ?? ''
  recent.set(legend.id, [...used, text].slice(-6))
  lastSpokeAt = now
  dialogueStore.set({ id: nextId++, legendId: legend.id, trigger, text })
}

export function clearDialogue(id?: number): void {
  dialogueStore.set((current) => (current && (id === undefined || current.id === id) ? null : current))
}
