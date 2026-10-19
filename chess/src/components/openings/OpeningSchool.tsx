import { ArrowLeft, Check, GraduationCap, Lightbulb, RotateCcw, Volume2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { sfx } from '../../audio'
import { speakLine, voicesSupported } from '../../audio/voice'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { getClassic } from '../../data/classic/roster'
import { classicPersona } from '../../data/personas'
import { useStore } from '../../hooks/useStore'
import { type LessonState, answer, playReply, prompt, replyDue, revealed, startLesson, studentToMove, tryMove } from '../../openings/lessonRun'
import { LESSONS, type Lesson } from '../../openings/lessons'
import { applyFeat } from '../../stores/featActions'
import { profileStore } from '../../stores/profileStore'
import { settingsStore } from '../../stores/settingsStore'
import type { MoveInput } from '../../types/chess'
import { recordLesson } from '../../utils/feats'
import { ChessBoard } from '../board/ChessBoard'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'

/** The Opening School: interactive lessons on the main openings, taught by the chess masters. */
export function OpeningSchool() {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const done = useStore(profileStore, (p) => p.feats.lessonsDone)
  if (lesson) return <LessonPlayer key={lesson.id} lesson={lesson} onBack={() => setLesson(null)} />
  return (
    <div className="mx-auto w-full max-w-4xl space-y-3" data-openings="list">
      <p className="text-sm text-slate-400">
        Learn the main openings move by move: you play your side, the master explains every move. {done.length}/{LESSONS.length} completed.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {LESSONS.map((l) => {
          const teacher = getClassic(l.teacher)
          const persona = teacher ? classicPersona(teacher) : null
          const finished = done.includes(l.id)
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setLesson(l)}
              data-lesson={l.id}
              className="glass flex items-center gap-3 rounded-2xl p-3 text-left transition hover:-translate-y-0.5 hover:border-white/25"
            >
              {persona && <PortraitEmblem spec={persona.portrait} label={persona.name} size="sm" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">{l.name}</span>
                <span className="block truncate text-[11px] text-slate-400">
                  {l.eco} · you play {l.student === 'w' ? 'White' : 'Black'} · {l.level}
                </span>
                <span className="block truncate text-[11px] text-slate-500">with {teacher?.name ?? 'a master'}</span>
              </span>
              {finished && (
                <span className="flex size-7 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300" aria-label="Completed">
                  <Check className="size-4" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LessonPlayer({ lesson, onBack }: { lesson: Lesson; onBack: () => void }) {
  const [state, setState] = useState<LessonState>(() => startLesson(lesson))
  const [shake, setShake] = useState(0)
  const settings = useStore(settingsStore, (s) => s)
  const teacher = getClassic(lesson.teacher)
  const persona = teacher ? classicPersona(teacher) : null
  const voiceOn = voicesSupported() && settings.characterVoice !== 'off'
  const finished = state.ply >= lesson.line.length

  const say = useCallback(
    (text: string) => {
      if (voiceOn && teacher) speakLine({ speaker: teacher.name, text, mood: 'calm' }, settingsStore.get().sfxVolume)
    },
    [teacher, voiceOn],
  )

  // The opponent's scripted reply, after a short pause.
  useEffect(() => {
    if (!replyDue(state)) return
    const id = window.setTimeout(() => {
      setState((s) => playReply(s))
      sfx.pickup()
    }, 900)
    return () => window.clearTimeout(id)
  }, [state])

  // The teacher reads the explanations aloud (when character voices are on).
  useEffect(() => {
    if (state.message.kind !== 'your-move') say(state.message.text)
  }, [say, state.message])

  // Record the lesson once it is finished.
  useEffect(() => {
    if (finished) applyFeat((p) => recordLesson(p, lesson.id, LESSONS.length))
  }, [finished, lesson.id])

  const onMove = useCallback(
    (input: MoveInput): boolean => {
      const out = tryMove(state, input)
      if (out.result === 'illegal') return false
      setState(out.state)
      if (out.result === 'wrong') setShake((n) => n + 1)
      else sfx.pickup()
      return out.result === 'correct'
    },
    [state],
  )

  const arrow = revealed(state) ? answer(state) : null
  const tone = state.message.kind === 'wrong' ? 'border-amber-300/50 bg-amber-300/[0.08]' : 'border-white/10 bg-white/[0.03]'

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start" data-openings="lesson" data-lesson-id={lesson.id}>
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 15rem)), 44rem)' }}>
        <ChessBoard
          id={`lesson-${lesson.id}`}
          fen={state.fen}
          orientation={lesson.student}
          lastMove={state.last}
          movableColor={studentToMove(state) ? lesson.student : null}
          onMove={onMove}
          theme={getBoardTheme(settings.boardTheme)}
          pieceSet={getPieceSet(settings.pieceSet)}
          lowPower={settings.batterySaver}
          showLegalMoves={settings.showLegalMoves}
          showCoordinates={settings.showCoordinates}
          shakeKey={shake}
          arrows={arrow ? [{ ...arrow, color: 'rgba(132, 204, 22, 0.9)' }] : []}
        />
      </div>
      <aside className="flex flex-col gap-3">
        <div className="glass flex items-center gap-3 rounded-2xl p-3">
          {persona && <PortraitEmblem spec={persona.portrait} label={persona.name} size="md" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
              <GraduationCap className="size-3.5" /> Opening School
            </div>
            <div className="truncate font-display text-lg font-extrabold text-white">{lesson.name}</div>
            <div className="text-[11px] text-slate-400">
              with {teacher?.name} · move {Math.min(state.ply + 1, lesson.line.length)}/{lesson.line.length}
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border p-3 text-sm leading-relaxed text-slate-200 ${tone}`} role="status" aria-live="polite" data-lesson-message={state.message.kind}>
          {state.message.kind === 'why' && <span className="mr-1 font-mono font-bold text-white">{state.message.san}</span>}
          {state.message.text}
          {!finished && studentToMove(state) && state.message.kind !== 'wrong' && <div className="mt-2 text-xs text-sky-200">{prompt(state)}</div>}
          {voiceOn && (
            <button type="button" onClick={() => say(state.message.text)} className="mt-2 flex items-center gap-1 text-[11px] text-slate-400 hover:text-white" aria-label="Read aloud">
              <Volume2 className="size-3.5" /> Read aloud
            </button>
          )}
        </div>

        {finished && (
          <div className="glass space-y-2 rounded-2xl p-3" data-lesson-done>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">
              <Check className="size-3.5" /> Lesson complete{state.totalMistakes === 0 ? ' · flawless' : ''}
            </div>
            <ul className="space-y-1.5">
              {lesson.ideas.map((idea) => (
                <li key={idea} className="flex gap-1.5 text-xs text-slate-300">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-300" /> {idea}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="size-4" />}>
            All lessons
          </Button>
          <Button variant="secondary" onClick={() => setState(startLesson(lesson))} icon={<RotateCcw className="size-4" />} data-lesson-restart>
            Start over
          </Button>
        </div>
      </aside>
    </div>
  )
}
