import type { CinematicMode } from '../cinema/director'
import type { CoachMode } from '../coach/patterns'
import type { BattlefieldSetting } from '../cinema/terrain'
import type { TierId } from '../data/campaign/tiers'
import type { GameSettings } from './chess'
import type { GrandRealmId } from './campaign'
import type { CampaignId } from './legend'
import type { PortraitSpec } from './persona'
import type { BoardThemeId, PieceSetId, SoundMaterial } from './theme'

/**
 * A beaten opponent worn as your avatar: a Classic character, a Grand Campaign
 * boss or a Chronos legend. Name and emblem are kept with the choice, so it shows
 * even before a lazily loaded campaign realm is in memory.
 */
export interface TrophyAvatar {
  /** Persona key: "classic:morphy", "boss:cyber.oracle-7", "legend:napoleon". */
  key: string
  name: string
  portrait: PortraitSpec
}

export type HapticIntensity = 'off' | 'light' | 'medium' | 'heavy'

/** Independently tunable haptic channels. */
export type HapticCategory = 'pickup' | 'move' | 'capture' | 'check' | 'ui'

export type HapticSettings = Record<HapticCategory, HapticIntensity>

/** 'theme' follows the equipped board theme's material. */
export type SoundMaterialSetting = SoundMaterial | 'theme'

export interface AppSettings {
  version: 1
  boardTheme: BoardThemeId
  pieceSet: PieceSetId
  /** Art pack: use custom portraits / pieces / boards from public/assets when available. */
  artPack: boolean
  /** Art piece set and board chosen explicitly (null = follow the theme / battle). */
  artPieces: string | null
  artBoard: string | null
  /** Size of art-pack pieces on the board (1 = fit the square; larger stand taller, like 3D pieces). */
  artPieceScale: number
  /** Battles show the opponent's realm / era look ('realm') or your own board and pieces ('mine'). */
  battleLook: 'realm' | 'mine'
  /** Art-pack background shown behind the board in battles (null = none). */
  arenaBackdrop: string | null
  /** Grand Campaign difficulty tier. */
  campaignTier: TierId
  /** Roll random mutators before campaign battles. */
  battleMutators: boolean
  /** An opponent you have beaten, used as your avatar (null = none). */
  trophyAvatar: TrophyAvatar | null
  /** The name other players see online ('' = ask). */
  onlineName: string
  /** Preferred clock for online rooms you create (a TIME_CONTROLS id from online/protocol). */
  onlineTimeControl: string
  /** Art-pack player avatar (null = the default icon). */
  playerAvatar: string | null
  // ── Audio mixer ──
  masterVolume: number
  sfxEnabled: boolean
  sfxVolume: number
  musicEnabled: boolean
  musicVolume: number
  uiSoundsEnabled: boolean
  uiVolume: number
  soundMaterial: SoundMaterialSetting
  /** Ambient focus soundscape (rain, fireplace, cosmic hum) and its level. */
  focusTrack: 'off' | 'rain' | 'fireplace' | 'cosmic'
  focusVolume: number
  /** Arena lighting follows the opponent's alignment; severe checks shake the screen. */
  moodEffects: boolean
  /** Cinematic camera on big moments: never, key moments (mates, promotions, queens falling) or every highlight. */
  cinematicCamera: CinematicMode
  /** The ground the board stands on: from the board theme ('auto'), none, or a chosen terrain. */
  battlefield: BattlefieldSetting
  /** Pieces react to the position (trembling king, shining knight, glowing pawn). */
  pieceReactions: boolean
  /** Predictive coach: warn before a move that walks into a trap — only ones that have cost you before ('mine'), any, or never. */
  coachWarnings: CoachMode
  // ── Haptics ──
  hapticsEnabled: boolean
  haptics: HapticSettings
  // ── Mobile ergonomics ──
  oneHanded: boolean
  gesturesEnabled: boolean
  gestureHintSeen: boolean
  /** The cinematic intro has been shown (it plays once automatically). */
  introSeen: boolean
  /** The opening film ("One Game. Every Era.") has been shown (it plays once automatically; a new film resets it). */
  openingSeen: boolean
  // ── Performance ──
  batterySaver: boolean
  autoBatterySaver: boolean
  // ── Board ──
  showEvalBar: boolean
  showLegalMoves: boolean
  showCoordinates: boolean
  game: GameSettings
  /** Last screen visited in the Legends hub (campaign select, a campaign map or free play). */
  legendsScreen: LegendsScreen
  /** Realm last opened on the Grand Campaign world map. */
  grandRealm: GrandRealmId
}

export type LegendsScreen = 'select' | CampaignId | 'freeplay' | 'grand' | 'gauntlet' | 'tournament' | 'classic' | 'variants' | 'openings' | 'battles' | 'museum' | 'quiz' | 'ghost' | 'war' | 'cards' | 'vanish' | 'escape' | 'royale'
