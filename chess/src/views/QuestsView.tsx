import { CalendarClock, Coins, Gift, ShoppingBag, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { sfx } from '../audio'
import { ConfettiCanvas } from '../components/effects/ConfettiCanvas'
import { QuestCard } from '../components/quests/QuestCard'
import { Button } from '../components/ui/Button'
import { QUEST_BONUS_REWARD } from '../constants/quests'
import { getBoardTheme } from '../constants/themes'
import { useStore } from '../hooks/useStore'
import { profileStore } from '../stores/profileStore'
import { settingsStore } from '../stores/settingsStore'
import { showToast } from '../stores/toastStore'
import type { QuestMetric } from '../types/quest'
import type { AppView } from '../types/ui'
import { localDateKey, msUntilTomorrow } from '../utils/date'
import { canClaimBonus, claimQuest, claimQuestBonus, getDailyQuests, isQuestComplete, questValue, questsForToday } from '../utils/quests'

const DESTINATION: Record<QuestMetric, AppView> = {
  games_played: 'play',
  ai_wins: 'play',
  black_wins: 'play',
  fast_wins: 'play',
  timed_games: 'play',
  captures: 'play',
  checks: 'play',
  castles: 'play',
  promotions: 'play',
  puzzles_solved: 'puzzles',
  analyses: 'play',
  rush_runs: 'rush',
  rush_points: 'rush',
}

/** Daily quests with claimable coin rewards and an all-complete bonus chest. */
export function QuestsView({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  const today = localDateKey()
  const profile = useStore(profileStore, (p) => p)
  const settings = useStore(settingsStore, (s) => s)
  const [celebration, setCelebration] = useState(0)
  const quests = getDailyQuests(today)
  const progress = questsForToday(profile.quests, today)
  const completed = quests.filter((q) => isQuestComplete(progress, q)).length
  const bonusReady = canClaimBonus(profile.quests, today)
  const hoursLeft = Math.ceil(msUntilTomorrow() / 3_600_000)

  const claim = (id: string) => {
    const out = claimQuest(profileStore.get(), id)
    if (!out.ok) return
    profileStore.set(out.profile)
    sfx.coins()
    showToast('coins', `+${out.coins} coins`, 'Quest reward claimed')
  }

  const claimBonus = () => {
    const out = claimQuestBonus(profileStore.get())
    if (!out.ok) return
    profileStore.set(out.profile)
    sfx.victory()
    if (!settings.batterySaver) setCelebration((c) => c + 1)
    showToast('coins', `+${out.coins} coins`, 'Daily chest opened!')
    out.unlocked.forEach((a) => showToast('achievement', a.title, `${a.description} · +${a.reward} coins`, 5000))
  }

  return (
    <div className="safe-px mx-auto w-full max-w-3xl flex-1 space-y-4 pb-4">
      <section className="glass relative overflow-hidden rounded-3xl p-5">
        <div className="pointer-events-none absolute -top-20 -right-10 size-64 rounded-full bg-accent-2/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-ink-950">
            <CalendarClock className="size-7" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-extrabold tracking-wider text-white">DAILY QUESTS</h2>
            <p className="text-sm text-slate-400">
              {completed}/{quests.length} complete · new quests in {hoursLeft}h
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 font-mono text-xl font-bold text-yellow-300">
              <Coins className="size-5" /> {profile.coins}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{progress.perfectDays} perfect days</div>
          </div>
        </div>
      </section>

      <div className="grid gap-3">
        {quests.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            value={questValue(progress, quest)}
            claimed={progress.claimed.includes(quest.id)}
            onClaim={() => claim(quest.id)}
            onGo={() => onNavigate(DESTINATION[quest.metric])}
          />
        ))}
      </div>

      <section className={`glass flex items-center gap-4 rounded-2xl p-4 ${bonusReady ? 'ring-2 ring-amber-300/70' : ''}`}>
        <div className={`flex size-14 items-center justify-center rounded-2xl ${bonusReady ? 'idle-pause animate-bounce-soft bg-gradient-to-br from-amber-300 to-orange-500 text-ink-950' : 'bg-white/[0.06] text-slate-400'}`}>
          <Gift className="size-7" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">Daily chest</div>
          <div className="text-xs text-slate-400">{progress.bonusClaimed ? 'Opened — come back tomorrow!' : 'Complete all three quests to open it.'}</div>
          <div className="mt-2 flex gap-1.5">
            {quests.map((q) => (
              <span key={q.id} className={`h-1.5 flex-1 rounded-full ${isQuestComplete(progress, q) ? 'bg-amber-300' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>
        <Button size="sm" variant={bonusReady ? 'primary' : 'secondary'} disabled={!bonusReady} onClick={claimBonus} icon={<Sparkles className="size-4" />}>
          +{QUEST_BONUS_REWARD}
        </Button>
      </section>

      <Button className="w-full" onClick={() => onNavigate('shop')} icon={<ShoppingBag className="size-4" />}>
        Spend coins in the shop
      </Button>
      <ConfettiCanvas burst={celebration} colors={getBoardTheme(settings.boardTheme).particles} disabled={settings.batterySaver} />
    </div>
  )
}
