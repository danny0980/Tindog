// Logic tests for Chronos Chess: campaign gating across both universes,
// rewards and achievements, shop rules, free-play strength scaling, opening
// repertoires and the style filter that gives each character its personality.
// Run with `npm run test:legends`.
import { Chess } from 'chess.js'
import { LEGENDS, applyStrength, getLegend, isLegendUnlocked, legendElo, nextChapter } from '../src/data/legends'
import { chooseMove, repertoireMove } from '../src/engine/personalities'
import { createDefaultProfile } from '../src/stores/profileStore'
import type { SearchResult } from '../src/types/engine'
import type { LegendId } from '../src/types/legend'
import type { PlayerProfile } from '../src/types/profile'
import { applyLegendResult, purchase } from '../src/utils/progression'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── Campaign gating ──────────────────────────────────────────────────────────
check('Cleopatra and Aerith open at start (one per universe)', isLegendUnlocked('cleopatra', {}) && isLegendUnlocked('aerith', {}))
check('Newton locked at start', !isLegendUnlocked('newton', {}))
check('Malakor locked until Aerith falls', !isLegendUnlocked('malakor', {}) && isLegendUnlocked('malakor', { aerith: 'x' }))
check('Ragnar requires Einstein', !isLegendUnlocked('ragnar', { cleopatra: 'x', newton: 'x', napoleon: 'x' }) && isLegendUnlocked('ragnar', { cleopatra: 'x', newton: 'x', napoleon: 'x', einstein: 'x' }))
check('Campaigns are independent', !isLegendUnlocked('newton', { aerith: 'x', malakor: 'x' }))
check('Next historical chapter after Einstein is Ragnar', nextChapter('historical', { cleopatra: 'x', newton: 'x', napoleon: 'x', einstein: 'x' })?.id === 'ragnar')

// ── Rewards & achievements ───────────────────────────────────────────────────
let p: PlayerProfile = createDefaultProfile()
const coins0 = p.coins
let r = applyLegendResult(p, 'cleopatra', 'win', 30)
check('first win grants bounty', r.coins === 300 && r.firstDefeat)
check('epoch theme + pieces unlocked', r.profile.unlockedThemes.includes('papyrus-gold') && r.profile.unlockedPieceSets.includes('lapis'), r.rewards.join(', '))
check('achievement granted', r.unlocked.some((a) => a.id === 'dethroned-the-nile'))
check('coins = bounty + achievement', r.profile.coins === coins0 + 300 + 100, String(r.profile.coins))
p = r.profile
r = applyLegendResult(p, 'cleopatra', 'win', 30)
check('repeat win smaller reward, no second unlock', r.coins === 40 && !r.firstDefeat && r.rewards.length === 0)
p = r.profile
r = applyLegendResult(p, 'cleopatra', 'win', 30, new Date(), 'mythic')
check('Mythic rematch pays 1.5×', r.coins === 60, String(r.coins))
p = r.profile
r = applyLegendResult(p, 'newton', 'loss', 42)
check('loss vs Newton after 40 moves → Calculated by Newton', r.unlocked.some((a) => a.id === 'calculated-by-newton') && r.coins === 0)
p = r.profile
for (const id of ['newton', 'napoleon', 'einstein', 'ragnar'] as const) p = applyLegendResult(p, id, 'win', 30).profile
check('Master of Time NOT yet (Musashi remains)', !p.achievements['master-of-time'])
r = applyLegendResult(p, 'musashi', 'win', 30)
p = r.profile
check('Musashi grants Book of Five Rings + new cosmetics', r.unlocked.some((a) => a.id === 'book-of-five-rings') && r.rewards.includes('Bamboo & Gold Leaf'), r.rewards.join(', '))
check('Master of Time + Time Traveler after all six eras', Boolean(p.achievements['master-of-time']) && Boolean(p.achievements['time-traveler']))
check('no Walker Between Worlds before visiting a realm', !p.achievements['walker-between-worlds'])
r = applyLegendResult(p, 'aerith', 'loss', 20)
p = r.profile
check('Walker Between Worlds after a fantasy battle', Boolean(p.achievements['walker-between-worlds']))
p = applyLegendResult(p, 'aerith', 'win', 20).profile
r = applyLegendResult(p, 'malakor', 'win', 20)
p = r.profile
check('Fantasy completion → Shadowbane + Hero of the Realm', Boolean(p.achievements.shadowbane) && Boolean(p.achievements['hero-of-the-realm']))
check('records tracked', p.legends.wins.cleopatra === 3 && p.legends.losses.newton === 1 && p.legends.losses.aerith === 1)

// ── Shop ─────────────────────────────────────────────────────────────────────
const rich = { ...createDefaultProfile(), coins: 99999 }
check('legend themes not purchasable', !purchase(rich, { kind: 'theme', id: 'chalkboard' }).ok && !purchase(rich, { kind: 'theme', id: 'obsidian-lava' }).ok)
check('legend piece sets not purchasable', !purchase(rich, { kind: 'pieces', id: 'moonsilver' }).ok)
check('normal theme purchasable', purchase(rich, { kind: 'theme', id: 'royal-gold' }).ok)

// ── Free-play strength ───────────────────────────────────────────────────────
const nap = getLegend('napoleon')
const novice = applyStrength(nap.profile, 'novice')
const mythic = applyStrength(nap.profile, 'mythic')
check('Novice is weaker but keeps the style', novice.skillLevel < nap.profile.skillLevel && novice.toleranceCp > nap.profile.toleranceCp && novice.weights === nap.profile.weights)
check('Mythic is full strength', mythic.skillLevel === 20 && mythic.depth > nap.profile.depth)
check('Elo offsets', legendElo(nap, 'novice') === 1650 && legendElo(nap, 'mythic') === 2200)

// ── Repertoires ──────────────────────────────────────────────────────────────
const sample = (id: LegendId, side: 'w' | 'b', history: string[]) => {
  const seen = new Set<string>()
  for (let i = 0; i < 60; i++) seen.add(repertoireMove(history, getLegend(id).profile.repertoire?.[side]) ?? '-')
  return [...seen].sort()
}
check('Napoleon (White) after 1.e4 e5 → Qf3 / f4', sample('napoleon', 'w', ['e4', 'e5']).join() === 'Qf3,f4')
check('Cleopatra springs the Blackburne Shilling trap', sample('cleopatra', 'b', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']).join() === 'Nd4')
check('Ragnar answers 1.d4 with the Borg (g5) or Dutch (f5)', sample('ragnar', 'b', ['d4']).join() === 'f5,g5')
check('Musashi plays the Najdorf deep into book', sample('musashi', 'b', ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3']).join() === 'a6')
check('Aerith opens with a fianchetto (b3 / g3)', sample('aerith', 'w', []).join() === 'b3,g3')
check('Malakor meets 1.d4 with the Englund (e5) or Budapest (Nf6)', sample('malakor', 'b', ['d4']).join() === 'Nf6,e5')
check('out of book → null', repertoireMove(['a3'], getLegend('cleopatra').profile.repertoire?.b) === null)

// ── Style filter ─────────────────────────────────────────────────────────────
// Italian Game, White to move: castling (solid) vs c3 vs the b4 Evans gambit vs d3.
const italian = new Chess()
for (const m of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']) italian.move(m)
const italianLines: SearchResult = {
  bestMove: 'e1g1',
  lines: [
    { multipv: 1, depth: 12, score: { type: 'cp', value: 40 }, pv: ['e1g1'] },
    { multipv: 2, depth: 12, score: { type: 'cp', value: 35 }, pv: ['c2c3'] },
    { multipv: 3, depth: 12, score: { type: 'cp', value: 20 }, pv: ['b2b4'] },
    { multipv: 4, depth: 12, score: { type: 'cp', value: 15 }, pv: ['d2d3'] },
  ],
}
// Black to move after 4.O-O d6 5.c3: a kingside pawn storm (…g5) vs development (…Nf6, …Bg4) vs …a6.
const storm = new Chess()
for (const m of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'd6', 'c3']) storm.move(m)
const stormLines: SearchResult = {
  bestMove: 'g8f6',
  lines: [
    { multipv: 1, depth: 12, score: { type: 'cp', value: -30 }, pv: ['g8f6'] },
    { multipv: 2, depth: 12, score: { type: 'cp', value: -45 }, pv: ['c8g4'] },
    { multipv: 3, depth: 12, score: { type: 'cp', value: -60 }, pv: ['a7a6'] },
    { multipv: 4, depth: 12, score: { type: 'cp', value: -95 }, pv: ['g7g5'] },
  ],
}
const pick = (id: LegendId, fen: string, result: SearchResult) => {
  const counts = new Map<string, number>()
  for (let i = 0; i < 200; i++) {
    const m = chooseMove(fen, result, getLegend(id).profile)
    counts.set(m, (counts.get(m) ?? 0) + 1)
  }
  return counts
}
const share = (counts: Map<string, number>, move: string) => (counts.get(move) ?? 0) / 200
const show = (id: string, counts: Map<string, number>) => console.log(`  ${id.padEnd(9)} ${JSON.stringify([...counts.entries()].sort((a, b) => b[1] - a[1]))}`)

const italianPicks = Object.fromEntries(LEGENDS.map((l) => [l.id, pick(l.id, italian.fen(), italianLines)]))
const stormPicks = Object.fromEntries(LEGENDS.map((l) => [l.id, pick(l.id, storm.fen(), stormLines)]))
console.log('  Italian (White):'); Object.entries(italianPicks).forEach(([id, c]) => show(id, c))
console.log('  Storm test (Black):'); Object.entries(stormPicks).forEach(([id, c]) => show(id, c))

const ip = (id: LegendId) => italianPicks[id] ?? new Map<string, number>()
const sp = (id: LegendId) => stormPicks[id] ?? new Map<string, number>()
check('Newton prefers castling (solid)', share(ip('newton'), 'e1g1') > 0.9)
check('Napoleon gambits b4 more than Newton', share(ip('napoleon'), 'b2b4') > share(ip('newton'), 'b2b4'))
check('Einstein spreads choices (creative)', ip('einstein').size >= 2)
check('Ragnar storms with …g5 far more than Musashi', share(sp('ragnar'), 'g7g5') > 0.5 && share(sp('musashi'), 'g7g5') < 0.05)
check('Musashi develops with …Nf6 (precise)', share(sp('musashi'), 'g8f6') > 0.9)
check('Aerith never storms (defensive)', share(sp('aerith'), 'g7g5') < 0.05)
check('Malakor gambits b4 in the Italian (high risk)', share(ip('malakor'), 'b2b4') > 0.5)

process.exit(failures ? 1 : 0)
