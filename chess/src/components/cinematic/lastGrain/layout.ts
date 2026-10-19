// Where everything stands on the obsidian board. One square = one unit; the
// board spans x, z ∈ [-4, 4] with its surface at y = 0 and gold inlay seams on
// every integer line. The camera mostly looks from the +z side (white's side).
import { T } from './timeline'

export type Vec3 = readonly [number, number, number]

/** Where the first grain strikes: on the z = 2 seam, at the board's left. */
export const IMPACT: Vec3 = [-3.5, 0, 2]
/** Where the last grain lands, just in front of the king (seen past him). */
export const LAST_IMPACT: Vec3 = [-0.3, 0, -1.3]

export type EraId = 'lapis' | 'bronze' | 'lacquer' | 'rune' | 'silver'
export type PieceKind = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'

export interface EraPiece {
  era: EraId
  name: string
  kind: PieceKind
  at: Vec3
  /** Film time its seam light arrives and it wakes. */
  ignite: number
  /** Yaw so knights show their profile to the gliding camera. */
  yaw: number
  /** HDR ember colour. */
  ember: Vec3
}

export const ERA_PIECES: readonly EraPiece[] = [
  { era: 'lapis', name: 'Egyptian lapis', kind: 'pawn', at: [-2.5, 0, 1.5], ignite: T.ignite[0], yaw: 0, ember: [0.7, 1.2, 3.2] },
  { era: 'bronze', name: 'Roman bronze', kind: 'knight', at: [-1.5, 0, 1.5], ignite: T.ignite[1], yaw: -0.5, ember: [3.2, 1.7, 0.55] },
  { era: 'lacquer', name: 'Samurai lacquer', kind: 'bishop', at: [-0.5, 0, 1.5], ignite: T.ignite[2], yaw: 0.4, ember: [3.2, 0.7, 0.35] },
  { era: 'rune', name: 'Viking rune', kind: 'rook', at: [0.5, 0, 1.5], ignite: T.ignite[3], yaw: 0.3, ember: [0.6, 2.5, 3.1] },
  { era: 'silver', name: 'Renaissance silver', kind: 'knight', at: [1.5, 0, 1.5], ignite: T.ignite[4], yaw: -0.9, ember: [2.5, 2.7, 3.1] },
]

export const QUEEN: Vec3 = [2.5, 0, 1.5]
export const QUEEN_HEIGHT = 1.4
/** Height where the queen's crown points begin. */
export const QUEEN_CROWN_FROM = 1.17

export const KING: Vec3 = [0.5, 0, -2.5]
export const KING_HEIGHT = 1.9

/** Obsidian pieces that set the scene: a scattered dark army behind the era pieces. */
export const SET_PIECES: ReadonlyArray<{ kind: PieceKind; at: Vec3; yaw: number }> = [
  { kind: 'pawn', at: [-3.5, 0, 0.5], yaw: 0 },
  { kind: 'rook', at: [-3.5, 0, -3.5], yaw: 0.2 },
  { kind: 'knight', at: [-2.5, 0, -3.5], yaw: 2.6 },
  { kind: 'bishop', at: [-1.5, 0, -2.5], yaw: 0 },
  { kind: 'queen', at: [1.5, 0, -3.5], yaw: 0 },
  { kind: 'bishop', at: [2.5, 0, -2.5], yaw: 0 },
  { kind: 'knight', at: [3.5, 0, -1.5], yaw: 3.4 },
  { kind: 'pawn', at: [1.5, 0, -0.5], yaw: 0 },
  { kind: 'pawn', at: [3.5, 0, 0.5], yaw: 0 },
]
