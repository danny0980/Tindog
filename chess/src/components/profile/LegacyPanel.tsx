import { BookOpen, Crown, NotebookPen, ScrollText } from 'lucide-react'
import { useState } from 'react'
import type { TitleContext } from '../../data/titles'
import { ChroniclePanel } from './ChroniclePanel'
import { NotebookPanel } from './NotebookPanel'
import { TitlePicker } from './TitlePicker'
import { TrophyHall } from './TrophyHall'

type Tab = 'trophies' | 'notebook' | 'chronicle' | 'titles'
const TABS: ReadonlyArray<{ id: Tab; label: string; Icon: typeof Crown }> = [
  { id: 'trophies', label: 'Trophies', Icon: Crown },
  { id: 'notebook', label: 'Notebook', Icon: NotebookPen },
  { id: 'chronicle', label: 'Chronicle', Icon: ScrollText },
  { id: 'titles', label: 'Titles', Icon: BookOpen },
]

/** Hall of Trophies, Personal Notebook, Chronicles Log and Titles in one tabbed card. */
export function LegacyPanel({ ctx, lowPower }: { ctx: TitleContext; lowPower: boolean }) {
  const [tab, setTab] = useState<Tab>('trophies')
  return (
    <section className="glass rounded-2xl p-4" aria-label="Legacy">
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-black/20 p-1" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            data-tab={id}
            onClick={() => setTab(id)}
            className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${tab === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {tab === 'trophies' && <TrophyHall ctx={ctx} lowPower={lowPower} />}
      {tab === 'notebook' && <NotebookPanel matches={ctx.profile.matches} notes={ctx.profile.notebook.notes} />}
      {tab === 'chronicle' && <ChroniclePanel profile={ctx.profile} />}
      {tab === 'titles' && <TitlePicker ctx={ctx} />}
    </section>
  )
}
