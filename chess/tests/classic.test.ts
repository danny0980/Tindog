// Tests for Classic Chess (100 historical opponents, pure chess) and the
// "smart but winnable" difficulty curve (shallow search + blunder guard).
// Run with `npm run test:classic`.
import { DIFFICULTY_CONFIGS, standardOpponent } from '../src/constants/game'
import { ARCHETYPES, strengthForElo } from '../src/data/campaign/archetypes'
import { BOOKS } from '../src/data/campaign/books'
import chronicle from '../src/data/campaign/rosters/chronicle'
import discovery from '../src/data/campaign/rosters/discovery'
import { CLASSIC_ERAS, CLASSIC_ROSTER, getClassic } from '../src/data/classic/roster'
import { classicPersona } from '../src/data/personas'
import { blunderGuard, chooseMove } from '../src/engine/personalities'
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/stores/settingsStore'
import type { SearchResult } from '../src/types/engine'
import type { QuoteTrigger } from '../src/types/legend'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── Roster ──────────────────────────────────────────────────────────────────
check('100 classic opponents', CLASSIC_ROSTER.length === 100)
check('ids and names are unique', new Set(CLASSIC_ROSTER.map((c) => c.id)).size === 100 && new Set(CLASSIC_ROSTER.map((c) => c.name)).size === 100)
check('ten eras of ten', CLASSIC_ERAS.length === 10 && CLASSIC_ERAS.every((e) => CLASSIC_ROSTER.filter((c) => c.era === e.id).length === 10))
check('one rating ladder, ~600 → 2760', CLASSIC_ROSTER.every((c, i) => i === 0 || c.elo > (CLASSIC_ROSTER[i - 1]?.elo ?? 0)) && CLASSIC_ROSTER[0]?.elo === 600 && CLASSIC_ROSTER[99]?.elo === 2760)
check('every style and opening book exists', CLASSIC_ROSTER.every((c) => ARCHETYPES[c.archetype] && BOOKS[c.book]))
const campaignNames = new Map([...chronicle, ...discovery].map((b) => [b.id.split('.')[1] ?? '', b.name]))
const mismatched = CLASSIC_ROSTER.filter((c) => campaignNames.has(c.id) && campaignNames.get(c.id) !== c.name)
check('characters shared with the campaign keep the same name (same portrait art)', mismatched.length === 0, mismatched.map((c) => c.id).join(', '))
check('getClassic finds by id', getClassic('capablanca')?.name === 'José Raúl Capablanca' && getClassic('nobody') === null)

// ── Pure chess personas ─────────────────────────────────────────────────────
const TRIGGERS: QuoteTrigger[] = ['intro', 'thinking', 'playerSlow', 'legendCapture', 'playerCapture', 'checkGiven', 'inCheck', 'advantage', 'disadvantage', 'legendWins', 'legendLoses', 'draw']
const personas = CLASSIC_ROSTER.map(classicPersona)
check('classic opponents cast no spells', personas.every((p) => p.spells.length === 0))
check('every classic opponent speaks on every trigger', personas.every((p) => TRIGGERS.every((t) => (p.quotes[t] ?? []).length > 0)))
check('every classic opponent has an opening book', personas.every((p) => (p.profile.repertoire?.w.length ?? 0) > 0 && (p.profile.repertoire?.b.length ?? 0) > 0))
check('every classic opponent is guarded against blunders', personas.every((p) => (p.profile.maxLossCp ?? 0) >= 55))
const first = personas[0]
const last = personas[99]
check('the first opponent is gentle: shallow search', Boolean(first && first.profile.depth <= 2 && first.difficulty === 'beginner'), `depth ${first?.profile.depth}`)
check('the last opponent plays at full strength', Boolean(last && last.profile.skillLevel === 20 && last.profile.depth >= 18 && last.difficulty === 'expert'))

// ── Difficulty curve ────────────────────────────────────────────────────────
const curve = [600, 800, 1100, 1400, 2000, 2600, 2800].map(strengthForElo)
check('depth, skill and guard tighten steadily with Elo', curve.every((s, i) => i === 0 || (s.depth >= (curve[i - 1]?.depth ?? 0) && s.skillLevel >= (curve[i - 1]?.skillLevel ?? 0) && s.maxLossCp <= (curve[i - 1]?.maxLossCp ?? 999))))
check('early levels are weak by depth, not by chaos', (curve[0]?.depth ?? 9) <= 2 && (curve[0]?.noise ?? 1) <= 0.5 && (curve[0]?.maxLossCp ?? 0) <= 150)
check('Quick Play Beginner is guarded too', DIFFICULTY_CONFIGS.beginner.maxLossCp <= 150 && standardOpponent('beginner', 'balanced').maxLossCp === DIFFICULTY_CONFIGS.beginner.maxLossCp)

// ── Blunder guard ───────────────────────────────────────────────────────────
// Weakened engine "best move" hangs a rook (−520 cp); sensible alternatives exist.
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'
const blunder: SearchResult = {
  bestMove: 'h1g1',
  lines: [
    { multipv: 1, depth: 3, score: { type: 'cp', value: 40 }, pv: ['f1b5'] },
    { multipv: 2, depth: 3, score: { type: 'cp', value: 25 }, pv: ['f1c4'] },
    { multipv: 3, depth: 3, score: { type: 'cp', value: -10 }, pv: ['d2d4'] },
    { multipv: 4, depth: 3, score: { type: 'cp', value: -480 }, pv: ['h1g1'] },
  ],
}
const weakBalanced = standardOpponent('beginner', 'balanced')
const weakStylish = classicPersona(CLASSIC_ROSTER[5] ?? CLASSIC_ROSTER[0]!).profile
let blunders = 0
let variety = new Set<string>()
for (let i = 0; i < 300; i++) {
  const a = chooseMove(FEN, blunder, weakBalanced)
  const b = chooseMove(FEN, blunder, weakStylish)
  if (a === 'h1g1' || b === 'h1g1') blunders += 1
  variety = new Set([...variety, b])
}
check('a weakened engine never plays the hanging move', blunders === 0, `${blunders}/300`)
check('…but still varies between sensible moves (beatable)', variety.size >= 2, [...variety].join(' '))
const fine: SearchResult = { ...blunder, bestMove: 'f1c4' }
check('a reasonable weaker pick is still allowed', chooseMove(FEN, fine, weakBalanced) === 'f1c4')
const mate: SearchResult = { bestMove: 'd2d4', lines: [{ multipv: 1, depth: 3, score: { type: 'mate', value: 1 }, pv: ['d1h5'] }, { multipv: 2, depth: 3, score: { type: 'cp', value: 30 }, pv: ['d2d4'] }] }
check('a mate in one is never passed up', chooseMove(FEN, mate, weakBalanced) === 'd1h5' && chooseMove(FEN, mate, weakStylish) === 'd1h5')
check('legacy profiles get a sensible default guard', blunderGuard({ toleranceCp: 400 }) === 170 && blunderGuard({ toleranceCp: 10 }) === 35)

// ── Settings ────────────────────────────────────────────────────────────────
const s = sanitizeSettings({ ...DEFAULT_SETTINGS, classicAvatar: 'morphy', legendsScreen: 'classic', game: { ...DEFAULT_SETTINGS.game, classicId: 'morphy' } })
check('Classic screen and avatar are remembered', s.classicAvatar === 'morphy' && s.legendsScreen === 'classic')
check('an unknown avatar is dropped; a classic game is not restored after reload', sanitizeSettings({ ...DEFAULT_SETTINGS, classicAvatar: 'nobody' }).classicAvatar === null && s.game.classicId === null)

console.log(failures === 0 ? '\nAll classic checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
