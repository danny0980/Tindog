// Tests for the Journey's modes and learning tools: Hold the Line, famous
// positions, weekend events, endgame lessons, phases, powers, the Bullet
// Gauntlet, dream matches, the mentor, the weekly report and mistake puzzles.
// Run with `npm run test:journey`.
import { Chess } from 'chess.js'
import { getClassic } from '../src/data/classic/roster'
import { SPELLS } from '../src/data/spells'
import { TACTICS } from '../src/data/spells'
import { act, hint, movesFrom, newDefense, recruitSquares, waveFor, wavesHeld } from '../src/journey/defense'
import { ENDGAMES, lessonRules } from '../src/journey/endgames'
import { WEEKEND_EVENTS, currentEvent } from '../src/journey/events'
import { diagnose, mistakesIn, sevenDayPlan, solvesMistake, weeklyReport } from '../src/journey/learn'
import { ARCHETYPE_POWER, DREAM_MATCHES, PHASES, PLAYER_POWERS, bulletOpponent, coopPlayer, dreamPair, phaseFor } from '../src/journey/modes'
import { FAMOUS_GAMES, positionRules, startFen } from '../src/journey/positions'
import { createDefaultProfile } from '../src/stores/profileStore'
import type { MatchRecord } from '../src/types/profile'
import { VariantGame } from '../src/variants/rules'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── Hold the Line ───────────────────────────────────────────────────────────
const d0 = newDefense(7)
check('you start with rooks, a bishop, a knight and two pawns', Object.values(d0.grid).filter((u) => u.side === 'me').length === 6 && d0.lives === 3)
check('a rook slides until blocked', movesFrom(d0, 'a1').includes('a8') && !movesFrom(d0, 'a1').includes('b1') === false)
check('your pawns step forward', movesFrom(d0, 'd2').join() === 'd3')
check('waves grow, knights from wave 3', waveFor(1).length === 4 && !waveFor(2).includes('n') && waveFor(3).includes('n') && waveFor(6).length > waveFor(3).length)
let d = d0
for (let i = 0; i < 3; i++) d = act(d, { kind: 'move', from: i % 2 ? 'h8' : 'h1', to: i % 2 ? 'h1' : 'h8' }) ?? act(d, { kind: 'move', from: 'd2', to: 'd3' }) ?? d
check('enemies arrive on the 8th rank', Object.entries(d.grid).some(([k, u]) => u.side === 'foe' && (k.endsWith('8') || k.endsWith('7') || k.endsWith('6'))))
check('an illegal action is refused', act(d0, { kind: 'move', from: 'a1', to: 'b2' }) === null && act(d0, { kind: 'recruit', type: 'q', to: 'b1' }) === null)
check('you can recruit on your first two ranks', recruitSquares(d0).includes('b1') && !recruitSquares(d0).includes('a1') && act(d0, { kind: 'recruit', type: 'p', to: 'b2' })?.grid.b2?.type === 'p')
// A breach costs a life.
const breach = act({ ...d0, grid: { ...d0.grid, g2: { side: 'foe', type: 'p' } }, queue: [] }, { kind: 'move', from: 'd2', to: 'd3' })
check('an enemy reaching your first rank costs a life', breach?.lives === 2 && breach.breaches === 1)
// A capture pays gold.
const prey = act({ ...d0, grid: { ...d0.grid, a5: { side: 'foe', type: 'p' } } }, { kind: 'move', from: 'a1', to: 'a5' })
check('captures pay gold', prey !== null && prey.gold === d0.gold + 1 && prey.captures === 1)
check('the hint finds a capture', hint({ ...d0, grid: { ...d0.grid, a5: { side: 'foe', type: 'p' } } })?.kind === 'move')
// Play a whole game with the hint (or a shuffle) — it must end and never break.
let sim = newDefense(3)
for (let t = 0; t < 400 && !sim.over; t++) {
  const h = hint(sim)
  const mine = Object.keys(sim.grid).filter((k) => sim.grid[k]?.side === 'me')
  const fallback = mine.flatMap((f) => movesFrom(sim, f).map((to) => ({ kind: 'move' as const, from: f, to })))[0]
  const recruit = sim.gold >= 3 && recruitSquares(sim)[0] ? { kind: 'recruit' as const, type: 'n' as const, to: recruitSquares(sim)[0]! } : null
  const next = (h && act(sim, h)) || (recruit && act(sim, recruit)) || (fallback && act(sim, fallback)) || null
  if (!next) break
  sim = next
}
check('a simulated defence holds some waves and the state stays sane', wavesHeld(sim) >= 1 && sim.lives >= 0 && Object.keys(sim.grid).every((k) => /^[a-h][1-8]$/.test(k)), `held ${wavesHeld(sim)} waves`)

// ── Famous positions ────────────────────────────────────────────────────────
for (const g of FAMOUS_GAMES) {
  const chess = new Chess()
  let ok = true
  try {
    for (const san of g.moves) chess.move(san)
  } catch {
    ok = false
  }
  check(`${g.name}: the whole game replays`, ok, ok ? '' : 'illegal move in the stored game')
  check(`${g.name}: you take over as the winner`, startFen(g) !== null && positionRules(g) !== null)
}
const opera = FAMOUS_GAMES.find((g) => g.id === 'opera')!
const operaRules = positionRules(opera)!
const og = VariantGame.battleGame(operaRules)
for (const san of opera.moves.slice(opera.startPly)) {
  const m = og.legalMoves().find((x) => x.san === san)
  if (m) og.play(m)
}
check('replaying Morphy’s moves wins the position', og.result?.winner === 'w' && og.result.reason === 'checkmate')

// ── Weekend events ──────────────────────────────────────────────────────────
for (const e of WEEKEND_EVENTS) {
  if (!e.fen) continue
  let ok = true
  try {
    const g = new VariantGame('battle', 518, undefined, { fen: e.fen, objective: { kind: 'material', at: 9999 }, events: [] })
    ok = g.legalMoves().length > 0
  } catch {
    ok = false
  }
  check(`event ${e.name}: the position is playable`, ok)
}
check('events are live Friday to Sunday', currentEvent(new Date(2026, 9, 23)).live && currentEvent(new Date(2026, 9, 25)).live && !currentEvent(new Date(2026, 9, 21)).live)
check('the event changes every week', currentEvent(new Date(2026, 9, 25)).event.id !== currentEvent(new Date(2026, 10, 1)).event.id)

// ── Endgame lessons ─────────────────────────────────────────────────────────
for (const l of ENDGAMES) {
  let ok = true
  try {
    const chess = new Chess(l.fen)
    ok = chess.turn() === l.side && !chess.isGameOver()
  } catch {
    ok = false
  }
  check(`lesson ${l.name}: a legal position, your move`, ok && getClassic(l.teacher) !== null)
}
const hold = lessonRules(ENDGAMES.find((l) => l.goal === 'hold')!)
check('a "hold" lesson is a survive objective', hold.objective.kind === 'survive')

// ── Phases, powers, co-op, bullet, dreams ───────────────────────────────────
check('phases by material lost', phaseFor(0).phase === 1 && phaseFor(6).phase === 2 && phaseFor(20).phase === 3 && PHASES.every((p) => p.spell === null || SPELLS[p.spell] !== undefined))
check('every style has a power and every player power exists', Object.values(ARCHETYPE_POWER).every((s) => SPELLS[s] !== undefined) && PLAYER_POWERS.every((t) => TACTICS[t] !== undefined))
check('co-op players alternate', coopPlayer(0) === 0 && coopPlayer(1) === 1 && coopPlayer(2) === 0)
check('the bullet ladder climbs', bulletOpponent(1200, 3).elo > bulletOpponent(1200, 0).elo && bulletOpponent(9999, 99).id !== undefined)
check('every dream match has two real characters', DREAM_MATCHES.every((m) => dreamPair(m) !== null))

// ── Mentor & report ─────────────────────────────────────────────────────────
const base = createDefaultProfile()
const match = (over: Partial<MatchRecord>, i: number): MatchRecord => ({
  id: `m${i}`, date: new Date(2026, 9, 20, 12, i).toISOString(), mode: 'ai', opponent: 'Stockfish', difficulty: 'beginner', personality: null, humanColor: 'w',
  result: { kind: 'timeout', winner: 'b' }, outcome: 'loss', pgn: '', plies: 60, timeControl: '3+2', rated: true, eloBefore: 1200, eloAfter: 1190, coins: 5, accuracy: 70, opening: 'Italian Game', legendId: null, bossId: null, ...over,
})
const timeouts = Array.from({ length: 6 }, (_, i) => match({}, i))
check('the mentor spots losses on time', diagnose(timeouts).focus === 'time')
check('too few games: no diagnosis yet', diagnose([]).focus === 'consistency' && base.matches.length === 0)
check('a seven-day plan', sevenDayPlan('endgames').length === 7 && sevenDayPlan('endgames').some((d) => d.task === 'endgame'))
const rep = weeklyReport([...timeouts, match({ outcome: 'win', result: { kind: 'checkmate', winner: 'w' }, eloBefore: 1190, eloAfter: 1205 }, 9)], '2026-10-19')
check('the weekly report counts the week', rep.games === 7 && rep.wins === 1 && rep.losses === 6 && rep.commonLoss === 'losing on time' && rep.bestOpening?.name === 'Italian Game')
check('a week without games is empty', weeklyReport(timeouts, '2026-10-26').games === 0)

// ── Mistake puzzles ─────────────────────────────────────────────────────────
const blunderGame = new Chess()
for (const san of ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']) blunderGame.move(san)
const pgn = blunderGame.pgn()
// Black's 3...Nf6?? (ply index 5) lets mate in one.
const evals = Array.from({ length: 7 }, () => ({ before: 0, after: 0, best: 'a2a3' as string | null }))
evals[5] = { before: 30, after: 9999, best: 'g7g6' }
const mistakes = mistakesIn({ id: 'g1', pgn, humanColor: 'b', opponent: 'Stockfish', date: '2026-10-20' }, evals)
check('a blunder becomes a puzzle from the position before it', mistakes.length === 1 && mistakes[0]!.played === 'Nf6' && mistakes[0]!.best === 'g7g6')
check('the engine move solves it; another move does not', solvesMistake(mistakes[0]!, 'g7g6') && !solvesMistake(mistakes[0]!, 'a7a6'))
check('the other side’s moves are ignored', mistakesIn({ id: 'g1', pgn, humanColor: 'w', opponent: 'x', date: '' }, evals).length === 0)

if (failures > 0) {
  console.error(`\n${failures} journey-mode test(s) failed`)
  process.exit(1)
}
console.log('\nAll journey-mode tests passed.')
