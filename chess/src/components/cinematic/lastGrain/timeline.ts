// "The Last Grain" — the 15 s startup film. Everything on screen is a pure
// function of the film time t (seconds), so the film can be skipped, seeked,
// paused with the tab and captured frame by frame with identical results.
//
//  Shot 1  0.0–2.2   a golden grain falls and strikes the obsidian board
//  Shot 2  2.2–5.0   its light races along the seams, waking five era pieces
//  Shot 3  5.0–7.8   orbit around the queen as molten gold cracks open her body
//  Shot 4  7.8–10.4  match cut to the king's cross; the last grain lands; time freezes
//  Shot 5  10.4–12.8 the frozen grains assemble the title; a light ray locks it
//  Shot 6  12.8–15.0 the board becomes frosted glass; the live menu rises

export const FILM_LENGTH = 15
export type ShotId = 1 | 2 | 3 | 4 | 5 | 6

export const SHOTS: ReadonlyArray<{ id: ShotId; start: number; end: number; name: string }> = [
  { id: 1, start: 0, end: 2.2, name: 'The first grain' },
  { id: 2, start: 2.2, end: 5, name: 'Light runs through the ages' },
  { id: 3, start: 5, end: 7.8, name: 'The queen wakes' },
  { id: 4, start: 7.8, end: 10.4, name: 'The king and the frozen second' },
  { id: 5, start: 10.4, end: 12.8, name: 'Time writes the name' },
  { id: 6, start: 12.8, end: 15, name: 'Your move' },
]

/** Key moments (seconds) — the score and the picture both hang on these. */
export const T = {
  impact: 0.95,
  seamEnter: 1.6,
  ignite: [3.0, 3.4, 3.8, 4.2, 4.6] as const,
  crackStart: 5.0,
  crackFull: 6.8,
  crownStart: 6.4,
  flare: 7.0,
  matchCut: 7.8,
  lastGrainDrop: 9.0,
  freeze: 9.6,
  restart: 10.4,
  lettersStart: 10.5,
  letterStep: 0.15,
  letterTravel: 0.75,
  tagline: 11.6,
  lock: 12.2,
  menu: 12.8,
  chips: [13.0, 13.4, 13.8] as const,
  tapToBegin: 14.2,
  /** Skip lands here: the title and the menu, with the world still moving. */
  skipTo: 12.8,
  /** Skip becomes available after one second. */
  skipAfter: 1,
} as const

export const TITLE = 'CHRONOS'
export const TAGLINE = 'CHESS ARENA · AAA EDITION'

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
/** 0 → 1 as t runs from a to b. */
export const progress = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a))
export const easeInOut = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
export const easeOut = (x: number): number => 1 - (1 - x) ** 3
export const easeIn = (x: number): number => x * x * x
/** Overshoots a little and settles: letters landing with weight. */
export const easeOutBack = (x: number): number => {
  const c = 1.4
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
}

export const shotAt = (t: number): ShotId => (SHOTS.find((s) => t < s.end)?.id ?? 6)

/**
 * World time for the particles: it runs with the film, stops dead at the
 * freeze (9.6 s), and restarts at 10.4 s — so embers hang in the air while
 * the camera keeps drifting.
 */
export function worldTime(t: number): number {
  if (t < T.freeze) return t
  if (t < T.restart) return T.freeze
  return t - (T.restart - T.freeze)
}

/** 0 → 1 → 0 strength of the freeze look (desaturation, crisp particles). */
export const freezeAmount = (t: number): number => (t < T.freeze || t > T.restart + 0.3 ? 0 : t < T.restart ? 1 : 1 - (t - T.restart) / 0.3)

/** When letter i of the title lands (arrival of its particles). */
export const letterLands = (i: number): number => T.lettersStart + i * T.letterStep + T.letterTravel

/**
 * Position of the running light along the z = 2 seam (x), by time: it gathers
 * pace after the impact, then runs at a steady 2.5 squares a second so it
 * reaches each era piece exactly as that piece ignites, and stops at the queen.
 */
export function lightX(t: number): number {
  if (t <= T.seamEnter) return -3.5
  if (t < 3) return -3.5 + easeIn((t - T.seamEnter) / (3 - T.seamEnter))
  if (t < 5) return -2.5 + 2.5 * (t - 3)
  return 2.5
}

/** Events the score and the overlay react to, in film order. */
export type CueKind = 'drone' | 'impact' | 'ostinato' | 'ignite' | 'riser' | 'queen' | 'flare' | 'reverse' | 'freeze' | 'restart' | 'letter' | 'lock' | 'chip' | 'resolve' | 'ambient'
export interface Cue {
  at: number
  kind: CueKind
  index?: number
}

export const CUES: readonly Cue[] = ([
  { at: 0, kind: 'drone' },
  { at: T.impact, kind: 'impact' },
  { at: 2.2, kind: 'ostinato' },
  ...T.ignite.map((at, index): Cue => ({ at, kind: 'ignite', index })),
  { at: 4.0, kind: 'riser' },
  { at: T.crackStart, kind: 'queen' },
  { at: T.flare, kind: 'flare' },
  { at: T.flare + 0.05, kind: 'reverse' },
  { at: T.freeze, kind: 'freeze' },
  { at: T.restart - 0.5, kind: 'restart' },
  ...Array.from(TITLE, (_, index): Cue => ({ at: letterLands(index), kind: 'letter', index })),
  { at: T.lock, kind: 'lock' },
  ...T.chips.map((at, index): Cue => ({ at, kind: 'chip', index })),
  { at: T.tapToBegin, kind: 'resolve' },
  { at: FILM_LENGTH - 0.2, kind: 'ambient' },
] satisfies Cue[]).sort((a, b) => a.at - b.at)

/** Cues in (from, to] — what the frame loop fires between two frames. */
export const cuesBetween = (from: number, to: number): Cue[] => CUES.filter((c) => c.at > from && c.at <= to)
