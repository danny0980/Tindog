import { Check, Coins, HelpCircle, X } from 'lucide-react'
import { useState } from 'react'
import { sfx } from '../../audio'
import type { QuizQuestion } from '../../data/classic/quiz'
import { quizReward } from '../../data/classic/quiz'
import { profileStore } from '../../stores/profileStore'
import { showToast } from '../../stores/toastStore'
import { playAchievement } from '../../audio/fanfares'
import { recordQuiz } from '../../utils/feats'
import { Button } from '../ui/Button'

const KIND_LABEL: Record<QuizQuestion['kind'], string> = {
  fact: 'History · a true fact',
  lived: 'History · dates',
  line: 'The game · a character’s line',
}

/** Steps through a history quiz; pays out once, when the last answer is given. */
/** A history quiz; `onDone` (optional) hears the score once the last question is answered (the score screen stays up). */
export function QuizPanel({ questions, onDone }: { questions: readonly QuizQuestion[]; onDone?: (correct: number) => void }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [finished, setFinished] = useState(false)
  const q = questions[index]

  const pick = (i: number) => {
    if (picked !== null || !q) return
    setPicked(i)
    const right = i === q.answer
    if (right) {
      setCorrect((n) => n + 1)
      sfx.score(correct + 1)
    } else sfx.error()
  }

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1)
      setPicked(null)
      return
    }
    setFinished(true)
    const out = recordQuiz(profileStore.get(), correct, questions.length)
    profileStore.set(out.profile)
    if (out.coins > 0) {
      sfx.coins()
      showToast('coins', `History quiz: +${out.coins} coins`, `${correct} of ${questions.length} correct`)
    }
    if (out.unlocked.length > 0) playAchievement()
    out.unlocked.forEach((a) => showToast('achievement', a.title, `${a.description} · +${a.reward} coins`, 5000))
    onDone?.(correct)
  }

  if (questions.length === 0) return <p className="text-sm text-slate-400">No questions available.</p>

  if (finished || !q) {
    return (
      <div className="py-4 text-center" data-quiz-result>
        <div className="font-display text-3xl font-extrabold text-white">
          {correct} / {questions.length}
        </div>
        <div className="mt-1 text-sm text-slate-300">{correct === questions.length ? 'A perfect score. The chroniclers approve.' : correct >= questions.length / 2 ? 'Well done. History is on your side.' : 'History is long. Try again!'}</div>
        <div className="mt-2 flex items-center justify-center gap-1 font-mono text-sm font-bold text-yellow-300">
          <Coins className="size-4" /> +{quizReward(correct)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3" data-quiz-question={index}>
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em]">
        <span className="flex items-center gap-1 text-amber-200">
          <HelpCircle className="size-3.5" /> {KIND_LABEL[q.kind]}
        </span>
        <span className="font-mono text-slate-400">
          {index + 1}/{questions.length} · {correct} ✓
        </span>
      </div>
      <div className="font-display text-lg font-bold text-white">{q.prompt}</div>
      {q.kind !== 'lived' && <blockquote className="rounded-2xl border-l-4 border-amber-300/60 bg-white/[0.05] p-3 text-sm leading-relaxed text-slate-100">{q.kind === 'line' ? `“${q.clue}”` : q.clue}</blockquote>}
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Answers">
        {q.options.map((o, i) => {
          const isRight = picked !== null && i === q.answer
          const isWrong = picked === i && i !== q.answer
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={picked === i}
              disabled={picked !== null}
              onClick={() => pick(i)}
              data-quiz-option={i}
              data-correct={isRight ? 'true' : undefined}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${isRight ? 'border-emerald-300 bg-emerald-400/15 text-white' : isWrong ? 'border-red-300 bg-red-400/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-200 enabled:hover:bg-white/[0.08]'}`}
            >
              {o}
              {isRight && <Check className="size-4 shrink-0 text-emerald-300" />}
              {isWrong && <X className="size-4 shrink-0 text-red-300" />}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <Button variant="primary" className="w-full" onClick={next} data-quiz-next>
          {index + 1 < questions.length ? 'Next question' : 'See my score'}
        </Button>
      )}
    </div>
  )
}
