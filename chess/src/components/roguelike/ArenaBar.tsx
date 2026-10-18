import { Hexagon, Skull, X } from 'lucide-react'
import { MAX_POTIONS_PER_BATTLE, POTIONS, POTION_IDS } from '../../data/arena'
import { altarOpen } from '../../engine/spellEngine'
import type { PickMode } from '../../hooks/useGameController'
import type { PotionInventory, PotionId } from '../../types/rpg'
import type { BattleEffects, BattleSetup } from '../../types/spells'
import { PORTRAIT_ICONS } from '../legends/portraitIcons'

interface ArenaBarProps {
  setup: BattleSetup
  effects: BattleEffects
  potions: PotionInventory
  /** Actions are only possible on your live turn. */
  enabled: boolean
  pickMode: PickMode
  altarSquares: number
  onDrink: (potion: PotionId) => void
  onPickMode: (mode: PickMode) => void
  compact?: boolean
}

/**
 * Potion belt, glue-trap and Sacrifice Altar controls for a character battle.
 * Thumb-sized targets in one horizontally scrolling row (one-handed friendly).
 * None of these spend your move — except the altar, which is its own ply.
 */
export function ArenaBar({ setup, effects, potions, enabled, pickMode, altarSquares, onDrink, onPickMode, compact = false }: ArenaBarProps) {
  const owned = POTION_IDS.filter((id) => (potions[id] ?? 0) > 0)
  const potionsLeft = MAX_POTIONS_PER_BATTLE - effects.potionsUsed
  const canAltar = altarOpen(effects) && altarSquares > 0
  const hint =
    pickMode === 'glue'
      ? 'Tap an empty square to lay the glue trap.'
      : pickMode === 'altar'
        ? 'Tap one of your pawns to sacrifice it: a knight awakens and a spent tactic recharges.'
        : null

  return (
    <div className={compact ? 'space-y-1.5' : 'glass space-y-2 rounded-2xl px-3 py-2.5'} aria-label="Potions and arena actions">
      {!compact && (
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          <span>Potion belt</span>
          <span className="normal-case tracking-normal">{potionsLeft} of {MAX_POTIONS_PER_BATTLE} left this battle</span>
        </div>
      )}
      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-0.5">
        {owned.length === 0 && !compact && <span className="py-1.5 text-[11px] text-slate-500">No potions — merchants, bounties and the shop sell them.</span>}
        {owned.map((id) => {
          const def = POTIONS[id]
          const Icon = PORTRAIT_ICONS[def.icon]
          const dormant = def.needsClock && !setup.timed
          return (
            <button
              key={id}
              type="button"
              data-potion={id}
              disabled={!enabled || dormant || potionsLeft <= 0}
              onClick={() => onDrink(id)}
              title={`${def.name}: ${def.description}`}
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 text-[11px] font-semibold text-amber-50 transition active:scale-95 disabled:opacity-40"
            >
              <Icon className="size-4" />
              <span>{def.name}</span>
              <span className="rounded-full bg-black/30 px-1.5 text-[10px]">×{potions[id] ?? 0}</span>
            </button>
          )
        })}
        {effects.glueCharges > 0 && (
          <button
            type="button"
            data-action="glue"
            disabled={!enabled}
            onClick={() => onPickMode(pickMode === 'glue' ? null : 'glue')}
            aria-pressed={pickMode === 'glue'}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition active:scale-95 disabled:opacity-40 ${pickMode === 'glue' ? 'border-amber-300 bg-amber-400/30 text-white' : 'border-amber-300/40 bg-white/5 text-amber-100'}`}
          >
            <Hexagon className="size-4" /> Lay trap ×{effects.glueCharges}
          </button>
        )}
        {(setup.kind !== 'legend' || canAltar) && (
          <button
            type="button"
            data-action="altar"
            disabled={!enabled || !canAltar}
            onClick={() => onPickMode(pickMode === 'altar' ? null : 'altar')}
            aria-pressed={pickMode === 'altar'}
            title={effects.altarUsed ? 'The altar has taken its offering.' : canAltar ? 'Sacrifice a pawn for power.' : 'The altar opens after the opponent’s third move.'}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition active:scale-95 disabled:opacity-40 ${pickMode === 'altar' ? 'border-rose-300 bg-rose-500/30 text-white' : 'border-rose-300/40 bg-white/5 text-rose-100'}`}
          >
            <Skull className="size-4" /> {effects.altarUsed ? 'Altar spent' : 'Altar'}
          </button>
        )}
      </div>
      {hint && (
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-200" role="status">
          <span className="flex-1">{hint}</span>
          <button type="button" onClick={() => onPickMode(null)} className="rounded-full p-1 text-slate-400 hover:text-white" aria-label="Cancel">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
