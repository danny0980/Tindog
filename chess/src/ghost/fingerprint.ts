// Ghost of Yourself: a style fingerprint built from your own saved games.
// Your openings become its repertoire, your habits (captures, checks, pawn
// storms, early castling…) pick the playing style, and your rating and
// accuracy set its strength. Pure and unit-tested; ghostPersona() turns it
// into an opponent the normal AI plays.
import { Chess } from 'chess.js'
import type { ArchetypeId } from '../types/campaign'
import type { Color } from '../types/chess'
import type { MatchRecord } from '../types/profile'

/** Plies of each game kept as opening book (both sides' moves, from the start). */
export const BOOK_PLIES = 12
/** Games needed before the ghost is a fair copy. */
export const MIN_GAMES = 5

export interface StyleStats {
  /** Share of your moves that capture / give check / push a pawn / move the queen in the first 10 moves. */
  captures: number
  checks: number
  pawnMoves: number
  earlyQueen: number
  /** Share of your games where you castled, and how early (average move number). */
  castled: number
  castleMove: number
  /** Share of your castles that went kingside. */
  kingside: number
  /** Your average accuracy (analysed games), or null. */
  accuracy: number | null
  /** Your results in these games (0–1). */
  score: number
}

export interface Fingerprint {
  games: number
  stats: StyleStats
  /** Opening lines (space-separated SAN from the start), per colour you played. */
  repertoire: { w: string[]; b: string[] }
  /** The playing style these habits look like. */
  archetype: ArchetypeId
  elo: number
}

type Game = Pick<MatchRecord, 'pgn' | 'humanColor' | 'outcome' | 'accuracy' | 'variant'>

/** The SAN moves of a saved game (empty when it can't be replayed as plain chess). */
export function gameMoves(pgn: string): string[] {
  if (!pgn) return []
  try {
    const c = new Chess()
    c.loadPgn(pgn)
    return c.history()
  } catch {
    return []
  }
}

/** Which archetype a set of habits looks most like. */
export function archetypeFor(s: StyleStats): ArchetypeId {
  const aggression = s.captures * 1.2 + s.checks * 2
  if (s.checks > 0.09 && s.captures > 0.22) return 'berserker'
  if (s.castled > 0.8 && s.castleMove <= 8 && aggression < 0.32) return 'fortifier'
  if (s.earlyQueen > 0.12) return 'trickster'
  if (s.accuracy !== null && s.accuracy >= 85) return 'calculator'
  if (s.pawnMoves > 0.42) return 'warlord'
  if (aggression > 0.36) return 'gambiteer'
  if (s.castled < 0.4) return 'maverick'
  return 'sniper'
}

export function fingerprint(matches: readonly Game[], elo: number): Fingerprint {
  const usable = matches.filter((m) => m.humanColor !== null && !m.variant?.length)
  const lines: Record<Color, string[]> = { w: [], b: [] }
  let mine = 0
  let captures = 0
  let checks = 0
  let pawnMoves = 0
  let earlyQueen = 0
  let openingMoves = 0
  let castledGames = 0
  let castleMoveSum = 0
  let kingside = 0
  let score = 0
  let accSum = 0
  let accN = 0
  let games = 0
  for (const m of usable) {
    const moves = gameMoves(m.pgn)
    if (moves.length < 4 || !m.humanColor) continue
    games += 1
    const color = m.humanColor
    lines[color].push(moves.slice(0, BOOK_PLIES).join(' '))
    let castledAt = 0
    moves.forEach((san, ply) => {
      if ((ply % 2 === 0 ? 'w' : 'b') !== color) return
      mine += 1
      const moveNo = Math.floor(ply / 2) + 1
      if (san.includes('x')) captures += 1
      if (san.includes('+') || san.includes('#')) checks += 1
      if (/^[a-h]/.test(san)) pawnMoves += 1
      if (moveNo <= 10) {
        openingMoves += 1
        if (san.startsWith('Q')) earlyQueen += 1
      }
      if (san.startsWith('O-O') && !castledAt) {
        castledAt = moveNo
        if (!san.startsWith('O-O-O')) kingside += 1
      }
    })
    if (castledAt) {
      castledGames += 1
      castleMoveSum += castledAt
    }
    score += m.outcome === 'win' ? 1 : m.outcome === 'draw' ? 0.5 : 0
    if (typeof m.accuracy === 'number') {
      accSum += m.accuracy
      accN += 1
    }
  }
  const per = (n: number, d: number) => (d > 0 ? n / d : 0)
  const stats: StyleStats = {
    captures: per(captures, mine),
    checks: per(checks, mine),
    pawnMoves: per(pawnMoves, mine),
    earlyQueen: per(earlyQueen, openingMoves),
    castled: per(castledGames, games),
    castleMove: castledGames ? castleMoveSum / castledGames : 0,
    kingside: per(kingside, castledGames),
    accuracy: accN ? accSum / accN : null,
    score: per(score, games),
  }
  // Most-played lines first, without duplicates.
  const rank = (xs: string[]) => {
    const counts = new Map<string, number>()
    for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x)
  }
  return { games, stats, repertoire: { w: rank(lines.w), b: rank(lines.b) }, archetype: archetypeFor(stats), elo }
}

/** Your habits as 0–100 bars for the radar on the ghost card. */
export function radar(f: Fingerprint): Array<{ label: string; value: number }> {
  const s = f.stats
  const pct = (v: number, full: number) => Math.round(Math.max(0, Math.min(1, v / full)) * 100)
  return [
    { label: 'Aggression', value: pct(s.captures + s.checks * 2, 0.5) },
    { label: 'Checks', value: pct(s.checks, 0.15) },
    { label: 'Pawn play', value: pct(s.pawnMoves, 0.55) },
    { label: 'Early queen', value: pct(s.earlyQueen, 0.25) },
    { label: 'King safety', value: pct(s.castled * (s.castleMove ? Math.max(0.3, 1 - (s.castleMove - 5) / 15) : 0), 1) },
    { label: 'Accuracy', value: s.accuracy === null ? 50 : Math.round(s.accuracy) },
  ]
}
