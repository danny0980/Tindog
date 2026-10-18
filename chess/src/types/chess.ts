import type { Color, Move, PieceSymbol, Square } from 'chess.js'

export type { Color, Move, PieceSymbol, Square }

export type GameMode = 'ai' | 'local'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export type ColorChoice = Color | 'random'

export type PromotionPiece = Extract<PieceSymbol, 'q' | 'r' | 'b' | 'n'>

export interface TimeControl {
  id: string
  label: string
  category: 'none' | 'bullet' | 'blitz' | 'rapid'
  /** Initial time per side in milliseconds (0 = untimed). */
  initialMs: number
  /** Increment added after each move in milliseconds. */
  incrementMs: number
}

export interface GameSettings {
  mode: GameMode
  difficulty: Difficulty
  /** Colour the human plays in AI mode. */
  playerColor: ColorChoice
  timeControlId: string
}

export type DrawReason = 'stalemate' | 'threefold' | 'insufficient' | 'fifty-move' | 'timeout-insufficient'

export type GameResult =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'resign'; winner: Color }
  | { kind: 'timeout'; winner: Color }
  | { kind: 'draw'; reason: DrawReason }

export type GameStatus =
  | { kind: 'playing'; turn: Color; inCheck: boolean }
  | { kind: 'over'; result: GameResult }

export interface ClockTimes {
  w: number
  b: number
}

export interface PendingPromotion {
  from: Square
  to: Square
  color: Color
}

export interface CapturedSummary {
  /** Pieces captured BY white (i.e. black pieces), sorted by value. */
  w: PieceSymbol[]
  /** Pieces captured BY black (i.e. white pieces), sorted by value. */
  b: PieceSymbol[]
  /** Material balance from white's point of view. */
  materialDiff: number
}

export interface EngineConfig {
  skillLevel: number
  depth: number
  moveTimeMs: number
  /** Minimum perceived "thinking" time so instant replies don't feel jarring. */
  minThinkMs: number
}
