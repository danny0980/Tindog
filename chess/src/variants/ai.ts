// How the computer plays the variants. Stockfish only knows standard chess
// (plus Chess960 castling), so it proposes candidate moves and this layer
// judges them by the variant's own goals: take a variant win when there is
// one, never hand you one, and in Three-Check reach for checks.
import type { VMove, VariantGame } from './rules'

export interface Candidate {
  uci: string
  /** Engine score from the mover's point of view (centipawns; mates as ±10000). */
  cp: number
}

/** Whether, after `move`, the opponent can win at once. */
function givesAwayWin(game: VariantGame, move: VMove): boolean {
  const after = game.clone()
  after.play(move)
  if (after.result) return false
  return after.legalMoves().some((reply) => after.winsAt(reply))
}

function checks(game: VariantGame, move: VMove): boolean {
  const after = game.clone()
  after.play(move)
  return after.inCheck
}

/**
 * Picks the computer's move. `candidates` are Stockfish's lines, best first;
 * `tolerance` (cp) lets weaker levels choose among near-equal moves at random.
 */
export function chooseVariantMove(game: VariantGame, candidates: readonly Candidate[], tolerance = 0, random: () => number = Math.random): VMove | null {
  const legal = game.legalMoves()
  if (legal.length === 0) return null

  // 1. A win on the spot (mate, the hill, the third check) is always taken.
  const win = legal.find((m) => game.winsAt(m))
  if (win) return win

  const scored = candidates
    .map((c) => ({ move: game.find({ from: c.uci.slice(0, 2), to: c.uci.slice(2, 4), promotion: c.uci[4] }), cp: c.cp }))
    .filter((c): c is { move: VMove; cp: number } => c.move !== null)

  // 2. Never hand the opponent a variant win if anything else is possible.
  const variantRules = game.variant !== 'chess960'
  let safe = variantRules ? scored.filter((c) => !givesAwayWin(game, c.move)) : scored
  if (safe.length === 0 && variantRules) {
    // All the engine's ideas lose at once: look at every legal move for one that doesn't.
    const rescue = legal.find((m) => !givesAwayWin(game, m))
    if (rescue) return rescue
    safe = scored
  }
  if (safe.length === 0) return legal[Math.floor(random() * legal.length)] ?? null

  const best = Math.max(...safe.map((c) => c.cp))
  // 3. Three-Check: a check that costs little is worth more than the engine thinks.
  if (game.variant === 'threecheck') {
    const checking = safe.filter((c) => c.cp >= best - 120 && checks(game, c.move))
    if (checking.length > 0) return checking.sort((a, b) => b.cp - a.cp)[0]!.move
  }
  const near = safe.filter((c) => c.cp >= best - tolerance)
  return near[Math.floor(random() * near.length)]?.move ?? safe[0]!.move
}
