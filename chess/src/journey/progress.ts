// Booking activity into the Journey: XP and levels, season XP, league points,
// and the weekly / seasonal rollovers. Pure (state in, state out) and
// unit-tested; journeyActions.ts applies the results to the stores.
import type { ClassicEraId } from '../data/classic/roster'
import type { Outcome } from '../types/chess'
import { localDateKey } from '../utils/date'
import { type LeagueResult, nextTier, settleWeek, weekKey } from './league'
import { SEASON_ERA_BONUS, seasonFor, tiersReached } from './season'
import { skillEffects } from './skills'
import { MAX_LEAGUE_HISTORY, type JourneyState } from './state'
import { MAX_LEVEL, MAX_PRESTIGE, baseXp, levelInfo, withBonus } from './xp'

export interface Rollover {
  journey: JourneyState
  /** Last week's league result, when a week closed. */
  league: LeagueResult | null
  /** The season that just ended (index and pass tier reached). */
  seasonEnded: { index: number; tier: number } | null
  coins: number
}

/** Moves the Journey into the current week and season (closing what ended). */
export function rollover(j: JourneyState, playerName: string, now: Date = new Date()): Rollover {
  let next = j
  let league: LeagueResult | null = null
  let seasonEnded: Rollover['seasonEnded'] = null
  let coins = 0
  const week = weekKey(now)
  if (next.league.week !== week) {
    if (next.league.week) {
      league = settleWeek(next.league.week, next.league.tier, next.league.points, playerName)
      coins += league.coins
      next = {
        ...next,
        league: { week, tier: nextTier(next.league.tier, league.move), points: 0 },
        leagueHistory: [...next.leagueHistory, league].slice(-MAX_LEAGUE_HISTORY),
        // Finishing a week in the Diamond league earns its frame.
        frames: league.tier === 'diamond' && !next.frames.includes('league-diamond') ? [...next.frames, 'league-diamond'] : next.frames,
      }
    } else {
      next = { ...next, league: { ...next.league, week, points: 0 } }
    }
  }
  const season = seasonFor(now)
  if (next.season.index !== season.index) {
    if (next.season.index >= 0) {
      seasonEnded = { index: next.season.index, tier: tiersReached(next.season.xp) }
      next = { ...next, seasonHistory: [...next.seasonHistory, seasonEnded].slice(-20) }
    }
    next = { ...next, season: { index: season.index, xp: 0, claimed: [] } }
  }
  return { journey: next, league, seasonEnded, coins }
}

export interface ActivityInput {
  outcome: Outcome | null
  /** Your rating and your opponent's, when it was a rated opponent. */
  elo?: number
  opponentElo?: number | null
  /** The Classic era of the opponent (the season's era earns bonus XP). */
  era?: ClassicEraId | null
  /** Fixed XP for activities that aren't games (puzzles, lessons, runs). */
  base?: number
  /** Coins the activity already paid (the Treasury skills add a share). */
  coins?: number
  /** Counts as a finished game (first-game-of-the-day bonus). */
  game?: boolean
}

export interface ActivityResult {
  journey: JourneyState
  xp: number
  leaguePoints: number
  bonusCoins: number
  levelBefore: number
  levelAfter: number
  tierBefore: number
  tierAfter: number
  firstOfDay: boolean
}

export function applyActivity(j: JourneyState, input: ActivityInput, now: Date = new Date()): ActivityResult {
  const fx = skillEffects(j.skills)
  const today = localDateKey(now)
  const firstOfDay = Boolean(input.game) && j.lastGameDate !== today && input.outcome === 'win'
  const season = seasonFor(now)
  const eraBonus = input.era && input.era === season.theme.era ? SEASON_ERA_BONUS : 0
  const raw = baseXp({
    outcome: input.outcome,
    firstOfDay,
    ...(input.elo !== undefined ? { elo: input.elo } : {}),
    ...(input.opponentElo !== undefined ? { opponentElo: input.opponentElo } : {}),
    ...(input.base !== undefined ? { base: input.base } : {}),
  })
  const xp = withBonus(raw, fx.xpBonus + j.prestige * 5 + eraBonus)
  const leaguePoints = withBonus(xp, fx.leagueBonus)
  const bonusCoins = Math.round(((input.coins ?? 0) * fx.coinBonus) / 100)
  const before = levelInfo(j.xp)
  const tierBefore = tiersReached(j.season.xp)
  const journey: JourneyState = {
    ...j,
    xp: j.xp + xp,
    totalXp: j.totalXp + xp,
    lastGameDate: input.game ? today : j.lastGameDate,
    season: { ...j.season, xp: j.season.xp + xp },
    league: { ...j.league, points: j.league.points + leaguePoints },
  }
  return {
    journey,
    xp,
    leaguePoints,
    bonusCoins,
    levelBefore: before.level,
    levelAfter: levelInfo(journey.xp).level,
    tierBefore,
    tierAfter: tiersReached(journey.season.xp),
    firstOfDay,
  }
}

export const canPrestige = (j: JourneyState): boolean => levelInfo(j.xp).level >= MAX_LEVEL && j.prestige < MAX_PRESTIGE

/** Starts the journey again at level 1, one prestige higher (skills are refunded). */
export function prestigeUp(j: JourneyState): JourneyState | null {
  if (!canPrestige(j)) return null
  return { ...j, xp: 0, prestige: j.prestige + 1, skills: [], frames: j.frames.includes('prestige-crown') ? j.frames : [...j.frames, 'prestige-crown'] }
}
