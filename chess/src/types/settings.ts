import type { GameSettings } from './chess'
import type { GrandRealmId } from './campaign'
import type { CampaignId } from './legend'
import type { BoardThemeId, PieceSetId, SoundMaterial } from './theme'

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
  // ── Haptics ──
  hapticsEnabled: boolean
  haptics: HapticSettings
  // ── Mobile ergonomics ──
  oneHanded: boolean
  gesturesEnabled: boolean
  gestureHintSeen: boolean
  /** The cinematic intro has been shown (it plays once automatically). */
  introSeen: boolean
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

export type LegendsScreen = 'select' | CampaignId | 'freeplay' | 'grand' | 'gauntlet' | 'tournament'
