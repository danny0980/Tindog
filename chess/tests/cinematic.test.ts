// Tests for the cinematic intro and post-processing layer: the timeline,
// scripted moves and their physics, the camera and projection, beats, the
// rift crack, the particle system, the adaptive quality governor, board FX
// mapping and view-transition directions. Run with `npm run test:cinematic`.
import { boardFxFor, burstsFor } from '../src/components/fx/boardFx'
import { ParticleSystem, QUALITY, QualityGovernor } from '../src/components/fx/particles'
import { buildCrack } from '../src/components/cinematic/renderer'
import { BOARD_EXTENT, valueNoise } from '../src/components/cinematic/textures'
import {
  INTRO_BEATS,
  INTRO_MOVES,
  INTRO_TIMES,
  MOVE_SECONDS,
  beatsBetween,
  cameraAt,
  initialPieces,
  liftAt,
  moveAt,
  morphAt,
  phaseAt,
  piecesAt,
  project,
  riftIntensity,
  squareToWorld,
  tremorAt,
} from '../src/components/cinematic/timeline'
import { squareCenter } from '../src/utils/boardGeometry'
import { navDirection } from '../src/utils/viewTransition'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

// ── Phases ───────────────────────────────────────────────────────────────────
check('phases run classic → rift → realm → finale', phaseAt(0) === 'classic' && phaseAt(INTRO_TIMES.rift + 0.1) === 'rift' && phaseAt(INTRO_TIMES.realm + 0.1) === 'realm' && phaseAt(INTRO_TIMES.finale + 5) === 'finale')
check('the morph happens between shockwave and realm', morphAt(INTRO_TIMES.shockwave - 0.01) === 0 && morphAt(INTRO_TIMES.realm) === 1 && morphAt((INTRO_TIMES.shockwave + INTRO_TIMES.realm) / 2) > 0.3)
check('rift intensity builds, peaks at the shockwave, then collapses', riftIntensity(INTRO_TIMES.rift - 0.1) === 0 && near(riftIntensity(INTRO_TIMES.shockwave), 1) && riftIntensity(INTRO_TIMES.rift + 1) < riftIntensity(INTRO_TIMES.rift + 1.8) && riftIntensity(INTRO_TIMES.shockwave + 2) === 0)

// ── Pieces & moves ───────────────────────────────────────────────────────────
check('32 pieces in the starting position', initialPieces().length === 32 && new Set(initialPieces().map((p) => p.square)).size === 32)
check('squares map to world coordinates (rank 1 nearest the camera)', squareToWorld('a1').x === -3.5 && squareToWorld('a1').z === -3.5 && squareToWorld('h8').x === 3.5 && squareToWorld('h8').z === 3.5)
const atStart = piecesAt(0)
check('every piece rests at t = 0', atStart.length === 32 && atStart.every((p) => p.lift === 0 && p.tremor === 0))
const e4 = INTRO_MOVES[0]
const midMove = e4 ? piecesAt(e4.at + MOVE_SECONDS / 2).find((p) => p.id === 'wpe') : undefined
check('a moving piece is lifted mid-arc and halfway there', midMove !== undefined && midMove.lift > 0.5 && near(midMove.z, (squareToWorld('e2').z + squareToWorld('e4').z) / 2, 1e-3))
const landed = e4 ? piecesAt(e4.at + MOVE_SECONDS + 0.01).find((p) => p.id === 'wpe') : undefined
check('it lands on its target square', landed !== undefined && landed.lift === 0 && near(landed.z, squareToWorld('e4').z) && near(landed.x, squareToWorld('e4').x))
check('lift is a smooth arc (0 at both ends)', liftAt(0) === 0 && liftAt(1) === 0 && near(liftAt(0.5), 0.55))
check('landing tremor decays and stops', Math.abs(tremorAt(0.02)) > Math.abs(tremorAt(0.5)) && tremorAt(0.8) === 0 && tremorAt(-0.1) === 0)
const nf3 = INTRO_MOVES[2]
const neighbours = nf3 ? piecesAt(nf3.at + MOVE_SECONDS + 0.03) : []
check('a landing sends micro-tremors into nearby pieces only', Math.abs(neighbours.find((p) => p.id === 'wpg')?.tremor ?? 0) > 0 && neighbours.find((p) => p.id === 'wra')?.tremor === 0)
const capture = INTRO_MOVES.find((m) => m.san.includes('x'))
const afterCapture = capture ? piecesAt(capture.at + MOVE_SECONDS + 0.2) : []
check('a captured piece is flagged (shattering), then removed', afterCapture.some((p) => p.id === 'bpe' && p.capturedFor !== null) && capture !== undefined && !piecesAt(capture.at + MOVE_SECONDS + 2).some((p) => p.id === 'bpe'))
check('pieces are drawn far to near', (() => {
  const list = piecesAt(3)
  return list.every((p, i) => i === 0 || (list[i - 1]?.z ?? 0) >= p.z)
})())
check('the rift rattles the board', piecesAt(INTRO_TIMES.rift + 1.5).some((p) => Math.abs(p.tremor) > 0.01))
check('final position after the script', (() => {
  const end = piecesAt(INTRO_TIMES.finale + 3)
  const f2 = end.find((p) => near(p.x, squareToWorld('f2').x) && near(p.z, squareToWorld('f2').z))
  return end.length === 30 && f2?.type === 'b' && f2.color === 'b'
})())
check('the caption follows the moves', moveAt(0) === null && moveAt(2)?.move.san === '1. e4' && moveAt(INTRO_TIMES.finale)?.move.san === '4… Bxf2+')

// ── Beats ────────────────────────────────────────────────────────────────────
check('beats are sorted and cover the story', INTRO_BEATS.every((b, i) => i === 0 || (INTRO_BEATS[i - 1]?.at ?? 0) <= b.at) && ['rift', 'shockwave', 'realm', 'title', 'capture', 'check', 'land'].every((k) => INTRO_BEATS.some((b) => b.kind === k)))
check('two captures (Nxe5, Bxf2+) and one check', INTRO_BEATS.filter((b) => b.kind === 'capture').length === 2 && INTRO_BEATS.filter((b) => b.kind === 'check').length === 1)
check('realm landings are flagged for ember sounds', INTRO_BEATS.some((b) => b.kind === 'land' && b.realm) && INTRO_BEATS.some((b) => b.kind === 'land' && !b.realm))
let fired = 0
for (let t = 0, prev = 0; t <= INTRO_TIMES.finale + 1; prev = t, t += 1 / 60) fired += beatsBetween(prev, t).length
check('frame-by-frame polling fires every beat exactly once', fired === INTRO_BEATS.length, `${fired}/${INTRO_BEATS.length}`)
check('a skip jump fires the skipped beats once', beatsBetween(1, INTRO_TIMES.finale).length === INTRO_BEATS.filter((b) => b.at > 1 && b.at <= INTRO_TIMES.finale).length)

// ── Camera & projection ──────────────────────────────────────────────────────
const W = 1280
const H = 720
const cam0 = cameraAt(0)
const cam1 = cameraAt(INTRO_TIMES.rift - 0.01)
check('macro shot pulls back over the study game', cam1.height > cam0.height && cam1.back > cam0.back)
check('the shockwave kicks the camera', cameraAt(INTRO_TIMES.shockwave).shake > 10 && cameraAt(2).shake === 0)
const centre = project(cam1, W, H, 0, 0, cam1.lookZ)
check('the look-at point projects to the screen centre', near(centre.x, W / 2, 1e-6) && near(centre.y, H / 2, 1e-3))
const nearRow = project(cam1, W, H, 1, 0, -3.5)
const farRow = project(cam1, W, H, 1, 0, 3.5)
check('perspective: far ranks are higher and smaller', farRow.y < nearRow.y && farRow.scale < nearRow.scale)
check('board rows project to horizontal lines (strip renderer is exact)', near(project(cam1, W, H, -4, 0, 2).y, project(cam1, W, H, 4, 0, 2).y, 1e-9))
check('raised points draw higher on screen', project(cam1, W, H, 0, 1, 0).y < project(cam1, W, H, 0, 0, 0).y)
const inFrame = (t: number) => {
  const c = cameraAt(t)
  const half = BOARD_EXTENT / 2
  const a = project(c, W, H, -half, 0, -half)
  const b = project(c, W, H, half, 0, half)
  return a.depth > 0 && b.depth > 0 && b.y > 0 && a.y < H * 1.05
}
check('the opening is a macro close-up (board overflows the frame)', !inFrame(0))
check('from the rift on, the whole realm board is in frame', [INTRO_TIMES.rift, INTRO_TIMES.realm, INTRO_TIMES.finale + 2].every(inFrame))

// ── Rift crack, noise ────────────────────────────────────────────────────────
const crack = buildCrack(1805)
check('the crack is seeded and reproducible', crack.length > 20 && JSON.stringify(buildCrack(1805)) === JSON.stringify(crack) && JSON.stringify(buildCrack(7)) !== JSON.stringify(crack))
check('crack segments reveal in order from the rift origin', crack.every((s) => s.order >= 0 && s.order <= 1) && crack.some((s) => s.order === 0 && near(s.x1, 0.5) && near(s.z1, 0)))
check('value noise is continuous and in range', (() => {
  let ok = true
  for (let i = 0; i < 200; i++) {
    const v = valueNoise(i * 0.137, i * 0.071, 3)
    const w = valueNoise(i * 0.137 + 0.001, i * 0.071, 3)
    if (v < 0 || v > 1 || Math.abs(v - w) > 0.02) ok = false
  }
  return ok
})())

// ── Particles & quality ──────────────────────────────────────────────────────
const ps = new ParticleSystem(50, () => 0.5)
ps.emit('spark', 20, { x: 10, y: 10, life: 1 })
check('particles spawn', ps.alive === 20)
ps.emit('ember', 100, { x: 0, y: 0, life: 1 })
check('the pool never exceeds its capacity (oldest recycled)', ps.alive === 50)
ps.limit = 10
ps.clear()
ps.emit('dust', 40, { x: 0, y: 0, life: 1 })
check('the quality limit caps live particles', ps.alive === 10)
ps.update(5)
check('particles die when their life runs out', ps.alive === 0)
const g = new QualityGovernor(3)
let dropped = false
for (let i = 0; i < 120; i++) dropped = g.sample(40) || dropped
check('sustained slow frames step quality down', dropped && g.level < 3)
const g2 = new QualityGovernor(1)
for (let i = 0; i < 400; i++) g2.sample(8)
check('sustained fast frames step quality back up', g2.level > 1)
const g3 = new QualityGovernor(2)
for (let i = 0; i < 400; i++) g3.sample(16.7)
check('a steady 60 fps keeps the level', g3.level === 2)
check('quality presets scale DPR, particles and strips', QUALITY[1].dpr < QUALITY[3].dpr && QUALITY[1].particles < QUALITY[3].particles && QUALITY[1].strips < QUALITY[3].strips && !QUALITY[1].bloom)

// ── In-game FX mapping ───────────────────────────────────────────────────────
check('Frost Sigil → frost particles on its square', boardFxFor({ kind: 'spell-cast', spell: 'frost-sigil', square: 'd4' })?.kind === 'frost' && boardFxFor({ kind: 'spell-cast', spell: 'frost-sigil', square: 'd4' })?.square === 'd4')
check('other spells → a spell burst', boardFxFor({ kind: 'spell-cast', spell: 'berserker-charge' })?.kind === 'spell')
check('glue, altar, potion and ward events map to their effects', boardFxFor({ kind: 'trap', sprung: true, square: 'e5', detail: 'Caught in glue' })?.kind === 'glue' && boardFxFor({ kind: 'trap', sprung: false, square: 'h2', detail: 'Altar: a knight awakens' })?.kind === 'blood' && boardFxFor({ kind: 'potion', potion: 'time-elixir', detail: '' })?.kind === 'potion' && boardFxFor({ kind: 'spell-blocked', spell: 'frost-sigil' })?.kind === 'ward')
check('clock and weather events have no board burst', boardFxFor({ kind: 'clock', side: 'human', deltaMs: 1, reason: '' }) === null && boardFxFor({ kind: 'weather', detail: '' }) === null)
check('every effect has at least one burst, sized to the board', (['frost', 'spell', 'ward', 'glue', 'blood', 'potion', 'check', 'mate'] as const).every((k) => burstsFor(k, 80).length > 0 && burstsFor(k, 80).every((b) => b.count > 0 && (b.options.spread ?? 0) > 0)))
check('square centres respect orientation', squareCenter('a1', 'w').x === 6.25 && squareCenter('a1', 'w').y === 93.75 && squareCenter('a1', 'b').x === 93.75 && squareCenter('a1', 'b').y === 6.25)

// ── View transitions ─────────────────────────────────────────────────────────
check('navigation slides in the direction of travel', navDirection('play', 'legends') === 'forward' && navDirection('profile', 'play') === 'back' && navDirection('shop', 'shop') === 'zoom')

console.log(failures === 0 ? '\nAll cinematic checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
