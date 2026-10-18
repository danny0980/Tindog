import type { BoardThemeId, PieceSetId } from './theme'
import type { Color, Difficulty, GameMode, GameResult, Outcome, Personality } from './chess'
import type { BossId, CampaignProgress } from './campaign'
import type { LegendId, LegendProgress } from './legend'
import type { QuestProgress } from './quest'
import type { RushRecord } from './rush'

export interface MatchRecord {
  id: string
  date: string
  mode: GameMode
  opponent: string
  difficulty: Difficulty | null
  personality: Personality | null
  humanColor: Color | null
  result: GameResult
  outcome: Outcome | null
  pgn: string
  plies: number
  timeControl: string
  rated: boolean
  eloBefore: number | null
  eloAfter: number | null
  coins: number
  accuracy: number | null
  opening: string | null
  legendId: LegendId | null
  /** Grand Campaign boss, if any. */
  bossId: BossId | null
}

export interface EloPoint {
  date: string
  elo: number
}

export interface PlayerStats {
  games: number
  wins: number
  losses: number
  draws: number
  winsByDifficulty: Record<Difficulty, number>
  personalitiesBeaten: Personality[]
  currentStreak: number
  bestStreak: number
}

export interface PuzzleProgress {
  /** Puzzle id → local date (YYYY-MM-DD) first solved. */
  solved: Record<string, string>
  /** Local dates on which at least one daily puzzle was solved. */
  lastSolvedDate: string | null
  streak: number
  bestStreak: number
}

export interface PlayerProfile {
  version: 1
  name: string
  elo: number
  peakElo: number
  eloHistory: EloPoint[]
  stats: PlayerStats
  coins: number
  totalCoinsEarned: number
  unlockedThemes: BoardThemeId[]
  unlockedPieceSets: PieceSetId[]
  /** Achievement id → ISO date unlocked. */
  achievements: Record<string, string>
  matches: MatchRecord[]
  puzzles: PuzzleProgress
  gamesAnalyzed: number
  quests: QuestProgress
  rush: RushRecord
  legends: LegendProgress
  campaign: CampaignProgress
}

export type AchievementIcon =
  | 'sword'
  | 'zap'
  | 'timer'
  | 'skull'
  | 'shield'
  | 'brain'
  | 'crown'
  | 'gem'
  | 'horse'
  | 'handshake'
  | 'hourglass'
  | 'trending'
  | 'puzzle'
  | 'flame'
  | 'trophy'
  | 'medal'
  | 'star'
  | 'target'
  | 'palette'
  | 'repeat'
  | 'search'
  | 'rocket'
  | 'scroll'
  | 'atom'
  | 'apple'
  | 'eye'
  | 'flag'
  | 'clock'
  | 'axe'
  | 'swords'
  | 'leaf'
  | 'wand'
  | 'globe'
  | 'map'
  | 'anchor'
  | 'cpu'
  | 'sparkles'
  | 'orbit'

export interface AchievementDef {
  id: string
  title: string
  description: string
  icon: AchievementIcon
  reward: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
}
