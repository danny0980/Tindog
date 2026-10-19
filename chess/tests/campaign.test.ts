// Logic tests for the Grand Campaign: the 100-boss registry, the archetype
// engine, opening books, unlock rules, stars, rewards, relics and storage.
// Run with `npm run test:campaign`.
import { Chess } from 'chess.js'
import { ARCHETYPES, ARCHETYPE_IDS, strengthForElo } from '../src/data/campaign/archetypes'
import { BOOKS } from '../src/data/campaign/books'
import { getCachedBoss, loadRealmRoster } from '../src/data/campaign/loader'
import { GRAND_REALMS, MILESTONE_INDEX, OVERLORD_INDEX, isBossId } from '../src/data/campaign/realms'
import { RELICS, activeRelics, applyRelicsToProfile, relicSlots } from '../src/data/campaign/relics'
import chronicle from '../src/data/campaign/rosters/chronicle'
import cosmic from '../src/data/campaign/rosters/cosmic'
import cyber from '../src/data/campaign/rosters/cyber'
import discovery from '../src/data/campaign/rosters/discovery'
import mythic from '../src/data/campaign/rosters/mythic'
import { getLegend } from '../src/data/legends'
import { bossPersona } from '../src/data/personas'
import { chooseMove } from '../src/engine/personalities'
import { createDefaultProfile, sanitizeProfile } from '../src/stores/profileStore'
import type { Boss, BossId } from '../src/types/campaign'
import type { SearchResult } from '../src/types/engine'
import type { QuoteTrigger } from '../src/types/legend'
import type { PlayerProfile } from '../src/types/profile'
import { applyBossResult, clearedCount, isBossUnlocked, isRealmUnlocked, nextBoss, starCount, starsFor, toggleRelic } from '../src/utils/campaign'
import { applyMatch, purchase } from '../src/utils/progression'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

const ROSTERS: Record<string, readonly Boss[]> = { chronicle, mythic, discovery, cyber, cosmic }
const ALL: Boss[] = GRAND_REALMS.flatMap((r) => [...(ROSTERS[r.id] ?? [])])
const TRIGGERS: QuoteTrigger[] = ['intro', 'thinking', 'playerSlow', 'legendCapture', 'playerCapture', 'checkGiven', 'inCheck', 'advantage', 'disadvantage', 'legendWins', 'legendLoses', 'draw']

// ── Registry ─────────────────────────────────────────────────────────────────
check('100 bosses across 5 realms', ALL.length === 100 && GRAND_REALMS.every((r) => ROSTERS[r.id]?.length === 20))
check('ids unique and well-formed', new Set(ALL.map((b) => b.id)).size === 100 && ALL.every((b) => isBossId(b.id)))
check('names unique', new Set(ALL.map((b) => b.name)).size === 100)
check('global order 0–99', ALL.every((b, i) => b.globalIndex === i))
check('ranks: #10 milestone, #20 overlord', ALL.every((b) => (b.index === MILESTONE_INDEX ? b.rank === 'milestone' : b.index === OVERLORD_INDEX ? b.rank === 'overlord' : b.rank === 'regular')))
const relicDrops = ALL.flatMap((b) => (b.relic ? [b.relic] : []))
check('each of the 10 relics drops exactly once', relicDrops.length === 10 && new Set(relicDrops).size === 10 && RELICS.every((r) => relicDrops.includes(r.id)))
const elos = ALL.map((b) => b.elo)
check('Elo spans 650–2800 (a gentle first realm)', Math.min(...elos) === 650 && Math.max(...elos) === 2800, `${Math.min(...elos)}–${Math.max(...elos)}`)
check('Elo rises along every realm path', GRAND_REALMS.every((r) => (ROSTERS[r.id] ?? []).every((b, i, arr) => i === 0 || b.elo > (arr[i - 1]?.elo ?? 0))))
check('par grows with Elo', (chronicle[0]?.par ?? 0) < (cosmic[19]?.par ?? 0), `${chronicle[0]?.par} → ${cosmic[19]?.par}`)
check('every boss speaks on every trigger', ALL.every((b) => TRIGGERS.every((t) => b.quotes[t].length > 0 && b.quotes[t].every((q) => q.trim().length > 0))))
const cameos = ALL.filter((b) => b.legendRef)
check('8 Chronos legends make cameos', cameos.length === 8 && cameos.every((b) => b.book === null && b.profile.repertoire !== undefined), cameos.map((b) => b.shortName).join(', '))
check('all 8 archetypes appear', ARCHETYPE_IDS.every((a) => ALL.some((b) => b.archetype === a)))
check('each realm mixes ≥5 archetypes', GRAND_REALMS.every((r) => new Set((ROSTERS[r.id] ?? []).map((b) => b.archetype)).size >= 5))
check('zones carry 5 bosses each', ALL.every((b) => b.zone.id === (GRAND_REALMS.find((r) => r.id === b.realm)?.zones[Math.floor(b.index / 5)]?.id ?? '')))
check('short names are short', ALL.every((b) => b.shortName.length > 0 && b.shortName.length <= 20), ALL.filter((b) => b.shortName.length > 20).map((b) => b.shortName).join(', '))

// ── Archetype engine ─────────────────────────────────────────────────────────
check('every archetype voices every generic trigger', ARCHETYPE_IDS.every((a) => Object.values(ARCHETYPES[a].lines).every((pool) => pool.length > 0)))
const ladder = [800, 1100, 1400, 1700, 2000, 2300, 2600, 2800].map(strengthForElo)
check('strength curve is monotonic', ladder.every((s, i) => i === 0 || (s.skillLevel >= (ladder[i - 1]?.skillLevel ?? 0) && s.depth >= (ladder[i - 1]?.depth ?? 0) && s.toleranceCp <= (ladder[i - 1]?.toleranceCp ?? 999))))
check('profiles are in engine range', ALL.every((b) => b.profile.skillLevel >= 0 && b.profile.skillLevel <= 20 && b.profile.depth >= 2 && b.profile.multiPv >= 3 && b.profile.toleranceCp > 0 && (b.profile.maxLossCp ?? 0) >= 50))
const infinite = cosmic[19] as Boss
const hammurabi = chronicle[0] as Boss
check('The Infinite plays at full strength', infinite.profile.skillLevel === 20 && infinite.profile.depth >= 20 && infinite.profile.toleranceCp < 25, JSON.stringify({ d: infinite.profile.depth, tol: infinite.profile.toleranceCp }))
check('Hammurabi is a gentle opener — shallow, but guarded against blunders', hammurabi.profile.skillLevel <= 3 && hammurabi.profile.depth <= 3 && (hammurabi.profile.maxLossCp ?? 0) >= 120)
const sameElo = (a: string, b: string) => [ALL.find((x) => x.id === a), ALL.find((x) => x.id === b)] as const
const [ironjaw, lattice] = sameElo('cyber.ironjaw', 'cyber.tessaract')
check('archetype slack: Berserker wider than Fortifier', Boolean(ironjaw && lattice && ironjaw.profile.toleranceCp > lattice.profile.toleranceCp))
const napoleonBoss = ALL.find((b) => b.legendRef === 'napoleon')
check('cameo legends are re-scaled to campaign Elo', napoleonBoss !== undefined && napoleonBoss.elo < 1500 && napoleonBoss.profile.skillLevel < 13 && napoleonBoss.profile.weights === getLegend('napoleon').profile.weights && napoleonBoss.profile.repertoire === getLegend('napoleon').profile.repertoire, `${napoleonBoss?.elo} / skill ${napoleonBoss?.profile.skillLevel}`)

// Black to move after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.O-O d6 5.c3: …g5 storm vs …Nf6 / …Bg4 / …a6.
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
const share = (boss: Boss | undefined, move: string) => {
  if (!boss) return 0
  let hits = 0
  for (let i = 0; i < 300; i++) if (chooseMove(storm.fen(), stormLines, boss.profile) === move) hits += 1
  return hits / 300
}
const ironStorm = share(ironjaw, 'g7g5')
const latticeStorm = share(lattice, 'g7g5')
const omnicoreBest = share(ALL.find((b) => b.id === 'cyber.omnicore'), 'g8f6')
console.log(`  …g5 share: Ironjaw (Berserker) ${ironStorm.toFixed(2)} · Tessaract (Fortifier) ${latticeStorm.toFixed(2)} · OMNICORE …Nf6 ${omnicoreBest.toFixed(2)}`)
check('Berserker storms far more than Fortifier', ironStorm > 0.4 && latticeStorm < 0.1)
check('Calculator overlord plays the engine move', omnicoreBest > 0.9)

// ── Opening books ────────────────────────────────────────────────────────────
let bookLines = 0
let bookOk = true
for (const [id, book] of Object.entries(BOOKS)) {
  for (const line of [...book.w, ...book.b]) {
    bookLines += 1
    const chess = new Chess()
    try {
      for (const san of line.split(' ')) chess.move(san)
    } catch {
      bookOk = false
      console.error(`  illegal move in ${id}: ${line}`)
    }
  }
}
check(`${bookLines} opening-book lines are legal`, bookOk)

// ── Unlocks, stars & rewards ─────────────────────────────────────────────────
let p: PlayerProfile = createDefaultProfile()
const realm0 = chronicle
check('only Historical Legends is open at start', isRealmUnlocked('chronicle', p.campaign) && !isRealmUnlocked('mythic', p.campaign))
check('first boss open, second locked', isBossUnlocked(realm0[0] as Boss, realm0, p.campaign) && !isBossUnlocked(realm0[1] as Boss, realm0, p.campaign))
check('star rules', starsFor(true, 10, 24, true, []) === 3 && starsFor(true, 30, 24, true, []) === 2 && starsFor(true, 60, 24, true, []) === 1 && starsFor(true, 10, 24, false, []) === 1 && starsFor(false, 10, 24, true, []) === 0)
check('Black Prince’s Banner loosens targets', starsFor(true, 28, 24, true, ['black-prince-banner']) === 3 && starsFor(true, 28, 24, true, []) === 2)

let r = applyBossResult(p, hammurabi, { outcome: 'loss', humanMoves: 30, clean: true, relics: [] })
check('a loss pays nothing and records it', r.coins === 0 && r.stars === 0 && r.profile.campaign.bosses[hammurabi.id]?.losses === 1)
p = r.profile
r = applyBossResult(p, hammurabi, { outcome: 'win', humanMoves: 40, clean: true, relics: [] })
check('first clear: bounty + star bonus + First Conquest', r.firstClear && r.stars === 1 && r.coins === hammurabi.rewards.first + 15 && r.unlocked.some((a) => a.id === 'first-conquest'), `${r.coins}`)
p = r.profile
check('second boss unlocked', isBossUnlocked(realm0[1] as Boss, realm0, p.campaign))
r = applyBossResult(p, hammurabi, { outcome: 'win', humanMoves: 12, clean: true, relics: ['fae-gold'] })
check('rematch improves stars, pays repeat + new stars, Fae Gold +25%', r.stars === 3 && r.previousStars === 1 && r.coins === Math.round((hammurabi.rewards.repeat + 30) * 1.25), `${r.coins}`)
p = r.profile
check('best moves tracked', p.campaign.bosses[hammurabi.id]?.bestMoves === 12)

// Fight through the whole first realm.
for (const boss of realm0.slice(1)) {
  r = applyBossResult(p, boss, { outcome: 'win', humanMoves: 20, clean: true, relics: [] })
  p = r.profile
  if (boss.index === MILESTONE_INDEX) check('#10 grants and auto-equips Shield of Kings', r.relic?.id === 'shield-of-kings' && p.campaign.equipped.includes('shield-of-kings'))
}
check('overlord grants Hourglass and clears the realm', r.relic?.id === 'hourglass-of-time' && r.realmCleared === 'chronicle' && r.unlocked.some((a) => a.id === 'keeper-of-history'))
check('Mythology realm now open', isRealmUnlocked('mythic', p.campaign) && !isRealmUnlocked('discovery', p.campaign))
check('counters', clearedCount(p.campaign) === 20 && clearedCount(p.campaign, 'chronicle') === 20 && starCount(p.campaign, 'chronicle') === 60 && nextBoss(realm0, p.campaign) === null)

// Clear the remaining realms.
for (const roster of [mythic, discovery, cyber, cosmic]) {
  for (const boss of roster) {
    r = applyBossResult(p, boss, { outcome: 'win', humanMoves: 5, clean: true, relics: [] })
    p = r.profile
    if (boss.id === 'discovery.hattori-hanzo') check('clearing Discovery unlocks Storm Sea + Brass', r.rewards.includes('Storm Sea Chart') && r.rewards.includes('Brass & Tar') && p.unlockedThemes.includes('storm-sea'))
  }
}
check('all 10 relics, 100 bosses, 300 stars', p.campaign.relics.length === 10 && clearedCount(p.campaign) === 100 && starCount(p.campaign) === 300)
check('endgame achievements', ['lord-of-the-cosmos', 'flawless-conqueror', 'relic-hunter', 'three-star-general', 'mythbreaker', 'admiral-of-blades', 'system-override'].every((id) => Boolean(p.achievements[id])))
check('Starforged Crown → 3 slots, extra relics not auto-equipped past the limit', relicSlots(p.campaign.relics) === 3 && p.campaign.equipped.length === 3, p.campaign.equipped.join(', '))

// ── Relics ───────────────────────────────────────────────────────────────────
let c = { ...p.campaign, equipped: [] as typeof p.campaign.equipped }
c = toggleRelic(c, 'emp-spike')
c = toggleRelic(c, 'fae-gold')
c = toggleRelic(c, 'smoke-veil')
c = toggleRelic(c, 'firewall-core')
check('slot limit enforced', c.equipped.length === 3 && !c.equipped.includes('firewall-core'))
check('passive relics cannot be equipped', toggleRelic(c, 'starforged-crown').equipped === c.equipped)
check('unequip works', !toggleRelic(c, 'emp-spike').equipped.includes('emp-spike'))
check('unowned relics cannot be equipped', toggleRelic(createDefaultProfile().campaign, 'emp-spike').equipped.length === 0)
check('active relics = equipped + owned passives', activeRelics(c.relics, c.equipped).includes('starforged-crown') && activeRelics(c.relics, c.equipped).length === 4)
const emp = applyRelicsToProfile(infinite.profile, ['emp-spike'])
check('EMP Spike weakens the search', emp.depth === infinite.profile.depth - 2 && emp.moveTimeMs < infinite.profile.moveTimeMs && applyRelicsToProfile(infinite.profile, []) === infinite.profile)

const lossInput = {
  mode: 'ai' as const, opponent: 'X', difficulty: 'expert' as const, personality: null, humanColor: 'w' as const,
  result: { kind: 'resign' as const, winner: 'b' as const }, pgn: '', history: [], timeControl: { id: 'none', label: '-', category: 'none' as const, initialMs: 0, incrementMs: 0 },
  rated: true, opening: null, opponentElo: 900,
}
const raw = applyMatch(createDefaultProfile(), lossInput)
const capped = applyMatch(createDefaultProfile(), { ...lossInput, eloLossCap: 4 })
check('Firewall Core caps rated losses at 4 Elo', (raw.eloDelta ?? 0) < -4 && capped.eloDelta === -4, `${raw.eloDelta} → ${capped.eloDelta}`)
check('realm cosmetics cannot be bought', !purchase({ ...createDefaultProfile(), coins: 99999 }, { kind: 'theme', id: 'nebula' }).ok)

// ── Storage ──────────────────────────────────────────────────────────────────
const roundTrip = sanitizeProfile(JSON.parse(JSON.stringify(p)))
check('campaign survives a storage round trip', JSON.stringify(roundTrip.campaign) === JSON.stringify(p.campaign))
const dirty = sanitizeProfile({
  ...JSON.parse(JSON.stringify(createDefaultProfile())),
  campaign: { bosses: { 'chronicle.hammurabi': { stars: 7, wins: 1 }, 'atlantis.x': { stars: 3 }, 'cyber.glitch': 'bad' }, relics: ['emp-spike', 'nope', 'emp-spike'], equipped: ['emp-spike', 'fae-gold'], realmsCleared: ['chronicle', 'mars'] },
})
check('corrupt campaign data is sanitised', dirty.campaign.bosses['chronicle.hammurabi']?.stars === 3 && Object.keys(dirty.campaign.bosses).length === 1 && dirty.campaign.relics.join() === 'emp-spike' && dirty.campaign.equipped.join() === 'emp-spike' && dirty.campaign.realmsCleared.join() === 'chronicle')

// ── Lazy loader & personas ───────────────────────────────────────────────────
const [a, b] = await Promise.all([loadRealmRoster('cyber'), loadRealmRoster('cyber')])
check('loader returns a realm once (shared promise, cached)', a === b && a.length === 20 && getCachedBoss('cyber.omnicore')?.name === 'OMNICORE')
check('unloaded realms are not cached', getCachedBoss('cosmic.the-infinite' as BossId) === null)
const persona = bossPersona(infinite)
check('boss persona carries theme, Elo and voice', persona.key === 'boss:cosmic.the-infinite' && persona.themeId === 'nebula' && persona.elo === 2800 && persona.difficulty === 'expert')

process.exit(failures ? 1 : 0)
