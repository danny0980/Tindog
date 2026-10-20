import { Chess } from 'chess.js'
import { DoorOpen, KeyRound, Lightbulb, Lock, LockOpen, ScrollText, Star, Timer } from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useState } from 'react'
import { sfx } from '../../audio'
import { ROOMS, LOCKS, type EscapeRun, attempt, getRoom, hint, inscription, roomOpen, runFen, startRun, starsFor } from '../../escape/escape'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { applyFeat } from '../../stores/featActions'
import { profileStore } from '../../stores/profileStore'
import { settingsStore } from '../../stores/settingsStore'
import type { Color, MoveInput } from '../../types/chess'
import { recordEscape } from '../../utils/feats'
import { ChessBoard } from '../board/ChessBoard'
import { Button } from '../ui/Button'

const fmt = (ms: number): string => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`

/** Historical Escape Rooms: four mate puzzles seal each room; every lock reveals a true inscription. */
export function EscapeView() {
  const escaped = useStore(profileStore, (p) => p.modes.escape)
  const [run, setRun] = useState<EscapeRun | null>(null)
  if (run) return <Room run={run} setRun={setRun} />
  const done = new Set(Object.keys(escaped))
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3" data-escape="rooms">
      {ROOMS.map((room, i) => {
        const open = roomOpen(i, done)
        const best = escaped[room.id]
        return (
          <button
            key={room.id}
            type="button"
            disabled={!open}
            onClick={() => setRun(startRun(room.id, Date.now()))}
            data-room={room.id}
            className="glass flex flex-col gap-1 rounded-3xl p-4 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-white/25 disabled:opacity-45"
          >
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
              {open ? <KeyRound className="size-3.5" /> : <Lock className="size-3.5" />} Room {i + 1} · mates in {room.mateIn}
            </span>
            <span className="font-display text-lg font-extrabold text-white">{room.name}</span>
            <span className="text-xs text-slate-400">{room.intro}</span>
            {best ? (
              <span className="mt-1 flex items-center gap-1 text-xs text-emerald-200">
                <DoorOpen className="size-3.5" /> Escaped in {fmt(best.bestMs)} · {'★'.repeat(best.stars)}
                {'☆'.repeat(3 - best.stars)}
              </span>
            ) : (
              !open && <span className="mt-1 text-xs text-slate-500">Escape the room before to open it.</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Room({ run, setRun }: { run: EscapeRun; setRun: (r: EscapeRun | null) => void }) {
  const room = getRoom(run.roomId)!
  const settings = useStore(settingsStore, (s) => s)
  const [shown, setShown] = useState<string | null>(null)
  const [opened, setOpened] = useState<number[]>([])
  const [shake, setShake] = useState(0)
  const [hintFrom, setHintFrom] = useState<string | null>(null)
  const [finished, setFinished] = useState<{ ms: number; stars: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const fen = shown ?? runFen(run) ?? ''
  const turn: Color = fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const [orientation, setOrientation] = useState<Color>(turn)
  const onPickup = useCallback(() => sfx.pickup(), [])

  useEffect(() => {
    if (finished) return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [finished])

  const onMove = (m: MoveInput): boolean => {
    if (finished || shown) return false
    const uci = `${m.from}${m.to}${m.promotion ?? ''}`
    const { run: next, outcome } = attempt(run, uci)
    setHintFrom(null)
    if (outcome.kind === 'wrong') {
      sfx.error()
      setShake((s) => s + 1)
      setRun(next)
      return false
    }
    // Show your move first; the defender answers a moment later.
    const chess = new Chess(fen)
    try {
      chess.move({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) })
    } catch {
      return false
    }
    setShown(chess.fen())
    window.setTimeout(() => {
      setShown(null)
      setRun(next)
      if (outcome.kind === 'lock-open') {
        sfx.puzzleSolved()
        setOpened((o) => [...o, outcome.lock])
        const nextFen = runFen(next)
        if (nextFen) setOrientation(nextFen.split(' ')[1] === 'b' ? 'b' : 'w')
      } else if (outcome.kind === 'escaped') {
        sfx.victory()
        setOpened((o) => [...o, LOCKS - 1])
        const ms = Date.now() - run.startedAt
        const stars = starsFor(next)
        setFinished({ ms, stars })
        applyFeat((p) => recordEscape(p, room.id, ms, stars, ROOMS.length))
      }
    }, outcome.kind === 'correct' ? 450 : 700)
    sfx.pickup()
    return true
  }

  const hintStyle: Record<string, CSSProperties> = hintFrom ? { [hintFrom]: { boxShadow: 'inset 0 0 0 4px rgba(251,191,36,0.95)', background: 'rgba(251,191,36,0.25)' } } : {}

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" data-escape={room.id}>
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        <ChessBoard
          id="escape-board"
          fen={fen}
          orientation={orientation}
          lastMove={null}
          movableColor={!finished && !shown ? turn : null}
          onMove={onMove}
          onPickup={onPickup}
          theme={getBoardTheme(room.theme)}
          pieceSet={getPieceSet(settings.pieceSet)}
          lowPower={settings.batterySaver}
          showLegalMoves={settings.showLegalMoves}
          showCoordinates
          shakeKey={shake}
          extraSquareStyles={hintStyle}
        />
      </div>
      <aside className="flex flex-col gap-3">
        <div className="glass space-y-2 rounded-2xl p-4">
          <div className="font-display text-lg font-extrabold text-white">{room.name}</div>
          <p className="text-xs italic text-slate-400">{room.intro}</p>
          <div className="flex items-center gap-2" aria-label="Locks" data-escape-locks={opened.length}>
            {Array.from({ length: LOCKS }, (_, i) => (
              <span key={i} className={`flex size-9 items-center justify-center rounded-xl ${opened.includes(i) ? 'bg-emerald-400/20 text-emerald-200' : i === run.lock && !finished ? 'bg-amber-300/20 text-amber-200 ring-1 ring-amber-300' : 'bg-white/5 text-slate-500'}`}>
                {opened.includes(i) ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <Timer className="size-3.5" /> {fmt((finished?.ms ?? now - run.startedAt) || 0)}
            </span>
            <span>
              {run.mistakes} mistake{run.mistakes === 1 ? '' : 's'} · {run.hints} hint{run.hints === 1 ? '' : 's'}
            </span>
          </div>
          {!finished && (
            <p className="text-sm text-white" role="status" data-escape-status>
              Lock {run.lock + 1}: {turn === 'w' ? 'White' : 'Black'} to move and mate.
            </p>
          )}
        </div>
        {opened.map((lock) => (
          <div key={lock} className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.07] p-3 text-xs text-slate-200" data-inscription={lock}>
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
              <ScrollText className="size-3.5" /> Inscription {lock + 1}
            </div>
            {inscription(room, lock)}
          </div>
        ))}
        {finished ? (
          <div className="glass space-y-2 rounded-2xl p-4 text-center" data-escaped>
            <DoorOpen className="mx-auto size-8 text-emerald-300" />
            <div className="font-display text-xl font-extrabold text-white">You escaped!</div>
            <div className="text-sm text-slate-300">
              {fmt(finished.ms)} ·{' '}
              {Array.from({ length: 3 }, (_, i) => (
                <Star key={i} className={`inline size-4 ${i < finished.stars ? 'fill-amber-300 text-amber-300' : 'text-slate-600'}`} />
              ))}
            </div>
            <Button variant="primary" className="w-full" onClick={() => setRun(null)}>
              Back to the rooms
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                const h = hint(run)
                setRun(h.run)
                setHintFrom(h.from)
              }}
              icon={<Lightbulb className="size-4" />}
              data-escape-hint
            >
              Hint
            </Button>
            <Button variant="secondary" onClick={() => setRun(null)}>
              Leave the room
            </Button>
          </div>
        )}
      </aside>
    </div>
  )
}
