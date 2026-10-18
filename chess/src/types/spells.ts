import type { RelicId } from './campaign'
import type { Square } from './chess'
import type { PortraitIcon } from './persona'

/** The rule-level effect a spell has; several bosses share a mechanic under their own name. */
export type SpellMechanic = 'freeze' | 'berserker' | 'time-dilation' | 'overclock' | 'shadow-step'

export type SpellId =
  | 'frost-sigil'
  | 'faerie-ring'
  | 'arrow-storm'
  | 'void-lock'
  | 'berserker-charge'
  | 'rally-of-orleans'
  | 'time-dilation'
  | 'eternity'
  | 'ancient-fury'
  | 'threat-analysis'
  | 'total-computation'
  | 'shadow-step'

export interface SpellDef {
  id: SpellId
  mechanic: SpellMechanic
  name: string
  /** What it does, in player terms. */
  description: string
  /** When it fires. */
  trigger: string
  icon: PortraitIcon
  /** True when the spell needs a running clock to have any effect. */
  needsClock: boolean
}

/** One-battle tactical buffs drafted before a fight (roguelike layer). */
export type TacticId = 'knights-boot' | 'chronos-hourglass' | 'katana-blade' | 'vanguard-charge' | 'spell-ward' | 'second-wind'

export interface TacticDef {
  id: TacticId
  name: string
  description: string
  icon: PortraitIcon
  /** Only offered in timed battles. */
  needsClock: boolean
}

/** Relic-driven upgrades to tactics and the draft itself. */
export interface Synergy {
  relic: RelicId
  tactic: TacticId | null
  description: string
}

/** Rules in force for one battle (computed when it starts, fixed until it ends). */
export interface BattleSetup {
  kind: 'campaign' | 'legend' | 'gauntlet'
  /** Spells the opponent can cast. */
  spells: readonly SpellId[]
  /** Tactics the player drafted. */
  tactics: readonly TacticId[]
  /** Clock is running (time spells / tactics only act in timed battles). */
  timed: boolean
  /** Tuning after relic synergies. */
  hourglassBonusMs: number
  bootCharges: number
  wardCharges: number
}

/**
 * Spell / tactic state after each ply. Kept as one snapshot per ply so undo
 * and the time machine restore it exactly.
 */
export interface BattleEffects {
  /** Opponent moves made so far (drives spell cadence; passes don't count). */
  bossMoves: number
  /** Square the player may not move to or through on their current move. */
  frozen: Square | null
  /** Spell the opponent is charging (shown as a warning before it lands). */
  warning: { spell: SpellId; inBossMoves: number } | null
  /** The opponent's next move is computed at full power. */
  overclock: boolean
  /** Berserker pawns unlocked (after losing a rook). */
  berserker: boolean
  shadowStepUsed: boolean
  wardCharges: number
  bootCharges: number
  vanguardCharges: number
  /** Katana Blade: ready → pending (after your first capture) → spent (opponent skipped a turn). */
  katana: 'none' | 'ready' | 'pending' | 'spent'
  secondWind: 'none' | 'ready' | 'spent'
}

export type BattleEvent =
  | { kind: 'spell-warning'; spell: SpellId }
  | { kind: 'spell-cast'; spell: SpellId; square?: Square }
  | { kind: 'spell-blocked'; spell: SpellId }
  | { kind: 'tactic'; tactic: TacticId; detail: string }
  | { kind: 'clock'; side: 'human' | 'boss'; deltaMs: number; reason: string }
