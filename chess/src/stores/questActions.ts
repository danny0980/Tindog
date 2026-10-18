import { sfx } from '../audio'
import type { QuestEvents } from '../types/quest'
import { applyQuestEvents } from '../utils/quests'
import { profileStore } from './profileStore'
import { showToast } from './toastStore'

/** Feeds game events into today's quests and announces any that complete. */
export function trackQuestEvents(events: QuestEvents, announceDelayMs = 0): void {
  const out = applyQuestEvents(profileStore.get(), events)
  profileStore.set(out.profile)
  out.completed.forEach((quest, i) =>
    window.setTimeout(() => {
      sfx.notify()
      showToast('quest', quest.description, `Claim +${quest.reward} coins in Quests`, 4500)
    }, announceDelayMs + i * 900),
  )
}
