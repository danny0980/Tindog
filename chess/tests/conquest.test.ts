// Tests for Phase C: opponents who remember you, the 3D Trophy Hall layout,
// the Custom Army and the Historical World War. Run with `npm run test:conquest`.
import { EMPTY_ARMY, MAX_RALLY, MAX_TAKEBACKS, armyEffects, draft, sanitizeArmy } from '../src/army/army'
import { getClassic } from '../src/data/classic/roster'
import { classicPersona } from '../src/data/personas'
import { MAX_MEMORIES, MAX_SHIFT, memoryIntro, memoryShift, remember, sanitizeMemory, withMemory } from '../src/memory/memory'
import { ENTRANCE_Z, ROW_X, clampWalk, glowFor, hallDepth, hallLayout } from '../src/museum/hall'
import { createDefaultProfile, sanitizeProfile } from '../src/stores/profileStore'
import { applyMatch } from '../src/utils/progression'
import { FACTION_COINS, SIEGE_TURNS, TERRITORIES, VICTORY_COINS, attackable, besieger, conquestCoins, getTerritory, opponentFor, resolveBattle, sanitizeWar, startWar } from '../src/war/war'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const never = () => 0.99
const always = () => 0

// ── Memory ──────────────────────────────────────────────────────────────────
let book = remember({}, 'classic:napoleon', 'win', 'Italian Game', '2026-10-01')
check('a first game is remembered', book['classic:napoleon']?.games === 1 && book['classic:napoleon'].streak === 1)
book = remember(book, 'classic:napoleon', 'win', null, '2026-10-02')
check('streaks build up', book['classic:napoleon']?.streak === 2 && book['classic:napoleon'].wins === 2)
book = remember(book, 'classic:napoleon', 'loss', null, '2026-10-03')
check('a loss flips the streak', book['classic:napoleon']?.streak === -1 && book['classic:napoleon'].losses === 1)
book = remember(book, 'classic:napoleon', 'draw', null, '2026-10-04')
check('a draw resets it', book['classic:napoleon']?.streak === 0 && book['classic:napoleon'].draws === 1)
const winStreak = { games: 3, wins: 3, losses: 0, draws: 0, streak: 3, last: 'win' as const, lastOpening: 'Ruy Lopez', lastDate: 'x' }
check('a winning streak gets a challenge', memoryIntro(winStreak)?.includes('3 wins in a row') === true)
check('a first rematch remembers the opening that beat them', memoryIntro({ ...winStreak, streak: 1, wins: 1, games: 1 })?.includes('with the Ruy Lopez') === true)
check('old rivals keep the score', memoryIntro({ ...winStreak, games: 6, wins: 4, losses: 2, streak: 1 })?.startsWith('Game 7 between us: 4 wins for you, 2 for me.') === true)
check('a first meeting has no memory line', memoryIntro(undefined) === null)
check('they play stronger after your streak, gentler after theirs, within limits', memoryShift(winStreak) === 80 && memoryShift({ ...winStreak, streak: 20 }) === MAX_SHIFT && memoryShift({ ...winStreak, streak: -4 }) === -80 && memoryShift({ ...winStreak, streak: -1 }) === 0)
const nap = classicPersona(getClassic('napoleon')!)
const remembered = withMemory(nap, winStreak)
check('a remembering opponent changes its greeting and farewells', remembered.quotes.intro[0]?.includes('in a row') === true && remembered.quotes.legendLoses[0]?.includes('4 wins for you') === true)
check('and its strength', remembered.profile.depth >= nap.profile.depth && remembered.elo === nap.elo)
check('without a memory nothing changes', withMemory(nap, undefined) === nap)
let crowd = {}
for (let i = 0; i < MAX_MEMORIES + 5; i++) crowd = remember(crowd, `k${i}`, 'win', null, `2026-01-01T00:${String(i).padStart(4, '0')}`)
check(`at most ${MAX_MEMORIES} opponents are remembered, the oldest forgotten`, Object.keys(crowd).length === MAX_MEMORIES && !('k0' in crowd))
check('memories are sanitised', Object.keys(sanitizeMemory({ 'bad key!': winStreak, ok: { ...winStreak, last: 'nope' }, good: winStreak })).join() === 'good')
const out = applyMatch(createDefaultProfile(), {
  mode: 'ai', opponent: 'Napoleon Bonaparte', difficulty: 'expert', personality: null, humanColor: 'w', result: { kind: 'resign', winner: 'w' }, pgn: '', history: [],
  timeControl: { id: 'none', label: '-', category: 'none', initialMs: 0, incrementMs: 0 }, rated: false, opening: 'Italian Game', opponentKey: 'classic:napoleon',
})
check('a finished game goes into the opponent’s memory', out.profile.memory['classic:napoleon']?.lastOpening === 'Italian Game')

// ── Trophy Hall layout ──────────────────────────────────────────────────────
const spots = hallLayout(5)
check('statues alternate sides of the aisle, facing it', spots[0]?.x === -ROW_X && spots[1]?.x === ROW_X && spots[0].yaw > 0 && spots[1].yaw < 0)
check('pairs stand further down the hall', spots[2]?.z !== undefined && spots[2].z < spots[0]!.z && spots[2].z === spots[3]?.z)
check('the walk is clamped to the hall', clampWalk(99, 6) === ENTRANCE_Z && clampWalk(-99, 6) === -hallDepth(6) - 1)
check('more wins, brighter glow', glowFor(1) < glowFor(3) && glowFor(5) === 1 && glowFor(50) === 1)

// ── Custom Army ─────────────────────────────────────────────────────────────
const beaten = new Set(['napoleon', 'cleopatra', 'hannibal', 'el-cid', 'fischer', 'saladin'])
let army = draft(EMPTY_ARMY, 'king', 'napoleon', beaten)
check('a beaten character can be drafted', army.king === 'napoleon')
check('an unbeaten one cannot', draft(army, 'queen', 'tesla', beaten) === army)
army = draft(army, 'queen', 'napoleon', beaten)
check('a character sits in one seat at a time', army.queen === 'napoleon' && army.king === null)
const archOf = (id: string) => getClassic(id)!.archetype
const warlords = [...beaten].filter((id) => archOf(id) === 'warlord')
check('the roster gives at least one warlord to test with', warlords.length > 0, [...beaten].map((id) => `${id}:${archOf(id)}`).join(' '))
const w = warlords[0]!
const kingRally = armyEffects({ ...EMPTY_ARMY, king: w })
const rookRally = armyEffects({ ...EMPTY_ARMY, rook: w })
check('the King’s seat doubles a trait', kingRally.rally === 2 * rookRally.rally && rookRally.rally > 0)
check('traits are capped', armyEffects({ king: w, queen: w, rook: w, bishop: w, knight: w }).rally <= MAX_RALLY)
check('an empty army brings nothing', armyEffects(EMPTY_ARMY).briefing.length === 0 && armyEffects(EMPTY_ARMY).eloLossCap === null)
const tricksters = ['tutankhamun', 'cleopatra', 'trickster'].filter((id) => getClassic(id)?.archetype === 'trickster')
if (tricksters[0]) check('takebacks never exceed the cap', armyEffects({ king: tricksters[0], queen: null, rook: null, bishop: null, knight: null }).takebacks <= MAX_TAKEBACKS)
check('armies are sanitised (unknown and duplicate ids dropped)', JSON.stringify(sanitizeArmy({ king: 'napoleon', queen: 'napoleon', rook: 'nobody', bishop: 7 })) === JSON.stringify({ ...EMPTY_ARMY, king: 'napoleon' }))

// ── World War ───────────────────────────────────────────────────────────────
check('21 territories, every defender a Classic character', TERRITORIES.length === 21 && TERRITORIES.every((t) => getClassic(t.defender) !== null))
check('the map’s borders go both ways', TERRITORIES.every((t) => t.neighbors.every((n) => getTerritory(n)?.neighbors.includes(t.id))))
check('every territory can be reached from every other', (() => {
  const seen = new Set(['greece'])
  const queue = ['greece']
  while (queue.length) {
    for (const n of getTerritory(queue.shift()!)!.neighbors) {
      if (seen.has(n)) continue
      seen.add(n)
      queue.push(n)
    }
  }
  return seen.size === TERRITORIES.length
})())
let war = startWar('greece', '2026-10-20')!
check('a war starts at your capital', war.owned.join() === 'greece' && startWar('atlantis', 'x') === null)
check('you may attack only across your borders', attackable(war).map((t) => t.id).sort().join() === 'anatolia,rome' && opponentFor(war, 'rome', 'attack') === 'julius-caesar' && opponentFor(war, 'japan', 'attack') === null)
let r = resolveBattle(war, 'rome', 'attack', true, never)
check('a victory conquers the territory and pays', r.state.owned.includes('rome') && r.coins === conquestCoins('rome') && r.state.turn === 1)
check('new borders open up', attackable(r.state).some((t) => t.id === 'carthage'))
const lost = resolveBattle(war, 'rome', 'attack', false, never)
check('a defeat takes nothing', lost.state.owned.join() === 'greece' && lost.coins === 0)
war = r.state
r = resolveBattle(war, 'anatolia', 'attack', true, always)
check('the empires strike back on your borders', Object.keys(r.state.sieges).length === 1 && r.events.some((e) => e.includes('marches on')))
check('your capital is never besieged', !(war.capital in r.state.sieges))
const siegedId = Object.keys(r.state.sieges)[0]!
check('a siege names who you must face', besieger(r.state, siegedId) !== null && opponentFor(r.state, siegedId, 'defend') !== null)
const held = resolveBattle(r.state, siegedId, 'defend', true, never)
check('breaking a siege keeps the territory', held.state.owned.includes(siegedId) && !(siegedId in held.state.sieges) && held.coins > 0)
const fell = resolveBattle(r.state, siegedId, 'defend', false, never)
check('losing the defence loses the territory', !fell.state.owned.includes(siegedId))
let ignored = r.state
for (let i = 0; i < SIEGE_TURNS; i++) ignored = resolveBattle(ignored, 'carthage', 'attack', false, never).state
check(`a siege ignored for ${SIEGE_TURNS} battles takes the province`, !ignored.owned.includes(siegedId))
// One empire falls.
let med = startWar('greece', 'x')!
med = resolveBattle(med, 'rome', 'attack', true, never).state
med = resolveBattle(med, 'anatolia', 'attack', true, never).state
const medFall = resolveBattle(med, 'carthage', 'attack', true, never)
med = medFall.state
check('conquering an empire’s last territory topples it and pays a bonus', med.owned.length === 4 && medFall.factionFallen === 'med' && medFall.coins === conquestCoins('carthage') + FACTION_COINS)
const nearly = { ...startWar('greece', 'x')!, owned: TERRITORIES.map((t) => t.id).filter((id) => id !== 'japan') }
const done = resolveBattle(nearly, 'japan', 'attack', true, never)
check('taking the last territory wins the war', done.warWon && done.state.won && done.coins >= VICTORY_COINS + FACTION_COINS)
check('a won war accepts no more battles', resolveBattle(done.state, 'japan', 'attack', true, never).events.length === 0)
const dirty = sanitizeWar({ capital: 'greece', owned: ['rome', 'rome', 'atlantis'], sieges: { rome: { faction: 'east', turns: 9 }, greece: { faction: 'east', turns: 1 }, japan: { faction: 'x', turns: 1 } }, log: [{ turn: 1, text: 'hi' }, 'bad'], turn: -3 })
check('war state is sanitised', dirty !== null && dirty.owned.join() === 'greece,rome' && Object.keys(dirty.sieges).join() === 'rome' && dirty.sieges.rome?.turns === SIEGE_TURNS && dirty.turn === 0 && dirty.log.length === 1)
check('a profile round-trips its memory, army and war', (() => {
  const p = { ...createDefaultProfile(), memory: book, army: { ...EMPTY_ARMY, king: 'napoleon' }, war: med }
  const back = sanitizeProfile(JSON.parse(JSON.stringify(p)))
  return back.army.king === 'napoleon' && back.war?.owned.length === 4 && back.memory['classic:napoleon']?.games === 4
})())

console.log(failures === 0 ? '\nAll conquest checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
