// Tests for the campaign expansion: branching roads, hidden Echo nodes,
// difficulty tiers, battle mutators, and the new saved settings.
// Run with `npm run test:expansion`.
import { MUTATORS, MUTATOR_IDS, mutatorArena, mutatorSeed, rollMutators } from '../src/data/campaign/mutators'
import { echoBoss, echoId, edgesOf, isHiddenBossId, parentsOf, rowOf, slotOf } from '../src/data/campaign/paths'
import chronicle from '../src/data/campaign/rosters/chronicle'
import { TIERS, applyTier, bestTier } from '../src/data/campaign/tiers'
import { buildBattleSetup } from '../src/data/spells'
import { createDefaultProfile, sanitizeProfile } from '../src/stores/profileStore'
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/stores/settingsStore'
import type { Boss } from '../src/types/campaign'
import type { PlayerProfile } from '../src/types/profile'
import { applyBossResult, clearedCount, isBossUnlocked, isEchoRevealed, nextBoss, starCount } from '../src/utils/campaign'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

const roster = chronicle
const at = (i: number) => roster[i] as Boss
const win = (p: PlayerProfile, b: Boss, tier: 'story' | 'normal' | 'heroic' | 'legendary' = 'normal') => applyBossResult(p, b, { outcome: 'win', humanMoves: 20, clean: true, relics: [], tier }).profile

// ── Road shape ──────────────────────────────────────────────────────────────
check('each zone: gate, two branches, merge, keep', ['gate', 'left', 'right', 'merge', 'keep'].every((s, i) => slotOf(i) === s && slotOf(i + 5) === s))
check('the branches share a map row', rowOf(1) === rowOf(2) && rowOf(6) === rowOf(7) && rowOf(0) < rowOf(1))
check('the merge is reached from either branch', parentsOf(3).join() === '1,2' && parentsOf(8).join() === '6,7')
check('a zone gate follows the previous zone boss', parentsOf(5).join() === '4' && parentsOf(0).length === 0)
check('20 nodes are joined by 23 roads (5 per zone + 3 zone links)', edgesOf(20).length === 23)

// ── Branching unlocks ───────────────────────────────────────────────────────
let p = createDefaultProfile()
p = win(p, at(0))
check('clearing the gate opens both branches', isBossUnlocked(at(1), roster, p.campaign) && isBossUnlocked(at(2), roster, p.campaign) && !isBossUnlocked(at(3), roster, p.campaign))
p = win(p, at(2))
check('one branch is enough to open the merge', isBossUnlocked(at(3), roster, p.campaign))
p = win(p, at(3))
p = win(p, at(4))
check('the skipped branch stays open to come back to', isBossUnlocked(at(1), roster, p.campaign) && nextBoss(roster, p.campaign)?.index === 1)
check('the next zone opens without the skipped branch', isBossUnlocked(at(5), roster, p.campaign))

// ── Hidden Echo ─────────────────────────────────────────────────────────────
const echo = echoBoss(roster)
check('every realm has an Echo, stronger than its overlord', echo !== null && echo.id === echoId('chronicle') && echo.hidden === true && echo.elo === at(19).elo + 250)
check('the Echo object is stable (safe in a store selector)', echoBoss(roster) === echo)
check('the Echo id is a valid, hidden boss id', isHiddenBossId(echo?.id ?? '') && !isHiddenBossId(at(0).id))
// Clear the main trunk only (one branch per fork): the realm is cleared but the Echo stays hidden.
let trunk = createDefaultProfile()
for (const i of [0, 1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16, 18, 19]) trunk = win(trunk, at(i))
check('the realm can be cleared through one branch per fork', trunk.campaign.realmsCleared.includes('chronicle'))
check('the Echo stays hidden until every node is conquered', !isEchoRevealed(roster, trunk.campaign) && !(echo && isBossUnlocked(echo, roster, trunk.campaign)))
for (const i of [2, 7, 12, 17]) trunk = win(trunk, at(i))
check('conquering both branches everywhere reveals the Echo', isEchoRevealed(roster, trunk.campaign) && Boolean(echo && isBossUnlocked(echo, roster, trunk.campaign)))
const before = { cleared: clearedCount(trunk.campaign, 'chronicle'), stars: starCount(trunk.campaign, 'chronicle') }
if (echo) trunk = win(trunk, echo)
check('the Echo is a bonus outside the realm count', clearedCount(trunk.campaign, 'chronicle') === before.cleared && starCount(trunk.campaign, 'chronicle') === before.stars && Boolean(trunk.campaign.bosses[echoId('chronicle')]?.firstClear))

// ── Tiers ───────────────────────────────────────────────────────────────────
const base = at(10).profile
check('Normal leaves the boss untouched', applyTier(base, 'normal') === base)
check('Legendary is stronger, Story is gentler', applyTier(base, 'legendary').skillLevel >= base.skillLevel && applyTier(base, 'legendary').depth > base.depth && applyTier(base, 'story').depth < base.depth && applyTier(base, 'story').toleranceCp > base.toleranceCp)
check('tiers stay within engine limits', applyTier({ ...base, skillLevel: 19 }, 'legendary').skillLevel === 20 && applyTier({ ...base, skillLevel: 1, depth: 2 }, 'story').skillLevel === 0 && applyTier({ ...base, depth: 2 }, 'story').depth >= 1)
check('the better tier is kept', bestTier('heroic', 'story') === 'heroic' && bestTier('story', 'legendary') === 'legendary' && bestTier(undefined, 'normal') === 'normal')
let t = createDefaultProfile()
t = win(t, at(0), 'heroic')
t = win(t, at(0), 'story')
check('a boss remembers the hardest tier it was beaten on', t.campaign.bosses[at(0).id]?.bestTier === 'heroic')
check('reward factors rise with difficulty', TIERS.story.rewardFactor < TIERS.normal.rewardFactor && TIERS.normal.rewardFactor < TIERS.heroic.rewardFactor && TIERS.heroic.rewardFactor < TIERS.legendary.rewardFactor)

// ── Mutators ────────────────────────────────────────────────────────────────
const roll = rollMutators(mutatorSeed(at(3).id, '2026-10-18', 0), 2)
check('a roll is reproducible', roll.join() === rollMutators(mutatorSeed(at(3).id, '2026-10-18', 0), 2).join())
let distinct = true
let variety = new Set<string>()
for (let i = 0; i < 300; i++) {
  const r = rollMutators(mutatorSeed(`b${i}`, 'd', i % 3), 3)
  if (new Set(r.map((id) => MUTATORS[id].slot)).size !== r.length) distinct = false
  variety = new Set([...variety, ...r])
}
check('never two mutators on the same rule', distinct)
check('every mutator turns up', variety.size === MUTATOR_IDS.length, `${variety.size}/${MUTATOR_IDS.length}`)
const arena = mutatorArena(['blizzard', 'swift-hunt', 'enraged'])
check('mutators set the arena rules', arena.weather === 'snow' && arena.restriction === 'swift-30' && arena.bossBoost === 1 && arena.rewardFactor === Math.round(1.2 * 1.4 * 1.5 * 100) / 100)
check('fury from parley and mutators clamps to ±1', mutatorArena(['enraged'], { bossBoost: 1 }).bossBoost === 1 && mutatorArena(['weary'], { bossBoost: 1 }).bossBoost === 0)
const setup = buildBattleSetup('campaign', [], [], true, [], { tier: 'heroic', mutators: ['fog'], weather: 'fog' })
check('the battle setup carries tier and mutators', setup.tier === 'heroic' && setup.mutators.join() === 'fog' && setup.weather === 'fog')
check('battles default to Normal with no mutators', buildBattleSetup('campaign', [], [], true, []).tier === 'normal' && buildBattleSetup('campaign', [], [], true, []).mutators.length === 0)

// ── Saved data ──────────────────────────────────────────────────────────────
const saved = sanitizeProfile(JSON.parse(JSON.stringify(t)))
check('best tier survives a save round trip', saved.campaign.bosses[at(0).id]?.bestTier === 'heroic')
const junk = sanitizeProfile({ ...JSON.parse(JSON.stringify(t)), campaign: { bosses: { [at(0).id]: { stars: 1, wins: 1, firstClear: 'x', bestTier: 'godlike' } } } })
check('an unknown tier is dropped', junk.campaign.bosses[at(0).id]?.bestTier === undefined)
check('Echo records survive a save round trip', sanitizeProfile(JSON.parse(JSON.stringify(trunk))).campaign.bosses[echoId('chronicle')]?.firstClear !== undefined)
const s = sanitizeSettings({ ...DEFAULT_SETTINGS, battleLook: 'mine', arenaBackdrop: 'victory-screen', campaignTier: 'legendary', battleMutators: true })
check('loadout settings are kept', s.battleLook === 'mine' && s.arenaBackdrop === 'victory-screen' && s.campaignTier === 'legendary' && s.battleMutators)
const bad = sanitizeSettings({ ...DEFAULT_SETTINGS, battleLook: 'theirs', arenaBackdrop: '../etc', campaignTier: 'impossible', battleMutators: 'yes' })
check('bad loadout settings fall back to defaults', bad.battleLook === 'realm' && bad.arenaBackdrop === null && bad.campaignTier === 'normal' && bad.battleMutators === false)

console.log(failures === 0 ? '\nAll expansion checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
