import type { ColorChoice, Difficulty } from './chess'
import type { OpponentProfile } from './engine'
import type { BoardThemeId, PieceSetId } from './theme'

/** The two campaign paths ("universes") of Chronos Chess. */
export type CampaignId = 'historical' | 'fantasy'

export type HistoricalLegendId = 'cleopatra' | 'newton' | 'napoleon' | 'einstein' | 'ragnar' | 'musashi'
export type FantasyLegendId = 'aerith' | 'malakor'
export type LegendId = HistoricalLegendId | FantasyLegendId

/** Historical eras and fantasy realms share one "epoch" model (board, pieces, soundtrack). */
export type EpochId = 'ancient' | 'scientific' | 'napoleonic' | 'modern' | 'viking' | 'feudal-japan' | 'elven-kingdom' | 'shadow-realm'

/** Free-play strength scaling applied on top of a legend's authentic profile. */
export type LegendStrength = 'novice' | 'authentic' | 'mythic'

/** Generative soundtrack flavour (see audio/ambientMusic.ts). */
export type MusicTexture = 'default' | 'ancient' | 'baroque' | 'imperial' | 'modern' | 'nordic' | 'japanese' | 'elven' | 'shadow'

export type LegendIcon = 'eye' | 'apple' | 'flag' | 'atom' | 'axe' | 'swords' | 'leaf' | 'flame'

export type QuoteTrigger =
  | 'intro'
  | 'thinking'
  | 'playerSlow'
  | 'legendCapture'
  | 'playerCapture'
  | 'checkGiven'
  | 'inCheck'
  | 'advantage'
  | 'disadvantage'
  | 'legendWins'
  | 'legendLoses'
  | 'draw'

export interface Epoch {
  id: EpochId
  campaign: CampaignId
  name: string
  /** Display span, e.g. "69–30 BCE" or a fantasy age. */
  span: string
  /** Signed year for historical eras (negative = BCE); null for fantasy realms. */
  year: number | null
  tagline: string
  themeId: BoardThemeId
  pieceSetId: PieceSetId
}

export interface LegendStats {
  aggression: number
  calculation: number
  creativity: number
  cunning: number
}

export interface Legend {
  id: LegendId
  campaign: CampaignId
  name: string
  /** Compact name for tight UI (buttons, chips). */
  shortName: string
  title: string
  epoch: EpochId
  lifespan: string
  bio: string
  playstyle: string
  signature: string
  /** Nominal rating used for Elo. */
  elo: number
  /** Closest standard difficulty (match coins / stats bucket). */
  difficulty: Difficulty
  /** Position within its own campaign (0 = first chapter). */
  campaignOrder: number
  profile: OpponentProfile
  stats: LegendStats
  firstWinReward: number
  repeatWinReward: number
  achievementId: string
  portrait: { icon: LegendIcon; from: string; to: string; monogram: string }
  /** In-character dialogue written for the game (not verified historical quotations). */
  quotes: Record<QuoteTrigger, readonly string[]>
}

export interface LegendProgress {
  /** Legend id → ISO date of first victory. */
  defeated: Partial<Record<LegendId, string>>
  wins: Partial<Record<LegendId, number>>
  losses: Partial<Record<LegendId, number>>
  draws: Partial<Record<LegendId, number>>
  /** Epochs in which the player has fought at least once. */
  epochsVisited: EpochId[]
}

export interface Campaign {
  id: CampaignId
  name: string
  tagline: string
  description: string
  /** Legend ids in chapter order. */
  chapters: readonly LegendId[]
  /** Achievement granted for completing every chapter. */
  completionAchievement: string
}

/** Options chosen when launching a legend battle (campaign or free play). */
export interface ChallengeOptions {
  color: ColorChoice
  timeControlId: string
  customMinutes?: number
  customIncrementSeconds?: number
  strength: LegendStrength
}
