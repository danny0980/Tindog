// The intro cinematic as pure data and maths: phase timing, the scripted
// moves (with physical lift, landing and micro-tremor), the camera path and
// a pinhole projection. The renderer only draws what these functions say,
// so every beat of the sequence is deterministic and unit-tested.

export type IntroPhase = 'classic' | 'rift' | 'realm' | 'finale'

/** Seconds from the start of the sequence. */
export const INTRO_TIMES = {
  classic: 0,
  rift: 8.6,
  /** The temporal crack bursts: shockwave, flash, the board begins to morph. */
  shockwave: 10.6,
  /** The fantasy realm has fully replaced the classic board. */
  realm: 12.4,
  finale: 18.5,
} as const

/** Morph progress window (classic texture → realm texture). */
export const MORPH = { start: 10.6, end: 12.4 } as const
export const MOVE_SECONDS = 0.9
export const TREMOR_SECONDS = 0.7

export function phaseAt(t: number): IntroPhase {
  if (t >= INTRO_TIMES.finale) return 'finale'
  if (t >= INTRO_TIMES.realm) return 'realm'
  if (t >= INTRO_TIMES.rift) return 'rift'
  return 'classic'
}

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
export const easeInOut = (u: number): number => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2)
export const easeOut = (u: number): number => 1 - (1 - u) ** 3

/** 0 → 1 progress of the classic → realm morph. */
export const morphAt = (t: number): number => clamp01((t - MORPH.start) / (MORPH.end - MORPH.start))

/** Rift instability (0–1): builds through the rift and collapses after the shockwave. */
export function riftIntensity(t: number): number {
  if (t < INTRO_TIMES.rift) return 0
  if (t < INTRO_TIMES.shockwave) return easeInOut(clamp01((t - INTRO_TIMES.rift) / (INTRO_TIMES.shockwave - INTRO_TIMES.rift)))
  return clamp01(1 - (t - INTRO_TIMES.shockwave) / 1.6)
}

// ── Pieces & the scripted game ───────────────────────────────────────────────

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p'
export type PieceColor = 'w' | 'b'

export interface ScriptedMove {
  from: string
  to: string
  /** When the piece is lifted (s). */
  at: number
  /** Caption shown while it moves. */
  san: string
}

/** The Italian Game in the study — then, in the realm, the board turns violent. */
export const INTRO_MOVES: readonly ScriptedMove[] = [
  { from: 'e2', to: 'e4', at: 1.4, san: '1. e4' },
  { from: 'e7', to: 'e5', at: 2.9, san: '1… e5' },
  { from: 'g1', to: 'f3', at: 4.3, san: '2. Nf3' },
  { from: 'b8', to: 'c6', at: 5.7, san: '2… Nc6' },
  { from: 'f1', to: 'c4', at: 7.1, san: '3. Bc4' },
  { from: 'f8', to: 'c5', at: 13.6, san: '3… Bc5' },
  { from: 'f3', to: 'e5', at: 15.0, san: '4. Nxe5!?' },
  { from: 'c5', to: 'f2', at: 16.6, san: '4… Bxf2+' },
]

export interface BoardPiece {
  id: string
  type: PieceType
  color: PieceColor
  /** World coordinates on the board plane (x across files, z along ranks). */
  x: number
  z: number
  /** Height above the board (lift arc + landing bounce). */
  lift: number
  /** Lateral micro-tremor offset. */
  tremor: number
  /** Seconds since this piece was captured (null while on the board). */
  capturedFor: number | null
}

const BACK: readonly PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
const FILES = 'abcdefgh'

/** World coordinates of a square's centre (rank 1 nearest the camera). */
export function squareToWorld(square: string): { x: number; z: number } {
  const file = FILES.indexOf(square[0] ?? 'a')
  const rank = Number(square[1] ?? '1') - 1
  return { x: file - 3.5, z: rank - 3.5 }
}

export function initialPieces(): Array<{ id: string; type: PieceType; color: PieceColor; square: string }> {
  const out: Array<{ id: string; type: PieceType; color: PieceColor; square: string }> = []
  for (let f = 0; f < 8; f++) {
    const file = FILES[f] ?? 'a'
    const back = BACK[f] ?? 'p'
    out.push({ id: `w${back}${file}`, type: back, color: 'w', square: `${file}1` })
    out.push({ id: `wp${file}`, type: 'p', color: 'w', square: `${file}2` })
    out.push({ id: `bp${file}`, type: 'p', color: 'b', square: `${file}7` })
    out.push({ id: `b${back}${file}`, type: back, color: 'b', square: `${file}8` })
  }
  return out
}

/** Damped landing wobble: amplitude decays exponentially after impact. */
export function tremorAt(sinceLanding: number, amplitude = 0.05): number {
  if (sinceLanding < 0 || sinceLanding > TREMOR_SECONDS) return 0
  return amplitude * Math.exp(-6 * sinceLanding) * Math.sin(sinceLanding * 48)
}

/** Lift arc of a moving piece: up, across, a little settle bounce. */
export function liftAt(u: number): number {
  if (u <= 0 || u >= 1) return 0
  return Math.sin(Math.PI * u) * 0.55
}

/**
 * Every piece's state at time `t`: moved pieces glide along their arcs,
 * captured ones are flagged (the renderer shatters them), landings ripple
 * micro-tremors into neighbours, and the rift shakes the whole board.
 */
export function piecesAt(t: number): BoardPiece[] {
  const squares = new Map<string, { id: string; type: PieceType; color: PieceColor }>()
  for (const p of initialPieces()) squares.set(p.square, { id: p.id, type: p.type, color: p.color })
  const captured = new Map<string, { id: string; type: PieceType; color: PieceColor; square: string; at: number }>()
  const moving: Array<{ id: string; from: string; to: string; u: number }> = []
  const landings: Array<{ square: string; at: number }> = []

  for (const m of INTRO_MOVES) {
    if (t < m.at) break
    const piece = squares.get(m.from)
    if (!piece) continue
    const u = (t - m.at) / MOVE_SECONDS
    if (u < 1) {
      moving.push({ id: piece.id, from: m.from, to: m.to, u })
      continue
    }
    const victim = squares.get(m.to)
    if (victim) captured.set(victim.id, { ...victim, square: m.to, at: m.at + MOVE_SECONDS })
    squares.delete(m.from)
    squares.set(m.to, piece)
    landings.push({ square: m.to, at: m.at + MOVE_SECONDS })
  }

  const shake = riftIntensity(t)
  const out: BoardPiece[] = []
  for (const [square, piece] of squares) {
    const move = moving.find((m) => m.id === piece.id)
    const from = squareToWorld(move ? move.from : square)
    const to = move ? squareToWorld(move.to) : from
    const e = move ? easeInOut(move.u) : 1
    const here = squareToWorld(square)
    let tremor = 0
    for (const l of landings) {
      const w = squareToWorld(l.square)
      const dist = Math.hypot(w.x - here.x, w.z - here.z)
      if (dist < 1.6) tremor += tremorAt(t - l.at, dist < 0.1 ? 0.06 : 0.025)
    }
    // Rift: pieces rattle with the building anomaly (deterministic per piece).
    if (shake > 0) tremor += shake * 0.07 * Math.sin(t * 37 + piece.id.length * 1.7 + here.x * 3.1)
    out.push({
      id: piece.id,
      type: piece.type,
      color: piece.color,
      x: from.x + (to.x - from.x) * e,
      z: from.z + (to.z - from.z) * e,
      lift: move ? liftAt(move.u) : 0,
      tremor,
      capturedFor: null,
    })
  }
  // A capture victim stands until the attacker lands, then shatters for 1.2 s.
  for (const c of captured.values()) {
    const since = t - c.at
    if (since > 1.2) continue
    const w = squareToWorld(c.square)
    out.push({ id: c.id, type: c.type, color: c.color, x: w.x, z: w.z, lift: 0, tremor: 0, capturedFor: since })
  }
  // Painter's order: far pieces first.
  return out.sort((a, b) => b.z - a.z)
}

/** The move currently in flight or most recently played (for captions and sounds). */
export function moveAt(t: number): { move: ScriptedMove; index: number; landed: boolean } | null {
  let found: { move: ScriptedMove; index: number; landed: boolean } | null = null
  for (const [index, move] of INTRO_MOVES.entries()) {
    if (t >= move.at) found = { move, index, landed: t >= move.at + MOVE_SECONDS }
  }
  return found
}

// ── Camera ───────────────────────────────────────────────────────────────────

export interface Camera {
  /** Camera height above the board and distance behind its centre (world units). */
  height: number
  back: number
  /** Point on the board the camera looks at (z). */
  lookZ: number
  /** Focal length in multiples of the viewport's shorter side. */
  focal: number
  /** Screen shake in px (before DPR). */
  shake: number
}

/**
 * Macro shot that slowly pulls back over the study game, pushes in on the
 * anomaly, then rises into a heroic wide shot of the realm.
 */
export function cameraAt(t: number): Camera {
  const pull = easeInOut(clamp01(t / INTRO_TIMES.rift))
  const push = easeInOut(clamp01((t - INTRO_TIMES.rift) / (INTRO_TIMES.shockwave - INTRO_TIMES.rift)))
  const rise = easeOut(clamp01((t - INTRO_TIMES.shockwave) / 3.5))
  const height = 3.2 + pull * 2.6 - push * 0.9 + rise * 2.4
  const back = 4.2 + pull * 3.4 - push * 1.2 + rise * 1.6
  const lookZ = -1.2 + pull * 1.0 + push * 0.4 - rise * 0.2
  const focal = 1.25 - pull * 0.15 + push * 0.12 - rise * 0.1
  // Shake: rift rumble, the shockwave kick, and a realm heartbeat.
  const kick = Math.max(0, 1 - Math.abs(t - INTRO_TIMES.shockwave) * 2.2)
  const shake = riftIntensity(t) * 4 + kick * 18
  return { height, back, lookZ, focal, shake }
}

export interface Projection {
  x: number
  y: number
  /** Screen pixels per world unit at this point (for sizing sprites). */
  scale: number
  depth: number
}

/**
 * Pinhole projection of world point (x, y, z) for a camera at (0, height,
 * −back) looking at (0, 0, lookZ). There is no yaw or roll, so every board
 * row (constant z) projects to one horizontal line — which lets the
 * renderer draw the textured board as thin horizontal strips.
 */
export function project(cam: Camera, width: number, height: number, x: number, y: number, z: number): Projection {
  const pitch = Math.atan2(cam.height, cam.lookZ + cam.back)
  const dy = y - cam.height
  const dz = z + cam.back
  const depth = dy * -Math.sin(pitch) + dz * Math.cos(pitch)
  const up = dy * Math.cos(pitch) + dz * Math.sin(pitch)
  const f = cam.focal * Math.min(width, height)
  const d = Math.max(0.05, depth)
  return { x: width / 2 + (f * x) / d, y: height * 0.5 - (f * up) / d, scale: f / d, depth }
}

// ── Beats (sound cues and particle bursts) ───────────────────────────────────

export type IntroBeat =
  | { kind: 'land'; at: number; square: string; realm: boolean }
  | { kind: 'capture'; at: number; square: string }
  | { kind: 'check'; at: number; square: string }
  | { kind: 'rift'; at: number }
  | { kind: 'shockwave'; at: number }
  | { kind: 'realm'; at: number }
  | { kind: 'title'; at: number }

/** Every beat of the sequence, in time order. */
export const INTRO_BEATS: readonly IntroBeat[] = (() => {
  const beats: IntroBeat[] = [
    { kind: 'rift', at: INTRO_TIMES.rift },
    { kind: 'shockwave', at: INTRO_TIMES.shockwave },
    { kind: 'realm', at: INTRO_TIMES.realm },
    { kind: 'title', at: INTRO_TIMES.finale },
  ]
  const occupied = new Set(initialPieces().map((p) => p.square))
  for (const m of INTRO_MOVES) {
    const at = m.at + MOVE_SECONDS
    const realm = at >= INTRO_TIMES.realm
    if (occupied.has(m.to)) beats.push({ kind: 'capture', at, square: m.to })
    else beats.push({ kind: 'land', at, square: m.to, realm })
    if (m.san.includes('+')) beats.push({ kind: 'check', at, square: 'e1' })
    occupied.delete(m.from)
    occupied.add(m.to)
  }
  return beats.sort((a, b) => a.at - b.at)
})()

/** Beats in (from, to] — call once per frame with the previous and current time. */
export const beatsBetween = (from: number, to: number): IntroBeat[] => INTRO_BEATS.filter((b) => b.at > from && b.at <= to)
