// What-If sandbox: fork the game at any move and try other ideas. A sandbox
// holds several lines (branches) from the same root position, each with a
// cursor you can step back and forth; playing a new move mid-line rewrites
// the rest of that line. Pure and unit-tested.
import { Chess } from 'chess.js'

export interface Line {
  /** UCI moves from the root. */
  moves: string[]
  /** How many of them are on the board. */
  cursor: number
}

export interface Sandbox {
  rootFen: string
  /** The game ply the sandbox forked from (0 = the start). */
  rootPly: number
  lines: Line[]
  active: number
}

export const MAX_LINES = 6

export function openSandbox(rootFen: string, rootPly: number): Sandbox {
  return { rootFen, rootPly, lines: [{ moves: [], cursor: 0 }], active: 0 }
}

const current = (s: Sandbox): Line => s.lines[s.active] ?? { moves: [], cursor: 0 }

function replay(fen: string, moves: readonly string[]): Chess | null {
  try {
    const c = new Chess(fen)
    for (const uci of moves) c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) })
    return c
  } catch {
    return null
  }
}

/** The position on the sandbox board. */
export function sandboxFen(s: Sandbox): string {
  const line = current(s)
  return replay(s.rootFen, line.moves.slice(0, line.cursor))?.fen() ?? s.rootFen
}

/** SAN of the active line (all of it, the cursor marks how far the board is). */
export function lineSan(s: Sandbox, index = s.active): string[] {
  const line = s.lines[index]
  if (!line) return []
  const c = new Chess(s.rootFen)
  const out: string[] = []
  for (const uci of line.moves) {
    try {
      out.push(c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) }).san)
    } catch {
      break
    }
  }
  return out
}

/** Plays a move on the sandbox board; null if it is illegal there. */
export function playMove(s: Sandbox, uci: string): Sandbox | null {
  const line = current(s)
  const board = replay(s.rootFen, line.moves.slice(0, line.cursor))
  if (!board) return null
  try {
    board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) })
  } catch {
    return null
  }
  // Same as the next move of the line: just step forward. Otherwise the rest of the line is rewritten.
  const moves = line.moves[line.cursor] === uci ? line.moves : [...line.moves.slice(0, line.cursor), uci]
  return withLine(s, { moves, cursor: line.cursor + 1 })
}

const withLine = (s: Sandbox, line: Line): Sandbox => ({ ...s, lines: s.lines.map((l, i) => (i === s.active ? line : l)) })

export function step(s: Sandbox, delta: number): Sandbox {
  const line = current(s)
  const cursor = Math.max(0, Math.min(line.moves.length, line.cursor + delta))
  return cursor === line.cursor ? s : withLine(s, { ...line, cursor })
}

/** A new, empty branch from the root (the oldest is dropped past MAX_LINES). */
export function newLine(s: Sandbox): Sandbox {
  const lines = [...s.lines, { moves: [], cursor: 0 }].slice(-MAX_LINES)
  return { ...s, lines, active: lines.length - 1 }
}

export const selectLine = (s: Sandbox, index: number): Sandbox => (index >= 0 && index < s.lines.length ? { ...s, active: index } : s)

/** Positions of the real game from the fork onward (for the "what happened" side). */
export function realLine(fens: readonly string[], rootPly: number): string[] {
  return fens.slice(rootPly)
}
