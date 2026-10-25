// Tests for the Journey: levels and prestige, seasons and the pass, weekly
// leagues, the skill tree, rewards, bonds, the nemesis, collections, story,
// remarks, the daily chest, the rotating shop and the save sanitiser.
// Run with `npm run test:journey`.
import { Chess } from 'chess.js'
import { CLASSIC_ROSTER, getClassic } from '../src/data/classic/roster'
import { loreFor } from '../src/data/classic/lore'
import { seededRandom } from '../src/data/spells'
import { remember } from '../src/memory/memory'
import { createDefaultProfile } from '../src/stores/profileStore'
import { BOND_LEVELS, bondGift, bondLevel, bondStories, collectionReward, collections, nextBond, pendingGifts, pickNemesis, rarityFor } from '../src/journey/characters'
import { CHEST_TABLE, FOUNDERS_PACK, buyOffer, dailyOffers, openChest, rollChest, streakBonus } from '../src/journey/economy'
import { frameDef, isFrameId, seasonFrame } from '../src/journey/cosmetics'
import { LEAGUE_SIZE, moveFor, nextTier, rivals, settleWeek, standings, weekKey, weekProgress } from '../src/journey/league'
import { applyActivity, canPrestige, prestigeUp, rollover } from '../src/journey/progress'
import { formIntro, shapeOf, styleRemark } from '../src/journey/remarks'
import { grantRewards } from '../src/journey/rewards'
import { PASS_TIERS, SEASON_DAYS, SEASON_THEMES, XP_PER_TIER, passReward, seasonFor, tiersReached } from '../src/journey/season'
import { SKILLS, canLearn, skillEffects, skillPoints } from '../src/journey/skills'
import { createJourney, sanitizeJourney } from '../src/journey/state'
import { CHAPTERS, chapterOpen, chapterReward, nextChapter } from '../src/journey/story'
import { MAX_LEVEL, baseXp, levelInfo, levelTitle, roman, xpForLevel, xpToNext } from '../src/journey/xp'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── Levels ──────────────────────────────────────────────────────────────────
check('level 1 at 0 XP, level 2 after 100', levelInfo(0).level === 1 && levelInfo(99).level === 1 && levelInfo(100).level === 2)
check('each level needs 20 XP more than the last', xpToNext(1) === 100 && xpToNext(2) === 120 && xpToNext(10) === 280)
check('xpForLevel adds up the steps', xpForLevel(3) === 220 && levelInfo(xpForLevel(12)).level === 12)
check('level 50 is the top', levelInfo(10_000_000).level === MAX_LEVEL && levelInfo(10_000_000).maxed)
check('level titles: Strategist at 5, Emperor at 35, Lord of Time at 50', levelTitle(5).name === 'Strategist' && levelTitle(37).name === 'Emperor' && levelTitle(50).name === 'Lord of Time')
check('a win is worth more than a loss; a stronger opponent more again', baseXp({ outcome: 'win' }) > baseXp({ outcome: 'loss' }) && baseXp({ outcome: 'win', elo: 1200, opponentElo: 1500 }) > baseXp({ outcome: 'win', elo: 1200, opponentElo: 1200 }))
check('the first win of the day pays a bonus', baseXp({ outcome: 'win', firstOfDay: true }) === baseXp({ outcome: 'win' }) + 50)
check('roman numerals', roman(1) === 'I' && roman(4) === 'IV' && roman(9) === 'IX' && roman(10) === 'X')

// ── Seasons ─────────────────────────────────────────────────────────────────
const s1 = seasonFor(new Date(2026, 0, 5))
const s1end = seasonFor(new Date(2026, 1, 15))
const s2 = seasonFor(new Date(2026, 1, 16))
check('season 1 starts 5 Jan 2026 and lasts six weeks', s1.number === 1 && s1.daysLeft === SEASON_DAYS && s1end.number === 1 && s1end.daysLeft === 1 && s2.number === 2)
check('seasons rotate through the themes', s1.theme.id === SEASON_THEMES[0]!.id && s2.theme.id === SEASON_THEMES[1]!.id)
check('pass tiers from season XP', tiersReached(0) === 0 && tiersReached(XP_PER_TIER * 3 + 10) === 3 && tiersReached(1e9) === PASS_TIERS)
check('pass: frame at 10, aura at 20, title at 30', passReward(0, 10).kind === 'frame' && passReward(0, 20).kind === 'aura' && passReward(0, 30).kind === 'title')
check('every pass tier has a reward', Array.from({ length: PASS_TIERS }, (_, i) => passReward(3, i + 1)).every((r) => r !== null))
check('season frames resolve', seasonFrame(4).id === 'season-4' && isFrameId('season-4') && frameDef('season-12')?.name.includes('Frame') === true)

// ── Leagues ─────────────────────────────────────────────────────────────────
const monday = weekKey(new Date(2026, 9, 21))
check('weeks start on Monday', monday === '2026-10-19' && weekKey(new Date(2026, 9, 25)) === '2026-10-19' && weekKey(new Date(2026, 9, 26)) === '2026-10-26')
check('week progress runs 0 → 1', weekProgress(new Date(2026, 9, 19, 0, 0)) === 0 && weekProgress(new Date(2026, 9, 22, 12)) === 0.5)
const r1 = rivals('2026-10-19', 'gold')
check('19 rivals, the same all week, drawn from the Classic characters', r1.length === LEAGUE_SIZE - 1 && JSON.stringify(r1) === JSON.stringify(rivals('2026-10-19', 'gold')) && r1.every((r) => getClassic(r.classicId)))
const table = standings('2026-10-19', 'bronze', 5000, 'Tester', 1)
check('a huge week puts you top of the table', table.length === LEAGUE_SIZE && table[0]?.you === true)
check('top five go up, bottom five down (not past the ends)', moveFor('silver', 3) === 'up' && moveFor('silver', 18) === 'down' && moveFor('diamond', 1) === 'stay' && moveFor('bronze', 20) === 'stay')
check('tiers step one at a time', nextTier('bronze', 'up') === 'silver' && nextTier('gold', 'down') === 'silver')
const settled = settleWeek('2026-10-19', 'bronze', 5000, 'Tester')
check('settling a big week: first place, promoted, paid', settled.rank === 1 && settled.move === 'up' && settled.coins > 0)
check('a week you did not play keeps your league', settleWeek('2026-10-19', 'gold', 0, 'T').move === 'stay')

// ── Rollover & activity ─────────────────────────────────────────────────────
const fresh = createJourney()
const rolled = rollover(fresh, 'Tester', new Date(2026, 9, 21))
check('the first rollover just starts this week and season', rolled.league === null && rolled.seasonEnded === null && rolled.journey.league.week === '2026-10-19' && rolled.journey.season.index === seasonFor(new Date(2026, 9, 21)).index)
const played = applyActivity(rolled.journey, { outcome: 'win', game: true, coins: 100 }, new Date(2026, 9, 21))
check('a win books XP, season XP and league points', played.xp > 0 && played.journey.xp === played.xp && played.journey.season.xp === played.xp && played.journey.league.points === played.leaguePoints)
check('the first win of the day is flagged once', played.firstOfDay && !applyActivity(played.journey, { outcome: 'win', game: true }, new Date(2026, 9, 21)).firstOfDay)
const withSkills = { ...played.journey, skills: ['purse-1', 'quick-study'] }
const boosted = applyActivity(withSkills, { outcome: 'loss', coins: 100 }, new Date(2026, 9, 21))
check('skills add coins and XP', boosted.bonusCoins === 5 && boosted.xp === Math.round(baseXp({ outcome: 'loss' }) * 1.1))
const nextWeek = rollover({ ...played.journey, league: { ...played.journey.league, points: 9000 } }, 'Tester', new Date(2026, 9, 28))
check('a new week settles the old one and promotes', nextWeek.league?.move === 'up' && nextWeek.journey.league.tier === 'silver' && nextWeek.journey.league.points === 0 && nextWeek.coins > 0 && nextWeek.journey.leagueHistory.length === 1)
const nextSeason = rollover(played.journey, 'Tester', new Date(2027, 0, 30))
check('a new season records the old one and starts the pass over', nextSeason.seasonEnded !== null && nextSeason.journey.season.xp === 0 && nextSeason.journey.seasonHistory.length === 1)
const maxed = { ...createJourney(), xp: xpForLevel(MAX_LEVEL) }
check('prestige at level 50: back to 1, crown frame, skills refunded', canPrestige(maxed) && prestigeUp({ ...maxed, skills: ['purse-1'] })?.prestige === 1 && prestigeUp(maxed)?.xp === 0 && prestigeUp({ ...maxed, skills: ['purse-1'] })?.skills.length === 0 && prestigeUp(maxed)?.frames.includes('prestige-crown') === true)
check('no prestige before level 50', !canPrestige(createJourney()) && prestigeUp(createJourney()) === null)

// ── Skills ──────────────────────────────────────────────────────────────────
check('skill points: one a level after the first, five a prestige', skillPoints(1, 0) === 0 && skillPoints(10, 0) === 9 && skillPoints(1, 2) === 10)
check('a skill needs the one before it', !canLearn([], 'purse-2', 10).ok && canLearn(['purse-1'], 'purse-2', 10).ok)
check('a skill needs enough points', !canLearn([], 'purse-1', 0).ok && canLearn([], 'purse-1', 1).ok)
check('effects add up', skillEffects(['purse-1', 'purse-2', 'steady-hand', 'kindred']).coinBonus === 15 && skillEffects(['steady-hand']).campaignUndos === 1 && skillEffects(['quick-study', 'kindred']).bondFactor === 2)
check('every branch has four tiers', ['treasury', 'war', 'library'].every((b) => [1, 2, 3, 4].every((t) => SKILLS.some((s) => s.branch === b && s.tier === t))))

// ── Rewards ─────────────────────────────────────────────────────────────────
const p0 = createDefaultProfile()
const g1 = grantRewards(p0, createJourney(), [{ kind: 'coins', amount: 50 }, { kind: 'frame', id: 'bronze-ring' }, { kind: 'potion', id: 'ward-tonic', count: 1 }, { kind: 'title', id: 't1', name: 'Tester' }])
check('rewards pay coins, frames, potions and titles', g1.profile.coins === p0.coins + 50 && g1.journey.frames.includes('bronze-ring') && (g1.profile.inventory.potions['ward-tonic'] ?? 0) >= 1 && g1.journey.titles.length === 1)
const g2 = grantRewards(g1.profile, g1.journey, [{ kind: 'frame', id: 'bronze-ring' }, { kind: 'theme', id: 'royal-gold' }])
check('something you own pays 150 coins instead', g2.profile.coins === g1.profile.coins + 150 && g2.profile.unlockedThemes.includes('royal-gold'))

// ── Characters ──────────────────────────────────────────────────────────────
check('bond levels grow with games', bondLevel(0) === 0 && bondLevel(1) === 1 && bondLevel(6) === 3 && bondLevel(15) === 5 && bondLevel(8, 2) === 5)
check('next bond: games still needed', nextBond(4)?.level.level === 3 && nextBond(4)?.gamesLeft === 2 && nextBond(99) === null && BOND_LEVELS.length === 5)
const cleo = getClassic('cleopatra')!
check('bond stories: the bio first, then a fact per level', bondStories(cleo, loreFor('cleopatra'), 1).length === 1 && bondStories(cleo, loreFor('cleopatra'), 4).length === 4 && bondStories(cleo, loreFor('cleopatra'), 5).length === 5)
check('gifts at bond levels 3 and 5', bondGift(cleo, 3).length > 0 && bondGift(cleo, 5).some((r) => r.kind === 'title') && bondGift(cleo, 2).length === 0)
let mem = {}
for (let i = 0; i < 6; i++) mem = remember(mem, 'classic:cleopatra', i === 0 ? 'win' : 'loss', null, `2026-10-0${i + 1}`)
check('a pending gift at bond level 3', pendingGifts(mem, {}).some((g) => g.character.id === 'cleopatra' && g.level === 3) && pendingGifts(mem, { cleopatra: 3 }).length === 0)
check('the nemesis: who beats you most and is still ahead', pickNemesis(mem, []) === 'classic:cleopatra' && pickNemesis(mem, ['classic:cleopatra']) === null)
const even = remember(remember(remember(remember({}, 'classic:sargon', 'loss', null, 'a'), 'classic:sargon', 'loss', null, 'b'), 'classic:sargon', 'win', null, 'c'), 'classic:sargon', 'win', null, 'd')
check('no nemesis while you are level with them', pickNemesis(even, []) === null)
check('card rarity by rating', rarityFor(700) === 'common' && rarityFor(1500) === 'rare' && rarityFor(2000) === 'epic' && rarityFor(2600) === 'legendary')
const ancient = new Set(CLASSIC_ROSTER.filter((c) => c.era === 'ancient').map((c) => c.id))
check('an era collection completes with all ten', collections(ancient).find((c) => c.era === 'ancient')?.complete === true && collections(new Set()).every((c) => c.owned === 0 && c.total === 10))
check('a collection pays coins, the board and the pieces', collectionReward('ancient').length === 3)

// ── Story ───────────────────────────────────────────────────────────────────
check('eleven chapters, each with a scene before and after', CHAPTERS.length === 11 && CHAPTERS.every((c) => c.intro.length > 0 && c.outro.length > 0))
check('chapter opponents exist', CHAPTERS.every((c) => c.opponent === 'ghost' || getClassic(c.opponent.classic) !== null))
check('every speaker exists', CHAPTERS.every((c) => [...c.intro, ...c.outro].every((p) => typeof p.speaker === 'string' || getClassic(p.speaker.classic) !== null)))
check('chapters open in order', chapterOpen(0, []) && !chapterOpen(3, [0, 1]) && chapterOpen(2, [0, 1]) && nextChapter([0, 1])?.index === 2 && nextChapter(CHAPTERS.map((c) => c.index)) === null)
check('the finale gives the Keeper’s Ring', chapterReward(10).some((r) => r.kind === 'frame' && r.id === 'story-ring') && isFrameId('story-ring'))

// ── Remarks ─────────────────────────────────────────────────────────────────
const quick = new Chess()
for (const m of ['f3', 'e5', 'g4', 'Qh4#']) quick.move(m)
const fools = shapeOf(quick.history({ verbose: true }), 'b', 'win', { kind: 'checkmate', winner: 'b' })
check('a quick mate is noticed', fools.plies === 4 && styleRemark(fools, 1) !== null)
check('a win on time gets a clock line', styleRemark({ ...fools, result: 'timeout', plies: 80 }, 2)?.toLowerCase().includes('clock') === true || styleRemark({ ...fools, result: 'timeout', plies: 80 }, 3)?.toLowerCase().includes('time') === true)
check('an ordinary game says nothing special', styleRemark({ plies: 70, outcome: 'draw', result: 'draw', deficit: 0, promoted: false, checks: 1 }, 1) === null)
check('form: a winning streak gets noticed', formIntro(4, 0, 1)?.includes('4') === true && formIntro(0, 0, 1) === null)

// ── Economy ─────────────────────────────────────────────────────────────────
check('the chest odds add up to 100%', CHEST_TABLE.reduce((n, p) => n + p.chance, 0) === 100)
const rolls = Array.from({ length: 4000 }, (_, i) => rollChest(seededRandom(i + 1)).id)
const share = (id: string) => rolls.filter((r) => r === id).length / rolls.length
check('rolled prizes follow the table', Math.abs(share('coins-100') - 0.4) < 0.04 && Math.abs(share('coins-200') - 0.25) < 0.04 && share('jackpot') < 0.03)
const opened = openChest(createJourney(), '2026-10-21', 0, seededRandom(3))
check('one chest a day', opened !== null && openChest(opened.journey, '2026-10-21', 0, seededRandom(4)) === null)
const day2 = openChest(opened!.journey, '2026-10-22', 0, seededRandom(5))
check('consecutive days build a streak bonus', day2?.streak === 2 && streakBonus(2) === 10 && streakBonus(30) === 100 && openChest(day2!.journey, '2026-10-25', 0, seededRandom(6))?.streak === 1)
check('the shop offers four items a day, the same for everyone', dailyOffers('2026-10-21').length === 4 && JSON.stringify(dailyOffers('2026-10-21').map((o) => o.id)) === JSON.stringify(dailyOffers('2026-10-21').map((o) => o.id)))
const offer = dailyOffers('2026-10-21')[0]!
const rich = { ...createDefaultProfile(), coins: 5000 }
const bought = buyOffer(rich, createJourney(), '2026-10-21', offer.id)
check('buying takes the coins', bought.ok && bought.profile.coins === 5000 - offer.price)
check('you can’t buy an offer that isn’t in today’s shop', !buyOffer(rich, createJourney(), '2026-10-21', 'no-such-offer').ok)
check('the Founders Pack has a frame, aura, title and coins', FOUNDERS_PACK.length === 4)

// ── Sanitiser ───────────────────────────────────────────────────────────────
check('garbage loads as a fresh journey', JSON.stringify(sanitizeJourney('nope')) === JSON.stringify(createJourney()) && JSON.stringify(sanitizeJourney(null)) === JSON.stringify(createJourney()))
const roundTrip = sanitizeJourney(JSON.parse(JSON.stringify({ ...played.journey, frames: ['bronze-ring', 'not-a-frame'], frame: 'not-a-frame', skills: ['purse-1', 'fake'] })))
check('unknown frames and skills are dropped; a frame you don’t own is not worn', roundTrip.frames.length === 1 && roundTrip.frame === null && roundTrip.skills.length === 1)
check('a valid save survives a round trip', JSON.stringify(sanitizeJourney(JSON.parse(JSON.stringify(played.journey)))) === JSON.stringify(played.journey))

if (failures > 0) {
  console.error(`\n${failures} journey test(s) failed`)
  process.exit(1)
}
console.log('\nAll journey tests passed.')
