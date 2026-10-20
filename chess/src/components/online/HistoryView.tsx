import { ArrowLeft, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Crown, EyeOff, History, Layers, Loader2, RefreshCw, Swords } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { type HistoryGame, type HistoryRow, api } from '../../online/ranked/api'
import { replayAt, replayLength } from '../../online/ranked/history'
import { poolById } from '../../online/ranked/protocol'
import { CARDS_POOL } from '../../online/ranked/modeProtocol'
import { settingsStore } from '../../stores/settingsStore'
import { ChessBoard } from '../board/ChessBoard'
import { RoyaleBoard } from '../royale/RoyaleBoard'
import { Button } from '../ui/Button'

const KIND = {
  chess: { name: 'Ranked', icon: Swords },
  vanish: { name: 'Vanishing', icon: EyeOff },
  cards: { name: 'Card Chess', icon: Layers },
  royale: { name: 'Battle Royale', icon: Crown },
} as const

const RESULT_TONE: Record<HistoryRow['result'], string> = { win: 'text-emerald-300', loss: 'text-red-300', draw: 'text-slate-300', aborted: 'text-slate-500' }
const ordinal = (n: number): string => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
const when = (ms: number): string => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const noop = () => false

function poolLabel(row: Pick<HistoryRow, 'kind' | 'pool'>): string {
  if (row.kind === 'royale') return '4 players'
  if (row.kind === 'cards') return CARDS_POOL.label.replace('Card Chess ', '')
  return poolById(row.pool)?.label ?? row.pool
}

function resultText(row: HistoryRow): string {
  if (row.kind === 'royale') return row.place ? `${ordinal(row.place)} place` : 'Left early'
  return row.result === 'win' ? 'Won' : row.result === 'loss' ? 'Lost' : row.result === 'draw' ? 'Draw' : 'Aborted'
}

/** Your online games (ranked, Vanishing, Card Chess and Battle Royale), newest first, each with a replay. */
export function HistoryView({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [next, setNext] = useState<number | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  /** Fetches a page (the first, or the one before `before`); state changes only when the answer arrives. */
  const fetchPage = useCallback((before?: number) => {
    api
      .history(before)
      .then((r) => {
        setRows((prev) => (before ? [...prev, ...r.games] : r.games))
        setNext(r.next)
        setState('ready')
        setError(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load your games.')
        if (!before) setState('error')
      })
      .finally(() => setMore(false))
  }, [])
  const load = (before?: number) => {
    if (before) setMore(true)
    else setState('loading')
    fetchPage(before)
  }

  useEffect(() => fetchPage(), [fetchPage])

  if (open) return <ReplayView id={open} onBack={() => setOpen(null)} />

  return (
    <div className="safe-px mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 pb-4" data-history>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="size-4" />} data-history-back>
          Online
        </Button>
        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold tracking-wider text-white">
          <History className="size-5 text-sky-300" /> Game history
        </h2>
      </div>
      {state === 'loading' && (
        <div className="glass flex items-center gap-2 rounded-3xl p-5 text-sm text-slate-300" data-history-state="loading">
          <Loader2 className="size-4 animate-spin" /> Loading your games…
        </div>
      )}
      {state === 'error' && (
        <div className="glass flex items-center gap-3 rounded-3xl p-5 text-sm text-red-100" role="alert" data-history-state="error">
          <span className="flex-1">{error}</span>
          <Button size="sm" onClick={() => load()} icon={<RefreshCw className="size-4" />}>
            Try again
          </Button>
        </div>
      )}
      {state === 'ready' && rows.length === 0 && (
        <div className="glass rounded-3xl p-5 text-sm text-slate-300" data-history-state="empty">
          No online games yet. Your ranked, Vanishing, Card Chess and Battle Royale games will appear here, each with a replay.
        </div>
      )}
      {rows.length > 0 && (
        <ul className="glass divide-y divide-white/5 overflow-hidden rounded-3xl" data-history-list>
          {rows.map((row) => {
            const k = KIND[row.kind]
            const Icon = k.icon
            return (
              <li key={row.id}>
                <button type="button" onClick={() => setOpen(row.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none" data-history-row={row.kind}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-sky-200">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {row.kind === 'royale' ? `vs ${row.opponents.join(', ')}` : `vs ${row.opponents[0] ?? 'Player'}`}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {k.name} · {poolLabel(row)} · {row.moves} moves · {when(row.endedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-sm font-semibold ${RESULT_TONE[row.result]}`}>{resultText(row)}</span>
                    {row.result !== 'aborted' && (
                      <span className={`block font-mono text-[11px] ${row.ratingChange >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {row.ratingChange >= 0 ? '+' : ''}
                        {row.ratingChange}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {next !== null && state === 'ready' && (
        <Button onClick={() => load(next)} disabled={more} icon={more ? <Loader2 className="size-4 animate-spin" /> : undefined} data-history-more>
          Load older games
        </Button>
      )}
      {error && state === 'ready' && <p className="text-xs text-amber-200">{error}</p>}
    </div>
  )
}

/** One finished game, move by move. */
function ReplayView({ id, onBack }: { id: string; onBack: () => void }) {
  const settings = useStore(settingsStore, (s) => s)
  const [game, setGame] = useState<HistoryGame | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ply, setPly] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    api
      .historyGame(id)
      .then((g) => {
        if (!live) return
        setGame(g)
        setError(null)
        // Start at the final position: that is what people come to see.
        setPly(replayLength(g))
      })
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : 'Could not load this game.'))
    return () => {
      live = false
    }
  }, [id, attempt])

  const total = game ? replayLength(game) : 0
  const frame = useMemo(() => (game ? replayAt(game, ply) : null), [game, ply])
  // The whole move list (for the list beside the board), worked out once per game.
  const allMoves = useMemo(() => {
    if (!game || game.kind === 'royale') return []
    const f = replayAt(game, replayLength(game))
    return f.kind === 'board' ? f.moves : []
  }, [game])

  // Arrow keys step through the game.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1))
      else if (e.key === 'ArrowRight') setPly((p) => Math.min(total, p + 1))
      else if (e.key === 'Home') setPly(0)
      else if (e.key === 'End') setPly(total)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  const back = (
    <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="size-4" />} data-replay-back>
      History
    </Button>
  )
  if (error) {
    return (
      <div className="safe-px mx-auto w-full max-w-3xl space-y-3 pb-4">
        {back}
        <div className="glass flex items-center gap-3 rounded-3xl p-5 text-sm text-red-100" role="alert">
          <span className="flex-1">{error}</span>
          <Button size="sm" onClick={() => setAttempt((a) => a + 1)} icon={<RefreshCw className="size-4" />}>
            Try again
          </Button>
        </div>
      </div>
    )
  }
  if (!game || !frame) {
    return (
      <div className="safe-px mx-auto w-full max-w-3xl space-y-3 pb-4">
        {back}
        <div className="glass flex items-center gap-2 rounded-3xl p-5 text-sm text-slate-300">
          <Loader2 className="size-4 animate-spin" /> Loading the game…
        </div>
      </div>
    )
  }

  const title = game.kind === 'royale' ? `Battle Royale · ${game.seats.join(', ')}` : `${game.white ?? 'Player'} (White) vs ${game.black ?? 'Player'} (Black)`
  const outcome =
    game.kind === 'royale'
      ? `You finished ${ordinal(game.ranking.indexOf(game.seat) + 1)} (${game.reason === 'points' ? 'on points' : 'last king standing'})`
      : game.reason === 'aborted'
        ? 'Aborted (unrated)'
        : game.winner === null
          ? `Draw (${game.reason})`
          : `${game.winner === game.color ? 'You won' : 'You lost'} (${game.reason})`

  return (
    <div className="safe-px mx-auto grid w-full max-w-6xl flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" data-replay={game.kind}>
      <div className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 16rem)), 44rem)' }}>
        {frame.kind === 'board' && (
          <ChessBoard
            id={`replay-${game.id}`}
            fen={frame.fen}
            orientation={game.kind === 'royale' ? 'w' : game.color}
            lastMove={frame.lastMove}
            movableColor={null}
            onMove={noop}
            theme={getBoardTheme(settings.boardTheme)}
            pieceSet={getPieceSet(settings.pieceSet)}
            lowPower={settings.batterySaver}
            showLegalMoves={false}
            showCoordinates={settings.showCoordinates}
          />
        )}
        {frame.kind === 'royale' && game.kind === 'royale' && <RoyaleBoard game={frame.game} seat={game.seat} selected={null} targets={[]} onCell={() => {}} />}
        {frame.kind === 'none' && <div className="glass rounded-2xl p-5 text-sm text-slate-300">{frame.reason}</div>}
        {frame.kind !== 'none' && (
          <div className="glass flex items-center justify-between gap-1 rounded-2xl p-1.5" role="toolbar" aria-label="Replay controls">
            <Button size="sm" variant="ghost" aria-label="Start" onClick={() => setPly(0)} disabled={ply === 0} icon={<ChevronFirst className="size-4" />} />
            <Button size="sm" variant="ghost" aria-label="Previous move" onClick={() => setPly((p) => Math.max(0, p - 1))} disabled={ply === 0} icon={<ChevronLeft className="size-4" />} data-replay-prev />
            <span className="font-mono text-xs text-slate-300" aria-live="polite" data-replay-ply>
              {ply} / {total}
            </span>
            <Button size="sm" variant="ghost" aria-label="Next move" onClick={() => setPly((p) => Math.min(total, p + 1))} disabled={ply >= total} icon={<ChevronRight className="size-4" />} data-replay-next />
            <Button size="sm" variant="ghost" aria-label="End" onClick={() => setPly(total)} disabled={ply >= total} icon={<ChevronLast className="size-4" />} />
          </div>
        )}
      </div>
      <aside className="flex flex-col gap-3">
        {back}
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">{KIND[game.kind].name}</div>
          <div className="mt-1 text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs text-slate-300" data-replay-outcome>
            {outcome} · {game.ratingChange >= 0 ? '+' : ''}
            {game.ratingChange} rating
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{when(game.endedAt)}</div>
        </div>
        {allMoves.length > 0 && (
          <ol className="glass grid max-h-72 grid-cols-2 gap-x-2 overflow-auto rounded-2xl p-3 font-mono text-[11px]" aria-label="Moves">
            {allMoves.map((san, i) => (
              <li key={i}>
                <button type="button" onClick={() => setPly(i + 1)} className={`w-full rounded px-1 text-left ${i + 1 === ply ? 'bg-sky-400/20 text-white' : 'text-slate-300 hover:bg-white/5'} ${san.includes(':') ? 'text-amber-200' : ''}`}>
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}
                  {san}
                </button>
              </li>
            ))}
          </ol>
        )}
        <p className="px-1 text-[11px] text-slate-500">Use ← and → to step through the game.</p>
      </aside>
    </div>
  )
}
