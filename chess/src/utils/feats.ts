// Lifetime feats outside the main game controller — chess variants, online
// games and Opening School lessons — and the achievements they unlock. Pure:
// each takes a profile and returns the updated one plus what was unlocked.
import type { AchievementDef, PlayerProfile } from '../types/profile'
import type { VariantId, VariantResultReason } from '../variants/rules'
import { grant } from './progression'

export interface FeatOutcome {
  profile: PlayerProfile
  unlocked: AchievementDef[]
}

const now = (): string => new Date().toISOString()

export function recordVariantResult(profile: PlayerProfile, variant: VariantId, won: boolean, reason: VariantResultReason): FeatOutcome {
  if (!won) return { profile, unlocked: [] }
  const f = profile.feats
  const feats = {
    ...f,
    wins960: f.wins960 + (variant === 'chess960' ? 1 : 0),
    kothWins: f.kothWins + (variant === 'koth' ? 1 : 0),
    threeCheckWins: f.threeCheckWins + (variant === 'threecheck' ? 1 : 0),
  }
  const ids = [
    ...(variant === 'chess960' ? ['fischer-random'] : []),
    ...(variant === 'koth' && reason === 'hill' ? ['king-of-the-hill'] : []),
    ...(variant === 'threecheck' && reason === 'three-checks' ? ['triple-threat'] : []),
    ...(feats.wins960 > 0 && feats.kothWins > 0 && feats.threeCheckWins > 0 ? ['variant-virtuoso'] : []),
  ]
  return grant({ ...profile, feats }, ids, now())
}

export function recordOnlineResult(profile: PlayerProfile, won: boolean): FeatOutcome {
  const f = profile.feats
  const feats = { ...f, onlineGames: f.onlineGames + 1, onlineWins: f.onlineWins + (won ? 1 : 0) }
  const ids = ['globetrotter', ...(feats.onlineWins >= 5 ? ['world-stage'] : [])]
  return grant({ ...profile, feats }, ids, now())
}

/** A lesson counts once, however often it's repeated. */
export function recordLesson(profile: PlayerProfile, lessonId: string, totalLessons: number): FeatOutcome {
  const done = profile.feats.lessonsDone.includes(lessonId) ? profile.feats.lessonsDone : [...profile.feats.lessonsDone, lessonId]
  const feats = { ...profile.feats, lessonsDone: done }
  const ids = [...(done.length >= 3 ? ['opening-student'] : []), ...(done.length >= totalLessons ? ['opening-scholar'] : [])]
  return grant({ ...profile, feats }, ids, now())
}
