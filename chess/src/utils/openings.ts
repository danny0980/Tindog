import { Chess } from 'chess.js'
import { OPENINGS } from '../data/openings'
import type { Move } from '../types/chess'
import type { DetectedOpening, OpeningEntry } from '../types/opening'

/** Placement + side to move + castling rights: enough to identify a book position. */
const positionKey = (fen: string): string => fen.split(' ').slice(0, 3).join(' ')

let index: Map<string, OpeningEntry> | null = null

function buildIndex(): Map<string, OpeningEntry> {
  const map = new Map<string, OpeningEntry>()
  for (const entry of OPENINGS) {
    const chess = new Chess()
    let valid = true
    for (const san of entry.moves.split(' ')) {
      try {
        chess.move(san)
      } catch {
        valid = false
        break
      }
    }
    if (!valid) continue
    const key = positionKey(chess.fen())
    const existing = map.get(key)
    // Prefer the more specific (longer) line when two names share a position.
    if (!existing || existing.moves.length < entry.moves.length) map.set(key, entry)
  }
  return map
}

/** Finds the deepest book position reached in the game (handles transpositions). */
export function detectOpening(history: readonly Move[]): DetectedOpening | null {
  index ??= buildIndex()
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const move = history[i]
    if (!move) continue
    const entry = index.get(positionKey(move.after))
    if (entry) return { ...entry, ply: i + 1 }
  }
  return null
}

/** Number of plies from the start that stay inside the opening book. */
export function bookDepth(history: readonly Move[]): number {
  index ??= buildIndex()
  let depth = 0
  for (let i = 0; i < history.length; i += 1) {
    const move = history[i]
    if (move && index.has(positionKey(move.after))) depth = i + 1
    else break
  }
  return depth
}
