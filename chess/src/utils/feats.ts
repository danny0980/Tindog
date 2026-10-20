// Lifetime feats outside the main game controller — chess variants, online
// games and Opening School lessons — and the achievements they unlock. Pure:
// each takes a profile and returns the updated one plus what was unlocked.
import type { AchievementDef, PlayerProfile } from '../types/profile'
import type { VariantId, VariantResultReason } from '../variants/rules'
import { quizReward } from '../data/classic/quiz'
import { eloAfter } from '../modes/stats'
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

/** Historic battles: who won, and from which side (the historical loser's win "rewrites history"). */
const HISTORICAL_WINNER: Record<string, 'w' | 'b'> = { thermopylae: 'b', cannae: 'w', waterloo: 'w' }

export function recordBattleResult(profile: PlayerProfile, battleId: string, side: 'w' | 'b', won: boolean): FeatOutcome {
  if (!won) return { profile, unlocked: [] }
  const key = `${battleId}:${side}`
  const battles = profile.feats.battlesWon.includes(key) ? profile.feats.battlesWon : [...profile.feats.battlesWon, key]
  const ids = [
    ...(battleId === 'thermopylae' && side === 'w' ? ['hold-the-pass'] : []),
    ...(battleId === 'cannae' && side === 'w' ? ['double-envelopment'] : []),
    ...(battleId === 'waterloo' ? ['near-run-thing'] : []),
    ...(HISTORICAL_WINNER[battleId] !== undefined && HISTORICAL_WINNER[battleId] !== side ? ['rewrite-history'] : []),
  ]
  return grant({ ...profile, feats: { ...profile.feats, battlesWon: battles } }, ids, now())
}

/** A Character Interview finished (the first time each character counts). */
export function recordInterview(profile: PlayerProfile, classicId: string): FeatOutcome {
  if (profile.feats.interviewed.includes(classicId)) return { profile, unlocked: [] }
  const interviewed = [...profile.feats.interviewed, classicId]
  const ids = ['first-interview', ...(interviewed.length >= 10 ? ['press-corps'] : [])]
  return grant({ ...profile, feats: { ...profile.feats, interviewed } }, ids, now())
}

/** A history quiz finished: coins for each right answer. */
export function recordQuiz(profile: PlayerProfile, correct: number, total: number): FeatOutcome & { coins: number } {
  const coins = quizReward(correct)
  const quizCorrect = profile.feats.quizCorrect + correct
  const ids = [...(total > 0 && correct === total ? ['perfect-recall'] : []), ...(quizCorrect >= 50 ? ['historian'] : [])]
  const paid = { ...profile, coins: profile.coins + coins, totalCoinsEarned: profile.totalCoinsEarned + coins, feats: { ...profile.feats, quizCorrect } }
  return { ...grant(paid, ids, now()), coins }
}

/** A Card Chess or Battle Royale game finished (`place`: 1–4 in the Royale). */
export function recordModeResult(profile: PlayerProfile, mode: 'cards' | 'royale', won: boolean, place: number | null = null): FeatOutcome {
  const m = profile.modes
  const modes =
    mode === 'cards'
      ? { ...m, cards: { games: m.cards.games + 1, wins: m.cards.wins + (won ? 1 : 0) } }
      : { ...m, royale: { games: m.royale.games + 1, wins: m.royale.wins + (won ? 1 : 0), best: place === null ? m.royale.best : Math.min(m.royale.best ?? 4, place) } }
  const ids = mode === 'cards' ? [...(won ? ['card-sharp'] : []), ...(modes.cards.wins >= 5 ? ['house-of-cards'] : [])] : won ? ['last-king-standing'] : []
  return grant({ ...profile, modes }, ids, now())
}

/** A Vanishing Chess game: its own rating, against the level's strength. */
export function recordVanish(profile: PlayerProfile, score: 0 | 0.5 | 1, opponentElo: number): FeatOutcome {
  const v = profile.modes.vanish
  const rating = eloAfter(v.rating, opponentElo, score)
  const modes = { ...profile.modes, vanish: { rating, games: v.games + 1, wins: v.wins + (score === 1 ? 1 : 0), peak: Math.max(v.peak, rating) } }
  return grant({ ...profile, modes }, score === 1 && opponentElo >= 1500 ? ['invisible-hand'] : [], now())
}

/** An escape room solved: the best time and stars are kept. */
export function recordEscape(profile: PlayerProfile, roomId: string, ms: number, stars: number, totalRooms: number): FeatOutcome {
  const prev = profile.modes.escape[roomId]
  const escape = { ...profile.modes.escape, [roomId]: { bestMs: prev ? Math.min(prev.bestMs, ms) : ms, stars: Math.max(prev?.stars ?? 0, stars) } }
  const ids = ['escape-artist', ...(Object.keys(escape).length >= totalRooms ? ['great-escape'] : [])]
  return grant({ ...profile, modes: { ...profile.modes, escape } }, ids, now())
}
