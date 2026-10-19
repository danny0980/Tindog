import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import type { BossId } from './campaign'
import type { LegendId, LegendStrength } from './legend'

export type { Color, Move, PieceSymbol, Square }

export type GameMode = 'ai' | 'local'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export type Personality = 'balanced' | 'aggressive' | 'defensive' | 'tactical' | 'positional'

export type ColorChoice = Color | 'random'

export type PromotionPiece = Extract<PieceSymbol, 'q' | 'r' | 'b' | 'n'>

export type TimeControlCategory = 'none' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'custom'

export interface TimeControl {
  id: string
  label: string
  category: TimeControlCategory
  /** Initial time per side in milliseconds (0 = untimed). */
  initialMs: number
  /** Fischer increment added after each move in milliseconds. */
  incrementMs: number
}

export interface GameSettings {
  mode: GameMode
  difficulty: Difficulty
  personality: Personality
  /** Colour the human plays in AI mode. */
  playerColor: ColorChoice
  timeControlId: string
  /** Used when timeControlId === 'custom'. */
  customMinutes: number
  customIncrementSeconds: number
  /** Historical legend opponent (AI mode); overrides difficulty & personality. */
  legendId: LegendId | null
  /** Free-play strength scaling for legend opponents. */
  legendStrength: LegendStrength
  /** Grand Campaign boss opponent (AI mode); overrides legend, difficulty & personality. */
  bossId: BossId | null
  /** Classic Chess opponent (AI mode): pure chess, no spells. Below boss and legend in precedence. */
  classicId: string | null
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

export interface MoveInput {
  from: Square
  to: Square
  promotion?: PieceSymbol
}

export type Outcome = 'win' | 'loss' | 'draw'
