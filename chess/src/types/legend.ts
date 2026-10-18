import type { Difficulty } from './chess'
import type { OpponentProfile } from './engine'
import type { BoardThemeId, PieceSetId } from './theme'

export type LegendId = 'cleopatra' | 'newton' | 'napoleon' | 'einstein'

export type EpochId = 'ancient' | 'scientific' | 'napoleonic' | 'modern'

/** Generative soundtrack flavour (see audio/ambientMusic.ts). */
export type MusicTexture = 'default' | 'ancient' | 'baroque' | 'imperial' | 'modern'

export type LegendIcon = 'eye' | 'apple' | 'flag' | 'atom'

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
  name: string
  /** Display span, e.g. "69–30 BCE". */
  span: string
  /** Signed year used to place the epoch on the timeline (negative = BCE). */
  year: number
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
