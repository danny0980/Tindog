// Tests for the board VFX rules: which squares get which effects, and when a
// capture flash fires. Run with `npm run test:vfx`.
import { boardVfx, captureSquare } from '../src/components/board/boardVfx'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
const AFTER_D5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
const AFTER_EXD5 = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2'

// ── Captures ────────────────────────────────────────────────────────────────
check('a quiet move is not a capture', captureSquare(START, AFTER_E4, { from: 'e2', to: 'e4' }) === null)
check('exd5 is a capture on d5', captureSquare(AFTER_D5, AFTER_EXD5, { from: 'e4', to: 'd5' }) === 'd5')
check('undoing a capture is not a capture', captureSquare(AFTER_EXD5, AFTER_D5, { from: 'd7', to: 'd5' }) === null)
check('loading a game is not a capture', captureSquare(null, AFTER_EXD5, { from: 'e4', to: 'd5' }) === null)
check('jumping two plies is not a capture', captureSquare(AFTER_E4, AFTER_EXD5, { from: 'e4', to: 'd5' }) === null)
const EP_BEFORE = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3'
const EP_AFTER = 'rnbqkbnr/ppp1p1pp/5P2/3p4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3'
check('en passant flashes on the landing square', captureSquare(EP_BEFORE, EP_AFTER, { from: 'e5', to: 'f6' }) === 'f6')

// ── Square effects ──────────────────────────────────────────────────────────
const fx = boardVfx({
  selected: 'e2',
  lastMove: { from: 'd7', to: 'd5' },
  kingInDanger: 'e1',
  mate: false,
  tiles: { frost: ['a3', 'h6'], lava: ['h6'], void: ['c4'], poison: ['zz' as never] },
})
check('the selected square gets the aura', fx.get('e2')?.selected === true)
check('the last move leaves a trail on both squares', fx.get('d7')?.lastFrom === true && fx.get('d5')?.lastTo === true)
check('a king in check pulses (and is not mated)', fx.get('e1')?.check === true && fx.get('e1')?.mate === false)
check('status tiles land on their squares', fx.get('a3')?.tile === 'frost' && fx.get('c4')?.tile === 'void')
check('a stronger tile wins a shared square', fx.get('h6')?.tile === 'lava')
check('invalid squares are ignored', ![...fx.keys()].some((k) => !/^[a-h][1-8]$/.test(k)))
check('checkmate marks the king as mated', boardVfx({ selected: null, lastMove: null, kingInDanger: 'e8', mate: true, tiles: {} }).get('e8')?.mate === true)
check('an empty board state carries no effects', boardVfx({ selected: null, lastMove: null, kingInDanger: null, mate: false, tiles: {} }).size === 0)

console.log(failures === 0 ? '\nAll VFX checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
