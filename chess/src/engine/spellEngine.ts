// The spell engine: a pure reducer applied after every ply. It decides when
// boss spells charge and land, consumes drafted tactics, and reports events
// (casts, warnings, clock changes, Katana passes) for the controller and UI.
// Deterministic given its RNG, so every rule is unit-tested.
import { Chess } from 'chess.js'
import { SPELLS } from '../data/spells'
import type { ClockTimes, Color, Move, Square } from '../types/chess'
import type { BattleEffects, BattleEvent, BattleSetup, SpellId, SpellMechanic } from '../types/spells'
import { type SpecialMove, crossesFrozen, generateCharges, generateLeaps, isKingAttacked, isSpecialMove, pathSquares } from './variant'

/** Spells on a 5-move cadence charge on move 4, 9, 14… and land on 5, 10, 15… */
export const SPELL_CADENCE = 5
export const DILATION_THRESHOLD_MS = 15_000
export const DILATION_BONUS_MS = 10_000
export const SECOND_WIND_BELOW_MS = 30_000
export const SECOND_WIND_BONUS_MS = 60_000

const spellWith = (setup: BattleSetup, mechanic: SpellMechanic): SpellId | null => setup.spells.find((id) => SPELLS[id].mechanic === mechanic) ?? null

export function createEffects(setup: BattleSetup): BattleEffects {
  const has = (t: string) => setup.tactics.some((x) => x === t)
  return {
    bossMoves: 0,
    frozen: null,
    warning: null,
    overclock: false,
    berserker: false,
    shadowStepUsed: false,
    wardCharges: setup.wardCharges,
    bootCharges: setup.bootCharges,
    vanguardCharges: has('vanguard-charge') ? 1 : 0,
    katana: has('katana-blade') ? 'ready' : 'none',
    secondWind: has('second-wind') ? 'ready' : 'none',
  }
}

export interface PlyContext {
  setup: BattleSetup
  mover: 'human' | 'boss'
  move: Move
  /** Position after the ply. */
  fen: string
  humanColor: Color
  /** How long the player thought before a human ply (ms). */
  thinkMs: number
  /** Clocks after the ply (before any adjustment from this reducer). */
  clocks: ClockTimes
  rng: () => number
}

export interface PlyOutcome {
  effects: BattleEffects
  events: BattleEvent[]
  /** Katana Blade: the boss must now skip its turn. */
  passBoss: boolean
}

const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w')

/**
 * Picks the square a freeze spell seals: an empty square the player could
 * otherwise use (a destination or a sliding path), never one that would leave
 * them without a legal move.
 */
export function chooseFrozenSquare(fen: string, rng: () => number): Square | null {
  let moves: Move[]
  try {
    moves = new Chess(fen).moves({ verbose: true })
  } catch {
    return null
  }
  const occupied = new Set<string>()
  const chess = new Chess(fen)
  for (const row of chess.board()) for (const cell of row) if (cell) occupied.add(cell.square)
  const candidates = [...new Set(moves.flatMap((m) => pathSquares(m)))].filter((sq) => !occupied.has(sq))
  const viable = candidates.filter((sq) => moves.some((m) => !crossesFrozen(m, sq)))
  if (viable.length === 0) return null
  return viable[Math.floor(rng() * viable.length)] ?? null
}

/** Applies one ply to the battle state. */
export function afterPly(effects: BattleEffects, ctx: PlyContext): PlyOutcome {
  const { setup, move } = ctx
  const events: BattleEvent[] = []
  const next: BattleEffects = { ...effects }
  const bossColor = opposite(ctx.humanColor)
  const has = (t: string) => setup.tactics.some((x) => x === t)

  /** Spell Ward absorbs the cast if it still has a charge. */
  const cast = (spell: SpellId): boolean => {
    if (next.wardCharges > 0) {
      next.wardCharges -= 1
      events.push({ kind: 'spell-blocked', spell })
      return false
    }
    return true
  }

  if (ctx.mover === 'human') {
    next.frozen = null
    if (isSpecialMove(move)) {
      if (move.piece === 'n' && next.bootCharges > 0) {
        next.bootCharges -= 1
        events.push({ kind: 'tactic', tactic: 'knights-boot', detail: `Long leap ${move.from} → ${move.to}` })
      } else if (move.piece === 'p' && next.vanguardCharges > 0) {
        next.vanguardCharges -= 1
        events.push({ kind: 'tactic', tactic: 'vanguard-charge', detail: `Pawn charge ${move.from} → ${move.to}` })
      }
    }
    if (next.katana === 'ready' && move.captured) next.katana = 'pending'

    const dilation = spellWith(setup, 'time-dilation')
    if (dilation && setup.timed && ctx.thinkMs > DILATION_THRESHOLD_MS && cast(dilation)) {
      events.push({ kind: 'spell-cast', spell: dilation })
      events.push({ kind: 'clock', side: 'boss', deltaMs: DILATION_BONUS_MS, reason: SPELLS[dilation].name })
    }

    const berserk = spellWith(setup, 'berserker')
    if (berserk && !next.berserker && move.captured === 'r' && cast(berserk)) {
      next.berserker = true
      events.push({ kind: 'spell-cast', spell: berserk })
    }

    if (next.secondWind === 'ready' && setup.timed && ctx.clocks[ctx.humanColor] < SECOND_WIND_BELOW_MS) {
      next.secondWind = 'spent'
      events.push({ kind: 'clock', side: 'human', deltaMs: SECOND_WIND_BONUS_MS, reason: 'Second Wind' })
      events.push({ kind: 'tactic', tactic: 'second-wind', detail: '+60 s' })
    }

    // Katana Blade: the boss loses its next turn as soon as it isn't in check.
    let passBoss = false
    if (next.katana === 'pending' && !isKingAttacked(ctx.fen, bossColor)) {
      next.katana = 'spent'
      passBoss = true
      events.push({ kind: 'tactic', tactic: 'katana-blade', detail: 'The boss loses its turn' })
    }
    return { effects: next, events, passBoss }
  }

  // ── Opponent ply ──
  if (move.flags.includes('z')) return { effects: next, events, passBoss: false }
  next.bossMoves += 1
  const n = next.bossMoves
  if (next.overclock) {
    next.overclock = false
    next.warning = null
  }
  if (isSpecialMove(move) && move.piece === 'n') next.shadowStepUsed = true

  if (has('chronos-hourglass') && setup.timed && (move.san.includes('+') || move.san.includes('#'))) {
    events.push({ kind: 'clock', side: 'human', deltaMs: setup.hourglassBonusMs, reason: 'Chronos Hourglass' })
    events.push({ kind: 'tactic', tactic: 'chronos-hourglass', detail: `+${setup.hourglassBonusMs / 1000} s` })
  }

  const freeze = spellWith(setup, 'freeze')
  if (freeze) {
    if (n % SPELL_CADENCE === SPELL_CADENCE - 1) {
      next.warning = { spell: freeze, inBossMoves: 1 }
      events.push({ kind: 'spell-warning', spell: freeze })
    } else if (n % SPELL_CADENCE === 0) {
      next.warning = null
      const square = chooseFrozenSquare(ctx.fen, ctx.rng)
      if (square && cast(freeze)) {
        next.frozen = square
        events.push({ kind: 'spell-cast', spell: freeze, square })
      }
    }
  }

  const overclock = spellWith(setup, 'overclock')
  if (overclock && n % SPELL_CADENCE === SPELL_CADENCE - 1 && cast(overclock)) {
    next.overclock = true
    next.warning = { spell: overclock, inBossMoves: 1 }
    events.push({ kind: 'spell-warning', spell: overclock })
  }

  return { effects: next, events, passBoss: false }
}

// ── Special moves ────────────────────────────────────────────────────────────

/** Rule-bending moves the player can make right now (Knight's Boot, Vanguard Charge). */
export function humanSpecialMoves(effects: BattleEffects, fen: string, humanColor: Color): SpecialMove[] {
  const out: SpecialMove[] = []
  if (effects.bootCharges > 0) out.push(...generateLeaps(fen, humanColor))
  if (effects.vanguardCharges > 0) out.push(...generateCharges(fen, humanColor))
  return effects.frozen ? out.filter((s) => s.to !== effects.frozen) : out
}

/** Is the opponent "threatened" — in check, or its queen under attack? */
export function isThreatened(fen: string, color: Color): boolean {
  if (isKingAttacked(fen, color)) return true
  try {
    const chess = new Chess(fen)
    for (const row of chess.board()) for (const cell of row) if (cell && cell.type === 'q' && cell.color === color && chess.isAttacked(cell.square, opposite(color))) return true
  } catch {
    return false
  }
  return false
}

/** Rule-bending moves the opponent may consider (Berserker pawns, Shadow Step). */
export function bossSpecialMoves(effects: BattleEffects, setup: BattleSetup, fen: string, bossColor: Color): SpecialMove[] {
  const out: SpecialMove[] = []
  if (effects.berserker) out.push(...generateCharges(fen, bossColor))
  if (spellWith(setup, 'shadow-step') && !effects.shadowStepUsed && isThreatened(fen, bossColor)) out.push(...generateLeaps(fen, bossColor))
  return out
}

/** Player moves legal under the current freeze. */
export const isMoveFrozen = (effects: BattleEffects, move: Pick<Move, 'from' | 'to' | 'piece' | 'flags'>): boolean => crossesFrozen(move, effects.frozen)
