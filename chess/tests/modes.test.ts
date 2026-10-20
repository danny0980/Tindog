// Tests for Phase D's new modes: Card Chess, Vanishing Chess, the Historical
// Escape Rooms and the 4-player Battle Royale. Run with `npm run test:modes`.
import { Chess } from 'chess.js'
import { CARD_IDS, CardGame, HAND_SIZE, OFFER_SIZE, aiDraft, offer } from '../src/cards/cardGame'
import { rng } from '../src/data/classic/quiz'
import { LOCKS, ROOMS, attempt, getRoom, hint, inscription, roomOpen, roomPuzzles, runFen, startRun, starsFor } from '../src/escape/escape'
import { DEFAULT_MODES, eloAfter, sanitizeModes } from '../src/modes/stats'
import { MAX_PLIES, RoyaleGame, chooseRoyaleMove, initialBoard, onBoard } from '../src/royale/royale'
import { createDefaultProfile } from '../src/stores/profileStore'
import { recordEscape, recordModeResult, recordVanish } from '../src/utils/feats'
import { VISIBLE_MIN, VISIBLE_START, hiddenCount, lastMoved, vanishMask, visibleFor } from '../src/vanish/vanish'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const ALL = { w: CARD_IDS.slice(0, 3), b: CARD_IDS.slice(3) }

// ── Card Chess ──────────────────────────────────────────────────────────────
const o = offer(rng(4))
check('five different cards are offered; the computer drafts three', o.length === OFFER_SIZE && new Set(o).size === OFFER_SIZE && aiDraft(o).length === HAND_SIZE)
const g = new CardGame({ w: ['jumping-pawn', 'reinforcements', 'aegis'], b: ['knights-leap', 'stone-wall', 'royal-swap'] })
g.play({ from: 'e2', to: 'e4' })
g.play({ from: 'a7', to: 'a6' })
check('Jumping Pawn: a pawn off its first rank may still jump two', g.cardMoves().some((m) => m.card === 'jumping-pawn' && m.from === 'e4' && m.to === 'e6'))
check('…but not from its start square (that is just a normal move)', !g.cardMoves().some((m) => m.card === 'jumping-pawn' && m.from === 'd2'))
check('Reinforcements: drop a pawn on an empty square of your second rank', g.cardMoves().some((m) => m.card === 'reinforcements' && m.to === 'e2') && !g.cardMoves().some((m) => m.card === 'reinforcements' && m.to === 'd2'))
const jump = g.cardMoves().find((m) => m.card === 'jumping-pawn' && m.from === 'e4')!
check('a card move is played as your move', g.playCard(jump) && g.turn === 'b' && new Chess(g.fen).get('e6')?.type === 'p' && g.sans.at(-1)?.startsWith('Jumping Pawn'))
check('each card is used once', !g.available('w').includes('jumping-pawn') && !g.cardMoves().some((m) => m.card === 'jumping-pawn'))
// Knight's Leap for Black.
check('Knight’s Leap: a rook or bishop jumps like a knight', g.cardMoves().some((m) => m.card === 'knights-leap' && m.from === 'a8' && m.to === 'b6'))
// Wards.
const w = new CardGame({ w: ['aegis', 'jumping-pawn', 'reinforcements'], b: ['stone-wall', 'knights-leap', 'royal-swap'] }, '4k3/8/8/3r4/8/8/3Q4/4K3 w - - 0 1')
check('Aegis protects your queen (a free action: still your move)', w.ward('aegis', 'd2') && w.turn === 'w' && w.wardedBy('w').has('d2'))
w.play({ from: 'e1', to: 'f1' })
check('a warded piece can’t be captured', !w.legalMoves().some((m) => m.from === 'd5' && m.to === 'd2'))
w.play({ from: 'd5', to: 'c5' })
w.play({ from: 'd2', to: 'd4' })
check('the ward follows the piece when it moves', w.wardedBy('w').has('d4') && !w.wardedBy('w').has('d2'))
w.play({ from: 'c5', to: 'c4' })
check('…and lapses after the enemy’s moves', !w.wardedBy('w').has('d4') && w.legalMoves().length > 0)
// A card move may not leave your king in check.
const pin = new CardGame({ w: ['knights-leap', 'jumping-pawn', 'reinforcements'], b: ['aegis', 'stone-wall', 'royal-swap'] }, '4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1')
check('a pinned bishop may not leap away from the pin', !pin.cardMoves().some((m) => m.card === 'knights-leap' && m.from === 'e2'))
// Royal swap.
const swap = new CardGame({ w: ['royal-swap', 'jumping-pawn', 'reinforcements'], b: ['aegis', 'stone-wall', 'knights-leap'] }, '4k3/8/8/8/8/8/8/3RK3 w - - 0 1')
const s = swap.cardMoves().find((m) => m.card === 'royal-swap' && m.to === 'd1')
check('Royal Swap trades the king with a piece next to it', s !== undefined && swap.playCard(s) && new Chess(swap.fen).get('d1')?.type === 'k' && new Chess(swap.fen).get('e1')?.type === 'r')
// Mate is judged with the cards: a card that escapes means it isn't mate.
const nearMate = new CardGame({ w: ALL.w, b: ALL.b }, '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1')
nearMate.play({ from: 'a1', to: 'a8' })
check('checkmate still ends the game', nearMate.result?.winner === 'w' && nearMate.result.reason === 'checkmate')
const resigned = new CardGame(ALL)
resigned.resign('w')
check('resigning', resigned.result?.winner === 'b')

// ── Vanishing Chess ─────────────────────────────────────────────────────────
check('pieces stay visible for fewer moves as the game goes on', visibleFor(0) === VISIBLE_START && visibleFor(12) === VISIBLE_START - 2 && visibleFor(500) === VISIBLE_MIN)
const start = new Chess().fen()
const lm = lastMoved(start, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1'])
check('the last move of every piece is tracked (castling moves the rook too)', lm.get('e4') === 1 && lm.get('g1') === 7 && lm.get('f1') === 7 && lm.get('e1') === undefined && lm.get('a1') === 0)
const ep = lastMoved(start, ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6'])
check('en passant removes the taken pawn', ep.get('d6') === 5 && !ep.has('d5') && !ep.has('e5'))
const early = vanishMask(start, ['e2e4'])
check('at the start everything is visible', Object.values(early).every((v) => v === 1) && hiddenCount(early) === 0)
const later = vanishMask(start, Array.from({ length: 6 }, (_, i) => ['g1f3', 'g8f6', 'f3g1', 'f6g8'][i % 4]!).concat(['e2e4', 'e7e5', 'd2d4', 'd7d5', 'b1c3', 'b8c6']))
check('pieces that haven’t moved for a while vanish; recent movers stay', later.a1 === 0 && later.c3 === 1 && hiddenCount(later) > 20)

// ── Escape Rooms ────────────────────────────────────────────────────────────
check('five rooms of four different locks', ROOMS.length === 5 && ROOMS.every((r) => roomPuzzles(r).length === LOCKS) && new Set(ROOMS.flatMap((r) => roomPuzzles(r).map((p) => p.id))).size === 20)
check('every inscription comes from the history', ROOMS.every((r) => Array.from({ length: LOCKS }, (_, i) => inscription(r, i)).every((t) => t.length > 20)))
check('rooms open one after another', roomOpen(0, new Set()) && !roomOpen(1, new Set()) && roomOpen(1, new Set([ROOMS[0]!.id])))
let escapedAll = true
for (const room of ROOMS) {
  let run = startRun(room.id, 0)
  for (let lock = 0; lock < LOCKS; lock++) {
    const puzzle = roomPuzzles(room)[lock]!
    for (let i = 0; i < puzzle.solution.length; i += 2) {
      const r = attempt(run, puzzle.solution[i]!)
      run = r.run
      if (r.outcome.kind === 'wrong') escapedAll = false
    }
  }
  if (run.lock !== LOCKS - 1 || starsFor(run) !== 3) escapedAll = false
}
check('every room can be escaped by its solutions, with three stars', escapedAll)
let run = startRun('boy-king', 0)
run = attempt(run, 'a1a1').run
check('a wrong move counts as a mistake', run.mistakes === 1 && run.step === 0)
run = hint(run).run
check('hints point at the right piece and cost a star', hint(run).from === roomPuzzles(getRoom('boy-king')!)[0]!.solution[0]!.slice(0, 2) && starsFor(run) === 2)
check('the board shows the lock’s position', runFen(startRun('tesla-lab', 0)) === roomPuzzles(getRoom('tesla-lab')!)[0]!.fen)

// ── Battle Royale ───────────────────────────────────────────────────────────
const board = initialBoard()
check('four armies of 16 on the cross-shaped board', board.flat().filter(Boolean).length === 64 && !onBoard(0, 0) && !onBoard(13, 13) && onBoard(0, 3) && onBoard(6, 0))
const royale = new RoyaleGame()
check('Red moves first, then clockwise', royale.turn === 'red' && royale.movesFor('red').length === 20)
royale.play({ from: [12, 7], to: [10, 7] })
check('the turn passes to Blue, whose pawns march right', royale.turn === 'blue' && royale.movesFor('blue').some((m) => m.from[0] === 7 && m.from[1] === 1 && m.to[1] === 3))
// A king capture knocks the player out and turns the army to rubble.
const ko = new RoyaleGame()
for (const row of ko.board) row.fill(null)
ko.board[13]![7] = { owner: 'red', type: 'k' }
ko.board[7]![7] = { owner: 'red', type: 'q' }
ko.board[3]![7] = { owner: 'yellow', type: 'k' }
ko.board[3]![8] = { owner: 'yellow', type: 'p' }
ko.board[7]![0] = { owner: 'blue', type: 'k' }
ko.board[7]![13] = { owner: 'green', type: 'k' }
check('the computer always takes a king it can reach', (() => {
  const m = chooseRoyaleMove(ko, 'red', 'easy', rng(1))
  return m?.captured?.type === 'k'
})())
ko.play({ from: [7, 7], to: [3, 7] })
check('a captured king puts that army out, as rubble', !ko.alive('yellow') && ko.board[3]![8]?.owner === 'dead' && ko.points.red === 20)
check('rubble can’t move and is worth nothing', ko.movesFor('yellow').length === 0)
// Survival: the AI does not leave its king where it can be taken.
const danger = new RoyaleGame()
for (const row of danger.board) row.fill(null)
danger.board[13]![7] = { owner: 'red', type: 'k' }
danger.board[13]![3] = { owner: 'red', type: 'r' }
danger.board[10]![6] = { owner: 'blue', type: 'k' }
danger.board[10]![10] = { owner: 'yellow', type: 'k' }
danger.board[11]![12] = { owner: 'green', type: 'k' }
danger.board[3]![8] = { owner: 'yellow', type: 'r' }
const safe = chooseRoyaleMove(danger, 'red', 'normal', rng(2))
const after = danger.clone()
after.play(safe!)
check('the computer steps its king out of danger', !after.attacked(after.kingOf('red')!, 'red'))
// Games end: last king standing, or points after the move limit.
let ended = 0
for (let seed = 1; seed <= 3; seed++) {
  const game = new RoyaleGame()
  const r = rng(seed)
  while (!game.result) {
    const m = chooseRoyaleMove(game, game.turn, 'normal', r)
    if (!m) break
    game.play(m)
  }
  if (game.result && game.result.ranking.length === 4 && game.ply <= MAX_PLIES) ended += 1
}
check('every simulated game ends with a full ranking', ended === 3)
const res = new RoyaleGame()
res.resign('red')
check('resigning puts you out and play goes on', !res.alive('red') && res.turn === 'blue' && res.result === null)

// ── Records ─────────────────────────────────────────────────────────────────
let p = createDefaultProfile()
p = recordModeResult(p, 'cards', true).profile
check('a Card Chess win is recorded (and unlocks Card Sharp)', p.modes.cards.wins === 1 && p.achievements['card-sharp'] !== undefined)
p = recordModeResult(p, 'royale', false, 3).profile
p = recordModeResult(p, 'royale', true, 1).profile
check('Battle Royale keeps the best place', p.modes.royale.best === 1 && p.modes.royale.games === 2 && p.achievements['last-king-standing'] !== undefined)
const v = recordVanish(p, 1, 1500)
check('Vanishing Chess has its own rating', v.profile.modes.vanish.rating === eloAfter(1200, 1500, 1) && v.profile.modes.vanish.rating > 1200 && v.unlocked.some((a) => a.id === 'invisible-hand'))
p = recordEscape(p, 'boy-king', 90_000, 2, 5).profile
p = recordEscape(p, 'boy-king', 120_000, 3, 5).profile
check('an escape keeps the best time and the most stars', p.modes.escape['boy-king']?.bestMs === 90_000 && p.modes.escape['boy-king'].stars === 3)
check('mode records are sanitised', JSON.stringify(sanitizeModes({ cards: { games: -3 }, vanish: { rating: 99999 }, escape: { 'bad id!': { bestMs: 1 }, ok: { bestMs: 5, stars: 9 } }, royale: { best: 7 } })) === JSON.stringify({ ...DEFAULT_MODES, vanish: { rating: 4000, games: 0, wins: 0, peak: 4000 }, escape: { ok: { bestMs: 5, stars: 3 } }, royale: { games: 0, wins: 0, best: 4 } }))

console.log(failures === 0 ? '\nAll mode checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
