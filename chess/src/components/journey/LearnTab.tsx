import { Chess } from 'chess.js'
import { BarChart3, Brain, CheckCircle2, Crosshair, Eye, GraduationCap, Loader2, Play, Search, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { sfx } from '../../audio'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { getClassic } from '../../data/classic/roster'
import { classicPersona } from '../../data/personas'
import { evaluatePosition } from '../../engine/analysis'
import { useEngine } from '../../hooks/useEngine'
import { useStore } from '../../hooks/useStore'
import { ENDGAMES, type EndgameLesson, lessonRules } from '../../journey/endgames'
import { payRewards, recordJourney } from '../../journey/journeyActions'
import { journeyStore } from '../../journey/journeyStore'
import { FOCUS_INFO, type PlanTask, type PlyEval, diagnose, mistakesIn, sevenDayPlan, solvesMistake, weeklyReport } from '../../journey/learn'
import { weekKey } from '../../journey/league'
import { MAX_MISTAKES, type MistakePuzzle } from '../../journey/state'
import { profileStore } from '../../stores/profileStore'
import { settingsStore } from '../../stores/settingsStore'
import { showToast } from '../../stores/toastStore'
import type { Color, MoveInput } from '../../types/chess'
import { formatShortDate, localDateKey, dayNumber } from '../../utils/date'
import { ChessBoard } from '../board/ChessBoard'
import { EngineNotice } from '../game/EngineNotice'
import { Button } from '../ui/Button'
import { JourneyBoardGame } from './JourneyBoardGame'
import type { JourneyLaunch } from './launch'
import { Bar, Card, ClassicFace, Pill, Stat } from './ui'

type Screen = 'menu' | { lesson: EndgameLesson } | 'mistakes'

export function LearnTab({ launch }: { launch: JourneyLaunch }) {
  const [screen, setScreen] = useState<Screen>('menu')
  if (screen === 'mistakes') return <MistakeTrainer onLeave={() => setScreen('menu')} />
  if (typeof screen === 'object') return <Lesson lesson={screen.lesson} onLeave={() => setScreen('menu')} />
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-learn>
      <Mentor launch={launch} onTask={(t) => (t === 'endgame' ? setScreen({ lesson: ENDGAMES[0]! }) : t === 'mistakes' ? setScreen('mistakes') : null)} />
      <Report />
      <Endgames onOpen={(lesson) => setScreen({ lesson })} />
      <MistakesCard onOpen={() => setScreen('mistakes')} />
    </div>
  )
}

function Mentor({ launch, onTask }: { launch: JourneyLaunch; onTask: (t: PlanTask) => void }) {
  const matches = useStore(profileStore, (p) => p.matches)
  const plan = useStore(journeyStore, (j) => j.learn.plan)
  const d = useMemo(() => diagnose(matches), [matches])
  const focus = plan?.focus && plan.focus in FOCUS_INFO ? (plan.focus as keyof typeof FOCUS_INFO) : d.focus
  const days = sevenDayPlan(focus)
  const today = plan ? Math.min(7, Math.max(1, dayNumber(localDateKey()) - dayNumber(plan.start) + 1)) : 0
  const capa = getClassic('capablanca')
  const go = (t: PlanTask) => {
    if (t === 'puzzles') launch.navigate('puzzles')
    else if (t === 'rush') launch.navigate('rush')
    else if (t === 'opening') launch.openLegends('openings')
    else if (t === 'review') launch.navigate('profile')
    else if (t === 'game') launch.navigate('play')
    else onTask(t)
  }
  return (
    <Card title="Your mentor" icon={<Brain className="size-4" />} className="lg:col-span-2" data-mentor={d.focus}>
      <div className="flex items-start gap-3">
        {capa && <ClassicFace c={capa} size="md" />}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-400">Capablanca has studied your last {d.games} games.</div>
          <div className="font-display text-lg font-bold text-white">Focus: {FOCUS_INFO[d.focus].title}</div>
          <p className="text-sm text-slate-300">{d.evidence}</p>
          <p className="mt-1 text-sm italic text-amber-100">“{FOCUS_INFO[d.focus].advice}”</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">{plan ? `Your 7-day plan · day ${today}` : 'A 7-day plan for you'}</div>
        <Button
          size="sm"
          variant={plan ? 'ghost' : 'primary'}
          onClick={() => journeyStore.set((j) => ({ ...j, learn: { ...j.learn, plan: { start: localDateKey(), focus: d.focus } } }))}
          data-mentor-start
        >
          {plan ? 'Restart the plan' : 'Start the plan'}
        </Button>
      </div>
      <ol className="mt-2 grid gap-1.5 sm:grid-cols-7">
        {days.map((day) => (
          <li key={day.day}>
            <button
              type="button"
              onClick={() => go(day.task)}
              className={`flex h-full w-full flex-col rounded-xl border p-2 text-left text-[11px] transition hover:bg-white/[0.07] ${plan && day.day === today ? 'border-accent bg-accent/15' : plan && day.day < today ? 'border-emerald-300/30 bg-emerald-400/5 opacity-70' : 'border-white/10 bg-white/[0.03]'}`}
            >
              <span className="font-bold text-slate-400">Day {day.day}</span>
              <span className="text-slate-200">{day.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function Report() {
  const matches = useStore(profileStore, (p) => p.matches)
  const [which, setWhich] = useState<'this' | 'last'>('this')
  const [weeks] = useState(() => ({ now: weekKey(), last: weekKey(new Date(Date.now() - 7 * 86_400_000)) }))
  const thisWeek = weeks.now
  const lastWeek = weeks.last
  const r = useMemo(() => weeklyReport(matches, which === 'this' ? thisWeek : lastWeek), [lastWeek, matches, thisWeek, which])
  const max = Math.max(...r.ratings, 1)
  const min = Math.min(...r.ratings, max)
  return (
    <Card
      title="Weekly report"
      icon={<BarChart3 className="size-4" />}
      data-report={r.week}
      action={
        <div className="flex gap-1 text-[11px]">
          {(['this', 'last'] as const).map((w) => (
            <button key={w} type="button" onClick={() => setWhich(w)} className={`rounded-full px-2 py-0.5 ${which === w ? 'bg-accent text-ink-950' : 'bg-white/5 text-slate-300'}`}>
              {w === 'this' ? 'This week' : 'Last week'}
            </button>
          ))}
        </div>
      }
    >
      {r.games === 0 ? (
        <p className="text-sm text-slate-400">No games {which === 'this' ? 'yet this week' : 'last week'}. Your report fills in as you play.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Games" value={r.games} sub={`${r.wins}W · ${r.draws}D · ${r.losses}L`} />
            <Stat label="Rating" value={r.eloChange === null ? '—' : `${r.eloChange >= 0 ? '+' : ''}${r.eloChange}`} />
            <Stat label="Accuracy" value={r.accuracy === null ? '—' : `${r.accuracy}%`} />
          </div>
          {r.ratings.length > 1 && (
            <svg viewBox={`0 0 ${(r.ratings.length - 1) * 20} 40`} className="h-12 w-full" preserveAspectRatio="none" aria-label="Rating through the week">
              <polyline
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                points={r.ratings.map((v, i) => `${i * 20},${max === min ? 20 : 38 - ((v - min) / (max - min)) * 36}`).join(' ')}
              />
            </svg>
          )}
          <ul className="space-y-1 text-sm text-slate-300">
            {r.bestOpening && (
              <li>
                Best opening: <span className="font-semibold text-white">{r.bestOpening.name}</span> ({r.bestOpening.score}/{r.bestOpening.games})
              </li>
            )}
            {r.commonLoss && (
              <li>
                Most common way you lost: <span className="font-semibold text-amber-200">{r.commonLoss}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Endgames({ onOpen }: { onOpen: (l: EndgameLesson) => void }) {
  const done = useStore(journeyStore, (j) => j.learn.endgames)
  return (
    <Card title="Endgame lessons" icon={<GraduationCap className="size-4" />} action={<Pill tone="gold">{done.length}/{ENDGAMES.length}</Pill>} data-endgames>
      <ul className="space-y-2">
        {ENDGAMES.map((l) => {
          const t = getClassic(l.teacher)
          return (
            <li key={l.id}>
              <button type="button" onClick={() => onOpen(l)} className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] p-2 text-left hover:bg-white/[0.08]" data-endgame={l.id}>
                {t && <ClassicFace c={t} size="sm" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{l.name}</span>
                  <span className="block text-[11px] text-slate-400">
                    {t?.name} · {l.goal === 'win' ? `win in ${l.moves} moves` : `hold for ${l.moves} moves`}
                  </span>
                </span>
                {done.includes(l.id) && <CheckCircle2 className="size-4 text-emerald-300" aria-label="Done" />}
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Lesson({ lesson, onLeave }: { lesson: EndgameLesson; onLeave: () => void }) {
  const t = getClassic(lesson.teacher)
  return (
    <JourneyBoardGame
      id={`endgame-${lesson.id}`}
      title={lesson.name}
      subtitle={lesson.summary}
      setup={{ variant: 'battle', rules: lessonRules(lesson) }}
      color={lesson.side}
      opponent={t ? { persona: classicPersona(t), intro: lesson.tips[0] ?? '' } : null}
      tips={lesson.tips}
      defaultLevel="master"
      info={<span className="text-amber-200">{lesson.goal === 'win' ? `Goal: checkmate within ${lesson.moves} moves.` : `Goal: don’t lose for ${lesson.moves} moves (a draw counts).`}</span>}
      onLeave={onLeave}
      onResult={(r, me) => {
        const ok = lesson.goal === 'win' ? r.winner === me : r.winner !== (me === 'w' ? 'b' : 'w')
        const j = journeyStore.get()
        if (ok && !j.learn.endgames.includes(lesson.id)) {
          journeyStore.set({ ...j, learn: { ...j.learn, endgames: [...j.learn.endgames, lesson.id] } })
          recordJourney({ outcome: null, base: 40 })
          payRewards([{ kind: 'coins', amount: 120 }], `Lesson learned: ${lesson.name}`)
        }
        return ok ? `${t?.name.split(' ')[0] ?? 'Your teacher'} nods: “Exactly. That is how it is done.”` : 'Not yet — read the tips and try again.'
      }}
    />
  )
}

function MistakesCard({ onOpen }: { onOpen: () => void }) {
  const learn = useStore(journeyStore, (j) => j.learn)
  const open = learn.mistakes.filter((m) => !learn.solved.includes(m.id)).length
  return (
    <Card title="Puzzles from your games" icon={<Crosshair className="size-4" />} action={<Pill tone={open > 0 ? 'gold' : 'slate'}>{open} to solve</Pill>} data-mistakes-card>
      <p className="text-sm text-slate-300">The engine looks through your recent games for the moves that cost you most, and turns each into a puzzle: find the move you missed.</p>
      <Button variant="primary" className="mt-3 w-full" icon={<Target className="size-4" />} onClick={onOpen} data-mistakes-open>
        Train on my mistakes
      </Button>
    </Card>
  )
}

const SCANNED_KEY = 'chess-arena:mistakes-scanned'
const readScanned = (): string[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(SCANNED_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
const writeScanned = (ids: string[]) => {
  try {
    window.localStorage.setItem(SCANNED_KEY, JSON.stringify(ids.slice(-200)))
  } catch {
    // Storage blocked: games may be scanned again later (duplicates are skipped by id).
  }
}

function MistakeTrainer({ onLeave }: { onLeave: () => void }) {
  const learn = useStore(journeyStore, (j) => j.learn)
  const matches = useStore(profileStore, (p) => p.matches)
  const settings = useStore(settingsStore, (s) => s)
  const engine = useEngine('analysis', true)
  const [scanning, setScanning] = useState<{ done: number; total: number } | null>(null)
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<'right' | 'wrong' | 'shown' | null>(null)
  const puzzles = learn.mistakes.filter((m) => !learn.solved.includes(m.id))
  const p: MistakePuzzle | undefined = puzzles[index % Math.max(1, puzzles.length)]
  const candidates = matches.filter((m) => m.mode === 'ai' && m.humanColor && m.plies >= 12 && !readScanned().includes(m.id)).slice(0, 4)

  const scan = async () => {
    if (engine.status !== 'ready' || candidates.length === 0) return
    const scanned = readScanned()
    let found: MistakePuzzle[] = []
    const total = candidates.reduce((n, m) => n + m.plies + 1, 0)
    let done = 0
    setScanning({ done, total })
    try {
      for (const match of candidates) {
        const chess = new Chess()
        try {
          chess.loadPgn(match.pgn)
        } catch {
          scanned.push(match.id)
          continue
        }
        const history = chess.history({ verbose: true })
        const fens = [history[0]?.before ?? chess.fen(), ...history.map((h) => h.after)]
        const evals: Array<{ cp: number; best: string | null }> = []
        for (const fen of fens) {
          const e = await evaluatePosition(fen, 10, (f) => engine.search(f, { depth: 10, multiPv: 1, moveTimeMs: 400 }))
          evals.push({ cp: e.cp, best: e.bestMove })
          done += 1
          setScanning({ done, total })
        }
        const plies: PlyEval[] = history.map((_, i) => ({ before: evals[i]!.cp, after: evals[i + 1]!.cp, best: evals[i]!.best }))
        found = [...found, ...mistakesIn(match, plies)]
        scanned.push(match.id)
      }
    } finally {
      writeScanned(scanned)
      setScanning(null)
    }
    const known = new Set(journeyStore.get().learn.mistakes.map((m) => m.id))
    const fresh = found.filter((m) => !known.has(m.id))
    journeyStore.set((j) => ({ ...j, learn: { ...j.learn, mistakes: [...j.learn.mistakes, ...fresh].slice(-MAX_MISTAKES) } }))
    showToast(fresh.length > 0 ? 'success' : 'info', fresh.length > 0 ? `${fresh.length} new puzzle${fresh.length === 1 ? '' : 's'}` : 'No big mistakes found', fresh.length > 0 ? 'Made from your own games.' : 'Those games were clean. Well played!', 3200)
  }

  const turn: Color = p?.fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const onMove = (input: MoveInput): boolean => {
    if (!p || feedback === 'right') return false
    const uci = `${input.from}${input.to}${input.promotion ?? ''}`
    try {
      new Chess(p.fen).move({ from: input.from, to: input.to, promotion: input.promotion ?? 'q' })
    } catch {
      return false
    }
    if (solvesMistake(p, uci)) {
      setFeedback('right')
      sfx.achievement()
      journeyStore.set((j) => ({ ...j, learn: { ...j.learn, solved: [...j.learn.solved, p.id] } }))
      recordJourney({ outcome: null, base: 20 })
      payRewards([{ kind: 'coins', amount: 25 }], 'Mistake fixed')
    } else {
      setFeedback('wrong')
      sfx.error()
    }
    return false
  }

  const next = () => {
    setFeedback(null)
    setIndex((i) => i + 1)
  }
  const arrow = p && (feedback === 'shown' || feedback === 'right') ? [{ from: p.best.slice(0, 2), to: p.best.slice(2, 4), color: 'rgba(52,211,153,0.85)' }] : []

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" data-mistake-trainer>
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        {p ? (
          <ChessBoard
            id={`mistake-${p.id}`}
            fen={p.fen}
            orientation={turn}
            lastMove={null}
            movableColor={feedback === 'right' ? null : turn}
            onMove={onMove}
            theme={getBoardTheme(settings.boardTheme)}
            pieceSet={getPieceSet(settings.pieceSet)}
            lowPower={settings.batterySaver}
            showLegalMoves={settings.showLegalMoves}
            showCoordinates={settings.showCoordinates}
            arrows={arrow}
          />
        ) : (
          <div className="glass flex aspect-square items-center justify-center rounded-3xl p-6 text-center text-sm text-slate-300">
            {learn.mistakes.length === 0 ? 'No puzzles yet. Scan your recent games to make some.' : 'All your mistake puzzles are solved! Play more games, then scan again.'}
          </div>
        )}
      </div>
      <aside className="flex flex-col gap-3">
        <EngineNotice status={engine.status} error={engine.error} onRetry={engine.retry} />
        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] font-bold tracking-[0.2em] text-amber-200 uppercase">Puzzles from your games</div>
          {p ? (
            <div className="mt-1 space-y-1 text-sm text-slate-200">
              <div>
                vs {p.opponent}
                {p.date ? `, ${formatShortDate(p.date)}` : ''}
              </div>
              <div className="text-xs text-slate-400">
                You played <span className="font-semibold text-red-200">{p.played}</span> here and it cost about {(p.swing / 100).toFixed(1)} pawns. Find a better move for {turn === 'w' ? 'White' : 'Black'}.
              </div>
              {feedback === 'right' && <div className="font-semibold text-emerald-300" data-mistake-feedback="right">Exactly! That is the move.</div>}
              {feedback === 'wrong' && <div className="font-semibold text-red-300" data-mistake-feedback="wrong">Not that one. Try again.</div>}
              {feedback === 'shown' && <div className="text-emerald-200">The engine’s move is shown on the board.</div>}
              <div className="text-[11px] text-slate-500">
                {puzzles.length} left · {learn.solved.length} solved
              </div>
            </div>
          ) : null}
        </div>
        {p && (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" icon={<Eye className="size-4" />} disabled={feedback === 'right'} onClick={() => setFeedback('shown')}>
              Show
            </Button>
            <Button size="sm" variant="primary" icon={<Play className="size-4" />} onClick={next}>
              Next
            </Button>
          </div>
        )}
        <div className="glass rounded-2xl p-3 text-xs text-slate-300">
          {scanning ? (
            <div className="space-y-2" data-mistake-scanning>
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Looking through your games…
              </div>
              <Bar value={scanning.done / Math.max(1, scanning.total)} />
            </div>
          ) : (
            <>
              <p>{candidates.length > 0 ? `${candidates.length} recent game${candidates.length === 1 ? '' : 's'} not scanned yet.` : 'Every recent game has been scanned.'}</p>
              <Button size="sm" className="mt-2 w-full" disabled={candidates.length === 0 || engine.status !== 'ready'} icon={<Search className="size-4" />} onClick={() => void scan()} data-mistake-scan>
                Scan my games
              </Button>
            </>
          )}
        </div>
        <Button variant="ghost" onClick={onLeave}>
          Back
        </Button>
      </aside>
    </div>
  )
}

