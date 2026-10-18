import { DEFAULT_GAME_SETTINGS, DIFFICULTIES, PERSONALITIES, STORAGE_KEYS, TIME_CONTROLS } from '../constants/game'
import { BOARD_THEMES, PIECE_SETS } from '../constants/themes'
import { GRAND_REALM_IDS } from '../data/campaign/realms'
import { LEGEND_IDS } from '../data/legends'
import type { GameSettings } from '../types/chess'
import type { LegendId } from '../types/legend'
import type { AppSettings, HapticCategory, HapticIntensity, HapticSettings, SoundMaterialSetting } from '../types/settings'
import { createPersistentStore } from '../utils/store'
import { asRecord, bool, num, oneOf, str } from '../utils/validate'
import { isArtId } from '../assets/artManifest'

export const HAPTIC_INTENSITIES: readonly HapticIntensity[] = ['off', 'light', 'medium', 'heavy']
export const HAPTIC_CATEGORIES: readonly HapticCategory[] = ['pickup', 'move', 'capture', 'check', 'ui']
const SOUND_MATERIALS: readonly SoundMaterialSetting[] = ['theme', 'wood', 'marble', 'metal', 'synth', 'soft', 'crystal', 'ember']

export const DEFAULT_HAPTICS: HapticSettings = {
  pickup: 'light',
  move: 'light',
  capture: 'medium',
  check: 'heavy',
  ui: 'light',
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  boardTheme: 'classic-wood',
  pieceSet: 'standard',
  artPack: true,
  artPieces: null,
  artBoard: null,
  playerAvatar: null,
  masterVolume: 0.8,
  sfxEnabled: true,
  sfxVolume: 1,
  musicEnabled: false,
  musicVolume: 0.6,
  uiSoundsEnabled: true,
  uiVolume: 0.8,
  soundMaterial: 'theme',
  focusTrack: 'off',
  focusVolume: 0.5,
  moodEffects: true,
  hapticsEnabled: true,
  haptics: DEFAULT_HAPTICS,
  oneHanded: false,
  gesturesEnabled: true,
  gestureHintSeen: false,
  introSeen: false,
  batterySaver: false,
  autoBatterySaver: true,
  showEvalBar: true,
  showLegalMoves: true,
  showCoordinates: true,
  game: DEFAULT_GAME_SETTINGS,
  legendsScreen: 'select',
  grandRealm: 'chronicle',
}

const TIME_IDS = [...TIME_CONTROLS.map((t) => t.id), 'custom']

function sanitizeGame(raw: unknown): GameSettings {
  const g = asRecord(raw)
  const d = DEFAULT_GAME_SETTINGS
  return {
    mode: oneOf(g.mode, ['ai', 'local'], d.mode),
    difficulty: oneOf(g.difficulty, DIFFICULTIES.map((x) => x.id), d.difficulty),
    personality: oneOf(g.personality, PERSONALITIES.map((x) => x.id), d.personality),
    playerColor: oneOf(g.playerColor, ['w', 'b', 'random'], d.playerColor),
    timeControlId: oneOf(str(g.timeControlId, d.timeControlId), TIME_IDS, d.timeControlId),
    customMinutes: num(g.customMinutes, d.customMinutes, 0.5, 180),
    customIncrementSeconds: num(g.customIncrementSeconds, d.customIncrementSeconds, 0, 60),
    legendId: typeof g.legendId === 'string' && (LEGEND_IDS as readonly string[]).includes(g.legendId) ? (g.legendId as LegendId) : null,
    legendStrength: oneOf(g.legendStrength, ['novice', 'authentic', 'mythic'], d.legendStrength),
    // Games are not restored across reloads, and boss rosters load lazily — a
    // fresh session always starts outside a campaign battle.
    bossId: null,
  }
}

function sanitizeHaptics(raw: unknown): HapticSettings {
  const h = asRecord(raw)
  const out = { ...DEFAULT_HAPTICS }
  for (const category of HAPTIC_CATEGORIES) out[category] = oneOf(h[category], HAPTIC_INTENSITIES, DEFAULT_HAPTICS[category])
  return out
}

export function sanitizeSettings(raw: unknown): AppSettings {
  const s = asRecord(raw)
  const d = DEFAULT_SETTINGS
  return {
    version: 1,
    boardTheme: oneOf(s.boardTheme, BOARD_THEMES.map((t) => t.id), d.boardTheme),
    pieceSet: oneOf(s.pieceSet, PIECE_SETS.map((p) => p.id), d.pieceSet),
    artPack: bool(s.artPack, d.artPack),
    artPieces: isArtId(s.artPieces) ? s.artPieces : null,
    artBoard: isArtId(s.artBoard) ? s.artBoard : null,
    playerAvatar: isArtId(s.playerAvatar) ? s.playerAvatar : null,
    masterVolume: num(s.masterVolume, d.masterVolume, 0, 1),
    sfxEnabled: bool(s.sfxEnabled, d.sfxEnabled),
    sfxVolume: num(s.sfxVolume, d.sfxVolume, 0, 1),
    musicEnabled: bool(s.musicEnabled, d.musicEnabled),
    musicVolume: num(s.musicVolume, d.musicVolume, 0, 1),
    focusTrack: oneOf(s.focusTrack, ['off', 'rain', 'fireplace', 'cosmic'], d.focusTrack),
    focusVolume: num(s.focusVolume, d.focusVolume, 0, 1),
    moodEffects: bool(s.moodEffects, d.moodEffects),
    uiSoundsEnabled: bool(s.uiSoundsEnabled, d.uiSoundsEnabled),
    uiVolume: num(s.uiVolume, d.uiVolume, 0, 1),
    soundMaterial: oneOf(s.soundMaterial, SOUND_MATERIALS, d.soundMaterial),
    hapticsEnabled: bool(s.hapticsEnabled, d.hapticsEnabled),
    haptics: sanitizeHaptics(s.haptics),
    oneHanded: bool(s.oneHanded, d.oneHanded),
    gesturesEnabled: bool(s.gesturesEnabled, d.gesturesEnabled),
    gestureHintSeen: bool(s.gestureHintSeen, d.gestureHintSeen),
    introSeen: bool(s.introSeen, d.introSeen),
    batterySaver: bool(s.batterySaver, d.batterySaver),
    autoBatterySaver: bool(s.autoBatterySaver, d.autoBatterySaver),
    showEvalBar: bool(s.showEvalBar, d.showEvalBar),
    showLegalMoves: bool(s.showLegalMoves, d.showLegalMoves),
    showCoordinates: bool(s.showCoordinates, d.showCoordinates),
    game: sanitizeGame(s.game),
    legendsScreen: oneOf(s.legendsScreen, ['select', 'historical', 'fantasy', 'freeplay', 'grand', 'gauntlet', 'tournament'], d.legendsScreen),
    grandRealm: oneOf(s.grandRealm, GRAND_REALM_IDS, d.grandRealm),
  }
}

export const settingsStore = createPersistentStore<AppSettings>(STORAGE_KEYS.settings, sanitizeSettings)

export function updateSettings(patch: Partial<AppSettings>): void {
  settingsStore.set((prev) => ({ ...prev, ...patch }))
}
