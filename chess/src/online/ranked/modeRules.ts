// Replaying the online modes' action logs. The server (the referee) and the
// browser both run exactly this, on the same rules code, so a log always
// means the same position on both sides.
import { CardGame, type CardId } from '../../cards/cardGame'
import { PLAYERS, type PlayerId, RoyaleGame, SIZE } from '../../royale/royale'
import type { Color, Square } from '../../types/chess'
import type { CardAction, RoyaleAction } from './modeProtocol'

/** Applies one Card Chess action. False (and nothing changes) when it isn't legal now. */
export function applyCardAction(game: CardGame, action: CardAction): boolean {
  switch (action.k) {
    case 'm':
      return game.play({ from: action.uci.slice(0, 2), to: action.uci.slice(2, 4), ...(action.uci.length > 4 ? { promotion: action.uci[4] } : {}) })
    case 'c':
      return game.playCard({ card: action.card, from: action.from as Square | null, to: action.to as Square, label: '' })
    case 'w':
      return game.ward(action.card, action.sq as Square)
  }
}

/** A Card Chess game rebuilt from the hands and its log (null if the log doesn't replay). */
export function replayCards(hands: Record<Color, CardId[]>, actions: readonly CardAction[]): CardGame | null {
  const game = new CardGame(hands)
  for (const a of actions) if (!applyCardAction(game, a)) return null
  return game
}

/** Does this action end the player's turn? (A ward is a free action.) */
export const endsTurn = (action: CardAction): boolean => action.k !== 'w'

export const seatPlayer = (seat: number): PlayerId => PLAYERS[seat] ?? 'red'
export const playerSeat = (p: PlayerId): number => PLAYERS.indexOf(p)

/** Applies one Battle Royale log entry. */
export function applyRoyaleAction(game: RoyaleGame, action: RoyaleAction): boolean {
  if (action.k === 'x') {
    const p = seatPlayer(action.seat)
    if (!game.alive(p) || game.result) return false
    game.resign(p)
    return true
  }
  return game.play({ from: action.from, to: action.to })
}

export function replayRoyale(actions: readonly RoyaleAction[]): RoyaleGame | null {
  const game = new RoyaleGame()
  for (const a of actions) if (!applyRoyaleAction(game, a)) return null
  return game
}

/**
 * Where a cell you see on screen is on the board, for the player in `seat`:
 * the board turns so your army is always at the bottom (red sits there
 * already; blue's side is the left, yellow's the top, green's the right).
 */
export function viewToBoard(row: number, col: number, seat: number): [number, number] {
  let r = row
  let c = col
  for (let i = 0; i < ((seat % 4) + 4) % 4; i++) [r, c] = [c, SIZE - 1 - r]
  return [r, c]
}
