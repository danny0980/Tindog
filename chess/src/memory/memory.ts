// Opponents who remember you. Every character keeps a record of your games
// together (wins, losses, streaks, the opening that beat them); it shapes
// what they say when you meet again and nudges their strength after a run
// of results. Pure and unit-tested.
import { rescaleProfile } from '../data/campaign/archetypes'
import type { Outcome } from '../types/chess'
import type { Persona } from '../types/persona'

export interface OpponentMemory {
  games: number
  /** Your wins, losses and draws against them. */
  wins: number
  losses: number
  draws: number
  /** Positive: your current winning streak against them; negative: theirs. */
  streak: number
  last: Outcome
  /** The opening of the last game, if it had a name. */
  lastOpening: string | null
  lastDate: string
}

export type MemoryBook = Readonly<Record<string, OpponentMemory>>

/** Most opponents remembered (the least recent are forgotten first). */
export const MAX_MEMORIES = 300
/** The most a run of results can move an opponent's strength. */
export const MAX_SHIFT = 160

export function remember(book: MemoryBook, key: string, outcome: Outcome, opening: string | null, date: string): MemoryBook {
  const prev = book[key]
  const streak = outcome === 'draw' ? 0 : outcome === 'win' ? Math.max(0, prev?.streak ?? 0) + 1 : Math.min(0, prev?.streak ?? 0) - 1
  const next: OpponentMemory = {
    games: (prev?.games ?? 0) + 1,
    wins: (prev?.wins ?? 0) + (outcome === 'win' ? 1 : 0),
    losses: (prev?.losses ?? 0) + (outcome === 'loss' ? 1 : 0),
    draws: (prev?.draws ?? 0) + (outcome === 'draw' ? 1 : 0),
    streak,
    last: outcome,
    lastOpening: opening,
    lastDate: date,
  }
  const entries = Object.entries({ ...book, [key]: next })
  if (entries.length <= MAX_MEMORIES) return Object.fromEntries(entries)
  return Object.fromEntries(entries.sort((a, b) => b[1].lastDate.localeCompare(a[1].lastDate)).slice(0, MAX_MEMORIES))
}

/** How much stronger (or gentler) they play after a run of results. */
export function memoryShift(m: OpponentMemory | undefined): number {
  if (!m) return 0
  if (m.streak >= 2) return Math.min(MAX_SHIFT, 40 * (m.streak - 1))
  if (m.streak <= -3) return -Math.min(MAX_SHIFT, 40 * (-m.streak - 2))
  return 0
}

const tally = (m: OpponentMemory): string => `${m.wins} win${m.wins === 1 ? '' : 's'} for you, ${m.losses} for me${m.draws ? `, ${m.draws} drawn` : ''}`

/** Their greeting, given what happened before (null on a first meeting). */
export function memoryIntro(m: OpponentMemory | undefined): string | null {
  if (!m) return null
  const lead = m.games >= 4 ? `Game ${m.games + 1} between us: ${tally(m)}. ` : ''
  if (m.streak >= 2) return `${lead}${m.streak} wins in a row against me. That ends today.`
  if (m.streak <= -3) return `${lead}${-m.streak} in a row for me. I will go easy on you… no, I will not.`
  if (m.last === 'win') return `${lead}You beat me last time${m.lastOpening ? ` with the ${m.lastOpening}` : ''}. I have thought about it ever since.`
  if (m.last === 'loss') return `${lead}Back for more? Last time did not go well for you.`
  return `${lead}Our last game was a draw. Let us settle it.`
}

/** A character who remembers you: the greeting, the parting words and their strength follow your history. */
export function withMemory(p: Persona, m: OpponentMemory | undefined): Persona {
  if (!m) return p
  const intro = memoryIntro(m)
  const shift = memoryShift(m)
  return {
    ...p,
    profile: shift === 0 ? p.profile : rescaleProfile(p.profile, p.elo + shift),
    quotes: {
      ...p.quotes,
      ...(intro ? { intro: [intro] } : {}),
      legendLoses: [`That makes ${m.wins + 1} wins for you against me. I will remember this.`, ...p.quotes.legendLoses],
      legendWins: [`${m.losses + 1} for me now. You know where to find me.`, ...p.quotes.legendWins],
    },
  }
}

const OUTCOMES: readonly Outcome[] = ['win', 'loss', 'draw']
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0)

export function sanitizeMemory(raw: unknown): MemoryBook {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, OpponentMemory> = {}
  for (const [key, v] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_MEMORIES)) {
    if (!/^[\w:.-]{1,80}$/.test(key) || typeof v !== 'object' || v === null) continue
    const r = v as Record<string, unknown>
    const last = OUTCOMES.find((o) => o === r.last)
    if (!last) continue
    const streak = typeof r.streak === 'number' && Number.isFinite(r.streak) ? Math.max(-99, Math.min(99, Math.trunc(r.streak))) : 0
    out[key] = {
      games: n(r.games),
      wins: n(r.wins),
      losses: n(r.losses),
      draws: n(r.draws),
      streak,
      last,
      lastOpening: typeof r.lastOpening === 'string' ? r.lastOpening.slice(0, 80) : null,
      lastDate: typeof r.lastDate === 'string' ? r.lastDate.slice(0, 40) : '',
    }
  }
  return out
}
