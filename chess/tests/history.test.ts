// Tests for Phase A, history: Play the Real Battle (positions, reinforcements,
// objectives, feats), Character Interviews, the Personal Timeline, the
// history quiz and historical rivals. Run with `npm run test:history`.
import { Chess } from 'chess.js'
import { BATTLES } from '../src/data/battles'
import { QUESTIONS, interviewAnswer } from '../src/data/classic/interview'
import { loreFor } from '../src/data/classic/lore'
import { buildQuiz, postGameQuiz, questionFor, revealsName, rng } from '../src/data/classic/quiz'
import { RIVALRIES, rivalLines, rivalryOf } from '../src/data/classic/rivals'
import { CLASSIC_ROSTER, getClassic } from '../src/data/classic/roster'
import { parseLived, timelinePosition } from '../src/data/classic/years'
import { classicPersona } from '../src/data/personas'
import { createDefaultProfile, sanitizeProfile } from '../src/stores/profileStore'
import { recordBattleResult, recordInterview, recordQuiz } from '../src/utils/feats'
import { applyMatch } from '../src/utils/progression'
import { type BattleRules, VariantGame } from '../src/variants/rules'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── Battles: positions ──────────────────────────────────────────────────────
for (const b of BATTLES) {
  let legal = true
  try {
    new Chess(b.setup.fen)
  } catch {
    legal = false
  }
  const g = VariantGame.battleGame(b.setup)
  check(`${b.name}: the starting position is legal and playable`, legal && g.result === null && g.legalMoves().length > 0)
  const kings = b.setup.fen.split(' ')[0]!.replace(/[^kK]/g, '')
  check(`${b.name}: one king a side`, kings.split('').sort().join('') === 'Kk')
  for (const side of ['w', 'b'] as const) {
    const id = b.sides[side].commander
    check(`${b.name}: ${side === 'w' ? 'White' : 'Black'} commander exists`, id === null || getClassic(id) !== null, id ?? 'none')
  }
}

// ── Battles: reinforcements ─────────────────────────────────────────────────
const custom: BattleRules = {
  fen: 'k7/7p/8/8/8/8/PPP5/K7 w - - 0 1',
  objective: { kind: 'survive', side: 'b', until: 30 },
  events: [
    {
      id: 'test',
      move: 2,
      color: 'w',
      pieces: [
        { square: 'a5', type: 'q' }, // would check the black king: refused
        { square: 'h1', type: 'r' }, // fine
        { square: 'a2', type: 'n' }, // occupied: skipped
      ],
      text: 'test',
    },
  ],
}
const r = VariantGame.battleGame(custom)
r.play('b2b3')
check('reinforcements wait for their move', r.fired.length === 0)
r.play('h7h6')
const board = new Chess(r.fen)
check('reinforcements arrive on time', r.fired.includes('test') && board.get('h1')?.type === 'r')
check('a reinforcement never lands on an occupied square', board.get('a2')?.type === 'p')
check('a reinforcement never leaves the waiting side in check', !board.get('a5') && !new Chess(r.fen).inCheck())
check('it is still White to move after reinforcements', r.turn === 'w' && r.moveNumber === 2)
r.play('c2c3')
r.play('h6h5')
check('reinforcements arrive once', r.fired.length === 1)

// Play every battle out with a seeded random mover; every game must end within its deadline.
const deadline = (rules: BattleRules): number => (rules.objective.kind === 'survive' ? rules.objective.until : rules.objective.kind === 'win-by' ? rules.objective.by : rules.objective.at)
for (const b of BATTLES) {
  let allEnded = true
  let firedSomewhere = false
  const reasons = new Set<string>()
  for (let seed = 1; seed <= 12; seed++) {
    const rand = rng(seed * 977)
    const g = VariantGame.battleGame(b.setup)
    while (!g.result && g.moveNumber <= deadline(b.setup) + 1) {
      const moves = g.legalMoves()
      const m = moves[Math.floor(rand() * moves.length)]
      if (!m) break
      g.play(m)
    }
    if (!g.result) allEnded = false
    else reasons.add(g.result.reason)
    if (g.fired.length > 0) firedSomewhere = true
  }
  check(`${b.name}: every game ends by its deadline`, allEnded, [...reasons].join(', '))
  check(`${b.name}: its reinforcements arrive in play`, firedSomewhere)
}

// Objectives, directly.
const hold = VariantGame.battleGame({ fen: '7k/8/8/8/8/8/P6P/K7 w - - 0 1', objective: { kind: 'survive', side: 'w', until: 1 }, events: [] })
hold.play('a2a3')
hold.play('h8g8')
check('holding to the deadline wins for the defender', hold.result?.winner === 'w' && hold.result.reason === 'held')
const failed = VariantGame.battleGame({ fen: '7k/7p/8/8/8/8/P7/K7 w - - 0 1', objective: { kind: 'win-by', side: 'w', by: 1 }, events: [] })
failed.play('a2a3')
failed.play('h7h6')
check('an attack that runs out of time loses', failed.result?.winner === 'b' && failed.result.reason === 'attack-failed')
const field = VariantGame.battleGame({ fen: '7k/7p/8/8/8/8/PP6/K7 w - - 0 1', objective: { kind: 'material', at: 1 }, events: [] })
field.play('a2a3')
field.play('h7h6')
check('after the last move, material decides the field', field.result?.winner === 'w' && field.result.reason === 'field')

// ── Battles: feats ──────────────────────────────────────────────────────────
let p = createDefaultProfile()
let out = recordBattleResult(p, 'thermopylae', 'w', true)
check('holding Thermopylae unlocks Hold the Pass and Rewrite History', out.unlocked.some((a) => a.id === 'hold-the-pass') && out.unlocked.some((a) => a.id === 'rewrite-history'))
p = out.profile
out = recordBattleResult(p, 'waterloo', 'w', true)
check('winning Waterloo as history did is not rewriting it', out.unlocked.some((a) => a.id === 'near-run-thing') && !out.unlocked.some((a) => a.id === 'rewrite-history'))
check('battles won are stored once each', out.profile.feats.battlesWon.join() === 'thermopylae:w,waterloo:w')
check('a lost battle changes nothing', recordBattleResult(p, 'cannae', 'w', false).profile === p)

// ── Timeline years ──────────────────────────────────────────────────────────
const unparsed = CLASSIC_ROSTER.filter((c) => parseLived(loreFor(c.id)?.lived ?? '') === null)
check('every Classic character has a year on the timeline', unparsed.length === 0, unparsed.map((c) => c.id).join(', '))
check('BCE ranges read as BCE', parseLived('100 – 44 BCE')?.from === -100 && parseLived('100 – 44 BCE')?.to === -44)
check('a range across the eras', parseLived('63 BCE – 14 CE')?.from === -63 && parseLived('63 BCE – 14 CE')?.to === 14)
check('centuries', parseLived('9th century (historicity uncertain)')?.year === 850 && parseLived('traditionally 6th – 5th century BCE')?.year === -500)
check('unknown ends', parseLived('c. 1697 – unknown')?.year === 1697 && parseLived('birth unknown – 71 BCE')?.year === -71)
check('Sargon comes first and Fischer last', (() => {
  const years = CLASSIC_ROSTER.map((c) => ({ id: c.id, y: parseLived(loreFor(c.id)?.lived ?? '')?.year ?? 0 })).sort((a, b) => a.y - b.y)
  return years[0]?.id === 'sargon' && years[years.length - 1]?.id === 'fischer'
})())
const positions = [-2300, -500, 0, 1000, 1500, 1850, 1990].map(timelinePosition)
check('the timeline scale runs one way, inside 0–1', positions.every((x, i) => x > 0 && x < 1 && (i === 0 || x > positions[i - 1]!)))

// ── Interviews ──────────────────────────────────────────────────────────────
const empty = CLASSIC_ROSTER.flatMap((c) => QUESTIONS.filter((q) => interviewAnswer(c, q.id, 3).text.trim().length < 10).map((q) => `${c.id}/${q.id}`))
check('every character answers every question', empty.length === 0, empty.slice(0, 5).join(', '))
const napoleon = getClassic('napoleon')!
check('the factual answers come from the lore', interviewAnswer(napoleon, 'secret', 0).factual && loreFor('napoleon')!.facts.some((f) => interviewAnswer(napoleon, 'secret', 0).text.includes(f)))
check('a rival question names the historical rival', interviewAnswer(napoleon, 'rival', 0).text.startsWith('The Duke of Wellington'))
check('imagined answers are marked as such', !interviewAnswer(napoleon, 'today', 0).factual && !interviewAnswer(napoleon, 'advice', 0).factual)
let ip = recordInterview(createDefaultProfile(), 'napoleon')
check('the first interview unlocks On the Record', ip.unlocked.some((a) => a.id === 'first-interview'))
check('the same character counts once', recordInterview(ip.profile, 'napoleon').profile === ip.profile)
for (const c of CLASSIC_ROSTER.slice(0, 10)) ip = recordInterview(ip.profile, c.id)
check('ten characters interviewed unlocks Press Corps', ip.profile.feats.interviewed.length === 11 && ip.profile.achievements['press-corps'] !== undefined)

// ── Quiz ────────────────────────────────────────────────────────────────────
let fair = true
let leaks: string[] = []
for (let seed = 1; seed <= 40; seed++) {
  for (const q of buildQuiz(CLASSIC_ROSTER, 5, seed)) {
    const c = getClassic(q.about)!
    const ok = q.options.length === 4 && new Set(q.options).size === 4 && q.answer >= 0 && q.answer < 4
    const right = q.kind === 'lived' ? q.options[q.answer] === loreFor(c.id)?.lived : q.options[q.answer] === c.name
    if (!ok || !right) fair = false
    if (q.kind !== 'lived' && revealsName(q.clue, c)) leaks.push(`${c.id}: ${q.clue}`)
  }
}
check('quiz questions have four different options and the right answer', fair)
check('a clue never gives the name away', leaks.length === 0, leaks.slice(0, 2).join(' | '))
check('"Who is this?" clues are true facts from the lore', (() => {
  const q = questionFor(napoleon, 'fact', rng(5))
  return q !== null && loreFor('napoleon')!.facts.includes(q.clue)
})())
check('the name filter catches surnames and accents', revealsName('Bonaparte crossed the Alps.', napoleon) && revealsName('Raúl played fast.', getClassic('capablanca')!) && !revealsName('He played fast.', getClassic('capablanca')!))
check('a quiz is the same for the same seed', JSON.stringify(buildQuiz(CLASSIC_ROSTER, 5, 9)) === JSON.stringify(buildQuiz(CLASSIC_ROSTER, 5, 9)))
const pg = postGameQuiz(napoleon, CLASSIC_ROSTER.slice(0, 20), 7)
check('the post-game quiz starts with the opponent you beat', pg.length === 3 && pg[0]?.about === 'napoleon' && pg.slice(1).every((q) => q.about !== 'napoleon'))
let qp = recordQuiz(createDefaultProfile(), 5, 5)
check('a perfect quiz pays 25 coins and unlocks Perfect Recall', qp.coins === 25 && qp.profile.coins >= createDefaultProfile().coins + 25 && qp.unlocked.some((a) => a.id === 'perfect-recall'))
for (let i = 0; i < 10; i++) qp = recordQuiz(qp.profile, 5, 5)
check('fifty right answers make a Historian', qp.profile.feats.quizCorrect === 55 && qp.profile.achievements.historian !== undefined)

// ── Rivals ──────────────────────────────────────────────────────────────────
check('every rival is in the roster, with lines for both', RIVALRIES.every((x) => getClassic(x.a) && getClassic(x.b) && x.lines[x.a] && x.lines[x.b]))
check('rivalries work both ways', rivalryOf('wellington', 'napoleon') === rivalryOf('napoleon', 'wellington') && rivalryOf('napoleon', 'tesla') === null)
const facing = classicPersona(napoleon, 'wellington')
check('facing a rival changes the greeting and the farewells', facing.quotes.intro[0] === rivalLines('napoleon', 'wellington')?.intro && facing.quotes.legendLoses[0] === rivalLines('napoleon', 'wellington')?.defeat)
check('without the rival, the usual lines', classicPersona(napoleon, 'tesla').quotes.intro[0] === napoleon.line && classicPersona(napoleon).quotes.intro[0] === napoleon.line)

// ── The museum record ───────────────────────────────────────────────────────
const winInput = {
  mode: 'ai' as const, opponent: napoleon.name, difficulty: 'expert' as const, personality: null, humanColor: 'w' as const,
  result: { kind: 'resign' as const, winner: 'w' as const }, pgn: '', history: [], timeControl: { id: 'none', label: '-', category: 'none' as const, initialMs: 0, incrementMs: 0 },
  rated: false, opening: null, opponentElo: napoleon.elo, classicId: napoleon.id,
}
const won = applyMatch(createDefaultProfile(), winInput)
check('a Classic win raises a statue in the museum', won.profile.feats.classicBeaten.join() === 'napoleon')
check('a Classic loss does not', applyMatch(createDefaultProfile(), { ...winInput, result: { kind: 'resign' as const, winner: 'b' as const } }).profile.feats.classicBeaten.length === 0)
const stored = sanitizeProfile(JSON.parse(JSON.stringify({ ...won.profile, feats: { ...won.profile.feats, classicBeaten: ['napoleon', 'BAD ID', 'napoleon'], quizCorrect: -4 } })))
check('museum and quiz records are sanitised', stored.feats.classicBeaten.join() === 'napoleon' && stored.feats.quizCorrect === 0)

console.log(failures === 0 ? '\nAll history checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
