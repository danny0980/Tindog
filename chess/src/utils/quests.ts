import { DAILY_QUEST_COUNT, QUEST_BONUS_REWARD, QUEST_POOL } from '../constants/quests'
import type { AchievementDef, PlayerProfile } from '../types/profile'
import type { QuestDef, QuestEvents, QuestMetric, QuestProgress } from '../types/quest'
import { dayNumber, localDateKey } from './date'
import { grant } from './progression'

/** Deterministic PRNG (mulberry32) so every device gets the same quests per day. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Today's quests: a seeded shuffle of the pool with no two quests on the same metric. */
export function getDailyQuests(dateKey: string = localDateKey()): QuestDef[] {
  const random = seeded(dayNumber(dateKey) * 7919)
  const pool = [...QUEST_POOL]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = pool[i]
    const b = pool[j]
    if (a && b) {
      pool[i] = b
      pool[j] = a
    }
  }
  const picked: QuestDef[] = []
  const metrics = new Set<QuestMetric>()
  for (const quest of pool) {
    if (metrics.has(quest.metric)) continue
    picked.push(quest)
    metrics.add(quest.metric)
    if (picked.length === DAILY_QUEST_COUNT) break
  }
  return picked
}

/** Rolls quest progress over to a new day when the date changes. */
export function questsForToday(progress: QuestProgress, today: string): QuestProgress {
  return progress.date === today ? progress : { date: today, progress: {}, claimed: [], bonusClaimed: false, perfectDays: progress.perfectDays }
}

export const questValue = (progress: QuestProgress, quest: QuestDef): number => Math.min(quest.target, progress.progress[quest.metric] ?? 0)
export const isQuestComplete = (progress: QuestProgress, quest: QuestDef): boolean => questValue(progress, quest) >= quest.target

/** Adds event counters to today's progress; returns quests that just completed. */
export function applyQuestEvents(
  profile: PlayerProfile,
  events: QuestEvents,
  now: Date = new Date(),
): { profile: PlayerProfile; completed: QuestDef[] } {
  const today = localDateKey(now)
  const before = questsForToday(profile.quests, today)
  const progress = { ...before.progress }
  for (const [metric, amount] of Object.entries(events) as Array<[QuestMetric, number | undefined]>) {
    if (amount && amount > 0) progress[metric] = (progress[metric] ?? 0) + amount
  }
  const after: QuestProgress = { ...before, progress }
  const completed = getDailyQuests(today).filter((q) => !isQuestComplete(before, q) && isQuestComplete(after, q))
  return { profile: { ...profile, quests: after }, completed }
}

export function claimQuest(profile: PlayerProfile, questId: string, now: Date = new Date()): { ok: boolean; profile: PlayerProfile; coins: number } {
  const today = localDateKey(now)
  const quests = questsForToday(profile.quests, today)
  const quest = getDailyQuests(today).find((q) => q.id === questId)
  if (!quest || quests.claimed.includes(questId) || !isQuestComplete(quests, quest)) return { ok: false, profile, coins: 0 }
  return {
    ok: true,
    coins: quest.reward,
    profile: {
      ...profile,
      coins: profile.coins + quest.reward,
      totalCoinsEarned: profile.totalCoinsEarned + quest.reward,
      quests: { ...quests, claimed: [...quests.claimed, questId] },
    },
  }
}

export function canClaimBonus(progress: QuestProgress, today: string = localDateKey()): boolean {
  const quests = questsForToday(progress, today)
  return !quests.bonusClaimed && getDailyQuests(today).every((q) => isQuestComplete(quests, q))
}

export function claimQuestBonus(
  profile: PlayerProfile,
  now: Date = new Date(),
): { ok: boolean; profile: PlayerProfile; coins: number; unlocked: AchievementDef[] } {
  const today = localDateKey(now)
  if (!canClaimBonus(profile.quests, today)) return { ok: false, profile, coins: 0, unlocked: [] }
  const quests = questsForToday(profile.quests, today)
  const next: PlayerProfile = {
    ...profile,
    coins: profile.coins + QUEST_BONUS_REWARD,
    totalCoinsEarned: profile.totalCoinsEarned + QUEST_BONUS_REWARD,
    quests: { ...quests, bonusClaimed: true, perfectDays: quests.perfectDays + 1 },
  }
  const granted = grant(next, ['questor'], now.toISOString())
  return { ok: true, coins: QUEST_BONUS_REWARD, ...granted }
}

/** Number of rewards (quests + bonus) waiting to be claimed today — drives the nav badge. */
export function claimableCount(progress: QuestProgress, today: string = localDateKey()): number {
  const quests = questsForToday(progress, today)
  const ready = getDailyQuests(today).filter((q) => isQuestComplete(quests, q) && !quests.claimed.includes(q.id)).length
  return ready + (canClaimBonus(progress, today) ? 1 : 0)
}
