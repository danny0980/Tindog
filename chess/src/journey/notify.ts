// Smart reminders: instead of "come and play", a reason that is true right now —
// your nemesis wants a rematch, your league week ends tonight, a weekend event
// has started, your daily chest is waiting. On the iOS / Android apps they are
// scheduled as local notifications (nothing leaves the phone); on the web the
// setting only previews them. Message choice is pure and unit-tested.
import { getClassic } from '../data/classic/roster'
import type { MemoryBook } from '../memory/memory'
import { localDateKey } from '../utils/date'
import { pickNemesis } from './characters'
import { currentEvent } from './events'
import { LEAGUE_INFO, standings, weekProgress } from './league'
import { seasonFor } from './season'
import type { JourneyState } from './state'

export interface Reminder {
  id: string
  title: string
  body: string
}

/** Reminders that are true on `date`, most compelling first. */
export function remindersFor(j: JourneyState, memory: MemoryBook, playerName: string, date: Date): Reminder[] {
  const out: Reminder[] = []
  const nemesisKey = pickNemesis(memory, j.nemesis.beaten)
  const nemesis = nemesisKey ? getClassic(nemesisKey.slice(8)) : null
  if (nemesis) out.push({ id: 'nemesis', title: `${nemesis.name} calls you out`, body: `${nemesis.name.split(' ')[0]} wants a rematch. Time for revenge?` })
  const day = (date.getDay() + 6) % 7
  if (day === 6 && j.league.points > 0) {
    const table = standings(j.league.week, j.league.tier, j.league.points, playerName, weekProgress(date))
    const rank = table.findIndex((r) => r.you) + 1
    out.push({ id: 'league', title: 'Your league week ends tonight', body: `You are #${rank} in the ${LEAGUE_INFO[j.league.tier].name}. One more game could change everything.` })
  }
  const event = currentEvent(date)
  if (event.live && day === 4) out.push({ id: 'event', title: `Weekend event: ${event.event.name}`, body: `${event.event.tagline} Win once this weekend for ${event.event.coins} coins.` })
  const season = seasonFor(date)
  if (season.daysLeft <= 3) out.push({ id: 'season', title: `${season.theme.name} ends in ${season.daysLeft} day${season.daysLeft === 1 ? '' : 's'}`, body: 'Claim your pass rewards before the new season begins.' })
  if (j.chest.date !== localDateKey(date)) out.push({ id: 'chest', title: 'Your daily chest is ready', body: j.chest.streak > 1 ? `Keep your ${j.chest.streak}-day streak going.` : 'Open it for coins, potions — or something rare.' })
  out.push({ id: 'tournament', title: 'Today’s Chronos Tournament is open', body: 'Eight players, one cup. Can you win the bracket today?' })
  return out
}

/** One reminder per day for the next `days` days, at `hour` local time. */
export function plan(j: JourneyState, memory: MemoryBook, playerName: string, now: Date, days = 3): Array<Reminder & { at: Date }> {
  const out: Array<Reminder & { at: Date }> = []
  for (let d = 1; d <= days; d++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, j.notify.hour, 0, 0)
    // The chest is always unopened on a future day (it resets daily).
    const future = { ...j, chest: { ...j.chest, date: '' } }
    const list = remindersFor(future, memory, playerName, at)
    // Rotate so the same message doesn't repeat every day.
    const pick = list[(d - 1) % Math.min(list.length, 3)] ?? list[0]
    if (pick) out.push({ ...pick, at })
  }
  return out
}

const IDS = [9101, 9102, 9103]

async function nativePlugin() {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isNativePlatform()) return null
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return LocalNotifications
}

/** Asks for permission (native apps). Returns whether reminders can be shown. */
export async function enableReminders(): Promise<'granted' | 'denied' | 'web'> {
  const ln = await nativePlugin().catch(() => null)
  if (!ln) return 'web'
  const p = await ln.requestPermissions()
  return p.display === 'granted' ? 'granted' : 'denied'
}

/** Replaces the scheduled reminders (or clears them when off). Safe to call often. */
export async function scheduleReminders(j: JourneyState, memory: MemoryBook, playerName: string, now: Date = new Date()): Promise<void> {
  const ln = await nativePlugin().catch(() => null)
  if (!ln) return
  await ln.cancel({ notifications: IDS.map((id) => ({ id })) }).catch(() => undefined)
  if (!j.notify.enabled) return
  const perm = await ln.checkPermissions().catch(() => null)
  if (perm?.display !== 'granted') return
  const items = plan(j, memory, playerName, now)
  await ln.schedule({ notifications: items.map((r, i) => ({ id: IDS[i]!, title: r.title, body: r.body, schedule: { at: r.at, allowWhileIdle: true } })) })
}
