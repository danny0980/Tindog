// The Journey's side of things: applies the pure rules to the stores, pays
// coins into the profile and announces level-ups, pass tiers and league
// results.
import { sfx } from '../audio'
import { profileStore } from '../stores/profileStore'
import { showToast } from '../stores/toastStore'
import { journeyStore } from './journeyStore'
import { LEAGUE_INFO } from './league'
import { type ActivityInput, applyActivity, prestigeUp, rollover } from './progress'
import { type Reward, grantRewards } from './rewards'
import { passReward, tiersReached } from './season'
import { canLearn, getSkill, skillPoints } from './skills'
import type { JourneyState } from './state'
import { LEVEL_TITLES, PRESTIGE_COINS, levelInfo, roman } from './xp'

const addCoins = (n: number) => {
  if (n <= 0) return
  profileStore.set((p) => ({ ...p, coins: p.coins + n, totalCoinsEarned: p.totalCoinsEarned + n }))
}

/** Closes a finished week or season (once), paying and announcing the result. */
export function ensureCurrent(now: Date = new Date()): JourneyState {
  const r = rollover(journeyStore.get(), profileStore.get().name, now)
  if (r.journey !== journeyStore.get()) journeyStore.set(r.journey)
  addCoins(r.coins)
  if (r.league) {
    const where = r.league.move === 'up' ? `Promoted to the ${LEAGUE_INFO[r.journey.league.tier].name}!` : r.league.move === 'down' ? `Down to the ${LEAGUE_INFO[r.journey.league.tier].name}.` : `You stay in the ${LEAGUE_INFO[r.journey.league.tier].name}.`
    window.setTimeout(() => showToast(r.league?.move === 'down' ? 'info' : 'success', `League week over: #${r.league?.rank}`, `${where}${r.league?.coins ? ` +${r.league.coins} coins` : ''}`, 7000), 1200)
  }
  if (r.seasonEnded) window.setTimeout(() => showToast('info', `Season ${r.seasonEnded!.index + 1} has ended`, `You reached pass tier ${r.seasonEnded!.tier}. A new season begins!`, 7000), 2400)
  return r.journey
}

export interface JourneySummary {
  xp: number
  levelBefore: number
  levelAfter: number
  tierAfter: number
  tierUp: boolean
  leaguePoints: number
  bonusCoins: number
  firstOfDay: boolean
}

/** Books XP, season XP and league points for an activity, and announces milestones. */
export function recordJourney(input: ActivityInput, delayMs = 0): JourneySummary {
  ensureCurrent()
  const r = applyActivity(journeyStore.get(), { ...input, elo: input.elo ?? profileStore.get().elo })
  journeyStore.set(r.journey)
  addCoins(r.bonusCoins)
  if (r.levelAfter > r.levelBefore) {
    const title = LEVEL_TITLES.find((t) => t.level > r.levelBefore && t.level <= r.levelAfter)
    window.setTimeout(() => {
      sfx.achievement()
      showToast('success', `Level ${r.levelAfter}!`, title ? `New title: ${title.name}` : 'A new skill point is waiting in the skill tree.', 5000)
    }, delayMs)
  }
  if (r.tierAfter > r.tierBefore) window.setTimeout(() => showToast('quest', `Season pass tier ${r.tierAfter}`, 'A reward is ready to claim in your Journey.', 4500), delayMs + 600)
  return {
    xp: r.xp,
    levelBefore: r.levelBefore,
    levelAfter: r.levelAfter,
    tierAfter: r.tierAfter,
    tierUp: r.tierAfter > r.tierBefore,
    leaguePoints: r.leaguePoints,
    bonusCoins: r.bonusCoins,
    firstOfDay: r.firstOfDay,
  }
}

/** Pays rewards and announces them in one toast. */
export function payRewards(rewards: readonly Reward[], title: string): string[] {
  const out = grantRewards(profileStore.get(), journeyStore.get(), rewards)
  profileStore.set(out.profile)
  journeyStore.set(out.journey)
  if (out.labels.length > 0) showToast('coins', title, out.labels.join(' · '), 4500)
  return out.labels
}

export function claimPassTier(tier: number): boolean {
  const j = ensureCurrent()
  if (tier < 1 || tier > tiersReached(j.season.xp) || j.season.claimed.includes(tier)) return false
  journeyStore.set({ ...j, season: { ...j.season, claimed: [...j.season.claimed, tier] } })
  sfx.coins()
  payRewards([passReward(j.season.index, tier)], `Pass tier ${tier}`)
  return true
}

export function learnSkill(id: string): boolean {
  const j = journeyStore.get()
  const check = canLearn(j.skills, id, skillPoints(levelInfo(j.xp).level, j.prestige))
  if (!check.ok) {
    sfx.error()
    showToast('warning', 'Not yet', check.reason, 2600)
    return false
  }
  journeyStore.set({ ...j, skills: [...j.skills, id] })
  sfx.achievement()
  showToast('success', getSkill(id)?.name ?? 'Skill learned', getSkill(id)?.description, 3200)
  return true
}

export function doPrestige(): boolean {
  const next = prestigeUp(journeyStore.get())
  if (!next) return false
  journeyStore.set(next)
  addCoins(PRESTIGE_COINS)
  sfx.victory()
  showToast('success', `Prestige ${roman(next.prestige)}!`, `Back to level 1 with a crown, ${PRESTIGE_COINS} coins and stronger opponents. Your skills were refunded.`, 7000)
  return true
}

export function equipFrame(id: string | null): void {
  journeyStore.set((j) => (id === null || j.frames.includes(id) ? { ...j, frame: id } : j))
}

export function equipAura(id: string | null): void {
  journeyStore.set((j) => (id === null || j.auras.includes(id) ? { ...j, aura: id } : j))
}
