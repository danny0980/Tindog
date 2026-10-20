// The 3D Trophy Hall's layout: statues stand in two facing rows down a long
// gallery, oldest first, and the camera walks the aisle between them. Pure
// and unit-tested; hallScene.ts builds the WebGL scene from it.

export interface StatueSpot {
  index: number
  /** World position of the plinth (y = floor). */
  x: number
  z: number
  /** Which way the statue faces (radians around y): toward the aisle. */
  yaw: number
}

export const ROW_X = 3.2
export const SPACING = 3.4
/** Where the camera starts: just inside the doors, looking down the hall. */
export const ENTRANCE_Z = 4

export function hallLayout(count: number): StatueSpot[] {
  return Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0
    return { index: i, x: left ? -ROW_X : ROW_X, z: -Math.floor(i / 2) * SPACING, yaw: left ? Math.PI / 2 : -Math.PI / 2 }
  })
}

/** How far down the hall the camera can walk (z of the last pair, minus a step). */
export const hallDepth = (count: number): number => Math.max(0, Math.ceil(count / 2) - 1) * SPACING

/** Glow of a statue from your wins over that character (1 win: a faint glow; 5+: full). */
export const glowFor = (wins: number): number => (wins <= 0 ? 0.15 : Math.min(1, 0.3 + (wins - 1) * 0.175))

/** Clamp the walk so the camera stays between the doors and the far wall. */
export const clampWalk = (z: number, count: number): number => Math.min(ENTRANCE_Z, Math.max(-hallDepth(count) - 1, z))
