import { Dices, Palette, Shuffle, Swords } from 'lucide-react'
import { MUTATORS, type MutatorId, mutatorArena } from '../../data/campaign/mutators'
import { TIERS, TIER_IDS, type TierId } from '../../data/campaign/tiers'
import { useStore } from '../../hooks/useStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import { PORTRAIT_ICONS } from '../legends/portraitIcons'
import { ChoiceGrid } from '../settings/ChoiceGrid'
import { useLookChoices } from '../settings/lookChoices'

interface BattleLoadoutProps {
  /** Mutators rolled for this battle (empty when mutators are off). */
  mutators: readonly MutatorId[]
  onReroll: () => void
  rerollsLeft: number
  /** Best tier this boss was beaten on, if any. */
  bestTier: TierId | undefined
}

/**
 * The customisation hub of the pre-battle screen: difficulty tier, random
 * mutators, and your look for the battle — the realm's own, or any board,
 * piece set (built-in or art pack), avatar and arena backdrop you own. Every
 * choice applies instantly and is remembered for the next battle.
 */
export function BattleLoadout({ mutators, onReroll, rerollsLeft, bestTier }: BattleLoadoutProps) {
  const tier = useStore(settingsStore, (s) => s.campaignTier)
  const mutatorsOn = useStore(settingsStore, (s) => s.battleMutators)
  const look = useStore(settingsStore, (s) => s.battleLook)
  const artPack = useStore(settingsStore, (s) => s.artPack)
  const looks = useLookChoices()
  const arena = mutatorArena(mutators)
  const total = Math.round(TIERS[tier].rewardFactor * arena.rewardFactor * 100) / 100

  return (
    <div className="space-y-4" data-loadout>
      <section aria-label="Difficulty tier">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
          <Swords className="size-3.5" /> Difficulty
          {bestTier && <span className="ml-auto font-normal normal-case tracking-normal text-slate-400">Best win: {TIERS[bestTier].name}</span>}
        </h3>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup">
          {TIER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={tier === id}
              data-tier={id}
              onClick={() => updateSettings({ campaignTier: id })}
              className={`rounded-xl border px-2 py-1.5 text-left text-xs transition ${tier === id ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}
            >
              <span className="block text-sm font-bold">{TIERS[id].name}</span>
              <span className="block font-mono text-[10px] text-slate-400">rewards ×{TIERS[id].rewardFactor}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">{TIERS[tier].description}</p>
      </section>

      <section aria-label="Mutators" data-mutators>
        <div className="mb-1.5 flex items-center gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">
            <Dices className="size-3.5" /> Mutators
          </h3>
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-300">
            Roll mutators
            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={mutatorsOn} onChange={(e) => updateSettings({ battleMutators: e.target.checked })} data-mutator-toggle />
          </label>
        </div>
        {mutatorsOn ? (
          <>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {mutators.map((id) => {
                const m = MUTATORS[id]
                const Icon = PORTRAIT_ICONS[m.icon]
                return (
                  <div key={id} className="flex items-start gap-2 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-2.5" data-mutator={id}>
                    <Icon className="mt-0.5 size-4 shrink-0 text-fuchsia-200" />
                    <div className="min-w-0 text-xs">
                      <div className="font-bold text-white">
                        {m.name} <span className="font-mono font-normal text-fuchsia-200">×{m.rewardFactor}</span>
                      </div>
                      <div className="text-slate-300">{m.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
              <button type="button" onClick={onReroll} disabled={rerollsLeft === 0} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-40" data-reroll>
                <Shuffle className="size-3.5" /> Re-roll ({rerollsLeft})
              </button>
              New mutators every day · a broken contract forfeits their bonus.
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">Off — switch on for a random twist on every battle, and bigger rewards.</p>
        )}
        <p className="mt-1 font-mono text-[11px] text-amber-200" data-reward-factor>
          Coin rewards ×{total}
        </p>
      </section>

      <section aria-label="Battle look" className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">
            <Palette className="size-3.5" /> Battle look
          </h3>
          <div className="ml-auto flex rounded-xl bg-white/5 p-0.5 text-xs" role="radiogroup">
            {(['realm', 'mine'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={look === v}
                data-look={v}
                onClick={() => updateSettings({ battleLook: v })}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${look === v ? 'bg-accent text-ink-950' : 'text-slate-300'}`}
              >
                {v === 'realm' ? "Realm's look" : 'My look'}
              </button>
            ))}
          </div>
        </div>
        {look === 'mine' && (
          <>
            <ChoiceGrid title="Board" items={looks.boards} compact testId="loadout-boards" />
            <ChoiceGrid title="Pieces" items={looks.pieceSets} compact testId="loadout-sets" />
          </>
        )}
        {artPack && looks.artSets.length > 0 && <ChoiceGrid title="Art piece set" items={looks.artSets} pinned={looks.defaults.artSet} compact testId="loadout-art-sets" />}
        {artPack && looks.artBoards.length > 0 && <ChoiceGrid title="Art board" items={looks.artBoards} pinned={looks.defaults.artBoard} compact testId="loadout-art-boards" />}
        {artPack && looks.avatars.length > 0 && <ChoiceGrid title="Avatar" items={looks.avatars} pinned={looks.defaults.avatar} compact testId="loadout-avatars" />}
        {artPack && looks.backdrops.length > 0 && <ChoiceGrid title="Arena backdrop" items={looks.backdrops} pinned={looks.defaults.backdrop} compact testId="loadout-backdrops" />}
        {look === 'realm' && <p className="text-[11px] text-slate-500">The battle uses the board and pieces of this boss's realm. Choose “My look” to bring your own.</p>}
      </section>
    </div>
  )
}
