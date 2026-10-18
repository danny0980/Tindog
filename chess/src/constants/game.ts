import type { Difficulty, GameSettings, Personality, TimeControl, TimeControlCategory } from '../types/chess'
import type { DifficultyConfig, OpponentProfile, StyleWeights } from '../types/engine'

export const DIFFICULTIES: ReadonlyArray<{ id: Difficulty; label: string; description: string }> = [
  { id: 'beginner', label: 'Beginner', description: 'Makes frequent mistakes — great for learning' },
  { id: 'intermediate', label: 'Intermediate', description: 'A solid club player' },
  { id: 'advanced', label: 'Advanced', description: 'Strong, tactically sharp play' },
  { id: 'expert', label: 'Expert', description: 'Near full engine strength' },
]

export const DIFFICULTY_CONFIGS: Readonly<Record<Difficulty, DifficultyConfig>> = {
  beginner: { skillLevel: 0, depth: 3, moveTimeMs: 200, minThinkMs: 650, toleranceCp: 220, noise: 0.9, elo: 800 },
  intermediate: { skillLevel: 6, depth: 7, moveTimeMs: 450, minThinkMs: 700, toleranceCp: 110, noise: 0.4, elo: 1400 },
  advanced: { skillLevel: 13, depth: 12, moveTimeMs: 900, minThinkMs: 650, toleranceCp: 55, noise: 0.15, elo: 2000 },
  expert: { skillLevel: 20, depth: 18, moveTimeMs: 1600, minThinkMs: 450, toleranceCp: 25, noise: 0.04, elo: 2600 },
}

export type PersonalityWeights = StyleWeights

export const PERSONALITIES: ReadonlyArray<{
  id: Personality
  name: string
  tagline: string
  weights: PersonalityWeights | null
}> = [
  { id: 'balanced', name: 'Balanced', tagline: 'Classic Stockfish — objective and precise', weights: null },
  {
    id: 'aggressive',
    name: 'Aggressive Attacker',
    tagline: 'Storms your king, loves checks and sacrifices',
    weights: {
      evaluation: 0.9, check: 1.1, capture: 0.12, forcing: 0.35, kingPressure: 1.6, advance: 0.25,
      castle: 0.1, kingShelter: -0.2, trade: -0.4, center: 0.2, development: 0.3, quiet: -0.2, earlyQueen: 0.2,
    },
  },
  {
    id: 'defensive',
    name: 'Defensive Wall',
    tagline: 'Solid, patient, trades down and waits for mistakes',
    weights: {
      evaluation: 1.1, check: 0, capture: 0.05, forcing: -0.2, kingPressure: -0.2, advance: -0.25,
      castle: 1.4, kingShelter: 0.9, trade: 0.9, center: 0.2, development: 0.4, quiet: 0.35, earlyQueen: -0.6,
    },
  },
  {
    id: 'tactical',
    name: 'Tactical Master',
    tagline: 'Hunts combinations, forcing lines and loose pieces',
    weights: {
      evaluation: 1.8, check: 0.8, capture: 0.3, forcing: 0.7, kingPressure: 0.5, advance: 0.1,
      castle: 0.2, kingShelter: 0, trade: 0, center: 0.1, development: 0.2, quiet: -0.4, earlyQueen: 0,
    },
  },
  {
    id: 'positional',
    name: 'Positional Grandmaster',
    tagline: 'Squeezes with space, structure and piece activity',
    weights: {
      evaluation: 1.3, check: -0.1, capture: 0.04, forcing: -0.25, kingPressure: 0.1, advance: 0.15,
      castle: 0.9, kingShelter: 0.2, trade: -0.1, center: 0.8, development: 1.0, quiet: 0.45, earlyQueen: -0.7,
    },
  },
]

const MINUTE = 60_000
const SECOND = 1_000

export const TIME_CONTROLS: ReadonlyArray<TimeControl> = [
  { id: 'none', label: 'Unlimited', category: 'none', initialMs: 0, incrementMs: 0 },
  { id: 'bullet-1-0', label: '1 + 0', category: 'bullet', initialMs: 1 * MINUTE, incrementMs: 0 },
  { id: 'bullet-2-1', label: '2 + 1', category: 'bullet', initialMs: 2 * MINUTE, incrementMs: 1 * SECOND },
  { id: 'blitz-3-2', label: '3 + 2', category: 'blitz', initialMs: 3 * MINUTE, incrementMs: 2 * SECOND },
  { id: 'blitz-5-3', label: '5 + 3', category: 'blitz', initialMs: 5 * MINUTE, incrementMs: 3 * SECOND },
  { id: 'rapid-10-5', label: '10 + 5', category: 'rapid', initialMs: 10 * MINUTE, incrementMs: 5 * SECOND },
  { id: 'rapid-15-10', label: '15 + 10', category: 'rapid', initialMs: 15 * MINUTE, incrementMs: 10 * SECOND },
  { id: 'classical-30-20', label: '30 + 20', category: 'classical', initialMs: 30 * MINUTE, incrementMs: 20 * SECOND },
]

export const TIME_CATEGORY_LABELS: Readonly<Record<TimeControlCategory, string>> = {
  none: 'Untimed',
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classical',
  custom: 'Fischer',
}

/** Categorises a custom Fischer control by estimated game duration (40 moves). */
function categorize(initialMs: number, incrementMs: number): TimeControlCategory {
  const estimated = initialMs + 40 * incrementMs
  if (estimated < 3 * MINUTE) return 'bullet'
  if (estimated < 10 * MINUTE) return 'blitz'
  if (estimated < 30 * MINUTE) return 'rapid'
  return 'classical'
}

export function resolveTimeControl(settings: Pick<GameSettings, 'timeControlId' | 'customMinutes' | 'customIncrementSeconds'>): TimeControl {
  if (settings.timeControlId === 'custom') {
    const initialMs = Math.max(0.5, settings.customMinutes) * MINUTE
    const incrementMs = Math.max(0, settings.customIncrementSeconds) * SECOND
    return {
      id: 'custom',
      label: `${settings.customMinutes} + ${settings.customIncrementSeconds}`,
      category: categorize(initialMs, incrementMs),
      initialMs,
      incrementMs,
    }
  }
  return TIME_CONTROLS.find((tc) => tc.id === settings.timeControlId) ?? (TIME_CONTROLS[0] as TimeControl)
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  mode: 'ai',
  difficulty: 'intermediate',
  personality: 'balanced',
  playerColor: 'w',
  timeControlId: 'none',
  customMinutes: 5,
  customIncrementSeconds: 3,
  legendId: null,
  legendStrength: 'authentic',
  bossId: null,
}

export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 } as const

export const STORAGE_KEYS = {
  settings: 'chess-arena:settings:v2',
  profile: 'chess-arena:profile:v1',
} as const

export const STOCKFISH_WORKER_PATH = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`

export const STARTING_ELO = 1200

/** Opponent profile for regular games: difficulty sets strength, personality sets style. */
export function standardOpponent(difficulty: GameSettings['difficulty'], personality: Personality): OpponentProfile {
  const config = DIFFICULTY_CONFIGS[difficulty]
  const weights = PERSONALITIES.find((p) => p.id === personality)?.weights ?? null
  return {
    skillLevel: config.skillLevel,
    depth: config.depth,
    moveTimeMs: config.moveTimeMs,
    minThinkMs: config.minThinkMs,
    multiPv: weights ? 4 : 1,
    toleranceCp: config.toleranceCp,
    noise: config.noise,
    weights,
  }
}
