import type { GameSettings } from './chess'
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
  // ── Audio mixer ──
  masterVolume: number
  sfxEnabled: boolean
  sfxVolume: number
  musicEnabled: boolean
  musicVolume: number
  uiSoundsEnabled: boolean
  uiVolume: number
  soundMaterial: SoundMaterialSetting
  // ── Haptics ──
  hapticsEnabled: boolean
  haptics: HapticSettings
  // ── Mobile ergonomics ──
  oneHanded: boolean
  gesturesEnabled: boolean
  gestureHintSeen: boolean
  // ── Performance ──
  batterySaver: boolean
  autoBatterySaver: boolean
  // ── Board ──
  showEvalBar: boolean
  showLegalMoves: boolean
  showCoordinates: boolean
  game: GameSettings
}
