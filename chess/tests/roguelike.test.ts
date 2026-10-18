// Tests for the RPG & roguelike layer: Chronos variant moves, the spell
// engine, the tactic draft, the taunt analyzer, the Endless Gauntlet and the
// leaderboard client. Run with `npm run test:roguelike`.
import { Chess, type Move } from 'chess.js'
import cyber from '../src/data/campaign/rosters/cyber'
import discovery from '../src/data/campaign/rosters/discovery'
import mythic from '../src/data/campaign/rosters/mythic'
import chronicle from '../src/data/campaign/rosters/chronicle'
import { getLegend } from '../src/data/legends'
import { bossPersona, legendPersona } from '../src/data/personas'
import { BOSS_SPELLS, SPELLS, TACTICS, buildBattleSetup, dealDraft, spellsForBoss } from '../src/data/spells'
import { TAUNTS, fillTemplate } from '../src/data/taunts'
import { afterPly, bossSpecialMoves, chooseFrozenSquare, createEffects, humanSpecialMoves, isThreatened, type PlyContext } from '../src/engine/spellEngine'
import { analyzeTaunt } from '../src/engine/taunts'
import { generateCharges, generateLeaps, isKingAttacked, passTurn, pathSquares, repetitionCount, specialFromEvent, toVariantEvent } from '../src/engine/variant'
import { createGlobalLeaderboard } from '../src/services/leaderboard'
import { sanitizeGauntlet } from '../src/stores/gauntletStore'
import { createDefaultProfile, sanitizeProfile } from '../src/stores/profileStore'
import type { Boss } from '../src/types/campaign'
import type { BattleEffects, BattleSetup } from '../src/types/spells'
import type { TauntKind, TauntTone } from '../src/types/taunts'
import { chooseBoon, createGauntletRecord, dealBoons, pickBoss, recordRun, resolveBattle, resumeInterrupted, runCoins, startRun, targetElo, START_BANK_MS } from '../src/utils/gauntlet'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const fixedRng = (v: number) => () => v

// ── Variant moves ────────────────────────────────────────────────────────────
const charges = generateCharges(START, 'w')
check('14 diagonal charges from the start', charges.length === 14, String(charges.length))
const ef3 = charges.find((c) => c.from === 'e2' && c.to === 'f3')
check('e2~f3 produces the right position', ef3?.move.after === 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPP1PPP/RNBQKBNR b KQkq - 0 1', ef3?.move.after)
check('special SAN and synthetic Move', ef3?.san === 'e2~f3' && ef3.move.before === START && !ef3.move.isCapture() && ef3.move.flags.includes('x'))
check('charges only on your turn', generateCharges(START, 'b').length === 0)
const promo = generateCharges('7k/6P1/8/8/8/8/8/K7 w - - 0 1', 'w')
check('a charge onto the last rank promotes to a queen', promo.some((c) => c.to === 'f8' && c.promotion === 'q' && c.move.after.startsWith('5Q1k')) && promo.every((c) => c.to !== 'h8'), promo.map((c) => c.san).join(' '))
// Pinned pawn: e2 pawn pinned by a rook on e8 against Ke1 → may not step off the file.
const pinned = generateCharges('4r2k/8/8/8/8/8/4P3/4K3 w - - 0 1', 'w')
check('a charge may not expose your own king', pinned.length === 0, pinned.map((c) => c.san).join(' '))
const leaps = generateLeaps(START, 'w')
check('camel leaps from the start: a4 c4 f4 h4', leaps.map((l) => l.to).sort().join() === 'a4,c4,f4,h4', leaps.map((l) => l.san).join(' '))
const rookGrab = generateLeaps('4k2r/8/8/6N1/8/8/8/4K3 w k - 0 1', 'w').find((l) => l.to === 'h8')
check('a leap can capture a rook — and strips its castling right', rookGrab?.captured === 'r' && rookGrab.move.after.split(' ')[2] === '-', rookGrab?.move.after)
check('leaps never capture a king', generateLeaps('7k/8/8/6N1/8/8/8/4K3 w - - 0 1', 'w').every((l) => l.to !== 'h8'))
check('every leap leaves a valid position with the other side to move', leaps.every((l) => new Chess(l.move.after).turn() === 'b'))
const pass = passTurn(START)
check('pass flips the side to move', pass?.move.after === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 1 1' && pass.san === '--')
check('no pass while in check', passTurn('4k3/8/8/8/8/8/8/4K2r w - - 0 1') === null)
check('special SAN carries check marks', generateCharges('8/8/3k4/8/1P6/8/8/4K3 w - - 0 1', 'w').some((c) => c.to === 'c5' && c.san === 'b4~c5+'))
const ev = toVariantEvent(ef3 as NonNullable<typeof ef3>, 1)
check('variant event round-trips for review', specialFromEvent(ev)?.move.after === ef3?.move.after)
check('path squares: rook, knight, castling', pathSquares({ from: 'a1', to: 'a4', piece: 'r', flags: 'n' }).join() === 'a2,a3,a4' && pathSquares({ from: 'b1', to: 'c3', piece: 'n', flags: 'n' }).join() === 'c3' && pathSquares({ from: 'e1', to: 'g1', piece: 'k', flags: 'k' }).join() === 'f1,g1')
const reps = new Chess()
for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) reps.move(m)
check('threefold counted over the whole history', repetitionCount(reps.history({ verbose: true }), reps.fen()) === 3)

// ── Spell engine ─────────────────────────────────────────────────────────────
const setupFor = (spells: BattleSetup['spells'], tactics: BattleSetup['tactics'] = [], timed = true, relics: Parameters<typeof buildBattleSetup>[4] = []) => buildBattleSetup('campaign', spells, tactics, timed, relics)
const quietBlack = (fen: string): Move => {
  const c = new Chess(fen)
  return c.moves({ verbose: true }).find((m) => !m.captured && !m.san.includes('+')) as Move
}
const ctx = (setup: BattleSetup, mover: 'human' | 'boss', move: Move, extra: Partial<PlyContext> = {}): PlyContext => ({
  setup, mover, move, fen: move.after, humanColor: 'w', thinkMs: 1000, clocks: { w: 300_000, b: 300_000 }, rng: fixedRng(0.3), ...extra,
})
// Play a short game where the boss (Black) keeps making quiet moves.
function simulateBossMoves(setup: BattleSetup, count: number): { fx: BattleEffects; events: string[] } {
  const chess = new Chess()
  let fx = createEffects(setup)
  const events: string[] = []
  const whiteMoves = ['Nf3', 'Ng1', 'Nc3', 'Nb1', 'Nf3', 'Ng1', 'Nc3', 'Nb1', 'Nf3', 'Ng1', 'Nc3', 'Nb1']
  const blackMoves = ['Nf6', 'Ng8', 'Nc6', 'Nb8', 'Nf6', 'Ng8', 'Nc6', 'Nb8', 'Nf6', 'Ng8', 'Nc6', 'Nb8']
  for (let i = 0; i < count; i++) {
    const w = chess.move(whiteMoves[i] ?? 'Nf3')
    fx = afterPly(fx, ctx(setup, 'human', w)).effects
    const b = chess.move(blackMoves[i] ?? 'Nf6')
    const out = afterPly(fx, ctx(setup, 'boss', b))
    fx = out.effects
    events.push(...out.events.map((e) => `${i + 1}:${e.kind}`))
  }
  return { fx, events }
}
const frost = simulateBossMoves(setupFor(['frost-sigil']), 5)
check('freeze: warning on boss move 4, cast on move 5', frost.events.join() === '4:spell-warning,5:spell-cast' && frost.fx.frozen !== null, frost.events.join())
check('frozen square is empty and leaves you legal moves', (() => {
  const sq = frost.fx.frozen
  return sq !== null && new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').get(sq) === undefined
})())
const thaw = afterPly(frost.fx, ctx(setupFor(['frost-sigil']), 'human', new Chess().move('e4')))
check('freeze lasts only your next move', thaw.effects.frozen === null)
const warded = simulateBossMoves(setupFor(['frost-sigil'], ['spell-ward']), 5)
check('Spell Ward blocks the first spell', warded.events.includes('5:spell-blocked') && warded.fx.frozen === null && warded.fx.wardCharges === 0)
const warded2 = setupFor(['frost-sigil'], ['spell-ward'], true, ['shield-of-kings'])
check('Shield of Kings synergy: ward ×2', warded2.wardCharges === 2)
const over = simulateBossMoves(setupFor(['total-computation']), 4)
check('overclock primes on move 4 for move 5', over.fx.overclock && over.events.includes('4:spell-warning'))
check('overclock is consumed by the next boss move', !simulateBossMoves(setupFor(['total-computation']), 5).fx.overclock)
check('freeze candidates never leave zero moves', chooseFrozenSquare('k7/8/1K6/8/8/8/8/1Q6 w - - 0 1', fixedRng(0.99)) !== null)

const dilate = setupFor(['time-dilation'])
const slow = afterPly(createEffects(dilate), ctx(dilate, 'human', new Chess().move('e4'), { thinkMs: 20_000 }))
check('Time Dilation: slow move gives the boss +10 s', slow.events.some((e) => e.kind === 'clock' && e.side === 'boss' && e.deltaMs === 10_000))
check('Time Dilation is dormant untimed', afterPly(createEffects(setupFor(['time-dilation'], [], false)), ctx(setupFor(['time-dilation'], [], false), 'human', new Chess().move('e4'), { thinkMs: 20_000 })).events.length === 0)

const berserk = setupFor(['berserker-charge'])
const rookTake = new Chess('r3k3/8/8/8/8/8/8/R3K3 w - - 0 1').move('Rxa8+')
const angry = afterPly(createEffects(berserk), ctx(berserk, 'human', rookTake))
check('Berserker activates when he loses a rook', angry.effects.berserker && angry.events.some((e) => e.kind === 'spell-cast'))
check('Berserker pawns get charges', bossSpecialMoves(angry.effects, berserk, '4k3/8/4p3/8/8/8/8/4K3 b - - 0 1', 'b').length === 2)
const shadow = setupFor(['shadow-step'])
const inCheck = bossSpecialMoves(createEffects(shadow), shadow, '4k3/8/8/8/1n6/8/8/4R1K1 b - - 0 1', 'b')
check('Shadow Step: only when threatened, and only moves that answer the check', bossSpecialMoves(createEffects(shadow), shadow, '4k3/8/8/8/1n6/8/8/6K1 b - - 0 1', 'b').length === 0 && inCheck.map((l) => l.to).sort().join() === 'e3,e5', inCheck.map((l) => l.san).join(' '))
check('Shadow Step is once per battle', bossSpecialMoves({ ...createEffects(shadow), shadowStepUsed: true }, shadow, '4k3/8/8/8/1n6/8/8/4R1K1 b - - 0 1', 'b').length === 0)
check('threat detection (check or attacked queen)', isThreatened('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1', 'b') && isThreatened('4k3/8/8/3q4/8/8/8/3R2K1 b - - 0 1', 'b') && !isThreatened('4k3/8/8/8/8/8/8/6K1 b - - 0 1', 'b'))

const katanaSetup = setupFor([], ['katana-blade'])
const cap = new Chess('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1').move('exd5')
const kat = afterPly(createEffects(katanaSetup), ctx(katanaSetup, 'human', cap))
check('Katana: first capture makes the boss skip its turn', kat.passBoss && kat.effects.katana === 'spent')
const checkingCapture = new Chess('3rk3/8/8/8/8/8/8/3QK3 w - - 0 1').move('Qxd8+')
const kat2 = afterPly(createEffects(katanaSetup), ctx(katanaSetup, 'human', checkingCapture))
check('Katana waits while the boss is in check', !kat2.passBoss && kat2.effects.katana === 'pending')

const hg = setupFor([], ['chronos-hourglass'], true, ['hourglass-of-time'])
const checkMove = new Chess('4k3/8/8/8/8/8/r7/4K3 b - - 0 1').move('Ra1+')
const hgOut = afterPly(createEffects(hg), ctx(hg, 'boss', checkMove))
check('Chronos Hourglass: +30 s on check with the Hourglass relic', hgOut.events.some((e) => e.kind === 'clock' && e.side === 'human' && e.deltaMs === 30_000))
const sw = setupFor([], ['second-wind'])
const swOut = afterPly(createEffects(sw), ctx(sw, 'human', new Chess().move('e4'), { clocks: { w: 25_000, b: 300_000 } }))
check('Second Wind: +60 s under 30 s, once', swOut.events.some((e) => e.kind === 'clock' && e.deltaMs === 60_000) && swOut.effects.secondWind === 'spent')

const bootSetup = setupFor([], ['knights-boot'], true, ['smoke-veil'])
check('Knight’s Boot ×2 with the Smoke Veil relic', bootSetup.bootCharges === 2)
let bootFx = createEffects(bootSetup)
const bootLeap = humanSpecialMoves(bootFx, START, 'w').find((s) => s.to === 'c4')
check('Knight’s Boot offers leaps', bootLeap !== undefined)
bootFx = afterPly(bootFx, ctx(bootSetup, 'human', (bootLeap as NonNullable<typeof bootLeap>).move)).effects
check('a leap spends one charge', bootFx.bootCharges === 1)
check('frozen squares block special moves too', humanSpecialMoves({ ...createEffects(bootSetup), frozen: 'c4' }, START, 'w').every((s) => s.to !== 'c4'))
check('untimed battles drop clock tactics', setupFor([], ['chronos-hourglass', 'katana-blade'], false).tactics.join() === 'katana-blade')

// ── Draft ────────────────────────────────────────────────────────────────────
const d1 = dealDraft(42, [], true)
check('draft: 3 distinct cards, 1 pick, reproducible', d1.cards.length === 3 && new Set(d1.cards).size === 3 && d1.picks === 1 && dealDraft(42, [], true).cards.join() === d1.cards.join())
check('Starforged Crown: 4 cards, 2 picks', dealDraft(42, ['starforged-crown'], true).cards.length === 4 && dealDraft(42, ['starforged-crown'], true).picks === 2)
check('untimed drafts never offer clock tactics', Array.from({ length: 30 }, (_, i) => dealDraft(i, [], false)).every((d) => d.cards.every((c) => !TACTICS[c].needsClock)))

// ── Spells on characters ─────────────────────────────────────────────────────
const malakorBoss = mythic.find((b) => b.legendRef === 'malakor') as Boss
check('Malakor (cameo) casts Frost Sigil', spellsForBoss(malakorBoss).join() === 'frost-sigil' && bossPersona(malakorBoss).spells.join() === 'frost-sigil')
check('Ragnar and Einstein legends carry their spells', legendPersona(getLegend('ragnar'), 'authentic').spells.join() === 'berserker-charge' && legendPersona(getLegend('einstein'), 'authentic').spells.join() === 'time-dilation')
const elite = [...chronicle, ...mythic, ...discovery, ...cyber].filter((b) => b.rank !== 'regular')
check('every milestone & overlord in realms I–IV has a spell', elite.every((b) => spellsForBoss(b).length > 0), elite.filter((b) => spellsForBoss(b).length === 0).map((b) => b.name).join(', '))
check('spell table only names real bosses', Object.keys(BOSS_SPELLS).length === 9 && Object.values(BOSS_SPELLS).every((s) => s?.every((id) => id in SPELLS)))

// ── Taunts ───────────────────────────────────────────────────────────────────
const queenHang = new Chess('4k3/3r4/8/8/8/8/8/3QK3 w - - 0 1').move('Qd5')
check('hanging your queen → "reckless sacrifice"', analyzeTaunt({ mover: 'human', move: queenHang, fen: queenHang.after, humanColor: 'w', evalSwingCp: null, ply: 21 })?.kind === 'queen-sacrifice')
const queenTaken = new Chess('4k3/3r4/8/3Q4/8/8/8/4K3 b - - 0 1').move('Rxd5')
check('losing your queen → boss gloats', analyzeTaunt({ mover: 'boss', move: queenTaken, fen: queenTaken.after, humanColor: 'w', evalSwingCp: null, ply: 22 })?.kind === 'queen-won')
const wonQueen = new Chess('3qk3/8/8/8/8/8/8/3RK3 w - - 0 1').move('Rxd8+')
check('taking the boss queen → anger', analyzeTaunt({ mover: 'human', move: wonQueen, fen: wonQueen.after, humanColor: 'w', evalSwingCp: null, ply: 30 })?.mood === 'angry')
const quiet = new Chess().move('e4')
check('eval swing → blunder / brilliance', analyzeTaunt({ mover: 'human', move: quiet, fen: quiet.after, humanColor: 'w', evalSwingCp: 300, ply: 1 })?.kind === 'blunder' && analyzeTaunt({ mover: 'human', move: quiet, fen: quiet.after, humanColor: 'w', evalSwingCp: -300, ply: 1 })?.kind === 'brilliance')
const check1 = new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').move('Ra8+')
check('putting the boss in check → tension', analyzeTaunt({ mover: 'human', move: check1, fen: check1.after, humanColor: 'w', evalSwingCp: null, ply: 40 })?.kind === 'in-check')
check('nothing notable → no taunt', analyzeTaunt({ mover: 'human', move: quiet, fen: quiet.after, humanColor: 'w', evalSwingCp: 10, ply: 1 }) === null)
const kinds: TauntKind[] = ['queen-sacrifice', 'queen-won', 'queen-lost', 'blunder', 'brilliance', 'big-capture', 'lost-major', 'player-promotes', 'boss-promotes', 'check-given', 'in-check', 'king-walk', 'early-castle', 'long-think', 'time-trouble', 'spell-cast', 'spell-blocked', 'tactic-used']
check('every tone voices every taunt', (['fierce', 'cold', 'sly'] as TauntTone[]).every((t) => kinds.every((k) => TAUNTS[t][k].length >= 2)))
check('templates fill board details', fillTemplate('Your queen on {square}? {spell}!', { square: 'd5', spell: 'Frost' }) === 'Your queen on d5? Frost!')

// ── Gauntlet ─────────────────────────────────────────────────────────────────
const now = new Date('2026-10-18T10:00:00Z')
let run = startRun(now, 7)
const pool = [...chronicle, ...mythic]
const b1 = pickBoss(pool, run)
check('round 1 boss is ~800 Elo', b1 !== null && Math.abs(b1.elo - targetElo(1)) <= 75, `${b1?.name} ${b1?.elo}`)
check('boss pick is reproducible', pickBoss(pool, run)?.id === b1?.id)
run = { ...run, phase: 'battle', bossId: (b1 as Boss).id, battleStartBankMs: run.bankMs }
const won = resolveBattle(run, b1 as Boss, 'win', START_BANK_MS - 100_000)
check('a win restores 35% of time used + 15 s', won.restoredMs === 50_000 && won.run.bankMs === START_BANK_MS - 50_000 && won.run.phase === 'boon', String(won.restoredMs))
check('score grows with boss rating', won.scoreGained >= (b1 as Boss).elo)
check('three distinct boons, reproducible', won.run.offeredBoons.length === 3 && new Set(won.run.offeredBoons).size === 3 && dealBoons(7, 1).join() === won.run.offeredBoons.join())
const tempo = chooseBoon({ ...won.run, offeredBoons: ['tempo', 'emp', 'shield'] }, 'tempo')
check('Tempo boon: +1 s increment for the run', tempo.boons.incrementMs === 1000 && tempo.phase === 'ready')
const cache = chooseBoon({ ...won.run, offeredBoons: ['time-cache', 'emp', 'shield'] }, 'time-cache')
check('Time Cache: +60 s now', cache.bankMs === won.run.bankMs + 60_000)
const offered = { ...won.run, offeredBoons: ['emp', 'shield', 'tactic'] as typeof won.run.offeredBoons }
check('boons not offered are refused', chooseBoon(offered, 'tempo') === offered)
const second = pickBoss(pool, { ...tempo })
check('round 2 avoids bosses already faced', second !== null && second.id !== (b1 as Boss).id)
const lost = resolveBattle({ ...tempo, phase: 'battle', bossId: (second as Boss).id, battleStartBankMs: tempo.bankMs }, second as Boss, 'loss', 0)
check('a loss ends the run', lost.ended && lost.run.phase === 'over')
const drawn = resolveBattle({ ...tempo, phase: 'battle', bossId: (second as Boss).id, battleStartBankMs: tempo.bankMs }, second as Boss, 'draw', 120_000)
check('a draw keeps the run alive without a restore', !drawn.ended && drawn.run.bankMs === 120_000 && drawn.run.streak === 0)
check('interrupted battles resume with a 60 s penalty', resumeInterrupted({ ...tempo, phase: 'interrupted', battleStartBankMs: 200_000 }).bankMs === 140_000)
const rec = recordRun(createGauntletRecord(), { ...lost.run, score: 5000 }, 'Ada', now)
check('runs are booked into the local leaderboard', rec.leaderboard.length === 1 && rec.bestScore === 5000 && rec.runs === 1)
check('run coins are capped', runCoins(100_000) === 300 && runCoins(500) === 10)
const persisted = sanitizeGauntlet(JSON.parse(JSON.stringify({ version: 1, run: { ...run, phase: 'battle' }, record: rec })))
check('a battle in progress becomes "interrupted" after reload', persisted.run?.phase === 'interrupted' && persisted.record.bestScore === 5000)
check('corrupt gauntlet data is sanitised', sanitizeGauntlet({ run: { id: 3 }, record: 'x' }).run === null && sanitizeGauntlet(null).record.runs === 0)

// ── Global leaderboard client ────────────────────────────────────────────────
const requests: Array<{ url: string; init: RequestInit | undefined }> = []
let failNext = 1
const fakeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  requests.push({ url, init })
  if (failNext > 0) {
    failNext -= 1
    return new Response('oops', { status: 503 })
  }
  if (init?.method === 'POST') return new Response('{}', { status: 201 })
  return new Response(JSON.stringify([{ id: 'a', name: 'Ada', score: 900, defeated: 3 }, { id: 'b', name: 'Bob<script>', score: 1200.6, defeated: 5 }, { junk: true }]), { status: 200 })
}
const board = createGlobalLeaderboard('https://lb.example/api/gauntlet', fakeFetch, [0])
const top = await board.top(10)
check('global board: retries, validates and sorts', top.length === 2 && top[0]?.score === 1201 && top[0].name === 'Bob<script>' && requests.length === 2 && requests[1]?.url.endsWith('?limit=10'))
await board.submit({ id: 'r1', name: 'Ada', score: 10, defeated: 1, bestStreak: 1, date: now.toISOString() })
check('global board: submits JSON via POST', requests[2]?.init?.method === 'POST' && String(requests[2]?.init?.body).includes('"score":10'))
failNext = 5
const failed = await board.top(10).then(() => false, () => true)
check('global board: gives up after retries', failed)

// ── Variant matches survive storage ──────────────────────────────────────────
const profile = createDefaultProfile()
const withVariant = { ...profile, matches: [{ id: 'm', date: now.toISOString(), mode: 'ai', opponent: 'Ragnar', difficulty: 'advanced', personality: null, humanColor: 'w', result: { kind: 'resign', winner: 'b' }, outcome: 'loss', pgn: '1. e4 e5', plies: 2, timeControl: '-', rated: false, eloBefore: null, eloAfter: null, coins: 0, accuracy: null, opening: null, legendId: 'ragnar', bossId: null, variant: [ev, { bogus: 1 }] }] }
const restored = sanitizeProfile(JSON.parse(JSON.stringify(withVariant)))
check('variant plies are stored with matches (junk dropped)', restored.matches[0]?.variant?.length === 1 && restored.matches[0].variant[0]?.san === 'e2~f3')
check('own-king safety helper', isKingAttacked('4k3/8/8/8/8/8/8/4K2r w - - 0 1', 'w') && !isKingAttacked(START, 'w'))

process.exit(failures ? 1 : 0)
