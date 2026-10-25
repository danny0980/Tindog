// "Beat my position": a position from one of your games, sent to a friend as a
// link. The link carries the position and who set it; the friend plays it out
// against Stockfish from the winner's side. Pure and unit-tested.
import { Chess } from 'chess.js'
import type { MatchRecord } from '../types/profile'

export interface PositionChallenge {
  fen: string
  /** Who sent it. */
  from: string
  /** What they did from here ("won in 12 moves"). */
  note: string
}

const toBase64Url = (s: string): string => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromBase64Url = (s: string): string => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export function encodeChallenge(c: PositionChallenge): string {
  return toBase64Url(JSON.stringify([c.fen, c.from.slice(0, 24), c.note.slice(0, 60)]))
}

/** The challenge in a link, if it is a valid, playable position. */
export function decodeChallenge(code: string | null): PositionChallenge | null {
  if (!code || code.length > 400) return null
  try {
    const [fen, from, note] = JSON.parse(fromBase64Url(code)) as unknown[]
    if (typeof fen !== 'string' || typeof from !== 'string' || typeof note !== 'string') return null
    const chess = new Chess(fen)
    if (chess.isGameOver()) return null
    return { fen: chess.fen(), from: from.slice(0, 24), note: note.slice(0, 60) }
  } catch {
    return null
  }
}

/** A position worth sharing from a game you won: twelve moves before the end. */
export function challengeFrom(match: MatchRecord, playerName: string): PositionChallenge | null {
  if (match.outcome !== 'win' || !match.humanColor) return null
  const chess = new Chess()
  try {
    chess.loadPgn(match.pgn)
  } catch {
    return null
  }
  const history = chess.history({ verbose: true })
  // Start on one of your own moves, about twelve of them before the end.
  let i = Math.max(0, history.length - 24)
  while (i < history.length && history[i]!.color !== match.humanColor) i += 1
  const move = history[i]
  if (!move) return null
  const left = Math.ceil((history.length - i) / 2)
  return { fen: move.before, from: playerName || 'A friend', note: `won from here in ${left} move${left === 1 ? '' : 's'}` }
}

export const challengeLink = (c: PositionChallenge, origin: string): string => `${origin}/?challenge=${encodeChallenge(c)}`
