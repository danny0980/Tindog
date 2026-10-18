import { useState } from 'react'
import { RESTRICTIONS, WEATHER } from '../../data/arena'
import { SPELLS, TACTICS } from '../../data/spells'
import type { PortraitIcon } from '../../types/persona'
import type { BattleEffects, BattleSetup, SpellId, TacticId } from '../../types/spells'
import { PORTRAIT_ICONS } from '../legends/portraitIcons'

type ChipState = 'idle' | 'charging' | 'active' | 'ready' | 'spent' | 'dormant'

const CHIP: Record<ChipState, string> = {
  idle: 'border-white/15 bg-white/[0.04] text-slate-200',
  charging: 'border-amber-300/70 bg-amber-300/15 text-amber-100 animate-pulse-soft',
  active: 'border-red-400/70 bg-red-500/15 text-red-100',
  ready: 'border-emerald-300/60 bg-emerald-400/10 text-emerald-100',
  spent: 'border-white/5 bg-white/[0.02] text-slate-500 line-through',
  dormant: 'border-white/5 bg-white/[0.02] text-slate-500',
}

function spellState(id: SpellId, setup: BattleSetup, fx: BattleEffects): { state: ChipState; note: string } {
  const spell = SPELLS[id]
  if (spell.needsClock && !setup.timed) return { state: 'dormant', note: 'dormant (untimed)' }
  if (fx.warning?.spell === id) return { state: 'charging', note: spell.mechanic === 'overclock' ? 'full power next move' : 'lands next move' }
  const frost = fx.traps.filter((t) => t.kind === 'frost')
  if (spell.mechanic === 'freeze' && frost.length > 0) return { state: 'active', note: `${frost.map((t) => `${t.square.toUpperCase()} (${t.turnsLeft})`).join(', ')} frozen` }
  if (spell.mechanic === 'berserker') return fx.berserker ? { state: 'active', note: 'pawns charging' } : { state: 'idle', note: 'after a lost rook' }
  if (spell.mechanic === 'shadow-step') return fx.shadowStepUsed ? { state: 'spent', note: 'used' } : { state: 'idle', note: 'when threatened' }
  if (spell.mechanic === 'freeze' || spell.mechanic === 'overclock') return { state: 'idle', note: `every ${5} moves` }
  return { state: 'idle', note: 'on slow moves' }
}

function tacticState(id: TacticId, setup: BattleSetup, fx: BattleEffects): { state: ChipState; note: string } {
  if (TACTICS[id].needsClock && !setup.timed) return { state: 'dormant', note: 'needs a clock' }
  switch (id) {
    case 'knights-boot':
      return fx.bootCharges > 0 ? { state: 'ready', note: `${fx.bootCharges}× leap ready` } : { state: 'spent', note: 'used' }
    case 'vanguard-charge':
      return fx.vanguardCharges > 0 ? { state: 'ready', note: 'charge ready' } : { state: 'spent', note: 'used' }
    case 'spell-ward':
      return fx.wardCharges > 0 ? { state: 'ready', note: `${fx.wardCharges}× ward` } : { state: 'spent', note: 'spent' }
    case 'katana-blade':
      return fx.katana === 'pending' ? { state: 'charging', note: 'tempo pending' } : fx.katana === 'spent' ? { state: 'spent', note: 'struck' } : { state: 'ready', note: 'first capture' }
    case 'second-wind':
      return fx.secondWind === 'spent' ? { state: 'spent', note: 'used' } : { state: 'ready', note: 'under 30 s' }
    case 'chronos-hourglass':
      return { state: 'ready', note: `+${setup.hourglassBonusMs / 1000} s on check` }
  }
}

const WIND_ARROW = { N: '↑', E: '→', S: '↓', W: '←' } as const

/** Arena chips: weather, bounty contract, Ironman, glue kits and awakened knights. */
function arenaItems(setup: BattleSetup, fx: BattleEffects) {
  const out: Array<{ key: string; owner: 'arena'; name: string; icon: PortraitIcon; rules: string; state: ChipState; note: string }> = []
  if (setup.weather !== 'clear') {
    const w = WEATHER[setup.weather]
    const note = setup.weather === 'wind' ? `blowing ${WIND_ARROW[fx.weather.wind]}` : setup.weather === 'snow' ? `${fx.weather.snow.length} drifts` : 'no hints'
    out.push({ key: 'a:weather', owner: 'arena', name: w.name, icon: w.icon, rules: w.description, state: 'active', note })
  }
  if (setup.restriction) {
    const r = RESTRICTIONS[setup.restriction]
    out.push({ key: 'a:contract', owner: 'arena', name: r.name, icon: 'scroll', rules: r.description, state: 'charging', note: 'bounty contract' })
  }
  if (setup.ironman) out.push({ key: 'a:ironman', owner: 'arena', name: 'Ironman', icon: 'skull', rules: 'No takebacks. Losing this battle wipes your Ironman run. Victories pay triple coins.', state: 'active', note: 'permadeath' })
  if (fx.glueCharges > 0) out.push({ key: 'a:glue', owner: 'arena', name: 'Glue trap', icon: 'hexagon', rules: 'Tap “Lay trap”, then an empty square. An enemy piece that lands there is stuck for two turns.', state: 'ready', note: `${fx.glueCharges}× to lay` })
  const glue = fx.traps.filter((t) => t.kind === 'glue').length
  if (glue > 0) out.push({ key: 'a:glued', owner: 'arena', name: `${glue} glue trap${glue === 1 ? '' : 's'}`, icon: 'hexagon', rules: 'Your glue traps on the board (they fade after six enemy moves).', state: 'idle', note: 'set' })
  if (fx.stuck.length > 0) out.push({ key: 'a:stuck', owner: 'arena', name: 'Stuck', icon: 'lock', rules: 'Enemy pieces caught in glue cannot move.', state: 'active', note: fx.stuck.map((s) => s.square.toUpperCase()).join(', ') })
  if (fx.awakening > 0) out.push({ key: 'a:awake', owner: 'arena', name: 'Awakened knight', icon: 'knight', rules: 'One of your knights may make a 3 + 1 long leap (violet rings).', state: 'ready', note: `${fx.awakening}× leap` })
  return out
}

interface SpellHudProps {
  setup: BattleSetup
  effects: BattleEffects
  opponentName: string
  /** One-line chips for the one-handed screen. */
  compact?: boolean
}

/**
 * Battle HUD for spells and tactics: what the opponent can cast (and whether
 * it is charging), and which drafted tactics you still hold. Tap a chip for
 * its rules.
 */
export function SpellHud({ setup, effects, opponentName, compact = false }: SpellHudProps) {
  const [open, setOpen] = useState<string | null>(null)
  const arena = arenaItems(setup, effects)
  if (setup.spells.length === 0 && setup.tactics.length === 0 && arena.length === 0) return null
  const items = [
    ...arena,
    ...setup.spells.map((id) => ({ key: `s:${id}`, owner: 'boss' as const, name: SPELLS[id].name, icon: SPELLS[id].icon, rules: SPELLS[id].description, ...spellState(id, setup, effects) })),
    ...setup.tactics.map((id) => ({ key: `t:${id}`, owner: 'you' as const, name: TACTICS[id].name, icon: TACTICS[id].icon, rules: TACTICS[id].description, ...tacticState(id, setup, effects) })),
  ]
  const detail = items.find((i) => i.key === open)

  return (
    <div className={compact ? '' : 'glass rounded-2xl px-3 py-2.5'} aria-label="Spells and tactics">
      {!compact && <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Spells, tactics & arena</div>}
      <div className={`flex gap-1.5 ${compact ? 'scrollbar-thin overflow-x-auto' : 'flex-wrap'}`}>
        {items.map((item) => {
          const Icon = PORTRAIT_ICONS[item.icon]
          return (
            <button
              key={item.key}
              type="button"
              data-chip={item.key}
              data-state={item.state}
              onClick={() => setOpen((o) => (o === item.key ? null : item.key))}
              aria-expanded={open === item.key}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${CHIP[item.state]}`}
              title={item.rules}
            >
              <Icon className="size-3.5" />
              <span className={item.owner === 'you' ? 'text-emerald-200' : item.owner === 'arena' ? 'text-sky-100' : ''}>{item.name}</span>
              {!compact && <span className="font-normal opacity-80 no-underline">· {item.note}</span>}
            </button>
          )
        })}
      </div>
      {detail && (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-300">
          <span className="font-bold text-white">{detail.owner === 'boss' ? `${opponentName}: ` : detail.owner === 'arena' ? 'Arena: ' : 'You: '}</span>
          {detail.rules} <span className="text-slate-400">({detail.note})</span>
        </p>
      )}
    </div>
  )
}
