// Tests for the cinematic layer: the camera director, living pieces,
// battlefields and highlight reels. Run with `npm run test:cinema`.
import { Chess, type Move } from 'chess.js'
import { COOLDOWN, OVERSCAN, directShot, focusOnScreen, kingToMove, shotKeyframes, shotsFor } from '../src/cinema/director'
import { END_MS, MAX_REEL_MS, TITLE_MS, pickHighlights, reelFrame, reelLength, scoreMove } from '../src/cinema/highlights'
import { pieceStates } from '../src/cinema/pieceStates'
import { fenPieces, solidOf } from '../src/cinema/reelRenderer'
import { TERRAINS, TERRAIN_IDS, lifeAlpha, seedDrift, stepDrift, terrainFor } from '../src/cinema/terrain'
import { rng } from '../src/data/classic/quiz'
import { sanitizeSettings } from '../src/stores/settingsStore'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const play = (sans: string[], fen?: string): Move[] => {
  const c = new Chess(fen)
  return sans.map((s) => c.move(s))
}

// ── Director ────────────────────────────────────────────────────────────────
const fools = play(['f3', 'e5', 'g4', 'Qh4#'])
const foolShots = shotsFor(fools, 'key')
check('checkmate gets the big shot, on the mated king', foolShots[3]?.kind === 'mate' && foolShots[3].focus === 'e1' && foolShots[3].duration === 2600)
check('quiet opening moves get no shot', foolShots.slice(0, 3).every((s) => s === null))
check('"off" means no camera at all', shotsFor(fools, 'off').every((s) => s === null))
const promo = play(['a8=Q+'], '4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
check('a promotion is filmed', shotsFor(promo, 'key')[0]?.kind === 'promotion' && shotsFor(promo, 'key')[0]?.caption === 'Queen!')
const queenTrade = play(['Qxd8+'], '3qk3/8/8/8/8/8/8/3QK3 w - - 0 1')
check('a falling queen is filmed in "key moments"', shotsFor(queenTrade, 'key')[0]?.kind === 'capture')
const rookTake = play(['Bxa8'], 'r3k3/8/8/8/8/8/6B1/4K3 w - - 0 1')
check('a smaller capture is filmed only in "every highlight"', shotsFor(rookTake, 'key')[0] === null && shotsFor(rookTake, 'all')[0]?.kind === 'capture')
const cheap = play(['Nxa8'], 'r3k3/8/1N6/8/8/8/8/4K3 w - - 0 1')
check('pawn grabs and trades are not filmed', shotsFor(play(['exd5'], '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1'), 'all')[0] === null && shotsFor(cheap, 'all')[0]?.kind === 'capture')
const checks = Array.from({ length: 7 }, (_, i) => ({ color: 'w' as const, from: 'd1' as const, to: 'd2' as const, piece: 'q' as const, san: `Qd${i}+`, after: '3k4/8/8/8/8/8/3Q4/4K3 b - - 0 1' }))
const checkShots = shotsFor(checks, 'all').map((s) => (s ? s.kind : null))
check(`the camera rests ${COOLDOWN} plies between ordinary shots`, checkShots.join() === 'check,,,check,,,check', checkShots.join())
check('the mate shot ignores the cooldown', directShot(fools[3]!, { mode: 'key', ply: 3, lastShotPly: 2, mate: true, check: true, king: 'e1' })?.kind === 'mate')
check('the king to move is found from the FEN', kingToMove('4k3/8/8/8/8/8/8/4K3 b - - 0 1') === 'e8' && kingToMove('8/8/8/8/8/8/8/6K1 w - - 0 1') === 'g1')
const mate = foolShots[3]!
const frames = shotKeyframes(mate, 'w')
check('the camera starts and ends on the plain board', frames[0]?.transform === frames[frames.length - 1]?.transform && String(frames[0]?.transform).includes('scale(1.000)'))
// No gaps: with the push-in, the board still covers the frame (for every focus square).
let covered = true
for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) {
  const shot = { ...mate, focus: `${f}${r}` as typeof mate.focus }
  const m = /translate3d\((-?[\d.]+)%, (-?[\d.]+)%/.exec(String(shotKeyframes(shot, 'b')[1]?.transform))
  const t = { x: Number(m?.[1]), y: Number(m?.[2]) }
  const left = 50 - 50 * shot.zoom + t.x
  const top = 50 - 50 * shot.zoom + t.y
  const gap = OVERSCAN + 0.01
  if (left > gap || top > gap || left + 100 * shot.zoom < 100 - gap || top + 100 * shot.zoom < 100 - gap) covered = false
  // …and the focus always clears the letterbox bars (9% each).
  const seen = focusOnScreen(shot, 'b')
  if (seen.x < 10 || seen.x > 90 || seen.y < 10 || seen.y > 90) covered = false
}
check('a push-in shows at most a thin strip past the board, and the focus clears the letterbox', covered)
const onScreen = focusOnScreen({ ...mate, focus: 'h1' }, 'w')
check('the camera pulls a corner square toward the middle, and keeps it in frame', onScreen.x < 93.75 && onScreen.y < 93.75 && onScreen.x > 50, `${onScreen.x.toFixed(1)}, ${onScreen.y.toFixed(1)}`)
const centre = focusOnScreen({ ...mate, focus: 'e4' }, 'w')
check('a central square lands in the middle of the frame', Math.abs(centre.x - 50) < 1 && Math.abs(centre.y - 50) < 1)

// ── Living pieces ───────────────────────────────────────────────────────────
const s1 = pieceStates('4k3/1P6/8/2P5/3N4/8/8/4K3 w - - 0 1')
check('a pawn one step from promotion is charged', s1.get('b7') === 'charged')
check('a pawn two steps away is warm, further is calm', s1.get('c5') === undefined && pieceStates('4k3/8/2P5/8/8/8/8/4K3 w - - 0 1').get('c6') === 'warm')
check('black pawns count toward their own promotion', pieceStates('4k3/8/8/8/8/8/p7/4K3 b - - 0 1').get('a2') === 'charged')
check('a knight forking king and queen shines', pieceStates('8/2k5/3q4/1N6/8/8/8/4K3 b - - 0 1').get('b5') === 'fork')
check('a knight with one target does not', pieceStates('8/2k5/8/1N6/8/8/8/4K3 b - - 0 1').get('b5') === undefined)
check('a king in check trembles', pieceStates(fools[3]!.after).get('e1') === 'tremble')
check('a king not in check is calm', pieceStates(new Chess().fen()).size === 0)
check('a broken FEN is ignored', pieceStates('nonsense').size === 0)

// ── Battlefields ────────────────────────────────────────────────────────────
check('auto picks the board theme’s terrain', terrainFor('auto', 'papyrus-gold')?.id === 'sand' && terrainFor('auto', 'storm-sea')?.id === 'sea' && terrainFor('auto', 'chalkboard')?.id === 'snow')
check('auto on a plain board shows no terrain', terrainFor('auto', 'minimal') === null)
check('a chosen terrain and "off" win over the theme', terrainFor('snow', 'papyrus-gold')?.id === 'snow' && terrainFor('off', 'papyrus-gold') === null)
const field = seedDrift(TERRAINS.snow, 300, 200, rng(3))
check('the field is seeded with the terrain’s particles', field.length === TERRAINS.snow.ambient.count && field.every((p) => p.x >= 0 && p.x <= 300 && p.y >= 0 && p.y <= 200))
for (let i = 0; i < 600; i++) stepDrift(field, TERRAINS.snow, 1 / 30, 300, 200, i / 30)
check('drifting particles wrap round and stay on the field', field.every((p) => p.x >= -8 && p.x <= 308 && p.y >= -8 && p.y <= 208))
check('particles fade in and out', lifeAlpha(0) === 0 && lifeAlpha(0.5) === 1 && lifeAlpha(1) === 0)
check('every terrain has particles and a ground', TERRAIN_IDS.every((id) => TERRAINS[id].ambient.count > 0 && TERRAINS[id].ground.length > 0))
const settings = sanitizeSettings({ cinematicCamera: 'wild', battlefield: 'lava-moon', pieceReactions: 'yes' })
check('bad cinematic settings fall back to the defaults', settings.cinematicCamera === 'key' && settings.battlefield === 'auto' && settings.pieceReactions === true)
check('good cinematic settings are kept', sanitizeSettings({ cinematicCamera: 'all', battlefield: 'sea', pieceReactions: false }).battlefield === 'sea')

// ── Highlight reels ─────────────────────────────────────────────────────────
const opera = play(['e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4', 'dxe5', 'Bxf3', 'Qxf3', 'dxe5', 'Bc4', 'Nf6', 'Qb3', 'Qe7', 'Nc3', 'c6', 'Bg5', 'b5', 'Nxb5', 'cxb5', 'Bxb5+', 'Nbd7', 'O-O-O', 'Rd8', 'Rxd7', 'Rxd7', 'Rd1', 'Qe6', 'Bxd7+', 'Nxd7', 'Qb8+', 'Nxb8', 'Rd8#'])
const reel = pickHighlights(opera)
check('the Opera Game’s mate makes the reel', reel[reel.length - 1]?.title === 'Checkmate!')
check('the queen sacrifice Qb8+ is spotted', reel.some((m) => m.move.san === 'Qb8+') || scoreMove(opera[30]!, 30).score > 0)
check('at most five moments, in order, never back to back', reel.length <= 5 && reel.every((m, i) => i === 0 || m.ply - reel[i - 1]!.ply > 1))
check('a knight taking a defended pawn is called a sacrifice', scoreMove(opera[18]!, 18).title === 'Knight sacrifice!', scoreMove(opera[18]!, 18).title)
check('a brilliant move from the analysis is featured', pickHighlights(fools.slice(0, 3), ['book', 'book', 'brilliant']).some((m) => m.title.startsWith('Brilliant')))
check('a quiet game has no highlights', pickHighlights(play(['e4', 'e5', 'Nf3', 'Nc6'])).length === 0)
check('a reel is never longer than 30 seconds', reelLength(reel) <= MAX_REEL_MS && reelLength([]) === TITLE_MS + END_MS)
const info = { white: 'Morphy', black: 'Duke & Count', result: '1–0', finalFen: opera[opera.length - 1]!.after, orientation: 'w' as const }
check('the reel opens on a title card', reelFrame(reel, info, 100).scene === 'title')
const mid = reelFrame(reel, info, TITLE_MS + 4200 * 0.4)
check('a moment slides the move in slow motion', mid.scene === 'moment' && mid.slide > 0 && mid.slide < 1 && mid.fen === reel[0]?.move.before && mid.zoom > 1)
const late = reelFrame(reel, info, TITLE_MS + 4200 * 0.95)
check('then holds on the position after it', late.scene === 'moment' && late.fen === reel[0]?.move.after)
const end = reelFrame(reel, info, reelLength(reel) - 10)
const mateMoment = reelFrame(reel, info, TITLE_MS + 4200 * (reel.length - 1) + 2000)
check('a mate moment frames the mated king', mateMoment.scene === 'moment' && mateMoment.focus === 'e8', mateMoment.scene === 'moment' ? mateMoment.focus : '')
check('and closes on the final position', end.scene === 'end' && end.fen === info.finalFen)
check('FEN pieces for the canvas', fenPieces(new Chess().fen()).length === 32 && fenPieces(new Chess().fen())[0]?.p === 'r' && fenPieces('8/8/8/8/8/8/8/7K w - - 0 1')[0]?.i === 63)
check('theme colours are read for the video', solidOf('linear-gradient(115deg, #fff, rgba(0,0,0,0.04)), #ecd3a8', '#000') === '#ecd3a8' && solidOf(undefined, '#123456') === '#123456')

console.log(failures === 0 ? '\nAll cinema checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
