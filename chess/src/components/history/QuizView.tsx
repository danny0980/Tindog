import { Play } from 'lucide-react'
import { useState } from 'react'
import { buildQuiz, type QuizQuestion } from '../../data/classic/quiz'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { Button } from '../ui/Button'
import { QuizPanel } from './QuizPanel'
import { useBeatenClassics } from './useBeaten'

const LENGTH = 5

/** "Who is this?" history quiz about the people you have beaten (or everyone, at first). */
export function QuizView() {
  const beaten = useBeatenClassics()
  const best = useStore(profileStore, (p) => p.feats.quizCorrect)
  const [round, setRound] = useState(0)
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null)

  const start = () => {
    const next = round + 1
    setRound(next)
    setQuiz(buildQuiz(beaten, LENGTH, profileStore.get().matches.length * 7919 + next * 104729))
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" data-quiz>
      <section className="glass space-y-3 rounded-3xl p-5">
        {quiz ? (
          <QuizPanel key={round} questions={quiz} />
        ) : (
          <div className="space-y-2 text-sm text-slate-300">
            <p>Five questions about the people of Classic Chess: true facts from the history books (“Who is this?”), their dates, and one line from the game itself.</p>
            <p className="text-xs text-slate-400">
              {beaten.length >= 4 ? `Drawn from the ${beaten.length} characters you have beaten.` : 'Beat four Classic characters and the quiz will be about them.'} 5 coins for each right answer · {best} answered correctly so far.
            </p>
          </div>
        )}
        <Button variant={quiz ? 'secondary' : 'primary'} size="lg" className="w-full" icon={<Play className="size-5" fill="currentColor" />} onClick={start} data-quiz-start>
          {quiz ? 'New quiz' : 'Start the quiz'}
        </Button>
      </section>
    </div>
  )
}
