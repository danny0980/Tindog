// Logic tests for Chronos Chess: campaign gating, rewards, shop rules,
// opening repertoires and the style filter that gives each legend its character.
// Run with `npm run test:legends`.
import { Chess } from 'chess.js'
import { LEGENDS, isLegendUnlocked } from '../src/data/historicalLegends'
import { chooseMove, repertoireMove } from '../src/engine/personalities'
import { createDefaultProfile } from '../src/stores/profileStore'
import { applyLegendResult, purchase } from '../src/utils/progression'
import type { SearchResult } from '../src/types/engine'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// Campaign gating
check('Cleopatra unlocked at start', isLegendUnlocked('cleopatra', {}))
check('Newton locked at start', !isLegendUnlocked('newton', {}))
check('Newton unlocked after Cleopatra', isLegendUnlocked('newton', { cleopatra: 'x' }))

// First win rewards
let p = createDefaultProfile()
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
r = applyLegendResult(p, 'newton', 'loss', 42)
check('loss vs Newton after 40 moves → Calculated by Newton', r.unlocked.some((a) => a.id === 'calculated-by-newton') && r.coins === 0)
p = r.profile
for (const id of ['newton', 'napoleon', 'einstein'] as const) {
  r = applyLegendResult(p, id, 'win', 30)
  p = r.profile
}
check('Master of Time + Time Traveler after all four', Boolean(p.achievements['master-of-time']) && Boolean(p.achievements['time-traveler']))
check('records tracked', p.legends.wins.cleopatra === 2 && p.legends.losses.newton === 1)

// Shop can't sell legend items
const rich = { ...createDefaultProfile(), coins: 99999 }
check('legend theme not purchasable', !purchase(rich, { kind: 'theme', id: 'chalkboard' }).ok)
check('normal theme purchasable', purchase(rich, { kind: 'theme', id: 'royal-gold' }).ok)

// Repertoire
const napoleon = LEGENDS.find((l) => l.id === 'napoleon')!
const seen = new Set<string>()
for (let i = 0; i < 50; i++) seen.add(repertoireMove(['e4', 'e5'], napoleon.profile.repertoire?.w) ?? '-')
check('Napoleon repertoire after 1.e4 e5 → Qf3 / f4', [...seen].every((m) => m === 'Qf3' || m === 'f4') && seen.size === 2, [...seen].join(','))
const cleo = LEGENDS.find((l) => l.id === 'cleopatra')!
check('Cleopatra answers 3.Bc4 with the Blackburne Shilling trap', repertoireMove(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], cleo.profile.repertoire?.b) === 'Nd4')
check('out of book → null', repertoireMove(['a3'], cleo.profile.repertoire?.b) === null)

// Style filter: synthetic MultiPV where candidates are within tolerance.
// Position after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 (White to move): b4 (Evans gambit) vs quiet O-O / c3.
const c = new Chess()
for (const m of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']) c.move(m)
const result: SearchResult = {
  bestMove: 'e1g1',
  lines: [
    { multipv: 1, depth: 12, score: { type: 'cp', value: 40 }, pv: ['e1g1'] },
    { multipv: 2, depth: 12, score: { type: 'cp', value: 35 }, pv: ['c2c3'] },
    { multipv: 3, depth: 12, score: { type: 'cp', value: 20 }, pv: ['b2b4'] },
    { multipv: 4, depth: 12, score: { type: 'cp', value: 15 }, pv: ['d2d3'] },
  ],
}
const pick = (id: string) => {
  const legend = LEGENDS.find((l) => l.id === id)!
  const counts = new Map<string, number>()
  for (let i = 0; i < 200; i++) {
    const m = chooseMove(c.fen(), result, legend.profile)
    counts.set(m, (counts.get(m) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}
const newtonPicks = pick('newton')
const napoleonPicks = pick('napoleon')
const einsteinPicks = pick('einstein')
console.log('  newton', JSON.stringify(newtonPicks), '\n  napoleon', JSON.stringify(napoleonPicks), '\n  einstein', JSON.stringify(einsteinPicks))
check('Newton prefers castling (solid)', newtonPicks[0]?.[0] === 'e1g1')
check('Napoleon gambits b4 more than Newton', (napoleonPicks.find((x) => x[0] === 'b2b4')?.[1] ?? 0) > (newtonPicks.find((x) => x[0] === 'b2b4')?.[1] ?? 0))
check('Einstein spreads choices (creative)', einsteinPicks.length >= 2)
process.exit(failures ? 1 : 0)
