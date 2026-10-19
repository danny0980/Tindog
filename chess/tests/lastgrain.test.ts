// Tests for "The Last Grain" startup film: the shot timeline, the score's cue
// sheet, camera continuity, the bullet-time freeze, the title assembly and the
// hand-off to the live menu. Run with `npm run test:lastgrain`.
import { cameraAt, cutBetween, firstGrainY, lastGrainY } from '../src/components/cinematic/lastGrain/camera'
import { ERA_PIECES } from '../src/components/cinematic/lastGrain/layout'
import { overlayAt } from '../src/components/cinematic/lastGrain/overlay'
import { ParticleSim } from '../src/components/cinematic/lastGrain/particles'
import { CUES, FILM_LENGTH, SHOTS, T, TITLE, cuesBetween, letterLands, lightX, shotAt, worldTime } from '../src/components/cinematic/lastGrain/timeline'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── Shots ───────────────────────────────────────────────────────────────────
check('six shots tile the 15 s film exactly', SHOTS.length === 6 && SHOTS[0]?.start === 0 && SHOTS.at(-1)?.end === FILM_LENGTH && SHOTS.every((s, i) => i === 0 || s.start === SHOTS[i - 1]?.end))
check('shot boundaries match the storyboard', SHOTS.map((s) => s.start).join() === '0,2.2,5,7.8,10.4,12.8')
check('shotAt finds every shot', shotAt(0) === 1 && shotAt(2.3) === 2 && shotAt(6) === 3 && shotAt(9) === 4 && shotAt(11) === 5 && shotAt(14.9) === 6 && shotAt(40) === 6)

// ── Score cue sheet ─────────────────────────────────────────────────────────
check('cues are in film order', CUES.every((c, i) => i === 0 || c.at >= (CUES[i - 1]?.at ?? 0)))
check('the grain strikes at 0.95 s', CUES.some((c) => c.kind === 'impact' && c.at === 0.95))
check('five material ticks between 3.0 and 4.6 s', CUES.filter((c) => c.kind === 'ignite').map((c) => c.at).join() === '3,3.4,3.8,4.2,4.6')
check('brass peak at 7.0, freeze at 9.6, lock at 12.2', CUES.some((c) => c.kind === 'flare' && c.at === 7) && CUES.some((c) => c.kind === 'freeze' && c.at === 9.6) && CUES.some((c) => c.kind === 'lock' && c.at === 12.2))
check('UI clicks at 13.0 / 13.4 / 13.8, resolve at 14.2', CUES.filter((c) => c.kind === 'chip').map((c) => c.at).join() === '13,13.4,13.8' && CUES.some((c) => c.kind === 'resolve' && c.at === 14.2))
check('every cue lies inside the film', CUES.every((c) => c.at >= 0 && c.at <= FILM_LENGTH))
let fired = 0
for (let t = 0; t < FILM_LENGTH + 0.5; t += 1 / 60) fired += cuesBetween(t, t + 1 / 60).length
check('frame-by-frame playback fires each cue exactly once', fired === CUES.length - CUES.filter((c) => c.at === 0).length, `${fired}`)

// ── Light, pieces and grains ────────────────────────────────────────────────
check('the seam light reaches each era piece on its ignite beat', ERA_PIECES.every((p) => Math.abs(lightX(p.ignite) - p.at[0]) < 1e-9))
check('the light runs only forward', Array.from({ length: 200 }, (_, i) => i * 0.03).every((t) => lightX(t + 0.03) >= lightX(t)))
check('the first grain lands on the impact beat', firstGrainY(T.impact - 0.2) > 0 && firstGrainY(T.impact) === 0)
check('the last grain lands before the freeze', lastGrainY(T.lastGrainDrop - 0.1) > 0 && lastGrainY(T.lastGrainDrop) === 0 && T.lastGrainDrop < T.freeze)

// ── Camera ──────────────────────────────────────────────────────────────────
const finite = (t: number) => {
  const c = cameraAt(t)
  return [...c.pos, ...c.target, c.fov, c.roll, c.dof].every(Number.isFinite)
}
check('the camera is defined on every frame (and after the film)', Array.from({ length: 1300 }, (_, i) => i / 60).every(finite))
// A pop is a sudden change of camera velocity (fast but smooth crane moves are fine).
let jump = 0
let lastStep: number | null = null
for (let t = 0; t < 20; t += 1 / 60) {
  if (cutBetween(t - 1 / 60, t + 1 / 60)) {
    lastStep = null
    continue
  }
  const a = cameraAt(t).pos
  const b = cameraAt(t + 1 / 60).pos
  const step = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  if (lastStep !== null) jump = Math.max(jump, Math.abs(step - lastStep))
  lastStep = step
}
check('no camera pops outside the two planned cuts', jump < 0.02, `largest velocity change ${jump.toFixed(4)} per frame`)
check('the planned cuts are on the queen beat and the match cut', cutBetween(4.99, 5.01) && cutBetween(7.79, 7.81) && !cutBetween(2.1, 2.3))
check('the camera stays above the board', Array.from({ length: 900 }, (_, i) => i / 60).every((t) => cameraAt(t).pos[1] > 0.1))

// ── Bullet time ─────────────────────────────────────────────────────────────
check('world time stops for the frozen second', worldTime(9.7) === worldTime(10.3) && worldTime(9.5) < worldTime(9.7) && worldTime(11) > worldTime(10.4))
const sim = new ParticleSim('high')
sim.update(9.7, null, 0.003)
const frozen = Float32Array.from(sim.position)
sim.update(10.3, null, 0.003)
let moved = 0
for (let i = 0; i < sim.count; i++) {
  const d = Math.hypot((sim.position[i * 3] ?? 0) - (frozen[i * 3] ?? 0), (sim.position[i * 3 + 1] ?? 0) - (frozen[i * 3 + 1] ?? 0), (sim.position[i * 3 + 2] ?? 0) - (frozen[i * 3 + 2] ?? 0))
  if (d > 1e-6 && (sim.alpha[i] ?? 0) > 0) moved += 1
}
check('every visible particle hangs perfectly still in the freeze', moved === 0, `${moved} moved`)
const splashAlive = Array.from({ length: sim.count }, (_, i) => sim.alpha[i] ?? 0).filter((a) => a > 0.05).length
check('the last splash is suspended mid-air', splashAlive > 100, `${splashAlive} lit`)
const again = new ParticleSim('high')
again.update(10.3, null, 0.003)
check('particles are deterministic (seek gives the same frame)', again.position.every((v, i) => v === sim.position[i]))
const bad = [0.5, 1, 3.3, 7, 9.2, 12, 20].some((t) => {
  sim.update(t, null, 0.003)
  return !sim.position.every(Number.isFinite) || !sim.alpha.every((a) => a >= 0 && a <= 1.0001)
})
check('no NaN positions or out-of-range alphas', !bad)

// ── Title assembly ──────────────────────────────────────────────────────────
const n = sim.titleParticles
const xy = new Float32Array(n * 2)
const letter = new Uint8Array(n)
for (let i = 0; i < n; i++) {
  letter[i] = i % TITLE.length
  xy[i * 2] = 100 + letter[i]! * 80
  xy[i * 2 + 1] = 300
}
sim.setTitleTargets({ xy, letter })
const toWorld = (x: number, y: number, depth: number, out: [number, number, number]) => {
  out[0] = x / 100
  out[1] = y / 100
  out[2] = depth
}
sim.update(letterLands(TITLE.length - 1) - 0.02, toWorld, 0.003)
const titleStart = sim.count - n
let off = 0
for (let i = 0; i < n; i++) {
  const p = titleStart + i
  if (Math.abs((sim.position[p * 3] ?? 0) - (xy[i * 2] ?? 0) / 100) > 0.05 || Math.abs((sim.position[p * 3 + 1] ?? 0) - 3) > 0.05) off += 1
}
check('the grains converge on their letters as the last letter lands', off === 0, `${off} off target`)
sim.setTitleTargets({ xy: new Float32Array(4), letter: new Uint8Array(2) })
check('mismatched title targets are ignored', (() => {
  sim.update(11, toWorld, 0.003)
  return sim.position.every(Number.isFinite)
})())
check('every letter lands before the light-ray lock', Array.from(TITLE, (_, i) => letterLands(i)).every((t) => t < T.lock))

// ── Overlay and hand-off ────────────────────────────────────────────────────
check('Skip appears after one second and goes once the menu is up', !overlayAt(0.9).skip && overlayAt(1.1).skip && !overlayAt(T.skipTo).skip)
check('letters are hidden until their grains arrive, then fully solid', overlayAt(10.4).letters.every((l) => l.opacity === 0) && overlayAt(T.lock + 0.35).letters.every((l) => l.opacity > 0.99))
check('chips rise in order on their clicks', overlayAt(13.2).chips[0]!.opacity > 0 && overlayAt(13.2).chips[1]!.opacity === 0 && overlayAt(14.5).chips.every((c) => c.opacity === 1 && Math.abs(c.rise) < 1e-9))
check('"Tap to begin" arrives last', overlayAt(14.1).tap === 0 && overlayAt(14.9).tap === 1)
check('the final frame is the live menu, and it holds', (() => {
  const end = overlayAt(FILM_LENGTH)
  const later = overlayAt(FILM_LENGTH + 30)
  const round = (o: unknown) => JSON.stringify(o, (_k, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))
  return end.live && round(end) === round(later)
})())
check('skipping lands on the built title with the menu rising', overlayAt(T.skipTo).letters.every((l) => l.opacity === 1) && overlayAt(T.skipTo).glass === 0 && overlayAt(T.skipTo + 1.2).glass === 1)

console.log(failures === 0 ? '\nAll Last Grain checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
