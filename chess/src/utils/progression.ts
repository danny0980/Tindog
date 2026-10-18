import { ACHIEVEMENTS } from '../constants/achievements'
import { DRAW_REWARD_FACTOR, LOSS_REWARD, MAX_ELO_HISTORY, MAX_MATCH_HISTORY, PUZZLE_ASSISTED_FACTOR, PUZZLE_REWARD, WIN_REWARD } from '../constants/economy'
import { DIFFICULTY_CONFIGS, PIECE_VALUES } from '../constants/game'
import { RUSH_MAX_COINS, RUSH_POINTS_PER_COIN } from '../constants/rush'
import { BOARD_THEMES, PIECE_SETS } from '../constants/themes'
import type { Color, Difficulty, GameMode, GameResult, Move, Outcome, Personality, TimeControl } from '../types/chess'
import type { AchievementDef, MatchRecord, PlayerProfile } from '../types/profile'
import type { Puzzle } from '../types/puzzle'
import type { QuestEvents } from '../types/quest'
import type { BoardThemeId, PieceSetId } from '../types/theme'
import { localDateKey, previousDateKey } from './date'

// ── Achievements ─────────────────────────────────────────────────────────────

export function grant(profile: PlayerProfile, ids: string[], nowIso: string): { profile: PlayerProfile; unlocked: AchievementDef[] } {
  const unlocked = ACHIEVEMENTS.filter((a) => ids.includes(a.id) && !profile.achievements[a.id])
  if (unlocked.length === 0) return { profile, unlocked }
  const achievements = { ...profile.achievements }
  for (const a of unlocked) achievements[a.id] = nowIso
  const coins = unlocked.reduce((sum, a) => sum + a.reward, 0)
  return {
    profile: { ...profile, achievements, coins: profile.coins + coins, totalCoinsEarned: profile.totalCoinsEarned + coins },
    unlocked,
  }
}

// ── Elo ──────────────────────────────────────────────────────────────────────

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400))
}

export function eloDelta(rating: number, opponent: number, score: number, gamesPlayed: number): number {
  const k = gamesPlayed < 30 ? 40 : 20
  return Math.round(k * (score - expectedScore(rating, opponent)))
}

// ── Matches ──────────────────────────────────────────────────────────────────

export interface MatchInput {
  mode: GameMode
  opponent: string
  difficulty: Difficulty | null
  personality: Personality | null
  humanColor: Color | null
  result: GameResult
  pgn: string
  history: readonly Move[]
  timeControl: TimeControl
  rated: boolean
  opening: string | null
}

export interface MatchOutcome {
  profile: PlayerProfile
  record: MatchRecord
  eloDelta: number | null
  coins: number
  unlocked: AchievementDef[]
}

export function outcomeFor(result: GameResult, color: Color): Outcome {
  if (result.kind === 'draw') return 'draw'
  return result.winner === color ? 'win' : 'loss'
}

/** Lowest material balance (from `color`'s view) reached during the game. */
function worstMaterial(history: readonly Move[], color: Color): number {
  let balance = 0
  let worst = 0
  for (const move of history) {
    const sign = move.color === color ? 1 : -1
    if (move.captured) balance += sign * PIECE_VALUES[move.captured]
    if (move.promotion) balance += sign * (PIECE_VALUES[move.promotion] - PIECE_VALUES.p)
    worst = Math.min(worst, balance)
  }
  return worst
}

export function applyMatch(profile: PlayerProfile, input: MatchInput, now: Date = new Date()): MatchOutcome {
  const nowIso = now.toISOString()
  const id = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const isAi = input.mode === 'ai' && input.humanColor !== null && input.difficulty !== null
  const baseRecord: MatchRecord = {
    id,
    date: nowIso,
    mode: input.mode,
    opponent: input.opponent,
    difficulty: input.difficulty,
    personality: input.personality,
    humanColor: input.humanColor,
    result: input.result,
    outcome: null,
    pgn: input.pgn,
    plies: input.history.length,
    timeControl: input.timeControl.label,
    rated: false,
    eloBefore: null,
    eloAfter: null,
    coins: 0,
    accuracy: null,
    opening: input.opening,
  }

  if (!isAi || input.humanColor === null || input.difficulty === null) {
    return {
      profile: { ...profile, matches: [baseRecord, ...profile.matches].slice(0, MAX_MATCH_HISTORY) },
      record: baseRecord,
      eloDelta: null,
      coins: 0,
      unlocked: [],
    }
  }

  const human = input.humanColor
  const difficulty = input.difficulty
  const outcome = outcomeFor(input.result, human)
  const score = outcome === 'win' ? 1 : outcome === 'draw' ? 0.5 : 0

  // Elo (only rated games — takebacks make a game casual).
  const delta = input.rated ? eloDelta(profile.elo, DIFFICULTY_CONFIGS[difficulty].elo, score, profile.stats.games) : null
  const elo = Math.max(100, profile.elo + (delta ?? 0))

  // Coins.
  const base = outcome === 'win' ? WIN_REWARD[difficulty] : outcome === 'draw' ? Math.round(WIN_REWARD[difficulty] * DRAW_REWARD_FACTOR) : LOSS_REWARD
  const coins = input.rated ? base : Math.ceil(base / 2)

  // Stats.
  const stats = profile.stats
  const currentStreak = outcome === 'win' ? stats.currentStreak + 1 : 0
  const personalitiesBeaten =
    outcome === 'win' && input.personality && input.personality !== 'balanced' && !stats.personalitiesBeaten.includes(input.personality)
      ? [...stats.personalitiesBeaten, input.personality]
      : stats.personalitiesBeaten
  const nextStats = {
    games: stats.games + 1,
    wins: stats.wins + (outcome === 'win' ? 1 : 0),
    losses: stats.losses + (outcome === 'loss' ? 1 : 0),
    draws: stats.draws + (outcome === 'draw' ? 1 : 0),
    winsByDifficulty: { ...stats.winsByDifficulty, [difficulty]: stats.winsByDifficulty[difficulty] + (outcome === 'win' ? 1 : 0) },
    personalitiesBeaten,
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
  }

  const record: MatchRecord = {
    ...baseRecord,
    outcome,
    rated: input.rated,
    eloBefore: input.rated ? profile.elo : null,
    eloAfter: input.rated ? elo : null,
    coins,
  }

  let next: PlayerProfile = {
    ...profile,
    elo,
    peakElo: Math.max(profile.peakElo, elo),
    eloHistory: input.rated ? [...profile.eloHistory, { date: nowIso, elo }].slice(-MAX_ELO_HISTORY) : profile.eloHistory,
    stats: nextStats,
    coins: profile.coins + coins,
    totalCoinsEarned: profile.totalCoinsEarned + coins,
    matches: [record, ...profile.matches].slice(0, MAX_MATCH_HISTORY),
  }

  // Achievement checks.
  const ids: string[] = []
  const won = outcome === 'win'
  const humanMoves = input.history.filter((m) => m.color === human)
  const lastMove = input.history[input.history.length - 1]
  if (won) ids.push('first-blood')
  if (won && input.result.kind === 'checkmate' && humanMoves.length <= 10) ids.push('checkmate-in-10')
  if (won && (input.timeControl.category === 'bullet' || input.timeControl.category === 'blitz')) ids.push('speed-demon')
  if (won && (difficulty === 'advanced' || difficulty === 'expert')) ids.push('advanced-conqueror')
  if (won && difficulty === 'expert') ids.push('slayer-of-expert')
  if (personalitiesBeaten.length >= 4) ids.push('mind-reader')
  if (won && !input.history.some((m) => m.color !== human && m.captured === 'q')) ids.push('queens-guard')
  if (humanMoves.some((m) => m.promotion)) ids.push('pawn-star')
  if (won && input.result.kind === 'checkmate' && lastMove?.piece === 'n') ids.push('knightmare')
  if (outcome === 'draw') ids.push('peacemaker')
  if (won && input.result.kind === 'timeout') ids.push('time-lord')
  if (won && worstMaterial(input.history, human) <= -5) ids.push('comeback-kid')
  if (currentStreak >= 3) ids.push('hat-trick')
  if (nextStats.games >= 10) ids.push('dedicated')
  if (nextStats.games >= 50) ids.push('veteran')
  if (elo >= 1500) ids.push('rising-star')
  if (elo >= 1800) ids.push('master-class')

  const granted = grant(next, ids, nowIso)
  next = granted.profile
  return { profile: next, record, eloDelta: delta, coins, unlocked: granted.unlocked }
}

// ── Analysis ─────────────────────────────────────────────────────────────────

export function applyAnalysis(
  profile: PlayerProfile,
  matchId: string | null,
  accuracy: number | null,
  won: boolean,
  now: Date = new Date(),
): { profile: PlayerProfile; unlocked: AchievementDef[] } {
  const matches =
    matchId && accuracy !== null
      ? profile.matches.map((m) => (m.id === matchId ? { ...m, accuracy: Math.round(accuracy * 10) / 10 } : m))
      : profile.matches
  const ids = ['analyst']
  if (won && accuracy !== null && accuracy >= 90) ids.push('surgical-precision')
  return grant({ ...profile, matches, gamesAnalyzed: profile.gamesAnalyzed + 1 }, ids, now.toISOString())
}

// ── Puzzles ──────────────────────────────────────────────────────────────────

export function applyPuzzleSolve(
  profile: PlayerProfile,
  puzzle: Puzzle,
  options: { daily: boolean; assisted: boolean },
  now: Date = new Date(),
): { profile: PlayerProfile; coins: number; unlocked: AchievementDef[]; firstSolve: boolean } {
  if (profile.puzzles.solved[puzzle.id]) return { profile, coins: 0, unlocked: [], firstSolve: false }
  const today = localDateKey(now)
  const puzzles = { ...profile.puzzles, solved: { ...profile.puzzles.solved, [puzzle.id]: today } }
  let coins = 0
  if (options.daily) {
    coins = Math.round(PUZZLE_REWARD[puzzle.mateIn] * (options.assisted ? PUZZLE_ASSISTED_FACTOR : 1))
    if (puzzles.lastSolvedDate !== today) {
      puzzles.streak = puzzles.lastSolvedDate === previousDateKey(today) ? puzzles.streak + 1 : 1
      puzzles.lastSolvedDate = today
      puzzles.bestStreak = Math.max(puzzles.bestStreak, puzzles.streak)
    }
  }
  const solvedCount = Object.keys(puzzles.solved).length
  const ids = ['puzzle-apprentice']
  if (puzzles.streak >= 3) ids.push('on-fire')
  if (solvedCount >= 25) ids.push('puzzle-master')
  const granted = grant(
    { ...profile, puzzles, coins: profile.coins + coins, totalCoinsEarned: profile.totalCoinsEarned + coins },
    ids,
    now.toISOString(),
  )
  return { profile: granted.profile, coins, unlocked: granted.unlocked, firstSolve: true }
}

// ── Shop ─────────────────────────────────────────────────────────────────────

export type ShopItem = { kind: 'theme'; id: BoardThemeId } | { kind: 'pieces'; id: PieceSetId }

export function itemPrice(item: ShopItem): number {
  if (item.kind === 'theme') return BOARD_THEMES.find((t) => t.id === item.id)?.price ?? 0
  return PIECE_SETS.find((p) => p.id === item.id)?.price ?? 0
}

export function ownsItem(profile: PlayerProfile, item: ShopItem): boolean {
  return item.kind === 'theme' ? profile.unlockedThemes.includes(item.id) : profile.unlockedPieceSets.includes(item.id)
}

export function purchase(
  profile: PlayerProfile,
  item: ShopItem,
  now: Date = new Date(),
): { ok: boolean; profile: PlayerProfile; unlocked: AchievementDef[] } {
  const price = itemPrice(item)
  if (ownsItem(profile, item) || profile.coins < price) return { ok: false, profile, unlocked: [] }
  const next: PlayerProfile = {
    ...profile,
    coins: profile.coins - price,
    unlockedThemes: item.kind === 'theme' ? [...profile.unlockedThemes, item.id] : profile.unlockedThemes,
    unlockedPieceSets: item.kind === 'pieces' ? [...profile.unlockedPieceSets, item.id] : profile.unlockedPieceSets,
  }
  const premium =
    next.unlockedThemes.filter((id) => (BOARD_THEMES.find((t) => t.id === id)?.price ?? 0) > 0).length +
    next.unlockedPieceSets.filter((id) => (PIECE_SETS.find((p) => p.id === id)?.price ?? 0) > 0).length
  const granted = premium >= 3 ? grant(next, ['collector'], now.toISOString()) : { profile: next, unlocked: [] }
  return { ok: true, ...granted }
}

/** Rank title shown on the profile card. */
export function rankTitle(elo: number): string {
  if (elo >= 2200) return 'Grandmaster'
  if (elo >= 2000) return 'Master'
  if (elo >= 1800) return 'Expert'
  if (elo >= 1600) return 'Class A'
  if (elo >= 1400) return 'Class B'
  if (elo >= 1200) return 'Class C'
  if (elo >= 1000) return 'Class D'
  return 'Novice'
}

// ── Quest events from a finished match ───────────────────────────────────────

export function matchQuestEvents(input: MatchInput): QuestEvents {
  const ai = input.mode === 'ai' && input.humanColor !== null
  // In local games both sides are "you", so every move counts.
  const mine = input.history.filter((m) => !ai || m.color === input.humanColor)
  const won = ai && input.humanColor !== null && outcomeFor(input.result, input.humanColor) === 'win'
  const humanMoves = mine.length
  return {
    games_played: 1,
    ai_wins: won ? 1 : 0,
    black_wins: won && input.humanColor === 'b' ? 1 : 0,
    fast_wins: won && humanMoves <= 25 ? 1 : 0,
    timed_games: input.timeControl.initialMs > 0 ? 1 : 0,
    captures: mine.filter((m) => m.captured).length,
    checks: mine.filter((m) => m.san.includes('+') || m.san.includes('#')).length,
    castles: mine.some((m) => m.isKingsideCastle() || m.isQueensideCastle()) ? 1 : 0,
    promotions: mine.filter((m) => m.promotion).length,
  }
}

// ── Time Rush ────────────────────────────────────────────────────────────────

export function applyRushResult(
  profile: PlayerProfile,
  score: number,
  round: number,
  now: Date = new Date(),
): { profile: PlayerProfile; coins: number; newBest: boolean; unlocked: AchievementDef[] } {
  const coins = Math.min(RUSH_MAX_COINS, Math.floor(score / RUSH_POINTS_PER_COIN))
  const newBest = score > profile.rush.bestScore
  const next: PlayerProfile = {
    ...profile,
    coins: profile.coins + coins,
    totalCoinsEarned: profile.totalCoinsEarned + coins,
    rush: {
      bestScore: Math.max(profile.rush.bestScore, score),
      bestRound: Math.max(profile.rush.bestRound, round),
      runs: profile.rush.runs + 1,
      totalScore: profile.rush.totalScore + score,
    },
  }
  const ids: string[] = []
  if (score >= 5000) ids.push('rush-hour')
  if (score >= 20000) ids.push('arcade-legend')
  const granted = grant(next, ids, now.toISOString())
  return { profile: granted.profile, coins, newBest, unlocked: granted.unlocked }
}
