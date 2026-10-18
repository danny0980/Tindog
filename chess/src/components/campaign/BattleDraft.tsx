import { Check, MessageSquareQuote, Skull, Sparkles, Swords, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { RELICS, relicSlots } from '../../data/campaign/relics'
import { parleyFor } from '../../data/parley'
import { bossPersona } from '../../data/personas'
import { SPELLS, TACTICS, dealDraft, hashSeed, spellsForBoss, synergiesFor } from '../../data/spells'
import type { ParleyChoice } from '../../types/rpg'
import type { Boss, CampaignProgress, RelicId } from '../../types/campaign'
import type { TacticId } from '../../types/spells'
import { bossRecord } from '../../utils/campaign'
import { PORTRAIT_ICONS } from '../legends/portraitIcons'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { RelicTile } from './RelicTile'

interface BattleDraftProps {
  boss: Boss
  progress: CampaignProgress
  /** Whether the chosen clock is running (clock-only tactics are left out of untimed battles). */
  timed: boolean
  onToggleRelic: (id: RelicId) => void
  /** Shrine blessings that will join this battle. */
  blessings: readonly TacticId[]
  /** Ironman run in progress (shown as a warning). */
  ironman: boolean
  onConfirm: (tactics: TacticId[], parley: ParleyChoice | null) => void
  onClose: () => void
}

/**
 * Roguelike pre-battle draft: review the boss's spells, set your Reliquary
 * loadout, then take one of three tactic cards (two of four with the
 * Starforged Crown). The deal is seeded per boss and attempt, so reopening
 * the screen can't reroll it.
 */
export function BattleDraft({ boss, progress, timed, blessings, ironman, onToggleRelic, onConfirm, onClose }: BattleDraftProps) {
  const record = bossRecord(progress, boss.id)
  const attempt = record.wins + record.losses + record.draws
  const offer = useMemo(() => dealDraft(hashSeed(`${boss.id}#${attempt}#${timed ? 't' : 'u'}`), progress.relics, timed), [attempt, boss.id, progress.relics, timed])
  const [picked, setPicked] = useState<TacticId[]>([])
  const parley = useMemo(() => parleyFor(bossPersona(boss).tone, `${boss.id}#${attempt}#parley`), [attempt, boss])
  const [choice, setChoice] = useState<ParleyChoice | null>(null)
  const synergies = synergiesFor(progress.relics)
  const spells = spellsForBoss(boss)
  const slots = relicSlots(progress.relics)
  const wearable = RELICS.filter((r) => progress.relics.includes(r.id) && r.scope !== 'passive')

  const toggle = (id: TacticId) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : prev.length < offer.picks ? [...prev, id] : [...prev.slice(1), id]))

  return (
    <Modal
      open
      title={`Prepare for ${boss.shortName}`}
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="primary" size="lg" className="w-full" onClick={() => onConfirm(choice?.grant ? [...picked, choice.grant] : picked, choice)} icon={<Swords className="size-5" />}>
          {picked.length > 0 ? `Battle with ${picked.map((t) => TACTICS[t].name).join(' + ')}` : 'Battle without a tactic'}
        </Button>
      }
    >
      <div className="space-y-4" data-draft>
        {ironman && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-100" data-ironman-warning>
            <Skull className="size-4 shrink-0" /> Ironman: no takebacks — a defeat wipes this run. Victories pay triple coins.
          </div>
        )}

        <section aria-label="Parley" data-parley>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200">
            <MessageSquareQuote className="size-3.5" /> Parley
          </h3>
          <p className="mb-2 rounded-2xl bg-white/5 p-3 text-sm italic text-slate-200">
            <span className="not-italic font-bold text-white">{boss.shortName}: </span>
            {parley.prompt}
          </p>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {parley.choices.map((c) => {
              const on = choice?.id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  data-parley-choice={c.id}
                  aria-pressed={on}
                  onClick={() => setChoice(on ? null : c)}
                  className={`flex flex-col gap-1 rounded-2xl border p-2.5 text-left text-xs transition ${on ? 'border-violet-300 bg-violet-400/20' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}
                >
                  <span className="text-sm font-semibold text-white">{c.label}</span>
                  <span className="text-slate-300">{c.effect}</span>
                </button>
              )
            })}
          </div>
          {!choice && <p className="mt-1 text-[11px] text-slate-500">Optional — say nothing and the battle is fought as usual.</p>}
        </section>

        {spells.length > 0 && (
          <section aria-label="Boss spells">
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-red-300">Boss spells</h3>
            {spells.map((id) => {
              const spell = SPELLS[id]
              const Icon = PORTRAIT_ICONS[spell.icon]
              return (
                <div key={id} className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3">
                  <Icon className="mt-0.5 size-5 shrink-0 text-red-300" />
                  <div className="text-sm">
                    <div className="font-bold text-white">{spell.name}</div>
                    <div className="text-slate-300">{spell.description}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{spell.trigger}</div>
                    {spell.needsClock && !timed && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-200">
                        <TriangleAlert className="size-3.5" /> Dormant in an untimed battle.
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        <section aria-label="Tactic draft">
          <div className="mb-1.5 flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Draft a tactic</h3>
            <span className="text-xs text-slate-400">
              Take {offer.picks} of {offer.cards.length} · this battle only
            </span>
          </div>
          <div className={`grid gap-2 ${offer.cards.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {offer.cards.map((id) => {
              const tactic = TACTICS[id]
              const Icon = PORTRAIT_ICONS[tactic.icon]
              const on = picked.includes(id)
              const boost = synergies.find((s) => s.tactic === id)
              return (
                <button
                  key={id}
                  type="button"
                  data-card={id}
                  aria-pressed={on}
                  onClick={() => toggle(id)}
                  className={`relative flex flex-col gap-1.5 rounded-2xl border p-3 text-left transition ${
                    on ? 'border-emerald-300 bg-emerald-400/15 shadow-[0_10px_30px_-12px_rgba(110,231,183,0.7)]' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`flex size-9 items-center justify-center rounded-xl ${on ? 'bg-emerald-300 text-ink-950' : 'bg-white/10 text-emerald-200'}`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="text-sm font-bold text-white">{tactic.name}</span>
                    {on && <Check className="ml-auto size-4 text-emerald-300" />}
                  </span>
                  <span className="text-xs leading-snug text-slate-300">{tactic.description}</span>
                  {boost && (
                    <span className="flex items-start gap-1 text-[11px] text-amber-200">
                      <Sparkles className="mt-0.5 size-3 shrink-0" /> {boost.description}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {blessings.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-sky-200" data-blessings>
              <Sparkles className="size-3" /> Shrine blessing joins this battle: {blessings.map((t) => TACTICS[t].name).join(', ')}
            </p>
          )}
          {!timed && <p className="mt-1.5 text-[11px] text-slate-500">Clock tactics (Chronos Hourglass, Second Wind) only appear in timed battles.</p>}
        </section>

        <section aria-label="Relic loadout">
          <div className="mb-1.5 flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">Reliquary loadout</h3>
            <span className="font-mono text-xs text-slate-400">
              {progress.equipped.length}/{slots} slots
            </span>
          </div>
          {wearable.length === 0 ? (
            <p className="rounded-xl bg-white/5 p-3 text-xs text-slate-400">No relics yet — milestone (#10) and overlord (#20) bosses drop them.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {wearable.map((relic) => {
                const on = progress.equipped.includes(relic.id)
                return (
                  <button
                    key={relic.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && progress.equipped.length >= slots}
                    onClick={() => onToggleRelic(relic.id)}
                    className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${on ? 'border-accent bg-accent/15 text-white' : 'border-white/10 text-slate-300'}`}
                  >
                    <RelicTile relic={relic} size="sm" /> {relic.name}
                  </button>
                )
              })}
            </div>
          )}
          {synergies.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-amber-100/90">
              {synergies.map((s) => (
                <li key={s.relic} className="flex gap-1">
                  <Sparkles className="mt-0.5 size-3 shrink-0" /> {s.description}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}
