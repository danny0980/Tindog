// Tests for the chess variants: Chess960 start positions and castling, King
// of the Hill, Three-Check, draws, and the computer's variant judgement.
// Run with `npm run test:variants`.
import { chooseVariantMove } from '../src/variants/ai'
import { VariantGame, chess960Rank } from '../src/variants/rules'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const playAll = (g: VariantGame, moves: string[]) => moves.every((m) => g.play(m))

// ── Chess960 positions ──────────────────────────────────────────────────────
check('position 518 is the normal setup', chess960Rank(518) === 'RNBQKBNR')
const ranks = Array.from({ length: 960 }, (_, i) => chess960Rank(i))
check('all 960 positions are different', new Set(ranks).size === 960)
const valid = ranks.every((r) => {
  const b = [...r].flatMap((p, i) => (p === 'B' ? [i % 2] : []))
  const k = r.indexOf('K')
  return b.length === 2 && b[0] !== b[1] && r.indexOf('R') < k && r.lastIndexOf('R') > k && [...r].sort().join('') === 'BBKNNQRR'
})
check('every position has opposite bishops and the king between the rooks', valid)
check('known positions match the standard numbering', chess960Rank(0) === 'BBQNNRKR' && chess960Rank(959) === 'RKRNNQBB')

// ── Chess960 castling ───────────────────────────────────────────────────────
const std = new VariantGame('chess960', 518)
check('the engine sees Shredder-FEN castling rights', std.engineFen().split(' ')[2] === 'HAha')
playAll(std, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'])
check('castling is offered as king onto rook', std.legalMoves().some((m) => m.castle === 'k' && m.uci === 'e1h1'))
check('castling by the king’s landing square works too', std.clone().play({ from: 'e1', to: 'g1' }))
std.play('e1h1')
check('after O-O: king g1, rook f1', std.fen.startsWith('r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b') && std.history.at(-1) === 'O-O')
check('castling uses up both of White’s rights', std.engineFen().split(' ')[2] === 'ha')

// A position where the king does not move when castling: king g1, rook h1.
const id = ranks.findIndex((r) => r.slice(5) === 'NKR')
const still = new VariantGame('chess960', id)
const knightOut = still.legalMoves().find((m) => m.from === 'f1')
check(`position ${id} (${ranks[id]}): the knight can leave f1`, knightOut !== undefined && still.play(knightOut))
still.play('a7a6')
const oo = still.legalMoves().find((m) => m.castle === 'k')
check('castling where only the rook moves', oo !== undefined && still.play(oo) && still.fen.split(' ')[0]?.endsWith('RK1') === true)

const walk = new VariantGame('chess960', 518)
playAll(walk, ['e2e4', 'e7e5', 'e1e2', 'e8e7', 'e2e1', 'e7e8', 'g1f3', 'g8f6', 'f1c4', 'f8c5'])
check('a king that has moved can no longer castle', !walk.legalMoves().some((m) => m.castle))
const rook = new VariantGame('chess960', 518)
playAll(rook, ['h2h4', 'a7a6', 'h1h2', 'a6a5', 'h2h1', 'a5a4', 'b1c3', 'b7b6', 'b2b3', 'c7c6', 'c1b2', 'd7d6', 'd2d3', 'e7e6', 'd1d2', 'f7f6'])
const sides = rook.legalMoves().filter((m) => m.castle).map((m) => m.castle)
check('a rook that moved gives up only its own side', sides.join() === 'q')

// Castling through an attacked square is illegal: a black bishop on a6 sees f1 (b5–c4–d3–e2 are empty).
const through = new VariantGame('chess960', 518)
playAll(through, ['g2g3', 'b7b6', 'g1f3', 'c8a6', 'f1g2', 'g8f6', 'e2e3', 'e7e6'])
check('the king may not castle through an attacked square', through.turn === 'w' && !through.legalMoves().some((m) => m.castle === 'k'))
const control = new VariantGame('chess960', 518)
playAll(control, ['g2g3', 'b7b6', 'g1f3', 'c8b7', 'f1g2', 'g8f6', 'e2e3', 'e7e6'])
check('…while the same castle with f1 unattacked is allowed', control.turn === 'w' && control.legalMoves().some((m) => m.castle === 'k'))

// ── King of the Hill ────────────────────────────────────────────────────────
const hill = VariantGame.fromFen('koth', '8/8/8/8/8/3K4/8/k7 w - - 0 1')
hill.play('d3d4')
check('a king on the hill wins at once (before the bare-kings draw)', hill.result?.winner === 'w' && hill.result.reason === 'hill')
const blocked = VariantGame.fromFen('koth', 'k7/8/8/8/8/3K4/8/7r b - - 0 1')
const pick = chooseVariantMove(blocked, [
  { uci: 'h1h2', cp: 0 },
  { uci: 'h1h4', cp: -10 },
])
check('the computer never lets your king reach the hill', pick?.uci === 'h1h4', pick?.uci)
const greedy = VariantGame.fromFen('koth', 'k7/8/8/8/8/3K4/8/7r w - - 0 1')
check('the computer takes the hill when it can', ['d3d4', 'd3e4'].includes(chooseVariantMove(greedy, [{ uci: 'd3c3', cp: 50 }])?.uci ?? ''))

// ── Three-Check ─────────────────────────────────────────────────────────────
const tc = VariantGame.fromFen('threecheck', '7k/8/6Q1/8/8/8/8/K7 w - - 0 1')
playAll(tc, ['g6e8', 'h8h7', 'e8e7', 'h7g8'])
check('checks are counted', tc.checks.w === 2 && tc.result === null)
tc.play('e7e8')
check('the third check wins', tc.result?.winner === 'w' && tc.result.reason === 'three-checks')
const prefer = VariantGame.fromFen('threecheck', '7k/8/6Q1/8/8/8/8/K7 w - - 0 1')
const choice = chooseVariantMove(prefer, [
  { uci: 'g6g1', cp: 900 },
  { uci: 'g6e8', cp: 850 },
])
check('in Three-Check the computer prefers a cheap check', choice?.uci === 'g6e8', choice?.uci)

// ── Draws and the rest ──────────────────────────────────────────────────────
const rep = new VariantGame('chess960', 518)
playAll(rep, ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'])
check('threefold repetition is tracked across the game', rep.result?.reason === 'threefold')
const mate = new VariantGame('koth')
playAll(mate, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
check('checkmate still wins every variant', mate.result?.winner === 'b' && mate.result.reason === 'checkmate')
check('illegal moves are refused', !new VariantGame('threecheck').play('e2e5'))

console.log(failures === 0 ? '\nAll variant checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
