import { Coins, FlaskConical, ScrollText, Sparkles, Swords } from 'lucide-react'
import { POTIONS, RESTRICTIONS, WEATHER } from '../../data/arena'
import { TACTICS } from '../../data/spells'
import type { Boss, CampaignProgress } from '../../types/campaign'
import type { Bounty, WorldEvent, WorldState } from '../../types/rpg'
import type { TacticId } from '../../types/spells'
import type { PotionId } from '../../types/rpg'
import { ambushWeather, isBountyDone, isEventReachable, isEventResolved } from '../../utils/world'
import { PORTRAIT_ICONS } from '../legends/portraitIcons'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

export type WorldItem = { type: 'event'; event: WorldEvent } | { type: 'bounty'; bounty: Bounty }

const KIND_LABEL = { shrine: 'Shrine', merchant: 'Merchant', ambush: 'Elite ambush' } as const
const KIND_ICON = { shrine: Sparkles, merchant: FlaskConical, ambush: Swords } as const

const worldItemId = (item: WorldItem): string => (item.type === 'event' ? item.event.id : item.bounty.id)

interface WorldBoardProps {
  world: WorldState
  progress: CampaignProgress
  realm: string
  roster: readonly Boss[] | null
  onOpen: (item: WorldItem) => void
}

/** Today's events and bounty contracts in this realm (they refresh every day). */
export function WorldBoard({ world, progress, realm, roster, onOpen }: WorldBoardProps) {
  const events = world.events.filter((e) => e.realm === realm)
  const bounties = world.bounties.filter((b) => b.realm === realm)
  if (events.length === 0 && bounties.length === 0) return null
  return (
    <section className="glass space-y-2 rounded-3xl p-3" aria-label="World events and bounties" data-world-board>
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Today on the map</h3>
        <span className="text-[11px] text-slate-500">New events every day</span>
      </div>
      <div className="scrollbar-thin -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {events.map((e) => {
          const Icon = KIND_ICON[e.kind]
          const done = isEventResolved(world, e.id)
          const reachable = isEventReachable(progress, e)
          const boss = e.kind === 'ambush' ? roster?.[e.bossIndex] : undefined
          return (
            <button
              key={e.id}
              type="button"
              data-event={e.kind}
              onClick={() => onOpen({ type: 'event', event: e })}
              className={`flex w-44 shrink-0 snap-start flex-col gap-1 rounded-2xl border p-2.5 text-left transition ${done ? 'border-white/5 bg-white/[0.02] opacity-50' : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.09]'}`}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                <Icon className="size-3.5" /> {KIND_LABEL[e.kind]}
              </span>
              <span className="truncate text-sm font-bold text-white">{e.title}</span>
              <span className="text-[11px] text-slate-400">
                {done ? 'Resolved today' : !reachable ? `Beside boss #${e.anchorIndex + 1}` : e.kind === 'ambush' ? `${boss?.shortName ?? 'An elite'} · +${e.reward.coins} coins` : e.kind === 'merchant' ? `${e.wares.length} wares` : 'Choose a blessing'}
              </span>
            </button>
          )
        })}
        {bounties.map((b) => {
          const done = isBountyDone(world, b.id)
          const boss = roster?.[b.bossIndex]
          return (
            <button
              key={b.id}
              type="button"
              data-bounty={b.restriction}
              onClick={() => onOpen({ type: 'bounty', bounty: b })}
              className={`flex w-44 shrink-0 snap-start flex-col gap-1 rounded-2xl border p-2.5 text-left transition ${done ? 'border-white/5 bg-white/[0.02] opacity-50' : 'border-emerald-300/30 bg-emerald-400/[0.07] hover:bg-emerald-400/[0.12]'}`}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                <ScrollText className="size-3.5" /> Bounty
              </span>
              <span className="truncate text-sm font-bold text-white">{RESTRICTIONS[b.restriction].name}</span>
              <span className="truncate text-[11px] text-slate-400">
                {done ? 'Fulfilled today' : `vs ${boss?.shortName ?? `boss #${b.bossIndex + 1}`} · +${b.reward.coins}`}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

interface WorldEventSheetProps {
  item: WorldItem
  world: WorldState
  progress: CampaignProgress
  roster: readonly Boss[] | null
  coins: number
  onClose: () => void
  onBlessing: (eventId: string, blessing: TacticId) => void
  onBuy: (eventId: string, potion: PotionId) => void
  onFight: (boss: Boss, item: WorldItem) => void
}

/** Event detail: pray at a shrine, trade with a merchant, or face an ambush / bounty. */
export function WorldEventSheet({ item, world, progress, roster, coins, onClose, onBlessing, onBuy, onFight }: WorldEventSheetProps) {
  const id = worldItemId(item)
  if (item.type === 'bounty') {
    const b = item.bounty
    const boss = roster?.[b.bossIndex]
    const done = isBountyDone(world, b.id)
    const rule = RESTRICTIONS[b.restriction]
    return (
      <Modal
        open
        title="Bounty contract"
        onClose={onClose}
        size="sm"
        footer={
          <Button variant="primary" size="lg" className="w-full" disabled={done || !boss} onClick={() => boss && onFight(boss, item)} icon={<Swords className="size-5" />}>
            {done ? 'Already fulfilled today' : `Accept & fight ${boss?.shortName ?? ''}`}
          </Button>
        }
      >
        <div className="space-y-3 text-sm" data-bounty-sheet>
          {boss && <BossLine boss={boss} />}
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-3">
            <div className="font-bold text-white">{rule.name}</div>
            <div className="text-slate-300">{rule.description}</div>
          </div>
          <Reward coins={b.reward.coins} potion={b.reward.potion} />
          <p className="text-xs text-slate-400">Bounties are unrated and can be retried until fulfilled. A rule you can’t break is enforced on the board; the rest are checked when you win.</p>
        </div>
      </Modal>
    )
  }

  const e = item.event
  const resolved = isEventResolved(world, id)
  const reachable = isEventReachable(progress, e)
  const locked = !reachable ? `Reach boss #${e.anchorIndex + 1} of this realm to visit.` : null

  if (e.kind === 'shrine') {
    return (
      <Modal open title={e.title} onClose={onClose} size="sm">
        <div className="space-y-3 text-sm" data-shrine>
          <p className="text-slate-300">Kneel and choose one blessing. It joins your <b>next campaign battle</b> as an extra tactic.</p>
          {locked && <p className="text-amber-200">{locked}</p>}
          <div className="grid gap-2">
            {e.blessings.map((t) => {
              const tactic = TACTICS[t]
              const Icon = PORTRAIT_ICONS[tactic.icon]
              return (
                <button
                  key={t}
                  type="button"
                  data-blessing={t}
                  disabled={resolved || Boolean(locked)}
                  onClick={() => onBlessing(e.id, t)}
                  className="flex items-start gap-3 rounded-2xl border border-sky-300/30 bg-sky-400/10 p-3 text-left transition hover:bg-sky-400/20 disabled:opacity-40"
                >
                  <Icon className="mt-0.5 size-5 shrink-0 text-sky-200" />
                  <span>
                    <span className="block font-bold text-white">{tactic.name}</span>
                    <span className="block text-xs text-slate-300">{tactic.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {resolved && <p className="text-xs text-slate-400">You have prayed here today. Blessings waiting: {world.blessings.map((t) => TACTICS[t].name).join(', ') || 'none'}.</p>}
        </div>
      </Modal>
    )
  }

  if (e.kind === 'merchant') {
    return (
      <Modal open title={e.title} onClose={onClose} size="sm">
        <div className="space-y-2 text-sm" data-merchant>
          <p className="text-slate-300">
            “Potions for the road, traveller?” <span className="text-yellow-300">You have {coins} coins.</span>
          </p>
          {locked && <p className="text-amber-200">{locked}</p>}
          {e.wares.map((w) => {
            const def = POTIONS[w.potion]
            const Icon = PORTRAIT_ICONS[def.icon]
            const sold = world.purchases.includes(`${e.id}:${w.potion}`)
            return (
              <div key={w.potion} className="flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-2.5">
                <Icon className="size-5 shrink-0 text-amber-200" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white">{def.name}</div>
                  <div className="text-xs text-slate-300">{def.description}</div>
                </div>
                <Button size="sm" variant="primary" data-buy={w.potion} disabled={sold || Boolean(locked) || coins < w.price} onClick={() => onBuy(e.id, w.potion)} icon={<Coins className="size-3.5" />}>
                  {sold ? 'Sold' : w.price}
                </Button>
              </div>
            )
          })}
        </div>
      </Modal>
    )
  }

  const boss = roster?.[e.bossIndex]
  const weather = WEATHER[ambushWeather(e.id)]
  return (
    <Modal
      open
      title={e.title}
      onClose={onClose}
      size="sm"
      footer={
        <Button variant="danger" size="lg" className="w-full" disabled={resolved || Boolean(locked) || !boss} onClick={() => boss && onFight(boss, item)} icon={<Swords className="size-5" />}>
          {resolved ? 'The ambushers are gone' : 'Fight!'}
        </Button>
      }
    >
      <div className="space-y-3 text-sm" data-ambush>
        {boss && <BossLine boss={boss} />}
        <p className="text-slate-300">An elite version of this boss blocks the road: it plays at <b>boosted strength</b>, and the battle is fought in <b>{weather.name.toLowerCase()}</b>. No draft — you are caught off guard.</p>
        <p className="text-xs text-slate-400">{weather.description}</p>
        {locked && <p className="text-amber-200">{locked}</p>}
        <Reward coins={e.reward.coins} potion={e.reward.potion} />
        <p className="text-xs text-slate-400">One attempt per day · unrated.</p>
      </div>
    </Modal>
  )
}

function BossLine({ boss }: { boss: Boss }) {
  return (
    <div className="flex items-center gap-3">
      <PortraitEmblem spec={boss.portrait} label={boss.name} size="sm" />
      <div className="min-w-0">
        <div className="truncate font-bold text-white">{boss.name}</div>
        <div className="truncate text-xs text-slate-400">
          #{boss.index + 1} · {boss.title} · ~{boss.elo}
        </div>
      </div>
    </div>
  )
}

function Reward({ coins, potion }: { coins: number; potion: PotionId | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 text-xs">
      <span className="font-bold uppercase tracking-[0.18em] text-slate-400">Reward</span>
      <span className="text-yellow-300">+{coins} coins</span>
      {potion && <span className="text-amber-200">+1 {POTIONS[potion].name}</span>}
    </div>
  )
}
