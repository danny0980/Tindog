// Tests for Phase B, the mind mechanics: Ghost of Yourself, the brain
// visualizer, the predictive coach and the What-If sandbox.
// Run with `npm run test:mind`.
import { Chess } from 'chess.js'
import { DISCARD_MS, EMPTY_BRAIN, brainArrows, formatScore, planSan, pruneBrain, reduceBrain } from '../src/brain/brain'
import { coachProfile, detect, historyNote, isHanging, warningsFor } from '../src/coach/patterns'
import { ghostPersona } from '../src/data/personas'
import { repertoireMove } from '../src/engine/personalities'
import { archetypeFor, fingerprint, gameMoves, radar } from '../src/ghost/fingerprint'
import type { EngineLine } from '../src/types/engine'
import { MAX_LINES, lineSan, newLine, openSandbox, playMove, sandboxFen, selectLine, step } from '../src/whatif/branch'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const pgnOf = (sans: string[]): string => {
  const c = new Chess()
  for (const s of sans) c.move(s)
  return c.pgn()
}
const game = (sans: string[], humanColor: 'w' | 'b', outcome: 'win' | 'loss' | 'draw' = 'win', accuracy: number | null = null) => ({ pgn: pgnOf(sans), humanColor, outcome, accuracy })

// ── Ghost of Yourself ───────────────────────────────────────────────────────
const italian = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+', 'Bd2', 'Bxd2+']
const london = ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'c5', 'c3', 'Nc6', 'Nbd2', 'Bd6']
const sicilianAsBlack = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']
const games = [game(italian, 'w'), game(italian, 'w', 'loss'), game(london, 'w', 'draw'), game(sicilianAsBlack, 'b'), game(sicilianAsBlack, 'b', 'win', 92)]
const f = fingerprint(games, 1450)
check('the ghost learns from every saved game', f.games === 5 && f.elo === 1450)
check('your most-played line comes first in its book', f.repertoire.w[0]?.startsWith('e4 e5 Nf3 Nc6 Bc4') === true && f.repertoire.w.length === 2)
check('the book is kept per colour', f.repertoire.b.length === 1 && f.repertoire.b[0]?.startsWith('e4 c5') === true)
check('the book follows your openings in a game', repertoireMove(['e4', 'e5', 'Nf3', 'Nc6'], f.repertoire.w, () => 0) === 'Bc4')
check('and lets the engine take over when you leave it', repertoireMove(['a3'], f.repertoire.w) === null)
check('your accuracy and results are measured', f.stats.accuracy === 92 && Math.abs(f.stats.score - 0.7) < 1e-9)
check('captures and checks are counted from your moves only (Black’s Bb4+ is not yours)', f.stats.captures > 0 && f.stats.checks === 0)
check('Chronos games with special moves are skipped', fingerprint([{ ...games[0]!, variant: [{ ply: 1, kind: 'x' }] as never }], 1200).games === 0)
check('broken PGNs are skipped', gameMoves('1. e4 Zz9') .length === 0 && fingerprint([{ pgn: 'nonsense', humanColor: 'w', outcome: 'win', accuracy: null }], 1200).games === 0)
const base = { captures: 0.1, checks: 0.02, pawnMoves: 0.3, earlyQueen: 0.02, castled: 0.6, castleMove: 9, kingside: 1, accuracy: null, score: 0.5 }
check('habits map to a playing style', archetypeFor({ ...base, captures: 0.3, checks: 0.12 }) === 'berserker' && archetypeFor({ ...base, castled: 0.95, castleMove: 6 }) === 'fortifier' && archetypeFor({ ...base, earlyQueen: 0.2 }) === 'trickster' && archetypeFor({ ...base, accuracy: 90 }) === 'calculator')
const ghost = ghostPersona(f, 'Danny')
check('the ghost persona carries your name, rating and book', ghost.name === 'Ghost of Danny' && ghost.elo === 1450 && ghost.profile.repertoire?.w[0] === f.repertoire.w[0] && ghost.key === 'ghost')
check('the style radar stays in range', radar(f).every((b) => b.value >= 0 && b.value <= 100) && radar(f).length === 6)

// ── Brain visualizer ────────────────────────────────────────────────────────
const start = new Chess().fen()
const line = (multipv: number, depth: number, cp: number, pv: string[]): EngineLine => ({ multipv, depth, score: { type: 'cp', value: cp }, pv })
let b = reduceBrain(EMPTY_BRAIN, start, [line(1, 8, 30, ['e2e4', 'e7e5', 'g1f3']), line(2, 8, 20, ['d2d4']), line(3, 8, 10, ['c2c4'])], 1000)
check('lines are folded with their depth and plan in SAN', b.depth === 8 && b.lines[0]?.san.join(' ') === 'e4 e5 Nf3' && b.lines.length === 3)
check('scores read from White’s side', b.lines[0]?.score === '+0.3')
const blackToMove = reduceBrain(EMPTY_BRAIN, '4k3/8/8/8/8/8/8/R3K3 b - - 0 1', [line(1, 5, -500, ['e8d7'])], 0)
check('a score for Black is flipped to White’s view', blackToMove.lines[0]?.cpWhite === 500)
b = reduceBrain(b, start, [line(1, 10, 32, ['e2e4']), line(2, 10, 25, ['g1f3']), line(3, 10, 18, ['d2d4'])], 2000)
check('a plan the engine drops is remembered as discarded', b.discarded.some((d) => d.san === 'c4' && d.depth === 10))
check('discarded plans fade away', pruneBrain(b, 2000 + DISCARD_MS + 1).discarded.length === 0)
check('a new position starts a fresh brain', reduceBrain(b, '8/8/8/8/8/8/8/K6k w - - 0 1', [], 3000).depth === 0)
const arrows = brainArrows(b)
check('the best plan gets the brightest arrow, dropped plans a red one', arrows[0]?.from === 'e2' && arrows[0].color.endsWith('0.90)') && arrows.some((a) => a.from === 'c2' && a.color.startsWith('rgba(248')))
check('mates and scores are written like an engine', formatScore(9997) === 'M3' && formatScore(-9998) === '−M2' && formatScore(-35) === '−0.3' && formatScore(0) === '0.0')
check('an illegal PV stops the plan cleanly', planSan(start, ['e2e4', 'e2e4']).join() === 'e4')

// ── Predictive coach ────────────────────────────────────────────────────────
const backRank = detect('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', { from: 'd1', to: 'd5' })
const leaves = detect('3r2k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1', { from: 'c1', to: 'c3' })
check('leaving the back rank to a rook mate is caught', leaves[0]?.pattern === 'back-rank' && leaves[0].square === 'd1', JSON.stringify(leaves))
check('a safe move raises nothing', backRank.length === 0 || backRank.every((w) => w.pattern !== 'back-rank'))
const hang = detect('4k3/8/8/8/3p4/8/8/4KN2 w - - 0 1', { from: 'f1', to: 'e3' })
check('walking a knight into a pawn’s capture is caught', hang.some((w) => w.pattern === 'hangs' && w.square === 'e3'), JSON.stringify(hang))
check('an even trade is not called hanging', !detect('4k3/8/8/3n4/8/2N5/8/4K3 w - - 0 1', { from: 'c3', to: 'd5' }).some((w) => w.pattern === 'hangs'))
const forkMe = detect('4k3/8/8/8/Q2n4/8/8/4K3 w - - 0 1', { from: 'a4', to: 'a3' })
check('a knight fork waiting to happen is caught', forkMe.some((w) => w.pattern === 'fork'), JSON.stringify(forkMe))
check('a piece a pawn attacks is hanging, a safe one is not', isHanging(new Chess('4k3/8/8/3p4/4N3/8/8/4K3 w - - 0 1'), 'e4', 'w') && !isHanging(new Chess('4k3/8/8/3p4/1N6/8/8/4K3 w - - 0 1'), 'b4', 'w'))
// History: games where you hung a piece and were mated on the back rank.
const hungBishop = { pgn: pgnOf(['e4', 'e5', 'Ba6', 'bxa6']), humanColor: 'w' as const }
const hungAgain = { pgn: pgnOf(['d4', 'e5', 'Bg5', 'Qxg5']), humanColor: 'w' as const }
const mated = { pgn: pgnOf(['f3', 'e5', 'g4', 'Qh4#']), humanColor: 'w' as const }
const prof = coachProfile([hungBishop, hungAgain, mated, { pgn: '', humanColor: null }])
check('your history shows the traps that cost you', prof.games === 3 && prof.hangs === 2 && prof['mate-in-1'] === 1, JSON.stringify(prof))
const sample = [{ pattern: 'hangs' as const, square: 'e3' as const, text: 'x' }, { pattern: 'fork' as const, square: 'c2' as const, text: 'y' }]
check('"my usual traps" warns only about traps that cost you twice', warningsFor(sample, prof, 'mine').map((w) => w.pattern).join() === 'hangs')
check('"every trap" and "off"', warningsFor(sample, prof, 'all').length === 2 && warningsFor(sample, prof, 'off').length === 0)
check('a warning explains the history behind it', /lost to a hanging piece \d+ times/.test(historyNote(sample[0]!, prof) ?? ''))

// ── What-If sandbox ─────────────────────────────────────────────────────────
let sb = openSandbox(start, 0)
sb = playMove(sb, 'e2e4')!
sb = playMove(sb, 'e7e5')!
check('moves are played on the sandbox', lineSan(sb).join(' ') === 'e4 e5' && sandboxFen(sb).startsWith('rnbqkbnr/pppp1ppp/8/4p3/4P3'))
check('an illegal move is refused', playMove(sb, 'e1e3') === null)
sb = step(sb, -1)
check('stepping back keeps the line', lineSan(sb).length === 2 && sb.lines[0]?.cursor === 1)
const replayed = playMove(sb, 'e7e5')!
check('replaying the next move just steps forward', replayed.lines[0]?.moves.length === 2 && replayed.lines[0].cursor === 2)
sb = playMove(sb, 'c7c5')!
check('a new move mid-line rewrites the rest', lineSan(sb).join(' ') === 'e4 c5')
sb = newLine(sb)
check('a new branch starts from the fork', sb.active === 1 && sandboxFen(sb) === start)
sb = selectLine(sb, 0)
check('branches are kept side by side', lineSan(sb).join(' ') === 'e4 c5' && sb.lines.length === 2)
let many = openSandbox(start, 0)
for (let i = 0; i < 10; i++) many = newLine(many)
check(`at most ${MAX_LINES} branches`, many.lines.length === MAX_LINES && many.active === MAX_LINES - 1)
check('stepping never runs past the line', step(openSandbox(start, 0), 5).lines[0]?.cursor === 0)

console.log(failures === 0 ? '\nAll mind checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
