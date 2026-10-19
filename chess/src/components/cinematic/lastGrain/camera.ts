// The camera move for every shot, as a pure function of film time. Shots 1→2
// and 4→5→6 are continuous moves; 2→3 is a cut on the queen's beat and 3→4 a
// match cut (crown points → the king's cross).
import { IMPACT, KING, LAST_IMPACT, QUEEN, type Vec3 } from './layout'
import { FILM_LENGTH, T, easeInOut, easeOut, lightX, progress } from './timeline'

export interface CameraPose {
  pos: Vec3
  target: Vec3
  /** Vertical field of view, degrees (for a 16:9 frame). */
  fov: number
  /** Dutch roll, radians. */
  roll: number
  /** Depth-of-field strength 0–1 (macro shots are shallow). */
  dof: number
}

const mix = (a: number, b: number, k: number): number => a + (b - a) * k
const mix3 = (a: Vec3, b: Vec3, k: number): Vec3 => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)]
const blend = (a: CameraPose, b: CameraPose, k: number): CameraPose => ({
  pos: mix3(a.pos, b.pos, k),
  target: mix3(a.target, b.target, k),
  fov: mix(a.fov, b.fov, k),
  roll: mix(a.roll, b.roll, k),
  dof: mix(a.dof, b.dof, k),
})

/** Height of a grain falling to land at `land` (s), released `fall` seconds earlier from `from`. */
export const grainHeight = (t: number, land: number, fall: number, from: number): number => (t >= land ? 0 : t < land - fall ? from : from * (1 - ((t - (land - fall)) / fall) ** 2))

/** The first grain: falling into the macro frame, landing on the impact beat. */
export const firstGrainY = (t: number): number => grainHeight(t, T.impact, T.impact, 1.15)
/** The last grain: drops beside the king. */
export const lastGrainY = (t: number): number => grainHeight(t, T.lastGrainDrop, 0.6, 2.4)

// Shot 1 — macro slow motion: low beside the seam, the grain falling into frame.
function shot1(t: number): CameraPose {
  const k = easeInOut(progress(t, 0, 2.2))
  const gy = firstGrainY(t)
  const [ix, , iz] = IMPACT
  return {
    pos: [mix(ix + 0.95, ix + 0.62, k), mix(0.62, 0.17, k), mix(iz + 1.05, iz + 0.72, k)],
    target: [ix + 0.05 * k, Math.max(0.05, gy * 0.62) + 0.02, iz],
    fov: mix(19, 22, k),
    roll: mix(0.05, -0.02, k),
    dof: 1,
  }
}

// Shot 2 — a low glide that rides just behind the running light.
function shot2(t: number): CameraPose {
  const head = lightX(t)
  const sway = Math.sin(t * 1.7) * 0.03
  // Framed side-on to the row, just ahead of the light: each piece wakes centre
  // frame and stays in shot as the light moves on to the next.
  return {
    pos: [head - 0.55, 0.42 + sway + 0.12 * progress(t, 2.2, 5), 3.7],
    target: [head + 0.25, 0.38, 1.35],
    fov: 34,
    roll: -0.04 + sway * 0.4,
    dof: 0.55,
  }
}

// Shot 3 — a slow orbit round the queen, rising with the fissures.
function shot3(t: number): CameraPose {
  const k = easeInOut(progress(t, T.crackStart, T.matchCut))
  const theta = mix(-0.3, 0.95, k)
  const r = mix(1.85, 1.45, k)
  const [qx, , qz] = QUEEN
  // A short, decaying kick when the crown flares.
  const kick = t > T.flare ? Math.exp(-(t - T.flare) * 7) * Math.sin((t - T.flare) * 70) * 0.025 : 0
  return {
    pos: [qx + r * Math.sin(theta), mix(0.45, 1.38, k) + kick, qz + r * Math.cos(theta)],
    target: [qx, mix(0.5, 1.22, k), qz],
    fov: 30,
    roll: 0.03 + kick,
    dof: 0.65,
  }
}

const KING_CLOSE: Vec3 = [KING[0] + 0.14, 2.0, KING[2] - 0.58]
const KING_TOP: Vec3 = [KING[0], 1.86, KING[2]]
const DOLLY_END: Vec3 = [-0.6, 1.3, -5.5]
const DOLLY_LOOK: Vec3 = [0.3, 0.55, -0.9]

/** Rotates p about the vertical axis through c by angle a. */
const orbitY = (p: Vec3, c: Vec3, a: number): Vec3 => {
  const dx = p[0] - c[0]
  const dz = p[2] - c[2]
  return [c[0] + dx * Math.cos(a) - dz * Math.sin(a), p[1], c[2] + dx * Math.sin(a) + dz * Math.cos(a)]
}

// Shot 4 — dolly back from the king's cross; then bullet time: the camera keeps
// arcing round the suspended splash while the world is frozen.
function shot4(t: number): CameraPose {
  const k = easeOut(progress(t, T.matchCut, T.freeze))
  const arc = easeInOut(progress(t, T.freeze - 0.2, T.restart + 0.6)) * 0.42
  return {
    pos: orbitY(mix3(KING_CLOSE, DOLLY_END, k), LAST_IMPACT, arc),
    target: mix3(KING_TOP, DOLLY_LOOK, k),
    fov: mix(26, 34, k),
    roll: mix(-0.05, 0.02, k),
    dof: mix(0.8, 0.35, k),
  }
}

// Shot 5 — a crane up and back that reveals the whole lit board under the title.
const CRANE_END: Vec3 = [0, 4.3, -7.6]
function shot5(t: number): CameraPose {
  const from = shot4(T.restart + 0.6)
  const k = easeInOut(progress(t, T.restart + 0.6, T.menu))
  return blend(from, { pos: CRANE_END, target: [0, 0.2, 0.3], fov: 40, roll: 0, dof: 0 }, k)
}

// Shot 6 — the camera settles overhead: the board flattens into the menu's glass.
const OVERHEAD: Vec3 = [0, 9.6, -2.4]
function shot6(t: number): CameraPose {
  const k = easeInOut(progress(t, T.menu, FILM_LENGTH - 0.3))
  const idle = Math.max(0, t - FILM_LENGTH)
  const drift: Vec3 = [Math.sin(idle * 0.19) * 0.35 * Math.min(1, idle / 3), 0, Math.cos(idle * 0.15) * 0.25 * Math.min(1, idle / 3) - 0.25 * Math.min(1, idle / 3)]
  const base = blend(shot5(T.menu), { pos: OVERHEAD, target: [0, 0, 0.1], fov: 38, roll: 0, dof: 0 }, k)
  return { ...base, pos: [base.pos[0] + drift[0], base.pos[1], base.pos[2] + drift[2]] }
}

export function cameraAt(t: number): CameraPose {
  if (t < 1.7) return shot1(t)
  // Continuous hand-off from the macro into the glide.
  if (t < 2.6) return blend(shot1(t), shot2(t), easeInOut(progress(t, 1.7, 2.6)))
  if (t < T.crackStart) return shot2(t)
  if (t < T.matchCut) return shot3(t)
  if (t < T.restart + 0.6) return shot4(t)
  if (t < T.menu) return shot5(t)
  return shot6(t)
}

/** Whether a hard cut happens between two frame times (no motion blur / smoothing across it). */
export const cutBetween = (a: number, b: number): boolean => (a < T.crackStart && b >= T.crackStart) || (a < T.matchCut && b >= T.matchCut)

