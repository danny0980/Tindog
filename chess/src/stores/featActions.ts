// Applies feat outcomes to the saved profile and announces new achievements.
import { playAchievement } from '../audio/fanfares'
import type { FeatOutcome } from '../utils/feats'
import { profileStore } from './profileStore'
import { showToast } from './toastStore'

export function applyFeat(update: (p: ReturnType<typeof profileStore.get>) => FeatOutcome): void {
  const out = update(profileStore.get())
  profileStore.set(out.profile)
  if (out.unlocked.length > 0) playAchievement()
  out.unlocked.forEach((a) => showToast('achievement', a.title, `${a.description} · +${a.reward} coins`, 5000))
}
