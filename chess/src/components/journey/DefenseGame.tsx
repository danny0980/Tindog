import { ArrowLeft, Coins, Heart, Lightbulb, RefreshCw, Shield } from 'lucide-react'
import { useMemo, useState } from 'react'
import { sfx } from '../../audio'
import { playPieceSound } from '../../audio/pieceSounds'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { RECRUIT_COST, type DefensePiece, type DefenseState, act, hint, movesFrom, newDefense, recruitSquares, wavesHeld } from '../../journey/defense'
import { payRewards, recordJourney } from '../../journey/journeyActions'
import { journeyStore } from '../../journey/journeyStore'
import { settingsStore } from '../../stores/settingsStore'
import { Button } from '../ui/Button'
import { PieceIcon } from '../ui/PieceIcon'
import { Pill } from './ui'

const FILES = 'abcdefgh'
const RECRUITS: DefensePiece[] = ['p', 'n', 'b', 'r', 'q']
const NAMES: Record<DefensePiece, string> = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen' }

/** "Hold the Line": chess tower defence on a board of its own. */
export function DefenseGame({ onLeave }: { onLeave: () => void }) {
  const settings = useStore(settingsStore, (s) => s)
  const best = useStore(journeyStore, (j) => j.modes.defenseBest)
  const [state, setState] = useState<DefenseState>(() => newDefense(Date.now() % 100_000))
  const [selected, setSelected] = useState<string | null>(null)
  const [recruit, setRecruit] = useState<DefensePiece | null>(null)
  const [booked, setBooked] = useState(false)
  const theme = getBoardTheme(settings.boardTheme)
  const pieceSet = getPieceSet(settings.pieceSet)
  const targets = useMemo(() => (recruit ? recruitSquares(state) : selected ? movesFrom(state, selected) : []), [recruit, selected, state])

  const play = (next: DefenseState | null) => {
    if (!next) {
      sfx.error()
      return
    }
    const captured = next.captures > state.captures
    playPieceSound(theme.material, captured ? 'capture' : 'move')
    if (next.lives < state.lives) sfx.severeCheck()
    if (next.wave > state.wave) sfx.achievement()
    setState(next)
    setSelected(null)
    setRecruit(null)
    if (next.over && !booked) {
      setBooked(true)
      const held = wavesHeld(next)
      journeyStore.set((j) => ({ ...j, modes: { ...j.modes, defenseRuns: j.modes.defenseRuns + 1, defenseBest: Math.max(j.modes.defenseBest, held) } }))
      recordJourney({ outcome: null, base: 10 + held * 12 })
      if (held > 0) payRewards([{ kind: 'coins', amount: held * 25 }], `Held ${held} wave${held === 1 ? '' : 's'}`)
      sfx.defeat()
    }
  }

  const tap = (sq: string) => {
    if (state.over) return
    if (recruit) return play(act(state, { kind: 'recruit', type: recruit, to: sq }))
    const unit = state.grid[sq]
    if (selected && targets.includes(sq)) return play(act(state, { kind: 'move', from: selected, to: sq }))
    if (unit?.side === 'me') {
      sfx.pickup()
      setSelected(sq === selected ? null : sq)
    } else setSelected(null)
  }

  const restart = () => {
    setState(newDefense(Date.now() % 100_000))
    setSelected(null)
    setRecruit(null)
    setBooked(false)
  }

  const squares: string[] = []
  for (let r = 8; r >= 1; r--) for (let f = 0; f < 8; f++) squares.push(`${FILES[f]}${r}`)
  const h = hint(state)

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" data-defense>
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        <div className="relative grid aspect-square grid-cols-8 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10" role="grid" aria-label="Hold the Line board">
          {squares.map((sq, i) => {
            const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1
            const u = state.grid[sq]
            const isTarget = targets.includes(sq)
            const isLast = state.last.includes(sq)
            const danger = sq.endsWith('2') && Object.entries(state.grid).some(([k, x]) => x.side === 'foe' && k[0] === sq[0] && Number(k[1]) <= 3)
            return (
              <button
                key={sq}
                type="button"
                onClick={() => tap(sq)}
                data-square={sq}
                aria-label={`${sq}${u ? `: ${u.side === 'me' ? 'your' : 'enemy'} ${NAMES[u.type]}` : ''}`}
                className="relative flex items-center justify-center"
                style={dark ? theme.darkSquare : theme.lightSquare}
              >
                {sq.endsWith('1') && <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-red-500/50" aria-hidden="true" />}
                {danger && <span className="pointer-events-none absolute inset-0 animate-pulse-soft bg-red-500/20" aria-hidden="true" />}
                {isLast && <span className="pointer-events-none absolute inset-0 bg-amber-300/25" aria-hidden="true" />}
                {selected === sq && <span className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-accent" aria-hidden="true" />}
                {u && <PieceIcon color={u.side === 'me' ? 'w' : 'b'} type={u.type} set={pieceSet} className="relative z-10 size-[86%]" />}
                {isTarget && <span className={`pointer-events-none absolute z-20 rounded-full ${u ? 'inset-1 ring-4 ring-red-400/70' : 'size-1/4 bg-black/30'}`} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>
      <aside className="flex flex-col gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-accent" />
            <span className="font-display text-lg font-bold text-white">Hold the Line</span>
            <Pill tone="gold">Best {best}</Pill>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/[0.05] py-1.5">
              <div className="text-[10px] text-slate-500 uppercase">Wave</div>
              <div className="font-mono text-lg font-bold text-white" data-defense-wave>{state.wave}</div>
            </div>
            <div className="rounded-xl bg-white/[0.05] py-1.5">
              <div className="text-[10px] text-slate-500 uppercase">Lives</div>
              <div className="flex justify-center gap-0.5 pt-1" data-defense-lives={state.lives}>
                {Array.from({ length: 3 }, (_, i) => (
                  <Heart key={i} className={`size-4 ${i < state.lives ? 'fill-red-400 text-red-400' : 'text-slate-600'}`} />
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.05] py-1.5">
              <div className="text-[10px] text-slate-500 uppercase">Gold</div>
              <div className="flex items-center justify-center gap-1 font-mono text-lg font-bold text-yellow-300">
                <Coins className="size-4" />
                {state.gold}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Enemy pawns march down; knights join from wave 3. Move one piece a turn, or recruit one onto your first two ranks. Each enemy that reaches rank 1 costs a life.</p>
        </div>
        <div className="glass rounded-2xl p-3">
          <div className="mb-1.5 text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">Recruit (uses your turn)</div>
          <div className="grid grid-cols-5 gap-1.5">
            {RECRUITS.map((t) => (
              <button
                key={t}
                type="button"
                disabled={state.gold < RECRUIT_COST[t] || state.over}
                onClick={() => {
                  setSelected(null)
                  setRecruit(recruit === t ? null : t)
                }}
                data-recruit={t}
                className={`flex flex-col items-center rounded-xl border p-1.5 text-[10px] transition disabled:opacity-40 ${recruit === t ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/[0.03]'}`}
              >
                <PieceIcon color="w" type={t} set={pieceSet} className="size-7" />
                <span className="font-mono text-yellow-300">{RECRUIT_COST[t]}</span>
              </button>
            ))}
          </div>
          {recruit && <div className="mt-1.5 text-xs text-amber-200">Tap an empty square on ranks 1–2 to place your {NAMES[recruit].toLowerCase()}.</div>}
        </div>
        <ul className="glass space-y-1 rounded-2xl p-3 text-xs text-slate-300" aria-live="polite" data-defense-log>
          {state.log.map((l, i) => (
            <li key={`${state.turn}-${i}`}>{l}</li>
          ))}
        </ul>
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" disabled={!h || state.over} icon={<Lightbulb className="size-4" />} onClick={() => h && h.kind === 'move' && (setRecruit(null), setSelected(h.from))}>
            Hint
          </Button>
          <Button size="sm" variant={state.over ? 'primary' : 'secondary'} icon={<RefreshCw className="size-4" />} onClick={restart} data-defense-restart>
            {state.over ? 'Again' : 'Restart'}
          </Button>
          <Button size="sm" variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onLeave}>
            Back
          </Button>
        </div>
        {state.over && (
          <div className="glass rounded-2xl p-4 text-center" data-defense-over>
            <div className="font-display text-2xl font-extrabold text-white">The line has fallen</div>
            <div className="text-sm text-slate-300">
              You held {wavesHeld(state)} wave{wavesHeld(state) === 1 ? '' : 's'} and captured {state.captures} enemies.
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
