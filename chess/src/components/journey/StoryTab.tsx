import { BookOpen, Check, Ghost, Lock, Play, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { assetUrl } from '../../assets/artManifest'
import { getClassic } from '../../data/classic/roster'
import { useStore } from '../../hooks/useStore'
import { journeyStore } from '../../journey/journeyStore'
import { CHAPTERS, type Chapter, STORY_STRENGTHS, type StoryStrength, chapterOpen, chapterReward, nextChapter } from '../../journey/story'
import { Button } from '../ui/Button'
import { Cutscene } from './Cutscene'
import type { JourneyLaunch } from './launch'
import { Bar, Card, Choice, ClassicFace, Pill } from './ui'

/** "The Keeper of Time": eleven chapters, a scene before and after each game. */
export function StoryTab({ launch }: { launch: JourneyLaunch }) {
  const done = useStore(journeyStore, (j) => j.story)
  const [selected, setSelected] = useState<number>(() => nextChapter(journeyStore.get().story)?.index ?? CHAPTERS.length - 1)
  const [scene, setScene] = useState<{ chapter: Chapter; part: 'intro' | 'outro' } | null>(null)
  const [strength, setStrength] = useState<StoryStrength>('fair')
  const chapter = CHAPTERS[selected] ?? CHAPTERS[0]!
  const open = chapterOpen(chapter.index, done)
  const finished = done.length >= CHAPTERS.length

  const play = (ch: Chapter) => {
    const elo = STORY_STRENGTHS.find((s) => s.id === strength)?.elo || null
    const tag = { kind: 'story' as const, chapter: ch.index, elo }
    if (ch.opponent === 'ghost') launch.playGhost({ color: 'random', timeControlId: 'none' }, { kind: 'legend', tactics: [], journey: tag })
    else launch.playClassic(ch.opponent.classic, { color: 'random', timeControlId: 'none' }, { kind: 'legend', tactics: [], journey: tag })
  }

  return (
    <div className="space-y-4" data-story>
      <Card className="relative overflow-hidden">
        <img src={assetUrl('backgrounds/chrono-realm.webp')} alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-30" onError={(e) => (e.currentTarget.style.display = 'none')} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 to-ink-950/60" aria-hidden="true" />
        <div className="relative">
          <div className="text-[11px] font-bold tracking-[0.3em] text-amber-200 uppercase">Story mode</div>
          <h2 className="font-display text-2xl font-extrabold text-white">The Keeper of Time</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            The Hourglass of Chronos has shattered, and its eleven shards have fallen through history. Each is held by one of history’s great minds — and they will only give it up over a game of chess.
          </p>
          <Bar value={done.length / CHAPTERS.length} className="mt-3 max-w-md" color="linear-gradient(90deg,#fbbf24,#f97316)" label="Story progress" />
          <div className="mt-1 text-xs text-slate-400">
            {done.length} / {CHAPTERS.length} shards recovered{finished ? ' — the Hourglass is whole!' : ''}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ol className="grid gap-2 sm:grid-cols-2" aria-label="Chapters">
          {CHAPTERS.map((ch) => {
            const isDone = done.includes(ch.index)
            const isOpen = chapterOpen(ch.index, done)
            const c = ch.opponent === 'ghost' ? null : getClassic(ch.opponent.classic)
            return (
              <li key={ch.index}>
                <button
                  type="button"
                  onClick={() => setSelected(ch.index)}
                  data-chapter={ch.index}
                  aria-current={selected === ch.index ? 'true' : undefined}
                  className={`glass flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${selected === ch.index ? 'border-accent ring-1 ring-accent' : 'hover:border-white/25'} ${isOpen ? '' : 'opacity-60'}`}
                >
                  {c ? <ClassicFace c={c} size="sm" locked={!isOpen} defeated={isDone} /> : <span className="flex size-11 items-center justify-center rounded-xl bg-slate-700 text-white"><Ghost className="size-5" /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold tracking-wider text-slate-500 uppercase">Chapter {ch.index + 1} · {ch.era}</span>
                    <span className="block truncate font-semibold text-white">{ch.title}</span>
                  </span>
                  {isDone ? <Check className="size-4 text-emerald-300" aria-label="Done" /> : isOpen ? <Sparkles className="size-4 text-amber-200" aria-label="Open" /> : <Lock className="size-4 text-slate-500" aria-label="Locked" />}
                </button>
              </li>
            )
          })}
        </ol>

        <Card title={`Chapter ${chapter.index + 1}`} icon={<BookOpen className="size-4" />} data-chapter-detail={String(chapter.index)}>
          <div className="font-display text-lg font-bold text-white">{chapter.title}</div>
          <div className="text-xs text-amber-200">{chapter.era}</div>
          <p className="mt-2 text-sm text-slate-300">
            Guarded by{' '}
            <span className="font-semibold text-white">{chapter.opponent === 'ghost' ? 'your own Ghost — built from your games' : (getClassic(chapter.opponent.classic)?.name ?? '?')}</span>.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {chapterReward(chapter.index).map((r) => (
              <Pill key={r.kind === 'coins' ? 'c' : r.kind === 'frame' ? r.id : r.id} tone="gold">
                {r.kind === 'coins' ? `${r.amount} coins` : r.kind === 'frame' ? 'Keeper’s Ring' : `Title: ${r.name}`}
              </Pill>
            ))}
            {done.includes(chapter.index) && <Pill tone="green">Completed</Pill>}
          </div>
          <div className="mt-3">
            <Choice label="Opponent strength" value={strength} onChange={setStrength} options={STORY_STRENGTHS.map((s) => ({ id: s.id, label: s.name, sub: s.elo ? `~${s.elo}` : 'their own' }))} />
          </div>
          <div className="mt-3 grid gap-2">
            <Button variant="primary" disabled={!open} icon={<Play className="size-4" fill="currentColor" />} onClick={() => setScene({ chapter, part: 'intro' })} data-chapter-play>
              {open ? (done.includes(chapter.index) ? 'Play again' : 'Begin the chapter') : 'Finish the chapter before'}
            </Button>
            {done.includes(chapter.index) && (
              <Button variant="secondary" size="sm" onClick={() => setScene({ chapter, part: 'outro' })}>
                Watch the ending again
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Story games are unrated. Your opponent strength only changes how hard they play.</p>
        </Card>
      </div>

      {scene && (
        <Cutscene
          title={scene.chapter.title}
          era={scene.chapter.era}
          backdrop={scene.chapter.backdrop}
          panels={scene.part === 'intro' ? scene.chapter.intro : scene.chapter.outro}
          onDone={() => {
            const s = scene
            setScene(null)
            if (s.part === 'intro') play(s.chapter)
          }}
        />
      )}
      <StoryOutro />
    </div>
  )
}

/** After a won chapter, its closing scene plays the next time the story screen opens. */
function StoryOutro() {
  const done = useStore(journeyStore, (j) => j.story)
  const [seen, setSeen] = useState<number[]>(() => readSeen())
  const pending = done.find((i) => !seen.includes(i))
  const ch = pending !== undefined ? CHAPTERS[pending] : undefined
  if (!ch) return null
  return (
    <Cutscene
      title={ch.title}
      era={ch.era}
      backdrop={ch.backdrop}
      panels={ch.outro}
      onDone={() => {
        const next = [...seen, ch.index]
        setSeen(next)
        writeSeen(next)
      }}
    />
  )
}

const SEEN_KEY = 'chess-arena:story-outros'
function readSeen(): number[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}
function writeSeen(v: number[]): void {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(v))
  } catch {
    // Private mode: the ending simply shows again next time.
  }
}
