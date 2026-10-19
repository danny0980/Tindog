// Tests for the Opening School: every lesson line is legal and well-formed,
// and the lesson runner teaches as intended (hints, the reveal, replies, the
// finish, and the achievements). Run with `npm run test:openings`.
import { Chess } from 'chess.js'
import { getClassic } from '../src/data/classic/roster'
import { answer, playReply, replyDue, revealed, startLesson, studentToMove, tryMove } from '../src/openings/lessonRun'
import { LESSONS } from '../src/openings/lessons'
import { createDefaultProfile } from '../src/stores/profileStore'
import { recordLesson, recordOnlineResult, recordVariantResult } from '../src/utils/feats'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── The lessons ─────────────────────────────────────────────────────────────
check('ten or more lessons, with unique ids', LESSONS.length >= 10 && new Set(LESSONS.map((l) => l.id)).size === LESSONS.length)
const illegal: string[] = []
for (const lesson of LESSONS) {
  const chess = new Chess()
  for (const ply of lesson.line) {
    try {
      const m = chess.move(ply.san)
      if (m.san !== ply.san) illegal.push(`${lesson.id}: ${ply.san} is written ${m.san}`)
    } catch {
      illegal.push(`${lesson.id}: ${ply.san}`)
      break
    }
  }
}
check('every lesson line is legal, written in standard SAN', illegal.length === 0, illegal.join('; '))
const studentPlies = LESSONS.flatMap((l) => l.line.filter((_, i) => (i % 2 === 0 ? 'w' : 'b') === l.student))
check('every move the student plays has a hint', studentPlies.every((p) => (p.hint ?? '').length > 5))
check('the hint never gives the move away', studentPlies.every((p) => !(p.hint ?? '').includes(p.san)))
check('every move is explained', LESSONS.every((l) => l.line.every((p) => p.why.length > 10)))
check('lessons are short: 8–13 moves, with three key ideas', LESSONS.every((l) => l.line.length >= 8 && l.line.length <= 13 && l.ideas.length === 3))
check('every teacher is a Classic Chess master', LESSONS.every((l) => getClassic(l.teacher)?.era === 'masters'))
check('both colours are taught', LESSONS.some((l) => l.student === 'w') && LESSONS.some((l) => l.student === 'b'))

// ── Running a lesson ────────────────────────────────────────────────────────
const italian = LESSONS.find((l) => l.id === 'italian')!
let s = startLesson(italian)
check('a lesson opens with its introduction', s.message.kind === 'intro' && studentToMove(s))
let out = tryMove(s, { from: 'a2', to: 'a3' })
check('a wrong move gets the hint, not the answer', out.result === 'wrong' && out.state.message.text.includes(italian.line[0]!.hint!) && !revealed(out.state))
out = tryMove(out.state, { from: 'h2', to: 'h3' })
check('a second wrong move reveals the answer with an arrow', revealed(out.state) && answer(out.state)?.from === 'e2' && answer(out.state)?.to === 'e4')
check('illegal moves are simply ignored', tryMove(out.state, { from: 'e2', to: 'e5' }).result === 'illegal')
out = tryMove(out.state, { from: 'e2', to: 'e4' })
check('the right move is played and explained', out.result === 'correct' && out.state.message.kind === 'why' && replyDue(out.state))
s = playReply(out.state)
check('the reply is played and explained', s.ply === 2 && s.message.kind === 'why' && studentToMove(s))
// Play the rest perfectly.
while (s.ply < italian.line.length) {
  if (replyDue(s)) s = playReply(s)
  else {
    const a = answer(s)!
    s = tryMove(s, a).state
  }
}
check('the lesson ends with a finish message', s.message.kind === 'done' && s.totalMistakes === 2)
const najdorf = startLesson(LESSONS.find((l) => l.id === 'sicilian-najdorf')!)
check('as Black, White’s first move is played for you', replyDue(najdorf) && playReply(najdorf).ply === 1)

// ── Achievements ────────────────────────────────────────────────────────────
let p = createDefaultProfile()
let r = recordLesson(p, 'italian', LESSONS.length)
r = recordLesson(r.profile, 'italian', LESSONS.length)
check('a lesson counts once', r.profile.feats.lessonsDone.length === 1)
for (const l of LESSONS) r = recordLesson(r.profile, l.id, LESSONS.length)
check('three lessons make an Opening Student; all make an Opening Scholar', Boolean(r.profile.achievements['opening-student']) && Boolean(r.profile.achievements['opening-scholar']))
p = createDefaultProfile()
let v = recordVariantResult(p, 'koth', true, 'checkmate')
check('King of the Hill is only for winning on the hill', !v.profile.achievements['king-of-the-hill'] && v.profile.feats.kothWins === 1)
v = recordVariantResult(v.profile, 'koth', true, 'hill')
v = recordVariantResult(v.profile, 'chess960', true, 'checkmate')
check('a loss records nothing', recordVariantResult(v.profile, 'threecheck', false, 'three-checks').profile === v.profile)
v = recordVariantResult(v.profile, 'threecheck', true, 'three-checks')
check('winning all three variants makes a Variant Virtuoso', ['king-of-the-hill', 'fischer-random', 'triple-threat', 'variant-virtuoso'].every((id) => Boolean(v.profile.achievements[id])))
let o = recordOnlineResult(createDefaultProfile(), false)
check('finishing an online game makes a Globetrotter', Boolean(o.profile.achievements['globetrotter']) && o.profile.feats.onlineGames === 1)
for (let i = 0; i < 5; i++) o = recordOnlineResult(o.profile, true)
check('five online wins put you on the World Stage', Boolean(o.profile.achievements['world-stage']) && o.profile.feats.onlineWins === 5)

console.log(failures === 0 ? '\nAll opening checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
