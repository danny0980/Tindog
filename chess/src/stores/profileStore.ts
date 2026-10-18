import { STARTING_ELO, STORAGE_KEYS } from '../constants/game'
import { BOARD_THEMES, FREE_PIECE_SETS, FREE_THEMES, PIECE_SETS } from '../constants/themes'
import type { Color, Difficulty, GameMode, GameResult, Outcome, Personality } from '../types/chess'
import type { EloPoint, MatchRecord, PlayerProfile } from '../types/profile'
import type { QuestMetric } from '../types/quest'
import { EPOCH_IDS, LEGEND_IDS } from '../data/legends'
import type { EpochId, LegendId, LegendProgress } from '../types/legend'
import type { BoardThemeId, PieceSetId } from '../types/theme'
import { createPersistentStore } from '../utils/store'
import { arrayOf, asRecord, isRecord, num, oneOf, str, stringRecord } from '../utils/validate'

export function createDefaultProfile(): PlayerProfile {
  return {
    version: 1,
    name: 'You',
    elo: STARTING_ELO,
    peakElo: STARTING_ELO,
    eloHistory: [{ date: new Date().toISOString(), elo: STARTING_ELO }],
    stats: {
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winsByDifficulty: { beginner: 0, intermediate: 0, advanced: 0, expert: 0 },
      personalitiesBeaten: [],
      currentStreak: 0,
      bestStreak: 0,
    },
    coins: 100,
    totalCoinsEarned: 100,
    unlockedThemes: [...FREE_THEMES],
    unlockedPieceSets: [...FREE_PIECE_SETS],
    achievements: {},
    matches: [],
    puzzles: { solved: {}, lastSolvedDate: null, streak: 0, bestStreak: 0 },
    gamesAnalyzed: 0,
    quests: { date: '', progress: {}, claimed: [], bonusClaimed: false, perfectDays: 0 },
    rush: { bestScore: 0, bestRound: 0, runs: 0, totalScore: 0 },
    legends: { defeated: {}, wins: {}, losses: {}, draws: {}, epochsVisited: [] },
  }
}

const isLegendId = (v: unknown): v is LegendId => typeof v === 'string' && (LEGEND_IDS as readonly string[]).includes(v)
const isEpochId = (v: unknown): v is EpochId => typeof v === 'string' && (EPOCH_IDS as readonly string[]).includes(v)

function legendRecord<T>(raw: unknown, guard: (v: unknown) => v is T): Partial<Record<LegendId, T>> {
  const out: Partial<Record<LegendId, T>> = {}
  for (const [key, value] of Object.entries(asRecord(raw))) if (isLegendId(key) && guard(value)) out[key] = value
  return out
}
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isString = (v: unknown): v is string => typeof v === 'string'

function sanitizeLegends(raw: unknown): LegendProgress {
  const l = asRecord(raw)
  return {
    defeated: legendRecord(l.defeated, isString),
    wins: legendRecord(l.wins, isCount),
    losses: legendRecord(l.losses, isCount),
    draws: legendRecord(l.draws, isCount),
    epochsVisited: arrayOf(l.epochsVisited, isEpochId),
  }
}

function sanitizeQuestProgress(raw: unknown): Partial<Record<QuestMetric, number>> {
  const out: Partial<Record<QuestMetric, number>> = {}
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if ((QUEST_METRICS as string[]).includes(key) && typeof value === 'number' && Number.isFinite(value)) out[key as QuestMetric] = Math.max(0, value)
  }
  return out
}

const QUEST_METRICS: QuestMetric[] = [
  'games_played', 'ai_wins', 'black_wins', 'fast_wins', 'timed_games', 'captures', 'checks',
  'castles', 'promotions', 'puzzles_solved', 'analyses', 'rush_runs', 'rush_points',
]
const THEME_IDS = BOARD_THEMES.map((t) => t.id)
const PIECE_IDS = PIECE_SETS.map((p) => p.id)
const PERSONALITY_IDS: Personality[] = ['balanced', 'aggressive', 'defensive', 'tactical', 'positional']
const DIFFICULTY_IDS: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'expert']

const isEloPoint = (v: unknown): v is EloPoint => isRecord(v) && typeof v.date === 'string' && typeof v.elo === 'number'
const isThemeId = (v: unknown): v is BoardThemeId => typeof v === 'string' && (THEME_IDS as string[]).includes(v)
const isPieceId = (v: unknown): v is PieceSetId => typeof v === 'string' && (PIECE_IDS as string[]).includes(v)
const isPersonality = (v: unknown): v is Personality => typeof v === 'string' && (PERSONALITY_IDS as string[]).includes(v)
const isColor = (v: unknown): v is Color => v === 'w' || v === 'b'

function isGameResult(v: unknown): v is GameResult {
  if (!isRecord(v)) return false
  if (v.kind === 'draw') return typeof v.reason === 'string'
  return (v.kind === 'checkmate' || v.kind === 'resign' || v.kind === 'timeout') && isColor(v.winner)
}

function sanitizeMatch(v: unknown): MatchRecord | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.pgn !== 'string' || !isGameResult(v.result)) return null
  const nullableNum = (x: unknown) => (typeof x === 'number' ? x : null)
  return {
    id: v.id,
    date: str(v.date, new Date(0).toISOString()),
    mode: oneOf<GameMode>(v.mode, ['ai', 'local'], 'ai'),
    opponent: str(v.opponent, 'Opponent'),
    difficulty: typeof v.difficulty === 'string' && (DIFFICULTY_IDS as string[]).includes(v.difficulty) ? (v.difficulty as Difficulty) : null,
    personality: isPersonality(v.personality) ? v.personality : null,
    humanColor: isColor(v.humanColor) ? v.humanColor : null,
    result: v.result,
    outcome: v.outcome === 'win' || v.outcome === 'loss' || v.outcome === 'draw' ? (v.outcome as Outcome) : null,
    pgn: v.pgn,
    plies: num(v.plies, 0, 0),
    timeControl: str(v.timeControl, 'Unlimited'),
    rated: v.rated === true,
    eloBefore: nullableNum(v.eloBefore),
    eloAfter: nullableNum(v.eloAfter),
    coins: num(v.coins, 0, 0),
    accuracy: nullableNum(v.accuracy),
    opening: typeof v.opening === 'string' ? v.opening : null,
    legendId: isLegendId(v.legendId) ? v.legendId : null,
  }
}

export function sanitizeProfile(raw: unknown): PlayerProfile {
  const d = createDefaultProfile()
  if (!isRecord(raw) || raw.version !== 1) return d
  const stats = asRecord(raw.stats)
  const wbd = asRecord(stats.winsByDifficulty)
  const puzzles = asRecord(raw.puzzles)
  const quests = asRecord(raw.quests)
  const rush = asRecord(raw.rush)
  const themes = arrayOf(raw.unlockedThemes, isThemeId)
  const pieces = arrayOf(raw.unlockedPieceSets, isPieceId)
  const elo = num(raw.elo, d.elo, 100, 4000)
  return {
    version: 1,
    name: str(raw.name, d.name).slice(0, 24),
    elo,
    peakElo: num(raw.peakElo, elo, 100, 4000),
    eloHistory: arrayOf(raw.eloHistory, isEloPoint),
    stats: {
      games: num(stats.games, 0, 0),
      wins: num(stats.wins, 0, 0),
      losses: num(stats.losses, 0, 0),
      draws: num(stats.draws, 0, 0),
      winsByDifficulty: {
        beginner: num(wbd.beginner, 0, 0),
        intermediate: num(wbd.intermediate, 0, 0),
        advanced: num(wbd.advanced, 0, 0),
        expert: num(wbd.expert, 0, 0),
      },
      personalitiesBeaten: arrayOf(stats.personalitiesBeaten, isPersonality),
      currentStreak: num(stats.currentStreak, 0, 0),
      bestStreak: num(stats.bestStreak, 0, 0),
    },
    coins: num(raw.coins, d.coins, 0),
    totalCoinsEarned: num(raw.totalCoinsEarned, d.totalCoinsEarned, 0),
    unlockedThemes: [...new Set([...FREE_THEMES, ...themes])],
    unlockedPieceSets: [...new Set([...FREE_PIECE_SETS, ...pieces])],
    achievements: stringRecord(raw.achievements),
    matches: (Array.isArray(raw.matches) ? raw.matches : []).map(sanitizeMatch).filter((m): m is MatchRecord => m !== null),
    puzzles: {
      solved: stringRecord(puzzles.solved),
      lastSolvedDate: typeof puzzles.lastSolvedDate === 'string' ? puzzles.lastSolvedDate : null,
      streak: num(puzzles.streak, 0, 0),
      bestStreak: num(puzzles.bestStreak, 0, 0),
    },
    gamesAnalyzed: num(raw.gamesAnalyzed, 0, 0),
    quests: {
      date: str(quests.date, ''),
      progress: sanitizeQuestProgress(quests.progress),
      claimed: Array.isArray(quests.claimed) ? quests.claimed.filter((x): x is string => typeof x === 'string') : [],
      bonusClaimed: quests.bonusClaimed === true,
      perfectDays: num(quests.perfectDays, 0, 0),
    },
    rush: {
      bestScore: num(rush.bestScore, 0, 0),
      bestRound: num(rush.bestRound, 0, 0),
      runs: num(rush.runs, 0, 0),
      totalScore: num(rush.totalScore, 0, 0),
    },
    legends: sanitizeLegends(raw.legends),
  }
}

export const profileStore = createPersistentStore<PlayerProfile>(STORAGE_KEYS.profile, sanitizeProfile)

export function resetProfile(): void {
  profileStore.set(createDefaultProfile())
}
