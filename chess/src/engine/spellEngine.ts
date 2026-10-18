// The spell engine: a pure reducer applied after every ply. It decides when
// boss spells charge and land, consumes drafted tactics, runs the arena
// (frost / glue traps, weather, the Sacrifice Altar, potions, bounty rules)
// and reports events for the controller and UI. Deterministic given its RNG,
// so every rule is unit-tested.
import { Chess } from 'chess.js'
import { MAX_POTIONS_PER_BATTLE } from '../data/arena'
import { SPELLS } from '../data/spells'
import type { ClockTimes, Color, Move, Square } from '../types/chess'
import type { PotionId, Trap, WindDirection } from '../types/rpg'
import type { BattleEffects, BattleEvent, BattleSetup, SpellId, SpellMechanic } from '../types/spells'
import { type SpecialMove, generateCharges, generateLeaps, isKingAttacked, isSpecialMove, pathSquares, sacrificePawn } from './variant'

/** Spells on a 5-move cadence charge on move 4, 9, 14… and land on 5, 10, 15… */
export const SPELL_CADENCE = 5
export const DILATION_THRESHOLD_MS = 15_000
export const DILATION_BONUS_MS = 10_000
export const SECOND_WIND_BELOW_MS = 30_000
export const SECOND_WIND_BONUS_MS = 60_000
/** Weather cadences (plies). */
export const SNOW_EVERY = 4
export const WIND_EVERY = 6
/** Slides this long (or longer) straight into the wind are blown back. */
export const WIND_MIN_SLIDE = 4
/** A glue trap fades after this many opponent moves; a piece caught in it is stuck for STUCK_TURNS. */
export const GLUE_LIFETIME = 6
export const STUCK_TURNS = 2
export const TIME_ELIXIR_MS = 30_000
/** The Sacrifice Altar opens once the opponent has made this many moves. */
export const ALTAR_OPENS_AFTER = 3

const WIND_ORDER: readonly WindDirection[] = ['N', 'E', 'S', 'W']

const spellWith = (setup: BattleSetup, mechanic: SpellMechanic): SpellId | null => setup.spells.find((id) => SPELLS[id].mechanic === mechanic) ?? null

export function createEffects(setup: BattleSetup): BattleEffects {
  const has = (t: string) => setup.tactics.some((x) => x === t)
  return {
    bossMoves: 0,
    traps: [],
    stuck: [],
    weather: { id: setup.weather, snow: [], wind: 'N' },
    plies: 0,
    glueCharges: 0,
    awakening: 0,
    altarUsed: false,
    potionsUsed: 0,
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
const fileIndex = (sq: Square): number => 'abcdefgh'.indexOf(sq[0] ?? 'a')
const rankIndex = (sq: Square): number => Number(sq[1])

function occupiedSquares(fen: string): Set<Square> {
  const out = new Set<Square>()
  try {
    for (const row of new Chess(fen).board()) for (const cell of row) if (cell) out.add(cell.square)
  } catch {
    // Unparseable position: treat the board as empty.
  }
  return out
}

function legalMoves(fen: string): Move[] {
  try {
    return new Chess(fen).moves({ verbose: true })
  } catch {
    return []
  }
}

export const frostSquares = (fx: BattleEffects): Square[] => fx.traps.filter((t) => t.kind === 'frost' && t.victim === 'human').map((t) => t.square)
export const glueSquares = (fx: BattleEffects): Square[] => fx.traps.filter((t) => t.kind === 'glue').map((t) => t.square)

/**
 * Picks the square a freeze spell seals: an empty, untrapped square the player
 * could otherwise use (a destination or a sliding path), never one that would
 * leave them without a legal move.
 */
export function chooseFrozenSquare(fen: string, rng: () => number, avoid: readonly Square[] = []): Square | null {
  const moves = legalMoves(fen)
  const occupied = occupiedSquares(fen)
  const candidates = [...new Set(moves.flatMap((m) => pathSquares(m)))].filter((sq) => !occupied.has(sq) && !avoid.includes(sq))
  const viable = candidates.filter((sq) => moves.some((m) => !pathSquares(m).includes(sq) && !avoid.some((a) => pathSquares(m).includes(a))))
  if (viable.length === 0) return null
  return viable[Math.floor(rng() * viable.length)] ?? null
}

/** Two fresh snow squares: empty squares on ranks 3–6. */
export function chooseSnowSquares(fen: string, rng: () => number, count = 2): Square[] {
  const occupied = occupiedSquares(fen)
  const pool: Square[] = []
  for (let rank = 3; rank <= 6; rank++) for (const file of 'abcdefgh') {
    const sq = `${file}${rank}` as Square
    if (!occupied.has(sq)) pool.push(sq)
  }
  const out: Square[] = []
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length)
    const [sq] = pool.splice(i, 1)
    if (sq) out.push(sq)
  }
  return out
}

// ── Move rules ───────────────────────────────────────────────────────────────

type MoveShape = Pick<Move, 'from' | 'to' | 'piece' | 'flags'>

/** Is this a straight slide of WIND_MIN_SLIDE+ squares against the wind? */
export function blownBack(move: MoveShape, wind: WindDirection): boolean {
  if (move.piece === 'n' || move.flags.includes('k') || move.flags.includes('q')) return false
  const df = fileIndex(move.to) - fileIndex(move.from)
  const dr = rankIndex(move.to) - rankIndex(move.from)
  if (df !== 0 && dr !== 0) return false
  const into = wind === 'N' ? -dr : wind === 'S' ? dr : wind === 'E' ? -df : df
  return into >= WIND_MIN_SLIDE
}

/**
 * Why `side` may not play `move` under the arena rules (null = allowed).
 * Frost and bounty rules bind the player; glue binds the opponent; weather binds both.
 */
export function blockReason(fx: BattleEffects, setup: BattleSetup, move: MoveShape, side: 'human' | 'boss'): string | null {
  const path = pathSquares(move)
  if (side === 'human') {
    const frost = frostSquares(fx).find((sq) => path.includes(sq))
    if (frost) return `${frost.toUpperCase()} is frozen: no piece may land on it or pass through it.`
    if (setup.restriction === 'pawnless' && move.piece === 'p') return 'Bounty contract: no pawn moves.'
    if (setup.restriction === 'no-castling' && (move.flags.includes('k') || move.flags.includes('q'))) return 'Bounty contract: no castling.'
  } else if (fx.stuck.some((s) => s.square === move.from)) {
    return `The piece on ${move.from.toUpperCase()} is stuck in glue.`
  }
  if (fx.weather.id === 'snow') {
    const through = path.slice(0, -1).find((sq) => fx.weather.snow.includes(sq))
    if (through) return `Snow on ${through.toUpperCase()} blocks the way.`
  }
  if (fx.weather.id === 'wind' && blownBack(move, fx.weather.wind)) return 'The wind blows back long slides into it.'
  return null
}

/**
 * Legal moves `side` may play in `fen`. If the arena would forbid every legal
 * move, all of them are allowed — traps and weather never cause stalemate.
 */
export function allowedMoves(fx: BattleEffects, setup: BattleSetup, fen: string, side: 'human' | 'boss'): Move[] {
  const legal = legalMoves(fen)
  const ok = legal.filter((m) => blockReason(fx, setup, m, side) === null)
  return ok.length > 0 ? ok : legal
}

/** The reason to refuse a move, honouring the never-stalemate fallback. */
export function moveRefusal(fx: BattleEffects, setup: BattleSetup, fen: string, move: MoveShape, side: 'human' | 'boss'): string | null {
  const reason = blockReason(fx, setup, move, side)
  if (!reason) return null
  return allowedMoves(fx, setup, fen, side).some((m) => m.from === move.from && m.to === move.to) ? null : reason
}

/** UCI moves for the opponent's search, or null when nothing is restricted. */
export function bossSearchMoves(fx: BattleEffects, setup: BattleSetup, fen: string): string[] | null {
  const legal = legalMoves(fen)
  const allowed = allowedMoves(fx, setup, fen, 'boss')
  if (allowed.length === legal.length) return null
  return allowed.map((m) => `${m.from}${m.to}${m.promotion ?? ''}`)
}

// ── The reducer ──────────────────────────────────────────────────────────────

/** Weather advances every ply (both sides). */
function advanceWeather(next: BattleEffects, fen: string, rng: () => number, events: BattleEvent[]): void {
  next.plies += 1
  const w = next.weather
  if (w.id === 'snow' && next.plies % SNOW_EVERY === 0) {
    const snow = chooseSnowSquares(fen, rng)
    next.weather = { ...w, snow }
    events.push({ kind: 'weather', detail: `Fresh snow on ${snow.map((s) => s.toUpperCase()).join(' and ')}` })
  } else if (w.id === 'wind') {
    const wind = WIND_ORDER[Math.floor(next.plies / WIND_EVERY) % WIND_ORDER.length] ?? 'N'
    if (wind !== w.wind) {
      next.weather = { ...w, wind }
      events.push({ kind: 'weather', detail: `The wind turns ${wind}` })
    }
  }
}

/** Sacrifice Altar: +1 awakened leap and one spent tactic recharged. */
function applyAltar(next: BattleEffects, setup: BattleSetup, events: BattleEvent[]): void {
  next.altarUsed = true
  next.awakening += 1
  const has = (t: string) => setup.tactics.some((x) => x === t)
  let recharged: string | null = null
  if (next.katana === 'spent') {
    next.katana = 'ready'
    recharged = 'Katana Blade'
  } else if (next.secondWind === 'spent') {
    next.secondWind = 'ready'
    recharged = 'Second Wind'
  } else if (has('vanguard-charge') && next.vanguardCharges === 0) {
    next.vanguardCharges = 1
    recharged = 'Vanguard Charge'
  } else if (has('spell-ward') && next.wardCharges === 0) {
    next.wardCharges = 1
    recharged = 'Spell Ward'
  } else if (has('knights-boot') && next.bootCharges === 0) {
    next.bootCharges = 1
    recharged = 'Knight’s Boot'
  }
  events.push({ kind: 'trap', sprung: false, detail: `Altar: a knight awakens (one long leap)${recharged ? ` · ${recharged} recharged` : ''}` })
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
    // The altar costs no move: the turn stays yours and nothing else ticks.
    if (move.flags.includes('s')) {
      applyAltar(next, setup, events)
      return { effects: next, events, passBoss: false }
    }
    // Frost fades as you use up your moves; a capture frees a glued square.
    next.traps = next.traps.flatMap((t): Trap[] => (t.victim !== 'human' ? [t] : t.turnsLeft > 1 ? [{ ...t, turnsLeft: t.turnsLeft - 1 }] : []))
    next.stuck = next.stuck.filter((s) => s.square !== move.to)
    if (isSpecialMove(move)) {
      if (move.piece === 'n' && next.bootCharges > 0) {
        next.bootCharges -= 1
        events.push({ kind: 'tactic', tactic: 'knights-boot', detail: `Long leap ${move.from} → ${move.to}` })
      } else if (move.piece === 'n' && next.awakening > 0) {
        next.awakening -= 1
        events.push({ kind: 'trap', sprung: false, detail: `Awakened leap ${move.from} → ${move.to}` })
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
    advanceWeather(next, ctx.fen, ctx.rng, events)

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

  // Glue: pieces already stuck count down; a piece landing on glue is caught.
  next.stuck = next.stuck.flatMap((s) => (s.turnsLeft > 1 ? [{ ...s, turnsLeft: s.turnsLeft - 1 }] : []))
  const glue = next.traps.find((t) => t.kind === 'glue' && t.square === move.to)
  next.traps = next.traps.flatMap((t): Trap[] => {
    if (t === glue) return []
    if (t.victim !== 'boss') return [t]
    return t.turnsLeft > 1 ? [{ ...t, turnsLeft: t.turnsLeft - 1 }] : []
  })
  if (glue) {
    next.stuck = [...next.stuck, { square: move.to, turnsLeft: STUCK_TURNS }]
    events.push({ kind: 'trap', sprung: true, detail: `Caught in glue on ${move.to.toUpperCase()}: stuck for ${STUCK_TURNS} turns` })
  }

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
      const square = chooseFrozenSquare(ctx.fen, ctx.rng, next.traps.map((t) => t.square))
      if (square && cast(freeze)) {
        const turnsLeft = SPELLS[freeze].duration ?? 1
        next.traps = [...next.traps, { square, kind: 'frost', victim: 'human', turnsLeft }]
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
  advanceWeather(next, ctx.fen, ctx.rng, events)

  return { effects: next, events, passBoss: false }
}

// ── Potions, glue and the altar (player actions that cost no move) ───────────

export type ActionResult = { ok: true; effects: BattleEffects; events: BattleEvent[] } | { ok: false; reason: string }

/** Drinks a potion. Inventory bookkeeping is the caller's job. */
export function applyPotion(fx: BattleEffects, setup: BattleSetup, potion: PotionId): ActionResult {
  if (fx.potionsUsed >= MAX_POTIONS_PER_BATTLE) return { ok: false, reason: `At most ${MAX_POTIONS_PER_BATTLE} potions per battle.` }
  const next: BattleEffects = { ...fx, potionsUsed: fx.potionsUsed + 1 }
  const events: BattleEvent[] = []
  switch (potion) {
    case 'time-elixir':
      if (!setup.timed) return { ok: false, reason: 'The Time Elixir needs a running clock.' }
      events.push({ kind: 'clock', side: 'human', deltaMs: TIME_ELIXIR_MS, reason: 'Time Elixir' })
      events.push({ kind: 'potion', potion, detail: '+30 s on your clock' })
      break
    case 'purge-potion': {
      const curses = fx.traps.filter((t) => t.victim === 'human').length + (fx.warning ? 1 : 0)
      if (curses === 0) return { ok: false, reason: 'There is nothing to purge.' }
      next.traps = fx.traps.filter((t) => t.victim !== 'human')
      next.warning = null
      next.overclock = false
      events.push({ kind: 'potion', potion, detail: `${curses} curse${curses === 1 ? '' : 's'} lifted` })
      break
    }
    case 'ward-tonic':
      next.wardCharges = fx.wardCharges + 1
      events.push({ kind: 'potion', potion, detail: 'The next spell will be warded' })
      break
    case 'trap-kit':
      next.glueCharges = fx.glueCharges + 1
      events.push({ kind: 'potion', potion, detail: 'Tap an empty square to lay a glue trap' })
      break
    case 'awakening-draught':
      next.awakening = fx.awakening + 1
      events.push({ kind: 'potion', potion, detail: 'A knight may make one long leap' })
      break
  }
  return { ok: true, effects: next, events }
}

/** Lays a glue trap (needs a trap kit charge) on an empty, untrapped square. */
export function placeGlue(fx: BattleEffects, fen: string, square: Square): ActionResult {
  if (fx.glueCharges <= 0) return { ok: false, reason: 'You have no glue traps to lay.' }
  if (occupiedSquares(fen).has(square)) return { ok: false, reason: 'Glue must go on an empty square.' }
  if (fx.traps.some((t) => t.square === square)) return { ok: false, reason: 'That square is already trapped.' }
  return {
    ok: true,
    effects: { ...fx, glueCharges: fx.glueCharges - 1, traps: [...fx.traps, { square, kind: 'glue', victim: 'boss', turnsLeft: GLUE_LIFETIME }] },
    events: [{ kind: 'trap', sprung: false, detail: `Glue trap laid on ${square.toUpperCase()}` }],
  }
}

/** Whether the Sacrifice Altar can be used right now. */
export const altarOpen = (fx: BattleEffects): boolean => !fx.altarUsed && fx.bossMoves >= ALTAR_OPENS_AFTER

/** Pawns the player could sacrifice at the altar (never one shielding the king). */
export function altarCandidates(fx: BattleEffects, fen: string, humanColor: Color): Square[] {
  if (!altarOpen(fx) || isKingAttacked(fen, humanColor)) return []
  const out: Square[] = []
  try {
    for (const row of new Chess(fen).board()) for (const cell of row) if (cell && cell.type === 'p' && cell.color === humanColor && sacrificePawn(fen, cell.square, humanColor)) out.push(cell.square)
  } catch {
    return []
  }
  return out
}

// ── Special moves ────────────────────────────────────────────────────────────

/** Rule-bending moves the player can make right now (Knight's Boot, awakened knights, Vanguard Charge). */
export function humanSpecialMoves(effects: BattleEffects, setup: BattleSetup, fen: string, humanColor: Color): SpecialMove[] {
  const out: SpecialMove[] = []
  if (effects.bootCharges > 0 || effects.awakening > 0) out.push(...generateLeaps(fen, humanColor))
  if (effects.vanguardCharges > 0) out.push(...generateCharges(fen, humanColor))
  return out.filter((s) => blockReason(effects, setup, s.move, 'human') === null)
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

/** Rule-bending moves the opponent may consider (Berserker pawns, Shadow Step), within arena rules. */
export function bossSpecialMoves(effects: BattleEffects, setup: BattleSetup, fen: string, bossColor: Color): SpecialMove[] {
  const out: SpecialMove[] = []
  if (effects.berserker) out.push(...generateCharges(fen, bossColor))
  if (spellWith(setup, 'shadow-step') && !effects.shadowStepUsed && isThreatened(fen, bossColor)) out.push(...generateLeaps(fen, bossColor))
  return out.filter((s) => blockReason(effects, setup, s.move, 'boss') === null)
}

/** Bounty: was the contract honoured over the whole battle? (Pawnless / no-castling are enforced move by move.) */
export function restrictionHonoured(setup: BattleSetup, humanMoves: number): boolean {
  if (setup.restriction === 'swift-30') return humanMoves <= 30
  return true
}
