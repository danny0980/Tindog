// Replays for the online game history: any finished game, rebuilt to any
// move with the same rules code that played it. Pure, so it is unit-tested.
import { Chess, type Square } from 'chess.js'
import { CARD_IDS, CardGame, type CardId } from '../../cards/cardGame'
import { type RoyaleGame } from '../../royale/royale'
import type { HistoryGame } from './api'
import { parseRoyaleAction } from './modeProtocol'
import { applyCardAction, parseCardNotation, replayRoyale } from './modeRules'

export type ReplayFrame =
  | { kind: 'board'; fen: string; lastMove: { from: Square; to: Square } | null; ply: number; total: number; moves: string[] }
  | { kind: 'royale'; game: RoyaleGame; ply: number; total: number }
  /** A game recorded without its moves (Battle Royale before 6.16), or one that no longer replays. */
  | { kind: 'none'; reason: string }

const isHand = (v: unknown): v is CardId[] => Array.isArray(v) && v.every((c) => typeof c === 'string' && (CARD_IDS as string[]).includes(c))

/** How many moves (plies) the game has. */
export function replayLength(game: HistoryGame): number {
  return game.kind === 'royale' ? (game.actions?.length ?? 0) : game.moves.length
}

/** The game as it stood after `ply` moves (clamped to the game's length). */
export function replayAt(game: HistoryGame, ply: number): ReplayFrame {
  const total = replayLength(game)
  const n = Math.max(0, Math.min(total, Math.floor(ply)))
  if (game.kind === 'royale') {
    if (!game.actions) return { kind: 'none', reason: 'This battle was played before replays were recorded.' }
    const actions = game.actions.slice(0, n).map(parseRoyaleAction)
    if (!actions.every((a) => a !== null)) return { kind: 'none', reason: 'This battle’s record is damaged.' }
    const g = replayRoyale(actions)
    return g ? { kind: 'royale', game: g, ply: n, total } : { kind: 'none', reason: 'This battle no longer replays.' }
  }
  if (game.kind === 'cards') {
    const hands = game.hands
    if (!hands || !isHand(hands.w) || !isHand(hands.b)) return { kind: 'none', reason: 'This game was played before replays were recorded.' }
    const cg = new CardGame({ w: hands.w, b: hands.b })
    for (const text of game.moves.slice(0, n)) {
      const a = parseCardNotation(text)
      if (!a || !applyCardAction(cg, a)) return { kind: 'none', reason: 'This game no longer replays.' }
    }
    return { kind: 'board', fen: cg.fen, lastMove: cg.lastMove, ply: n, total, moves: [...cg.sans] }
  }
  // Ranked and Vanishing Chess: ordinary chess.
  const chess = new Chess()
  let lastMove: { from: Square; to: Square } | null = null
  const sans: string[] = []
  for (const uci of game.moves.slice(0, n)) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci[4] } : {}) })
      lastMove = { from: m.from, to: m.to }
      sans.push(m.san)
    } catch {
      return { kind: 'none', reason: 'This game no longer replays.' }
    }
  }
  return { kind: 'board', fen: chess.fen(), lastMove, ply: n, total, moves: sans }
}
