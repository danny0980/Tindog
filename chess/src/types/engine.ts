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
