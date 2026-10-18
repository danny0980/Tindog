export interface OpeningEntry {
  eco: string
  name: string
  /** Space-separated SAN moves from the initial position. */
  moves: string
}

export interface DetectedOpening extends OpeningEntry {
  /** Ply at which the position was last found in the book. */
  ply: number
}
