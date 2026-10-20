// Historical Escape Rooms: five rooms from history, each sealed by four
// locks. Every lock is a forced-mate puzzle (from the verified puzzle set);
// opening it reveals an inscription — a true fact from the history behind
// the room's character. The story around it is a game, the facts are not.
// Rooms open one after another. Pure and unit-tested.
import { Chess } from 'chess.js'
import { loreFor } from '../data/classic/lore'
import { PUZZLES } from '../data/puzzles'
import type { BoardThemeId } from '../types/theme'
import type { Puzzle } from '../types/puzzle'

export interface EscapeRoom {
  id: string
  name: string
  /** The Classic character whose history the inscriptions come from. */
  character: string
  theme: BoardThemeId
  /** The setting (fiction, framed as such in the app). */
  intro: string
  /** Which puzzles seal it: mates in 2 for the first three rooms, mates in 3 after. */
  mateIn: 2 | 3
  /** Index of this room's first puzzle among the puzzles of that length. */
  first: number
}

export const LOCKS = 4

export const ROOMS: readonly EscapeRoom[] = [
  { id: 'boy-king', name: 'The Tomb of the Boy King', character: 'tutankhamun', theme: 'papyrus-gold', intro: 'The torch gutters. The stone door of the burial chamber has slid shut behind you, and four seals bar the way out.', mateIn: 2, first: 0 },
  { id: 'eureka', name: 'The Workshop of Archimedes', character: 'archimedes', theme: 'royal-gold', intro: 'Syracuse is under siege, and the old inventor’s workshop has locked itself: four mechanisms, each guarded by a puzzle.', mateIn: 2, first: LOCKS },
  { id: 'white-tower', name: 'The White Tower', character: 'william-conqueror', theme: 'rune-oak', intro: 'Locked in the Conqueror’s new stone keep, you hear the guards change below. Four iron locks stand between you and the river gate.', mateIn: 2, first: LOCKS * 2 },
  { id: 'mirror-script', name: 'The Studio of Leonardo', character: 'leonardo', theme: 'blueprint', intro: 'Every note in this studio is written backwards. The door is held by four of the master’s puzzle locks.', mateIn: 3, first: 0 },
  { id: 'tesla-lab', name: 'The Laboratory of Tesla', character: 'tesla', theme: 'oled-black', intro: 'The coils hum and the lab door is sealed by four circuits. Close each one with a forced mate before the current runs out.', mateIn: 3, first: LOCKS },
]

export const getRoom = (id: string): EscapeRoom | null => ROOMS.find((r) => r.id === id) ?? null

/** The four puzzles that seal a room. */
export function roomPuzzles(room: EscapeRoom): Puzzle[] {
  return PUZZLES.filter((p) => p.mateIn === room.mateIn).slice(room.first, room.first + LOCKS)
}

/** The inscription behind each lock: three true facts, then the character's dates as the door opens. */
export function inscription(room: EscapeRoom, lock: number): string {
  const lore = loreFor(room.character)
  if (!lore) return ''
  return lock < lore.facts.length ? lore.facts[lock]! : `Carved over the door: ${lore.lived}. ${lore.bio.split('. ')[0]}.`
}

/** A room opens once the one before it has been escaped. */
export const roomOpen = (index: number, escaped: ReadonlySet<string>): boolean => index === 0 || escaped.has(ROOMS[index - 1]?.id ?? '')

export interface EscapeRun {
  roomId: string
  lock: number
  /** Index into the current puzzle's solution (even = your move). */
  step: number
  mistakes: number
  hints: number
  startedAt: number
}

export type AttemptOutcome = { kind: 'wrong' } | { kind: 'correct'; reply: string } | { kind: 'lock-open'; lock: number } | { kind: 'escaped' }

export function startRun(roomId: string, now: number): EscapeRun {
  return { roomId, lock: 0, step: 0, mistakes: 0, hints: 0, startedAt: now }
}

const playUci = (chess: Chess, uci: string) => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) })

/** The position on the board now. */
export function runFen(run: EscapeRun): string | null {
  const room = getRoom(run.roomId)
  const puzzle = room ? roomPuzzles(room)[run.lock] : undefined
  if (!puzzle) return null
  const chess = new Chess(puzzle.fen)
  for (const uci of puzzle.solution.slice(0, run.step)) playUci(chess, uci)
  return chess.fen()
}

/**
 * Your move. The solution's move is right; on the final move any mate is
 * right too. A right move brings the defender's reply, or opens the lock.
 */
export function attempt(run: EscapeRun, uci: string): { run: EscapeRun; outcome: AttemptOutcome } {
  const room = getRoom(run.roomId)
  const puzzle = room ? roomPuzzles(room)[run.lock] : undefined
  const fen = runFen(run)
  if (!room || !puzzle || !fen) return { run, outcome: { kind: 'wrong' } }
  const last = run.step >= puzzle.solution.length - 1
  let ok = uci === puzzle.solution[run.step]
  if (!ok && last) {
    try {
      const chess = new Chess(fen)
      playUci(chess, uci)
      ok = chess.isCheckmate()
    } catch {
      ok = false
    }
  }
  if (!ok) return { run: { ...run, mistakes: run.mistakes + 1 }, outcome: { kind: 'wrong' } }
  if (!last) return { run: { ...run, step: run.step + 2 }, outcome: { kind: 'correct', reply: puzzle.solution[run.step + 1]! } }
  if (run.lock + 1 >= LOCKS) return { run: { ...run, step: run.step + 1 }, outcome: { kind: 'escaped' } }
  return { run: { ...run, lock: run.lock + 1, step: 0 }, outcome: { kind: 'lock-open', lock: run.lock } }
}

/** The square to look at (a hint costs as much as a mistake). */
export function hint(run: EscapeRun): { run: EscapeRun; from: string | null } {
  const room = getRoom(run.roomId)
  const puzzle = room ? roomPuzzles(room)[run.lock] : undefined
  const next = puzzle?.solution[run.step]
  return { run: { ...run, hints: run.hints + 1 }, from: next ? next.slice(0, 2) : null }
}

/** Stars for an escape: 3 clean, 2 with a slip or two, 1 otherwise. */
export const starsFor = (run: EscapeRun): number => {
  const slips = run.mistakes + run.hints
  return slips === 0 ? 3 : slips <= 2 ? 2 : 1
}
