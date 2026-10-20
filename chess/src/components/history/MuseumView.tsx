import { BookOpen, Landmark, Lock, Mic } from 'lucide-react'
import { useMemo, useState } from 'react'
import { loreFor } from '../../data/classic/lore'
import { rivalsOf } from '../../data/classic/rivals'
import { CLASSIC_ERAS, CLASSIC_ROSTER, type ClassicCharacter, getClassic } from '../../data/classic/roster'
import { TIMELINE_TICKS, formatYear, parseLived, timelinePosition } from '../../data/classic/years'
import { classicPersona } from '../../data/personas'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { InterviewModal } from './InterviewPanel'
import { useBeatenClassics } from './useBeaten'

const WIDTH = 2600
const LANE = 52
const GAP = 46

interface Placed {
  c: ClassicCharacter
  year: number
  x: number
  lane: number
}

/** Everyone on the timeline, spread into lanes so markers never overlap. */
function place(): { placed: Placed[]; lanes: number } {
  const items = CLASSIC_ROSTER.map((c) => ({ c, year: parseLived(loreFor(c.id)?.lived ?? '')?.year ?? 0 }))
    .map((i) => ({ ...i, x: timelinePosition(i.year) * WIDTH }))
    .sort((a, b) => a.x - b.x)
  const ends: number[] = []
  const placed = items.map((i) => {
    let lane = ends.findIndex((end) => i.x - end >= GAP)
    if (lane === -1) {
      lane = ends.length
      ends.push(i.x)
    } else ends[lane] = i.x
    return { ...i, lane }
  })
  return { placed, lanes: ends.length }
}

const { placed, lanes } = place()

/** Personal Timeline & Trophy Museum: history from 2300 BCE fills up as you beat its people. */
export function MuseumView() {
  const beaten = useBeatenClassics()
  const beatenIds = useMemo(() => new Set(beaten.map((c) => c.id)), [beaten])
  const [open, setOpen] = useState<ClassicCharacter | null>(null)
  const [interview, setInterview] = useState<ClassicCharacter | null>(null)
  const pct = Math.round((beaten.length / CLASSIC_ROSTER.length) * 100)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5" data-museum>
      <section className="glass rounded-3xl p-4" aria-label="Personal Timeline">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">Personal Timeline · 2300 BCE → today</h3>
          <span className="font-mono text-xs text-slate-400" data-museum-count>
            {beaten.length}/{CLASSIC_ROSTER.length} · {pct}%
          </span>
        </div>
        <div className="overflow-x-auto pb-2" tabIndex={0} aria-label="Timeline, scroll sideways">
          <div className="relative" style={{ width: WIDTH + 40, height: lanes * LANE + 46 }}>
            {/* Era bands */}
            <div className="absolute inset-x-5 bottom-6 h-1.5 rounded-full bg-gradient-to-r from-amber-500/60 via-sky-500/60 to-fuchsia-500/60" />
            {TIMELINE_TICKS.map((y) => (
              <div key={y} className="absolute bottom-0 -translate-x-1/2 text-[10px] font-mono text-slate-500" style={{ left: 20 + timelinePosition(y) * WIDTH }}>
                <div className="mx-auto mb-1 h-3 w-px bg-white/25" />
                {formatYear(y)}
              </div>
            ))}
            {placed.map(({ c, year, x, lane }) => {
              const won = beatenIds.has(c.id)
              const era = CLASSIC_ERAS.find((e) => e.id === c.era)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpen(c)}
                  data-timeline={c.id}
                  data-beaten={won ? 'true' : 'false'}
                  title={`${c.name} · ${formatYear(year)}`}
                  className={`absolute flex size-10 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold transition hover:z-10 hover:scale-125 ${won ? 'text-ink-950 shadow-[0_0_18px_-2px_rgba(251,191,36,0.8)] ring-2 ring-amber-200' : 'bg-white/[0.06] text-slate-500 ring-1 ring-white/10'}`}
                  style={{ left: 20 + x, bottom: 40 + lane * LANE, ...(won && era ? { background: `linear-gradient(145deg, ${era.from}, ${era.to})` } : {}) }}
                >
                  {won ? (c.name.replace(/^(The|Sir|Queen|Captain) /, '')[0] ?? '?') : <Lock className="size-3" />}
                  <span className="sr-only">{won ? `${c.name}, beaten` : `${c.name}, not yet beaten`}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section aria-label="Trophy Museum">
        <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">
          <Landmark className="size-3.5" /> Hall of statues
        </h3>
        {beaten.length === 0 ? (
          <p className="glass rounded-3xl p-6 text-center text-sm text-slate-400">The hall is empty. Beat a Classic Chess opponent and their statue will stand here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" style={{ perspective: '900px' }}>
            {beaten.map((c) => (
              <Statue key={c.id} c={c} onOpen={() => setOpen(c)} />
            ))}
          </div>
        )}
      </section>

      <Plaque c={open} beaten={open ? beatenIds.has(open.id) : false} onClose={() => setOpen(null)} onInterview={(c) => { setOpen(null); setInterview(c) }} />
      <InterviewModal c={interview} onClose={() => setInterview(null)} />
    </div>
  )
}

/** A bronze-and-marble statue: the portrait as the bust, the plaque on the plinth. */
function Statue({ c, onOpen }: { c: ClassicCharacter; onOpen: () => void }) {
  const persona = classicPersona(c)
  const lived = loreFor(c.id)?.lived ?? ''
  return (
    <button type="button" onClick={onOpen} data-statue={c.id} className="group flex flex-col items-center text-center [transform-style:preserve-3d]">
      <div className="transition duration-500 [transform:rotateX(8deg)] group-hover:[transform:rotateX(0deg)_rotateY(-12deg)_translateZ(18px)]">
        <PortraitEmblem spec={persona.portrait} label={c.name} size="lg" className="sepia-[0.35] shadow-[0_18px_30px_-12px_rgba(0,0,0,0.9)]" ring="ring-amber-200/70" />
      </div>
      <div className="-mt-1 h-3 w-20 rounded-t-md bg-gradient-to-b from-slate-300 to-slate-500 shadow-inner" aria-hidden="true" />
      <div className="w-full rounded-b-lg rounded-t-sm bg-gradient-to-b from-slate-500 via-slate-700 to-slate-900 px-2 py-2 shadow-[0_14px_24px_-10px_rgba(0,0,0,0.8)]">
        <div className="rounded border border-amber-300/50 bg-gradient-to-b from-amber-200/90 to-amber-500/90 px-1.5 py-1 text-ink-950">
          <div className="truncate text-[11px] font-extrabold uppercase tracking-wide">{c.name}</div>
          <div className="truncate text-[9px] font-semibold">{lived}</div>
        </div>
      </div>
    </button>
  )
}

function Plaque({ c, beaten, onClose, onInterview }: { c: ClassicCharacter | null; beaten: boolean; onClose: () => void; onInterview: (c: ClassicCharacter) => void }) {
  const lore = c ? loreFor(c.id) : null
  const rivals = c ? rivalsOf(c.id).map((id) => getClassic(id)?.name).filter((n): n is string => typeof n === 'string') : []
  return (
    <Modal
      open={c !== null}
      title={c?.name ?? ''}
      onClose={onClose}
      footer={
        c && beaten ? (
          <Button variant="primary" className="w-full" onClick={() => onInterview(c)} icon={<Mic className="size-4" />} data-plaque-interview>
            Interview {c.name}
          </Button>
        ) : (
          <p className="text-center text-xs text-slate-400">Beat {c?.name ?? 'them'} in Classic Chess to raise their statue and interview them.</p>
        )
      }
    >
      {c && (
        <div className="space-y-3" data-plaque={c.id}>
          <div className="flex items-center gap-3">
            <PortraitEmblem spec={classicPersona(c).portrait} label={c.name} size="md" locked={!beaten} />
            <div>
              <div className="text-sm font-semibold text-white">{c.title}</div>
              <div className="text-xs text-slate-400">{lore?.lived}</div>
            </div>
          </div>
          {lore && <p className="text-sm leading-relaxed text-slate-300">{lore.bio}</p>}
          {lore && beaten && (
            <ul className="space-y-1.5 text-xs text-slate-300">
              {lore.facts.map((f) => (
                <li key={f} className="flex gap-1.5">
                  <BookOpen className="mt-0.5 size-3 shrink-0 text-amber-200" /> {f}
                </li>
              ))}
            </ul>
          )}
          {rivals.length > 0 && <p className="text-xs text-violet-200">Historical rival: {rivals.join(', ')}. Choose either as your avatar and face the other for a special meeting.</p>}
        </div>
      )}
    </Modal>
  )
}
