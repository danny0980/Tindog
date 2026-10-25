// The number on the Journey tab: rewards waiting to be collected.
import type { MemoryBook } from '../memory/memory'
import { pendingGifts } from './characters'
import { foundersOpen } from './economy'
import { tiersReached } from './season'
import { skillEffects } from './skills'
import type { JourneyState } from './state'

export function journeyBadge(j: JourneyState, memory: MemoryBook, today: string): number {
  const pass = Math.max(0, tiersReached(j.season.xp) - j.season.claimed.length)
  const gifts = pendingGifts(memory, j.bondGifts, skillEffects(j.skills).bondFactor).length
  const chest = j.chest.date === today ? 0 : 1
  const founders = !j.founder && foundersOpen(today) ? 1 : 0
  return pass + gifts + chest + founders
}
