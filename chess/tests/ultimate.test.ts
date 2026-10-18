// Tests for the Ultimate Edition (6.0) layer: arena traps, weather, bounty
// rules, the Sacrifice Altar, potions, Ironman permadeath, world-map events,
// parleys, daily tournaments, the notebook, chronicle, titles, trophies and
// the v2 → v3 profile migration. Run with `npm run test:ultimate`.
import { Chess, type Move } from 'chess.js'
import { MAX_POTIONS_PER_BATTLE, POTIONS, POTION_IDS } from '../src/data/arena'
import chronicle from '../src/data/campaign/rosters/chronicle'
import { ALL_PARLEYS, parleyFor } from '../src/data/parley'
import { buildBattleSetup } from '../src/data/spells'
import { NOBLE_RANKS, displayTitle, earnedTitles, nobleRank } from '../src/data/titles'
import { TROPHIES, earnedTrophyIds } from '../src/data/trophies'
import {
  GLUE_LIFETIME,
  STUCK_TURNS,
  TIME_ELIXIR_MS,
  afterPly,
  allowedMoves,
  altarCandidates,
  applyPotion,
  blockReason,
  blownBack,
  bossSearchMoves,
  bossSpecialMoves,
  createEffects,
  frostSquares,
  glueSquares,
  humanSpecialMoves,
  moveRefusal,
  placeGlue,
  restrictionHonoured,
  type PlyContext,
} from '../src/engine/spellEngine'
import { isSpecialMove, sacrificePawn, specialKindOf } from '../src/engine/variant'
import { PROFILE_VERSION, V3_STARTER_POTIONS, migrateProfile } from '../src/stores/migrations'
import { createDefaultProfile, loadProfile, sanitizeProfile } from '../src/stores/profileStore'
import type { GameAnalysis, MoveAnalysis, PositionEval } from '../src/types/analysis'
import type { MatchRecord, PlayerProfile } from '../src/types/profile'
import type { BattleEffects, BattleSetup } from '../src/types/spells'
import { IRONMAN_COIN_FACTOR, abandonIronman, applyIronmanResult, startIronman } from '../src/utils/ironman'
import { applyBossResult, clearedCount } from '../src/utils/campaign'
import { buildChronicle } from '../src/utils/chronicle'
import { addPotion, buyPotion, consumePotion, potionCount } from '../src/utils/inventory'
import { buildNotebook, summarizeAnalysis } from '../src/utils/notebook'
import { YOU, createTournament, currentMatch, ensureTournament, recordTournamentResult } from '../src/utils/tournament'
import { acceptBlessing, ambushWeather, buyWare, consumeBlessings, dealWorld, isEventReachable, refreshWorld, resolveAmbush, resolveBounty } from '../src/utils/world'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const rng = (v: number) => () => v
const setup = (extra: Parameters<typeof buildBattleSetup>[5] = {}, tactics: BattleSetup['tactics'] = [], timed = true): BattleSetup =>
  buildBattleSetup('campaign', [], tactics, timed, [], extra)
const ctx = (s: BattleSetup, mover: 'human' | 'boss', move: Move, extra: Partial<PlyContext> = {}): PlyContext => ({
  setup: s, mover, move, fen: move.after, humanColor: 'w', thinkMs: 1000, clocks: { w: 300_000, b: 300_000 }, rng: rng(0.3), ...extra,
})
const legal = (fen: string, from: string, to: string): Move => {
  const m = new Chess(fen).moves({ verbose: true }).find((x) => x.from === from && x.to === to)
  if (!m) throw new Error(`no move ${from}${to} in ${fen}`)
  return m
}
const withFx = (s: BattleSetup, patch: Partial<BattleEffects>): BattleEffects => ({ ...createEffects(s), ...patch })

// ── Tile traps ───────────────────────────────────────────────────────────────
const plain = setup()
const frosty = withFx(plain, { traps: [{ square: 'e4', kind: 'frost', victim: 'human', turnsLeft: 2 }] })
check('frost trap: landing is refused', blockReason(frosty, plain, legal(START, 'e2', 'e4'), 'human') !== null)
check('frost trap: sliding through is refused', blockReason(withFx(plain, { traps: [{ square: 'd2', kind: 'frost', victim: 'human', turnsLeft: 1 }] }), plain, legal('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', 'd1', 'd5'), 'human') !== null)
check('frost trap: other moves are fine', blockReason(frosty, plain, legal(START, 'd2', 'd4'), 'human') === null)
check('frost binds only the player', blockReason(frosty, plain, legal('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1', 'e7', 'e5'), 'boss') === null)
const thawing = afterPly(frosty, ctx(plain, 'human', legal(START, 'd2', 'd4'))).effects
check('frost duration counts down per player move', thawing.traps[0]?.turnsLeft === 1)
check('frost fades after its last move', frostSquares(afterPly(thawing, ctx(plain, 'human', legal(START, 'g1', 'f3'))).effects).length === 0)
const cornered = '1r5k/8/8/8/8/8/8/K7 w - - 0 1' // Ka2 is White's only legal move
const sealA2 = withFx(plain, { traps: [{ square: 'a2', kind: 'frost', victim: 'human', turnsLeft: 1 }] })
check('frost never stalemates: fallback to all legal moves', allowedMoves(sealA2, plain, cornered, 'human').map((m) => m.to).join() === 'a2')
check('refusal honours the fallback', blockReason(sealA2, plain, legal(cornered, 'a1', 'a2'), 'human') !== null && moveRefusal(sealA2, plain, cornered, legal(cornered, 'a1', 'a2'), 'human') === null)

// Glue
const kit = withFx(plain, { glueCharges: 1 })
const laid = placeGlue(kit, START, 'e5')
check('glue: laid on an empty square, spends the charge', laid.ok && laid.effects.glueCharges === 0 && glueSquares(laid.effects).join() === 'e5')
check('glue: refused on an occupied square', !placeGlue(kit, START, 'e2').ok)
check('glue: refused without a kit', !placeGlue(withFx(plain, {}), START, 'e5').ok)
check('glue: refused on a trapped square', laid.ok && !placeGlue({ ...laid.effects, glueCharges: 1 }, START, 'e5').ok)
const afterE4 = new Chess(START)
afterE4.move('e4')
const blackE5 = legal(afterE4.fen(), 'e7', 'e5')
const caught = laid.ok ? afterPly(laid.effects, ctx(plain, 'boss', blackE5)) : null
check('glue catches the boss piece that lands on it', caught !== null && caught.effects.stuck.some((s) => s.square === 'e5' && s.turnsLeft === STUCK_TURNS) && glueSquares(caught.effects).length === 0 && caught.events.some((e) => e.kind === 'trap' && e.sprung))
const stuckFx: BattleEffects = withFx(plain, { stuck: [{ square: 'e5', turnsLeft: 2 }] })
const stuckFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
check('a stuck piece cannot move', blockReason(stuckFx, plain, { from: 'e5', to: 'e4', piece: 'p', flags: 'n' }, 'boss') !== null && blockReason(stuckFx, plain, legal(stuckFen, 'd7', 'd5'), 'boss') === null)
const searchMoves = bossSearchMoves(withFx(plain, { stuck: [{ square: 'g8', turnsLeft: 2 }] }), plain, 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
check('boss search is restricted to allowed UCI moves', searchMoves !== null && searchMoves.length === 18 && !searchMoves.some((m) => m.startsWith('g8')), String(searchMoves?.length))
check('no restriction → no searchmoves', bossSearchMoves(createEffects(plain), plain, START) === null)
const s1 = afterPly(stuckFx, ctx(plain, 'boss', legal(stuckFen, 'd7', 'd6'))).effects
check('stuck counts down over the boss’s turns', s1.stuck[0]?.turnsLeft === 1 && afterPly(s1, ctx(plain, 'boss', legal(stuckFen, 'd7', 'd6'))).effects.stuck.length === 0)
const fading = withFx(plain, { traps: [{ square: 'a5', kind: 'glue', victim: 'boss', turnsLeft: 1 }] })
check(`unsprung glue fades after ${GLUE_LIFETIME} boss moves`, glueSquares(afterPly(fading, ctx(plain, 'boss', legal(stuckFen, 'd7', 'd6'))).effects).length === 0)
check('capturing a stuck piece clears it', afterPly(withFx(plain, { stuck: [{ square: 'e5', turnsLeft: 2 }] }), ctx(plain, 'human', legal('4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1', 'd4', 'e5'))).effects.stuck.length === 0)
check('stuck pieces cannot cast leaps either', bossSpecialMoves(withFx(setup(), { stuck: [{ square: 'b4', turnsLeft: 1 }] }), buildBattleSetup('campaign', ['shadow-step'], [], true, []), '4k3/8/8/8/1n6/8/8/4R1K1 b - - 0 1', 'b').length === 0)

// ── Weather ──────────────────────────────────────────────────────────────────
const snowy = setup({ weather: 'snow' })
const snowFx: BattleEffects = { ...createEffects(snowy), weather: { id: 'snow', snow: ['d3'], wind: 'N' } }
const rookFen = '4k3/8/8/8/8/8/8/3RK3 w - - 0 1'
check('snow blocks sliding through', blockReason(snowFx, snowy, legal(rookFen, 'd1', 'd5'), 'human') !== null)
check('snow allows landing', blockReason(snowFx, snowy, legal(rookFen, 'd1', 'd3'), 'human') === null)
check('snow binds both sides', blockReason(snowFx, snowy, legal('3rk3/8/8/8/8/8/8/4K3 b - - 0 1', 'd8', 'd1'), 'boss') !== null)
check('knights jump over snow', blockReason({ ...snowFx, weather: { id: 'snow', snow: ['c3', 'b2'], wind: 'N' } }, snowy, legal(START, 'b1', 'c3'), 'human') === null)
let fx = createEffects(snowy)
const snowEvents: string[] = []
const game = new Chess()
for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) {
  const m = game.move(san)
  const out = afterPly(fx, ctx(snowy, m.color === 'w' ? 'human' : 'boss', m))
  fx = out.effects
  snowEvents.push(...out.events.filter((e) => e.kind === 'weather').map((e) => e.kind))
}
check('fresh snow every 4 plies (2 empty squares on ranks 3–6)', fx.plies === 4 && fx.weather.snow.length === 2 && fx.weather.snow.every((s) => Number(s[1]) >= 3 && Number(s[1]) <= 6) && snowEvents.length === 1)
check('wind: long slides into the wind are blown back', blownBack({ from: 'd1', to: 'd5', piece: 'r', flags: 'n' }, 'S') && !blownBack({ from: 'd1', to: 'd5', piece: 'r', flags: 'n' }, 'N') && !blownBack({ from: 'd1', to: 'd3', piece: 'r', flags: 'n' }, 'S'))
check('wind: knights and diagonals are immune', !blownBack({ from: 'b1', to: 'c3', piece: 'n', flags: 'n' }, 'S') && !blownBack({ from: 'a1', to: 'e5', piece: 'b', flags: 'n' }, 'S'))
const windy = setup({ weather: 'wind' })
let wfx = createEffects(windy)
const wg = new Chess()
const turns: string[] = []
for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6']) {
  const m = wg.move(san)
  const out = afterPly(wfx, ctx(windy, m.color === 'w' ? 'human' : 'boss', m))
  wfx = out.effects
  turns.push(...out.events.filter((e) => e.kind === 'weather').map((e) => (e.kind === 'weather' ? e.detail : '')))
}
check('the wind turns every 6 plies', wfx.weather.wind === 'E' && turns.length === 1, turns.join())
check('fog has no move rules', blockReason(createEffects(setup({ weather: 'fog' })), setup({ weather: 'fog' }), legal(rookFen, 'd1', 'd8'), 'human') === null)

// ── Bounty restrictions ──────────────────────────────────────────────────────
const pawnless = setup({ restriction: 'pawnless' })
check('pawnless contract blocks pawn moves', blockReason(createEffects(pawnless), pawnless, legal(START, 'e2', 'e4'), 'human') !== null && blockReason(createEffects(pawnless), pawnless, legal(START, 'g1', 'f3'), 'human') === null)
const pawnOnly = 'k7/8/8/8/8/8/P4q2/7K w - - 0 1' // king boxed in: only pawn moves remain
check('pawnless: forced pawn moves are still allowed', new Chess(pawnOnly).moves({ verbose: true }).every((m) => m.piece === 'p') && moveRefusal(createEffects(pawnless), pawnless, pawnOnly, new Chess(pawnOnly).moves({ verbose: true })[0] as Move, 'human') === null)
const noCastle = setup({ restriction: 'no-castling' })
check('no-castling contract blocks O-O', blockReason(createEffects(noCastle), noCastle, legal('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'e1', 'g1'), 'human') !== null)
check('pawnless contract blocks pawn charges', humanSpecialMoves(withFx(pawnless, { vanguardCharges: 1 }), pawnless, START, 'w').length === 0)
check('swift-30 checked at the end', restrictionHonoured(setup({ restriction: 'swift-30' }), 30) && !restrictionHonoured(setup({ restriction: 'swift-30' }), 31) && restrictionHonoured(pawnless, 99))
check('arena options flow into the setup', (() => {
  const s = buildBattleSetup('bounty', [], ['spell-ward', 'spell-ward'], true, [], { restriction: 'clock-60', weather: 'wind', bossBoost: 1, rewardFactor: 1.5, ironman: true })
  return s.restriction === 'clock-60' && s.weather === 'wind' && s.bossBoost === 1 && s.rewardFactor === 1.5 && s.ironman && s.tactics.length === 1
})())

// ── Sacrifice Altar ──────────────────────────────────────────────────────────
const sac = sacrificePawn(START, 'h2', 'w')
check('sacrifice removes the pawn and keeps your turn', sac !== null && sac.move.after.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPP1/RNBQKBNR w') && sac.move.flags === 's' && sac.san === 'Xh2')
check('sacrifice is a special ply of its own kind', sac !== null && isSpecialMove(sac.move) && specialKindOf(sac.move) === 'sacrifice')
check('a pawn shielding the king cannot be sacrificed', sacrificePawn('4k3/4r3/8/8/8/8/4P3/4K3 w - - 0 1', 'e2', 'w') === null)
check('only your own pawns, on your turn', sacrificePawn(START, 'e7', 'w') === null && sacrificePawn(START, 'g1', 'w') === null && sacrificePawn(START, 'h2', 'b') === null)
const altarSetup = setup({}, ['katana-blade'])
const openAltar = withFx(altarSetup, { bossMoves: 3, katana: 'spent' })
check('altar opens after the boss’s third move', altarCandidates(withFx(altarSetup, { bossMoves: 2 }), START, 'w').length === 0 && altarCandidates(openAltar, START, 'w').length === 8)
const sacOut = sac ? afterPly(openAltar, ctx(altarSetup, 'human', sac.move)) : null
check('altar: +1 awakened leap, a spent tactic recharged, once', sacOut !== null && sacOut.effects.awakening === 1 && sacOut.effects.katana === 'ready' && sacOut.effects.altarUsed && altarCandidates(sacOut.effects, START, 'w').length === 0)
check('altar costs no clock tick / weather ply', sacOut !== null && sacOut.effects.plies === openAltar.plies && !sacOut.passBoss)
check('awakened knights may leap', humanSpecialMoves(withFx(plain, { awakening: 1 }), plain, START, 'w').length === 4)
const leap = humanSpecialMoves(withFx(plain, { awakening: 1 }), plain, START, 'w')[0]
check('an awakened leap spends the awakening', leap !== undefined && afterPly(withFx(plain, { awakening: 1 }), ctx(plain, 'human', leap.move)).effects.awakening === 0)

// ── Potions ──────────────────────────────────────────────────────────────────
const timed = setup()
const elixir = applyPotion(createEffects(timed), timed, 'time-elixir')
check('Time Elixir: +30 s on your clock', elixir.ok && elixir.events.some((e) => e.kind === 'clock' && e.side === 'human' && e.deltaMs === TIME_ELIXIR_MS) && elixir.effects.potionsUsed === 1)
check('Time Elixir needs a clock', !applyPotion(createEffects(setup({}, [], false)), setup({}, [], false), 'time-elixir').ok)
const cursed = withFx(timed, { traps: [{ square: 'e4', kind: 'frost', victim: 'human', turnsLeft: 2 }, { square: 'a5', kind: 'glue', victim: 'boss', turnsLeft: 3 }], warning: { spell: 'frost-sigil', inBossMoves: 1 }, overclock: true })
const purged = applyPotion(cursed, timed, 'purge-potion')
check('Purge Potion lifts curses and frost, keeps your glue', purged.ok && frostSquares(purged.effects).length === 0 && glueSquares(purged.effects).join() === 'a5' && purged.effects.warning === null && !purged.effects.overclock)
check('Purge Potion refuses when there is nothing to purge', !applyPotion(createEffects(timed), timed, 'purge-potion').ok)
const ward = applyPotion(createEffects(timed), timed, 'ward-tonic')
check('Ward Tonic +1 ward, Trap Kit +1 glue, Draught +1 leap', ward.ok && ward.effects.wardCharges === 1 && (() => {
  const t = applyPotion(createEffects(timed), timed, 'trap-kit')
  const a = applyPotion(createEffects(timed), timed, 'awakening-draught')
  return t.ok && t.effects.glueCharges === 1 && a.ok && a.effects.awakening === 1
})())
check(`at most ${MAX_POTIONS_PER_BATTLE} potions per battle`, !applyPotion(withFx(timed, { potionsUsed: MAX_POTIONS_PER_BATTLE }), timed, 'ward-tonic').ok)
let inv: PlayerProfile = { ...createDefaultProfile(), coins: 500, inventory: { potions: {} } }
const bought = buyPotion(inv, 'time-elixir')
check('shop: buying a potion costs its price', bought !== null && bought.coins === 500 - POTIONS['time-elixir'].price && potionCount(bought, 'time-elixir') === 1)
inv = addPotion(inv, 'purge-potion', 2)
const drunk = consumePotion(inv, 'purge-potion')
check('drinking reduces the stack and counts the feat', drunk !== null && potionCount(drunk.profile, 'purge-potion') === 1 && drunk.profile.feats.potionsDrunk === 1)
check('cannot drink what you do not have', consumePotion(inv, 'ward-tonic') === null)
check('the Alchemist after ten potions', (() => {
  const p = consumePotion(addPotion({ ...inv, feats: { ...inv.feats, potionsDrunk: 9 } }, 'ward-tonic', 1), 'ward-tonic')
  return p !== null && p.unlocked.some((a) => a.id === 'alchemist')
})())

// ── Ironman (permadeath) ─────────────────────────────────────────────────────
const regular: PlayerProfile = (() => {
  let p = createDefaultProfile()
  for (const boss of chronicle.slice(0, 3)) p = applyBossResult(p, boss, { outcome: 'win', humanMoves: 30, clean: true, relics: [] }).profile
  return p
})()
const iron = startIronman(regular)
check('Ironman starts a fresh campaign and stashes the regular one', iron.ironman.enabled && clearedCount(iron.campaign) === 0 && iron.ironman.savedCampaign !== null && clearedCount(iron.ironman.savedCampaign) === 3)
const ironWin = applyBossResult(iron, chronicle[0] as (typeof chronicle)[number], { outcome: 'win', humanMoves: 30, clean: true, relics: [], rewardFactor: IRONMAN_COIN_FACTOR })
const normalWin = applyBossResult(createDefaultProfile(), chronicle[0] as (typeof chronicle)[number], { outcome: 'win', humanMoves: 30, clean: true, relics: [] })
check('Ironman victories pay 3× coins', ironWin.coins === normalWin.coins * 3, `${ironWin.coins} vs ${normalWin.coins}`)
const survived = applyIronmanResult(ironWin.profile, 'win', null)
check('a win keeps the run alive', !survived.wiped && clearedCount(survived.profile.campaign) === 1)
const wiped = applyIronmanResult(survived.profile, 'loss', null)
check('permadeath: a defeat wipes the run', wiped.wiped && wiped.lostBosses === 1 && clearedCount(wiped.profile.campaign) === 0 && wiped.profile.ironman.wipes === 1 && wiped.profile.ironman.bestCleared === 1 && wiped.profile.ironman.enabled)
check('the regular campaign survives a wipe', clearedCount(wiped.profile.ironman.savedCampaign ?? { bosses: {}, relics: [], equipped: [], realmsCleared: [] }) === 3)
check('a draw does not wipe', !applyIronmanResult(survived.profile, 'draw', null).wiped)
const restored = abandonIronman(wiped.profile)
check('ending Ironman restores the regular campaign', !restored.ironman.enabled && clearedCount(restored.campaign) === 3 && restored.ironman.savedCampaign === null && restored.ironman.wipes === 1)
const ironRealm = applyIronmanResult(survived.profile, 'win', 'chronicle')
check('Iron Will on an Ironman realm clear', ironRealm.unlocked.some((a) => a.id === 'iron-will') && ironRealm.profile.ironman.realmsConquered.join() === 'chronicle')
check('Iron Crown after all five realms', applyIronmanResult({ ...survived.profile, ironman: { ...survived.profile.ironman, realmsConquered: ['chronicle', 'mythic', 'discovery', 'cyber'] } }, 'win', 'cosmic').unlocked.some((a) => a.id === 'iron-crown'))
check('Ironman is a no-op outside a run', applyIronmanResult(regular, 'loss', null).profile === regular)
check('Ironman survives sanitising', sanitizeProfile(JSON.parse(JSON.stringify(wiped.profile))).ironman.savedCampaign !== null)

// ── World events & bounties ─────────────────────────────────────────────────
const fresh = createDefaultProfile()
const dealt = dealWorld(fresh.campaign, '2026-10-18')
check('only unlocked realms get events (3 events + 2 bounties)', dealt.events.length === 3 && dealt.bounties.length === 2 && dealt.events.every((e) => e.realm === 'chronicle'))
check('the deal is deterministic per day', JSON.stringify(dealWorld(fresh.campaign, '2026-10-18')) === JSON.stringify(dealt) && JSON.stringify(dealWorld(fresh.campaign, '2026-10-19')) !== JSON.stringify(dealt))
check('events sit beside reachable bosses', dealt.events.every((e) => isEventReachable(fresh.campaign, e)) && dealt.bounties.every((b) => b.bossIndex === 0))
const day = new Date(2026, 9, 18, 12)
let w = refreshWorld({ ...fresh, coins: 1000 }, day)
check('refresh deals once per day', w.world.cycle === '2026-10-18' && refreshWorld(w, day) === w)
const shrine = w.world.events.find((e) => e.kind === 'shrine')
const blessing = shrine?.blessings[0]
const blessed = shrine && blessing ? acceptBlessing(w, shrine.id, blessing) : null
check('shrine: a blessing is stored for the next battle', blessed !== null && blessed.ok && blessed.profile.world.blessings.join() === blessing && blessed.profile.world.resolved.includes(shrine?.id ?? ''))
check('shrine: once per day', blessed !== null && blessed.ok && shrine !== undefined && blessing !== undefined && !acceptBlessing(blessed.profile, shrine.id, blessing).ok)
if (blessed?.ok) {
  const used = consumeBlessings(blessed.profile)
  check('blessings are spent by the next battle', used.blessings.length === 1 && used.profile.world.blessings.length === 0)
  w = blessed.profile
}
const merchant = w.world.events.find((e) => e.kind === 'merchant')
const ware = merchant?.wares[0]
const purchase = merchant && ware ? buyWare(w, merchant.id, ware.potion) : null
check('merchant: buy a ware for its price', purchase !== null && purchase.ok && purchase.profile.coins === w.coins - (ware?.price ?? 0) && potionCount(purchase.profile, ware?.potion ?? 'time-elixir') === potionCount(w, ware?.potion ?? 'time-elixir') + 1)
check('merchant: each ware once a day', purchase !== null && purchase.ok && merchant !== undefined && ware !== undefined && !buyWare(purchase.profile, merchant.id, ware.potion).ok)
check('merchant: not without coins', merchant !== undefined && ware !== undefined && !buyWare({ ...w, coins: 0 }, merchant.id, ware.potion).ok)
const ambush = w.world.events.find((e) => e.kind === 'ambush')
const ambushWin = ambush ? resolveAmbush(w, ambush.id, true) : null
check('ambush victory pays coins + a potion', ambushWin !== null && ambush !== undefined && ambushWin.coins === ambush.reward.coins && ambushWin.potion !== null && ambushWin.profile.world.resolved.includes(ambush.id))
check('ambush is one-shot', ambushWin !== null && ambush !== undefined && resolveAmbush(ambushWin.profile, ambush.id, true).coins === 0)
check('ambushes bring weather', ambush !== undefined && ambushWeather(ambush.id) !== 'clear')
const bounty = w.world.bounties[0]
check('a failed bounty stays open', bounty !== undefined && resolveBounty(w, bounty.id, false).profile === w)
const paid = bounty ? resolveBounty(w, bounty.id, true) : null
check('a fulfilled bounty pays and counts', paid !== null && paid.coins === bounty?.reward.coins && paid.profile.feats.bountiesCompleted === 1 && paid.profile.world.completedBounties.length === 1)
check('Bounty Hunter after five contracts', bounty !== undefined && resolveBounty({ ...w, feats: { ...w.feats, bountiesCompleted: 4 } }, bounty.id, true).unlocked.some((a) => a.id === 'bounty-hunter'))
check('Pilgrim after ten events', ambush !== undefined && resolveAmbush({ ...w, feats: { ...w.feats, eventsResolved: 9 } }, ambush.id, false).unlocked.some((a) => a.id === 'pilgrim'))
check('world state survives sanitising', JSON.stringify(sanitizeProfile(JSON.parse(JSON.stringify(w))).world) === JSON.stringify(w.world))

// ── Parley ───────────────────────────────────────────────────────────────────
check('every parley offers boost / boon / weaken choices', ALL_PARLEYS.length === 9 && ALL_PARLEYS.every((p) => p.choices.length === 3 && p.choices.some((c) => c.bossBoost === 1 && c.rewardFactor > 1) && p.choices.some((c) => c.grant !== undefined) && p.choices.some((c) => c.bossBoost === -1 && c.rewardFactor < 1)))
check('parley is stable per attempt', parleyFor('cold', 'boss#1').id === parleyFor('cold', 'boss#1').id && parleyFor('sly', 'x').id.startsWith('sly'))

// ── Daily tournament ─────────────────────────────────────────────────────────
const t0 = createTournament(fresh, day)
check('tournament: 8 entrants incl. you, 4 quarter-finals', t0.entrants.length === 8 && t0.entrants.some((e) => e.id === YOU) && t0.rounds[0]?.length === 4 && new Set(t0.entrants.map((e) => e.id)).size === 8)
check('you have a pending match', currentMatch(t0)?.round === 0)
let tp: PlayerProfile = { ...fresh, tournament: t0 }
const qf = recordTournamentResult(tp, 'win', day)
check('a win advances and pays the round prize', qf !== null && qf.advanced && qf.coins === 40 && qf.tournament.rounds.length === 2 && qf.tournament.rounds[0]?.every((m) => m.winner !== null) && currentMatch(qf.tournament)?.round === 1)
if (qf) tp = qf.profile
const sf = recordTournamentResult(tp, 'win', day)
const fin = sf ? recordTournamentResult(sf.profile, 'win', day) : null
check('winning the final crowns you', fin !== null && fin.champion && fin.tournament.status === 'won' && fin.profile.tournamentsWon === 1 && fin.unlocked.some((a) => a.id === 'tournament-victor'))
const out = recordTournamentResult({ ...fresh, tournament: t0 }, 'loss', day)
check('a loss eliminates you and simulates the bracket to the end', out !== null && !out.advanced && out.tournament.status === 'eliminated' && out.tournament.rounds.length === 3 && out.tournament.rounds[2]?.[0]?.winner !== null && currentMatch(out.tournament) === null)
check('one tournament per day', ensureTournament({ ...fresh, tournament: t0 }, day).tournament === t0 && ensureTournament({ ...fresh, tournament: t0 }, new Date(2026, 9, 19, 12)).tournament?.date === '2026-10-19')
check('tournament survives sanitising', JSON.stringify(sanitizeProfile(JSON.parse(JSON.stringify({ ...fresh, tournament: t0 }))).tournament) === JSON.stringify(t0))

// ── Notebook, chronicle, titles, trophies ────────────────────────────────────
const ev = (cp: number): PositionEval => ({ cp, mate: null, bestMove: null, depth: 10 })
const mv = (ply: number, san: string, color: 'w' | 'b', classification: MoveAnalysis['classification']): MoveAnalysis => ({ ply, san, color, classification, evalBefore: ev(0), evalAfter: ev(0), winChanceLoss: 0, bestMoveSan: null })
const analysis: GameAnalysis = {
  moves: [mv(1, 'e4', 'w', 'book'), mv(2, 'e5', 'b', 'book'), mv(25, 'Qh5', 'w', 'blunder'), mv(27, 'Bxf7+', 'w', 'brilliant'), mv(65, 'Kd2', 'w', 'mistake'), mv(30, 'Nf6', 'b', 'blunder')],
  evals: [],
  accuracy: { w: 80, b: 70 },
  counts: { w: { book: 1, brilliant: 1, best: 0, excellent: 0, good: 0, forced: 0, inaccuracy: 0, mistake: 1, blunder: 1 }, b: { book: 1, brilliant: 0, best: 0, excellent: 0, good: 0, forced: 0, inaccuracy: 0, mistake: 0, blunder: 1 } },
}
const sum = summarizeAnalysis(analysis, 'w')
check('analysis summary counts only your moves, by phase and piece', sum.moves === 4 && sum.blunders === 1 && sum.brilliant === 1 && sum.mistakes === 1 && sum.errorsByPhase.middlegame === 1 && sum.errorsByPhase.endgame === 1 && sum.blunderPieces.q === 1)
const match = (i: number, outcome: 'win' | 'loss' | 'draw', opening: string, extra: Partial<MatchRecord> = {}): MatchRecord => ({
  id: `m${i}`, date: new Date(2026, 9, i).toISOString(), mode: 'ai', opponent: 'Stockfish', difficulty: 'beginner', personality: 'balanced', humanColor: 'w',
  result: outcome === 'draw' ? { kind: 'draw', reason: 'stalemate' } : { kind: outcome === 'loss' && i % 2 === 0 ? 'timeout' : 'checkmate', winner: outcome === 'win' ? 'w' : 'b' },
  outcome, pgn: '', plies: 40, timeControl: '5+3', rated: true, eloBefore: 1200, eloAfter: 1200, coins: 0, accuracy: 75, opening, legendId: null, bossId: null, analysis: sum, ...extra,
})
const matches = [match(1, 'win', 'Italian Game'), match(2, 'win', 'Italian Game'), match(3, 'win', 'Italian Game'), match(4, 'loss', 'Sicilian Defense'), match(6, 'loss', 'Sicilian Defense')]
const nb = buildNotebook(matches)
check('notebook: opening scorecard', nb.openings[0]?.name === 'Italian Game' && nb.openings[0].score === 100 && nb.openings.find((o) => o.name === 'Sicilian Defense')?.score === 0)
check('notebook: weaknesses and blunder patterns', nb.insights.some((i) => i.title.includes('queen') || i.title.includes('phase')) && nb.blunderPieces[0]?.piece === 'queen' && nb.timeoutLosses === 2)
check('notebook: recommendations keep winners and flag losers', nb.recommendations.some((r) => r.includes('Keep playing the Italian')) && nb.recommendations.some((r) => r.includes('Sicilian')))
check('empty notebook still recommends openings', buildNotebook([]).recommendations.length === 2)
const chron = buildChronicle({ ...fresh, matches: [match(9, 'win', 'x', { legendId: 'newton', opponent: 'Isaac Newton' })] })
check('chronicle logs victories and brilliant %', chron.victories === 1 && chron.legendVictories === 1 && chron.entries[0]?.title.includes('Newton') === true && chron.brilliantPct === 25)
check('noble ranks follow peak rating', nobleRank(1200).name === 'Squire' && nobleRank(1450).name === 'Knight' && nobleRank(2050).name === 'Duke' && NOBLE_RANKS.length === 6)
const champ: PlayerProfile = { ...fresh, peakElo: 1650, tournamentsWon: 1, campaign: { ...fresh.campaign, realmsCleared: ['chronicle'] }, title: 'slayer-of-chronos' }
check('feat titles are earned and selectable', earnedTitles({ profile: champ, gauntletBest: 0 }).map((t) => t.id).join() === 'baron,slayer-of-chronos,tournament-victor' && displayTitle({ profile: champ, gauntletBest: 0 }).name === 'Slayer of Chronos')
check('an unearned chosen title falls back to your rank', displayTitle({ profile: { ...fresh, title: 'iron-monarch' }, gauntletBest: 0 }).name === 'Squire')
const trophies = earnedTrophyIds({ profile: champ, gauntletBest: 3 })
check('trophies: realm crown + weapon, cups', trophies.includes('chronicle-crown') && trophies.includes('chronicle-weapon') && trophies.includes('tournament-cup') && trophies.includes('gauntlet-bronze') && !trophies.includes('iron-crown'))
check('every trophy has a unique id and a hint', new Set(TROPHIES.map((t) => t.id)).size === TROPHIES.length && TROPHIES.every((t) => t.hint.length > 0))

// ── Profile v3 migration ─────────────────────────────────────────────────────
const v2 = { version: 2, name: 'Veteran', coins: 777, campaign: { bosses: {}, relics: ['fae-gold'], equipped: [], realmsCleared: [] }, matches: [] }
const m3 = migrateProfile(v2)
check('v2 → v3 migration runs', PROFILE_VERSION === 3 && m3.migrated && m3.fromVersion === 2 && m3.data?.version === 3)
const loaded = loadProfile(v2)
check('v3 keeps progress and gifts starter potions', loaded.coins === 777 && loaded.campaign.relics.join() === 'fae-gold' && POTION_IDS.every((id) => potionCount(loaded, id) === (V3_STARTER_POTIONS[id as keyof typeof V3_STARTER_POTIONS] ?? 0)) && !loaded.ironman.enabled && loaded.tournament === null)
const junk = sanitizeProfile({ ...createDefaultProfile(), inventory: { potions: { 'time-elixir': -3, 'purge-potion': 2.7, bogus: 4 } }, ironman: { enabled: 'yes' }, world: { events: [{ id: 1 }], blessings: ['katana-blade', 'nope'] }, feats: { potionsDrunk: 'x' } })
check('corrupt v3 fields are sanitised individually', potionCount(junk, 'time-elixir') === 0 && potionCount(junk, 'purge-potion') === 2 && !junk.ironman.enabled && junk.world.events.length === 0 && junk.world.blessings.join() === 'katana-blade' && junk.feats.potionsDrunk === 0)
check('analysis summaries survive sanitising', sanitizeProfile({ ...createDefaultProfile(), matches: [match(1, 'win', 'x')] }).matches[0]?.analysis?.blunderPieces.q === 1)

console.log(failures === 0 ? '\nAll Ultimate Edition checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
