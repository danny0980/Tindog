import { DEFAULT_GAME_SETTINGS, DIFFICULTIES, PERSONALITIES, STORAGE_KEYS, TIME_CONTROLS } from '../constants/game'
import { BOARD_THEMES, PIECE_SETS } from '../constants/themes'
import type { GameSettings } from '../types/chess'
import type { AppSettings } from '../types/settings'
import { createPersistentStore } from '../utils/store'
import { asRecord, bool, num, oneOf, str } from '../utils/validate'

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  boardTheme: 'classic-wood',
  pieceSet: 'standard',
  masterVolume: 0.8,
  sfxEnabled: true,
  musicEnabled: false,
  hapticsEnabled: true,
  batterySaver: false,
  autoBatterySaver: true,
  showEvalBar: true,
  showLegalMoves: true,
  showCoordinates: true,
  game: DEFAULT_GAME_SETTINGS,
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
  }
}

export function sanitizeSettings(raw: unknown): AppSettings {
  const s = asRecord(raw)
  const d = DEFAULT_SETTINGS
  return {
    version: 1,
    boardTheme: oneOf(s.boardTheme, BOARD_THEMES.map((t) => t.id), d.boardTheme),
    pieceSet: oneOf(s.pieceSet, PIECE_SETS.map((p) => p.id), d.pieceSet),
    masterVolume: num(s.masterVolume, d.masterVolume, 0, 1),
    sfxEnabled: bool(s.sfxEnabled, d.sfxEnabled),
    musicEnabled: bool(s.musicEnabled, d.musicEnabled),
    hapticsEnabled: bool(s.hapticsEnabled, d.hapticsEnabled),
    batterySaver: bool(s.batterySaver, d.batterySaver),
    autoBatterySaver: bool(s.autoBatterySaver, d.autoBatterySaver),
    showEvalBar: bool(s.showEvalBar, d.showEvalBar),
    showLegalMoves: bool(s.showLegalMoves, d.showLegalMoves),
    showCoordinates: bool(s.showCoordinates, d.showCoordinates),
    game: sanitizeGame(s.game),
  }
}

export const settingsStore = createPersistentStore<AppSettings>(STORAGE_KEYS.settings, sanitizeSettings)

export function updateSettings(patch: Partial<AppSettings>): void {
  settingsStore.set((prev) => ({ ...prev, ...patch }))
}
