import { BookOpen, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { QUESTIONS, type QuestionId, interviewAnswer } from '../../data/classic/interview'
import type { ClassicCharacter } from '../../data/classic/roster'
import { classicPersona } from '../../data/personas'
import { useStore } from '../../hooks/useStore'
import { applyFeat } from '../../stores/featActions'
import { profileStore } from '../../stores/profileStore'
import { recordInterview } from '../../utils/feats'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

/** Character Interview: ask a beaten Classic character questions. */
export function InterviewPanel({ c }: { c: ClassicCharacter }) {
  const persona = classicPersona(c)
  const seed = useStore(profileStore, (p) => p.matches.length + p.feats.interviewed.length)
  const [asked, setAsked] = useState<QuestionId | null>(null)
  const answer = asked ? interviewAnswer(c, asked, seed) : null

  const ask = (q: QuestionId) => {
    setAsked(q)
    applyFeat((p) => recordInterview(p, c.id))
  }

  return (
    <div className="space-y-3" data-interview={c.id}>
      <div className="flex items-start gap-3">
        <PortraitEmblem spec={persona.portrait} label={c.name} size="lg" />
        <div className="min-w-0 flex-1" aria-live="polite">
          <div className="font-display text-lg font-extrabold text-white">{c.name}</div>
          <div className="text-xs text-slate-400">{c.title}</div>
          <div className="mt-2 min-h-16 rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.05] p-3 text-sm leading-relaxed text-slate-100" data-interview-answer>
            {answer ? (
              <>
                {answer.text}
                <span className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] ${answer.factual ? 'text-amber-200' : 'text-violet-200'}`}>
                  {answer.factual ? <BookOpen className="size-3" /> : <MessageCircle className="size-3" />}
                  {answer.factual ? 'From the history books' : 'In character · imagined for the game'}
                </span>
              </>
            ) : (
              <span className="text-slate-400">Ask me anything. I have time now.</span>
            )}
          </div>
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2" role="list" aria-label="Questions">
        {QUESTIONS.map((q) => (
          <button
            key={q.id}
            type="button"
            role="listitem"
            onClick={() => ask(q.id)}
            data-question={q.id}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition sm:text-sm ${asked === q.id ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08]'}`}
          >
            {q.text}
          </button>
        ))}
      </div>
    </div>
  )
}

export function InterviewModal({ c, onClose }: { c: ClassicCharacter | null; onClose: () => void }) {
  const close = onClose
  return (
    <Modal
      open={c !== null}
      title={c ? `Interview · ${c.name}` : 'Interview'}
      onClose={close}
      footer={
        <Button variant="secondary" className="w-full" onClick={close}>
          Thank you
        </Button>
      }
    >
      {c && <InterviewPanel key={c.id} c={c} />}
    </Modal>
  )
}
