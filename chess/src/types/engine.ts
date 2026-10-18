/** Engine score from the point of view of the side to move (raw UCI semantics). */
export type EngineScore = { type: 'cp'; value: number } | { type: 'mate'; value: number }

export interface EngineLine {
  multipv: number
  depth: number
  score: EngineScore
  /** Principal variation in UCI notation. */
  pv: string[]
}

export interface SearchOptions {
  depth: number
  moveTimeMs?: number
  multiPv?: number
  skillLevel?: number
}

export interface SearchResult {
  bestMove: string
  lines: EngineLine[]
}

export interface DifficultyConfig {
  skillLevel: number
  depth: number
  moveTimeMs: number
  /** Minimum perceived "thinking" time so instant replies don't feel jarring. */
  minThinkMs: number
  /** Centipawn window a personality may deviate from the best move. */
  toleranceCp: number
  /** Random noise added to personality move scoring (0 = deterministic). */
  noise: number
  /** Nominal rating used for player Elo calculations. */
  elo: number
}

export type EngineRole = 'play' | 'analysis'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Style weights used to re-rank Stockfish's MultiPV candidates (see engine/personalities.ts). */
export interface StyleWeights {
  /** Multiplier on the engine evaluation (per 100cp). */
  evaluation: number
  check: number
  /** Per point of captured material. */
  capture: number
  /** Bonus for any forcing move (check or capture). */
  forcing: number
  /** Closeness of the destination square to the enemy king (0–1). */
  kingPressure: number
  /** Ranks advanced towards the opponent. */
  advance: number
  castle: number
  /** Destination next to our own king. */
  kingShelter: number
  /** Equal-value capture (simplification). */
  trade: number
  center: number
  development: number
  quiet: number
  earlyQueen: number
  /** Leaving material en prise for initiative (gambits, sacrifices). */
  sacrifice?: number
  /** Moved piece attacks two or more valuable targets (forks, traps). */
  fork?: number
  /** Preference for lower-ranked MultiPV lines — unorthodox choices. */
  creativity?: number
  /** Pawn advances on the wing of the enemy king (pawn storms). */
  pawnStorm?: number
  /** Pawn moves that land on a square defended by another pawn (solid chains). */
  pawnStructure?: number
  /** Long-range bishop/rook/queen manoeuvres (distance travelled). */
  longRange?: number
}

/** Everything the AI opponent needs to search and choose a move. */
export interface OpponentProfile {
  skillLevel: number
  depth: number
  moveTimeMs: number
  minThinkMs: number
  multiPv: number
  toleranceCp: number
  noise: number
  /** null = play Stockfish's own best move. */
  weights: StyleWeights | null
  /**
   * Opening lines per colour the opponent plays (space-separated SAN from the
   * initial position), followed while the game matches them.
   */
  repertoire?: { w: readonly string[]; b: readonly string[] }
}
