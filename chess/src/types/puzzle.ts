export interface Puzzle {
  id: string
  fen: string
  /** UCI moves alternating solver / defender, starting with the solver. */
  solution: string[]
  mateIn: 2 | 3
}
