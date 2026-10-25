// Journey games played on the main board, and what their result means for
// the Journey save (story chapters, the nemesis, the Bullet Gauntlet, co-op,
// three-phase bosses and the Duel of Powers).
import type { Outcome } from '../types/chess'
import { nemesisReward } from './characters'
import { payRewards } from './journeyActions'
import { journeyStore } from './journeyStore'
import { bulletCoins } from './modes'
import { CHAPTERS, chapterReward } from './story'

export type JourneyTag =
  | { kind: 'story'; chapter: number; elo: number | null }
  | { kind: 'nemesis' }
  | { kind: 'bullet'; streak: number }
  | { kind: 'coop'; players: [string, string] }
  | { kind: 'phases' }
  | { kind: 'powers' }

/** Books a Journey game's result; returns a line for the results card (or null). */
export function settleJourneyTag(tag: JourneyTag | null, outcome: Outcome, classicId: string | null, personaKey: string | null): string | null {
  if (!tag) return null
  const j = journeyStore.get()
  const won = outcome === 'win'
  switch (tag.kind) {
    case 'story': {
      if (!won) return 'The shard is still out of reach. Try the chapter again.'
      const first = !j.story.includes(tag.chapter)
      if (first) {
        journeyStore.set({ ...j, story: [...j.story, tag.chapter] })
        payRewards(chapterReward(tag.chapter), `Chapter ${tag.chapter + 1} complete`)
      }
      const next = CHAPTERS[tag.chapter + 1]
      return first ? (next ? `Shard recovered! Chapter ${tag.chapter + 2}, “${next.title}”, is open.` : 'The Hourglass is whole again. You are the Keeper of Time.') : 'Chapter replayed.'
    }
    case 'nemesis': {
      if (!won || !personaKey) return won ? null : 'Your nemesis wins again. They will be waiting.'
      const first = j.nemesis.beaten.length === 0
      journeyStore.set({ ...j, nemesis: { key: null, since: '', beaten: [...j.nemesis.beaten, personaKey] } })
      payRewards(nemesisReward(first), 'Nemesis defeated')
      return 'Revenge! Your nemesis is defeated — for now.'
    }
    case 'bullet': {
      const streak = won ? tag.streak + 1 : 0
      journeyStore.set({ ...j, modes: { ...j.modes, bulletStreak: streak, bulletBest: Math.max(j.modes.bulletBest, streak) } })
      if (won) payRewards([{ kind: 'coins', amount: bulletCoins(tag.streak) }], `Bullet streak ${streak}`)
      return won ? `Bullet streak: ${streak}. The next opponent is stronger.` : `The Bullet run ends at ${tag.streak}. Best: ${Math.max(j.modes.bulletBest, tag.streak)}.`
    }
    case 'coop': {
      if (!won) return `${tag.players[0]} and ${tag.players[1]} fall together. Regroup and try again.`
      journeyStore.set({ ...j, modes: { ...j.modes, coopWins: j.modes.coopWins + 1 } })
      payRewards([{ kind: 'coins', amount: 150 }], 'Co-op victory')
      return `${tag.players[0]} and ${tag.players[1]} win together!`
    }
    case 'phases': {
      if (!won || !classicId) return won ? null : 'The boss survives its last stand. Try again.'
      const first = !j.modes.phases.includes(classicId)
      journeyStore.set({ ...j, modes: { ...j.modes, phases: first ? [...j.modes.phases, classicId] : j.modes.phases } })
      payRewards([{ kind: 'coins', amount: first ? 300 : 80 }], 'Boss defeated')
      return 'All three phases broken!'
    }
    case 'powers': {
      if (!won) return null
      journeyStore.set({ ...j, modes: { ...j.modes, powersWins: j.modes.powersWins + 1 } })
      payRewards([{ kind: 'coins', amount: 120 }], 'Duel of Powers')
      return 'Your power prevailed.'
    }
  }
}
