import type { Difficulty, EngineConfig, GameSettings, TimeControl } from '../types/chess'

export const DIFFICULTIES: ReadonlyArray<{ id: Difficulty; label: string; description: string; elo: string }> = [
  { id: 'beginner', label: 'Beginner', description: 'Makes frequent mistakes', elo: '~800' },
  { id: 'intermediate', label: 'Intermediate', description: 'Solid club player', elo: '~1400' },
  { id: 'advanced', label: 'Advanced', description: 'Strong tactical play', elo: '~2000' },
  { id: 'expert', label: 'Expert', description: 'Full engine strength', elo: '2800+' },
]

export const ENGINE_CONFIGS: Readonly<Record<Difficulty, EngineConfig>> = {
  beginner: { skillLevel: 0, depth: 2, moveTimeMs: 150, minThinkMs: 600 },
  intermediate: { skillLevel: 6, depth: 6, moveTimeMs: 400, minThinkMs: 700 },
  advanced: { skillLevel: 13, depth: 12, moveTimeMs: 900, minThinkMs: 700 },
  expert: { skillLevel: 20, depth: 20, moveTimeMs: 1800, minThinkMs: 500 },
}

const MINUTE = 60_000
const SECOND = 1_000

export const TIME_CONTROLS: ReadonlyArray<TimeControl> = [
  { id: 'none', label: 'Unlimited', category: 'none', initialMs: 0, incrementMs: 0 },
  { id: 'bullet-1-0', label: '1 + 0', category: 'bullet', initialMs: 1 * MINUTE, incrementMs: 0 },
  { id: 'blitz-3-2', label: '3 + 2', category: 'blitz', initialMs: 3 * MINUTE, incrementMs: 2 * SECOND },
  { id: 'blitz-5-0', label: '5 + 0', category: 'blitz', initialMs: 5 * MINUTE, incrementMs: 0 },
  { id: 'rapid-10-0', label: '10 + 0', category: 'rapid', initialMs: 10 * MINUTE, incrementMs: 0 },
  { id: 'rapid-15-10', label: '15 + 10', category: 'rapid', initialMs: 15 * MINUTE, incrementMs: 10 * SECOND },
]

export const DEFAULT_TIME_CONTROL: TimeControl = TIME_CONTROLS[0] ?? {
  id: 'none',
  label: 'Unlimited',
  category: 'none',
  initialMs: 0,
  incrementMs: 0,
}

export function getTimeControl(id: string): TimeControl {
  return TIME_CONTROLS.find((tc) => tc.id === id) ?? DEFAULT_TIME_CONTROL
}

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'ai',
  difficulty: 'intermediate',
  playerColor: 'w',
  timeControlId: 'none',
}

export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const

export const STORAGE_KEYS = {
  settings: 'chess-arena:settings',
  sound: 'chess-arena:sound',
} as const

export const STOCKFISH_WORKER_PATH = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`
