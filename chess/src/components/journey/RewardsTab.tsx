import { Bell, BellOff, Check, Coins, Crown, Gift, Hourglass, Shirt, ShoppingBag, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { sfx } from '../../audio'
import { useStore } from '../../hooks/useStore'
import { ALL_FIXED_FRAMES, AURAS, auraDef, frameDef } from '../../journey/cosmetics'
import { CHEST_TABLE, FOUNDERS_PACK, FOUNDERS_UNTIL, type ChestPrize, buyOffer, dailyOffers, foundersOpen, openChest, streakBonus } from '../../journey/economy'
import { equipAura, equipFrame, payRewards } from '../../journey/journeyActions'
import { journeyStore } from '../../journey/journeyStore'
import { enableReminders, plan, scheduleReminders } from '../../journey/notify'
import { rewardLabel } from '../../journey/rewards'
import { skillEffects } from '../../journey/skills'
import { profileStore } from '../../stores/profileStore'
import { showToast } from '../../stores/toastStore'
import { localDateKey, msUntilTomorrow } from '../../utils/date'
import { Button } from '../ui/Button'
import { Card, FrameSwatch, Pill } from './ui'

export function RewardsTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-rewards>
      <Chest />
      <Founders />
      <DailyShop />
      <Wardrobe />
      <Reminders />
    </div>
  )
}

function Chest() {
  const j = useStore(journeyStore, (s) => s)
  const today = localDateKey()
  const opened = j.chest.date === today
  const [prize, setPrize] = useState<ChestPrize | null>(null)
  const [shaking, setShaking] = useState(false)
  const rolls = skillEffects(j.skills).chestRolls
  const open = () => {
    setShaking(true)
    sfx.spellWarning()
    window.setTimeout(() => {
      const out = openChest(journeyStore.get(), today, rolls, Math.random)
      setShaking(false)
      if (!out) return
      journeyStore.set(out.journey)
      setPrize(out.prize)
      if (out.prize.rare) sfx.victory()
      else sfx.coins()
      payRewards(out.rewards, out.prize.rare ? 'A rare prize!' : 'Daily chest')
    }, 1400)
  }
  const hours = Math.ceil(msUntilTomorrow() / 3_600_000)
  return (
    <Card title="Daily chest" icon={<Gift className="size-4" />} data-chest={opened ? 'opened' : 'ready'} action={j.chest.streak > 0 ? <Pill tone="gold">{j.chest.streak}-day streak</Pill> : undefined}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={open}
          disabled={opened || shaking}
          className={`flex size-24 shrink-0 items-center justify-center rounded-3xl text-ink-950 transition ${opened ? 'bg-white/10 text-slate-500' : 'bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_0_40px_-8px_rgba(251,191,36,.8)] hover:scale-105'} ${shaking ? 'animate-chest' : ''}`}
          aria-label={opened ? 'Opened today' : 'Open the chest'}
          data-chest-open
        >
          <Gift className="size-12" />
        </button>
        <div className="min-w-0 flex-1 text-sm">
          {prize ? (
            <div className="animate-pop-in">
              <div className={`font-display text-lg font-bold ${prize.rare ? 'text-amber-200' : 'text-white'}`}>{prize.name}</div>
              <div className="text-xs text-slate-400">{prize.rewards.map(rewardLabel).join(' · ')}</div>
            </div>
          ) : opened ? (
            <div className="text-slate-300">Opened today. A new chest in {hours}h.</div>
          ) : (
            <div className="text-slate-300">A free chest every day. Open it on consecutive days for a streak bonus (+{streakBonus(j.chest.streak + 1)} coins today).</div>
          )}
          {rolls > 0 && <div className="mt-1 text-[11px] text-amber-200">Golden Touch: two rolls, the better prize is kept.</div>}
        </div>
      </div>
      <details className="mt-3 text-xs text-slate-400">
        <summary className="cursor-pointer text-slate-300">The odds</summary>
        <table className="mt-2 w-full">
          <tbody>
            {CHEST_TABLE.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className={`py-1 ${p.rare ? 'text-amber-200' : ''}`}>{p.name}</td>
                <td className="py-1 text-right font-mono">{p.chance}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  )
}

function DailyShop() {
  const profile = useStore(profileStore, (p) => p)
  const j = useStore(journeyStore, (s) => s)
  const today = localDateKey()
  const offers = useMemo(() => dailyOffers(today), [today])
  const buy = (id: string) => {
    const out = buyOffer(profileStore.get(), journeyStore.get(), today, id)
    if (!out.ok) {
      sfx.error()
      showToast('warning', 'Shop', out.reason, 2600)
      return
    }
    profileStore.set(out.profile)
    journeyStore.set(out.journey)
    payRewards(out.offer.rewards, `Bought: ${out.offer.name}`)
  }
  return (
    <Card title="Today’s shop" icon={<ShoppingBag className="size-4" />} action={<Pill>New in {Math.ceil(msUntilTomorrow() / 3_600_000)}h</Pill>} data-daily-shop>
      <ul className="grid gap-2 sm:grid-cols-2">
        {offers.map((o) => {
          const owned = o.owned(profile, j) || (j.shop.date === today && j.shop.bought.includes(o.id) && o.id !== 'potions-3')
          const frame = o.rewards[0]?.kind === 'frame' ? frameDef(o.rewards[0].id) : null
          return (
            <li key={o.id} className="flex flex-col gap-2 rounded-2xl bg-white/[0.04] p-3" data-offer={o.id}>
              <div className="flex items-center gap-2">
                {frame ? <FrameSwatch frame={frame} size={34} /> : <Sparkles className="size-5 text-amber-200" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{o.name}</div>
                  <div className="text-[11px] text-slate-400">{o.detail}</div>
                </div>
              </div>
              <Button size="sm" variant={owned ? 'ghost' : 'primary'} disabled={owned || profile.coins < o.price} icon={owned ? <Check className="size-4" /> : <Coins className="size-4" />} onClick={() => buy(o.id)}>
                {owned ? 'Owned' : (
                  <span>
                    {o.price}
                    {o.was && <s className="ml-1 opacity-60">{o.was}</s>}
                  </span>
                )}
              </Button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Founders() {
  const claimed = useStore(journeyStore, (j) => j.founder)
  const today = localDateKey()
  const open = foundersOpen(today)
  const claim = () => {
    if (journeyStore.get().founder || !open) return
    journeyStore.set((j) => ({ ...j, founder: true }))
    sfx.victory()
    payRewards(FOUNDERS_PACK, 'Founders Pack')
  }
  const until = new Date(`${FOUNDERS_UNTIL}T23:59:59`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <Card title="Founders Pack" icon={<Crown className="size-4" />} className="relative overflow-hidden" data-founders={claimed ? 'claimed' : open ? 'open' : 'closed'}>
      <div className="pointer-events-none absolute -top-16 -right-12 size-56 rounded-full bg-amber-400/25 blur-3xl" aria-hidden="true" />
      <div className="relative">
        <p className="text-sm text-slate-300">A thank-you for the first players of Chronos Chess. Free, and it will never come back after {until}.</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {FOUNDERS_PACK.map((r) => (
            <li key={rewardLabel(r)}>
              <Pill tone="gold">{rewardLabel(r)}</Pill>
            </li>
          ))}
        </ul>
        <Button variant="primary" className="mt-3 w-full" disabled={claimed || !open} icon={claimed ? <Check className="size-4" /> : <Hourglass className="size-4" />} onClick={claim} data-founders-claim>
          {claimed ? 'Claimed — welcome, Founder' : open ? 'Claim the Founders Pack' : 'The founding window has closed'}
        </Button>
      </div>
    </Card>
  )
}

function Wardrobe() {
  const j = useStore(journeyStore, (s) => s)
  return (
    <Card title="Wardrobe" icon={<Shirt className="size-4" />} className="lg:col-span-2" data-wardrobe>
      <div className="mb-1.5 text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">Avatar frames</div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => equipFrame(null)} className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-[10px] ${j.frame === null ? 'border-accent bg-accent/15 text-white' : 'border-white/10 text-slate-400'}`}>
          None
        </button>
        {[...ALL_FIXED_FRAMES.map((f) => f.id), ...j.frames.filter((id) => id.startsWith('season-'))].map((id) => {
          const f = frameDef(id)
          if (!f) return null
          const owned = j.frames.includes(id)
          return (
            <button
              key={id}
              type="button"
              disabled={!owned}
              onClick={() => equipFrame(id)}
              title={`${f.name} — ${f.source}`}
              aria-label={`${f.name}${owned ? '' : ' (locked)'}`}
              className={`relative rounded-2xl p-1 transition ${j.frame === id ? 'ring-2 ring-accent' : ''} ${owned ? 'hover:scale-105' : 'opacity-30 grayscale'}`}
              data-frame-choice={id}
            >
              <FrameSwatch frame={f} size={48} />
            </button>
          )
        })}
      </div>
      <div className="mt-4 mb-1.5 text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">Board auras</div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => equipAura(null)} className={`rounded-xl border px-3 py-2 text-xs ${j.aura === null ? 'border-accent bg-accent/15 text-white' : 'border-white/10 text-slate-400'}`}>
          None
        </button>
        {AURAS.map((a) => {
          const owned = j.auras.includes(a.id)
          return (
            <button
              key={a.id}
              type="button"
              disabled={!owned}
              onClick={() => equipAura(a.id)}
              title={a.source}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${j.aura === a.id ? 'border-accent bg-accent/15 text-white' : 'border-white/10 text-slate-300'} ${owned ? '' : 'opacity-35'}`}
              data-aura-choice={a.id}
            >
              <span className="size-3 rounded-full" style={{ background: a.color, boxShadow: `0 0 10px ${a.color}` }} />
              {a.name}
            </button>
          )
        })}
      </div>
      {j.aura && <p className="mt-2 text-[11px] text-slate-500">Wearing {auraDef(j.aura)?.name}: it glows around your board in every game.</p>}
    </Card>
  )
}

function Reminders() {
  const j = useStore(journeyStore, (s) => s)
  const memory = useStore(profileStore, (p) => p.memory)
  const name = useStore(profileStore, (p) => p.name)
  const [web, setWeb] = useState(false)
  const [now] = useState(() => Date.now())
  const preview = useMemo(() => plan(j, memory, name, new Date(now), 3), [j, memory, name, now])
  const toggle = async () => {
    if (j.notify.enabled) {
      const next = { ...journeyStore.get(), notify: { ...journeyStore.get().notify, enabled: false } }
      journeyStore.set(next)
      void scheduleReminders(next, memory, name)
      return
    }
    const r = await enableReminders()
    if (r === 'denied') {
      showToast('warning', 'Notifications are off', 'Allow notifications for Chronos Chess in your phone’s settings.', 5000)
      return
    }
    setWeb(r === 'web')
    const next = { ...journeyStore.get(), notify: { ...journeyStore.get().notify, enabled: true } }
    journeyStore.set(next)
    void scheduleReminders(next, memory, name)
    showToast('success', 'Reminders on', r === 'web' ? 'They are sent by the iOS and Android apps.' : 'One a day, only when there is a reason.', 3600)
  }
  return (
    <Card title="Smart reminders" icon={j.notify.enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />} className="lg:col-span-2" data-reminders={j.notify.enabled ? 'on' : 'off'}>
      <p className="text-sm text-slate-300">At most one a day, and only when there is a real reason: your nemesis wants a rematch, your league week ends tonight, an event has started.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant={j.notify.enabled ? 'secondary' : 'primary'} icon={j.notify.enabled ? <BellOff className="size-4" /> : <Bell className="size-4" />} onClick={() => void toggle()} data-reminders-toggle>
          {j.notify.enabled ? 'Turn off' : 'Turn on'}
        </Button>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          At
          <select
            value={j.notify.hour}
            onChange={(e) => {
              const next = { ...journeyStore.get(), notify: { ...journeyStore.get().notify, hour: Number(e.target.value) } }
              journeyStore.set(next)
              void scheduleReminders(next, memory, name)
            }}
            className="rounded-lg bg-white/5 px-2 py-1 text-white"
            aria-label="Reminder time"
          >
            {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        {web && <span className="text-[11px] text-slate-500">On the web this only previews them; the apps send them.</span>}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {preview.map((r) => (
          <li key={r.at.toISOString()} className="rounded-2xl bg-white/[0.04] p-3 text-xs">
            <div className="text-[10px] text-slate-500">{r.at.toLocaleDateString(undefined, { weekday: 'long' })}</div>
            <div className="font-semibold text-white">{r.title}</div>
            <div className="text-slate-400">{r.body}</div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
