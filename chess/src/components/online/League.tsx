import { CalendarClock, Crown, Eye, Loader2, LogOut, Medal, Plus, RefreshCw, Shield, Swords, Trophy, Tv, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEngine } from '../../hooks/useEngine'
import { useStore } from '../../hooks/useStore'
import { scoreToCp } from '../../engine/scoring'
import { accountStore } from '../../online/ranked/account'
import { type ClanInfo, type ClansInfo, type LiveGameRow, type SeasonInfo, api } from '../../online/ranked/api'
import type { BoardThemeId, PieceSetId } from '../../types/theme'
import { type WatchGame, clocksNow } from '../../online/ranked/onlineManager'
import { poolById } from '../../online/ranked/protocol'
import { getRanked, useRanked } from '../../online/ranked/rankedSession'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { settingsStore } from '../../stores/settingsStore'
import { ChessBoard } from '../board/ChessBoard'
import { ChessClock } from '../game/ChessClock'
import { Button } from '../ui/Button'

type Tab = 'season' | 'tournament' | 'watch' | 'clans'
const TABS: ReadonlyArray<{ id: Tab; label: string; icon: typeof Medal }> = [
  { id: 'season', label: 'Season', icon: Medal },
  { id: 'tournament', label: 'Tournament', icon: Trophy },
  { id: 'watch', label: 'Watch', icon: Tv },
  { id: 'clans', label: 'Clans', icon: Shield },
]

const TIER_STYLE: Record<string, string> = {
  legend: 'from-fuchsia-300 to-amber-300 text-ink-950',
  diamond: 'from-cyan-200 to-sky-400 text-ink-950',
  platinum: 'from-teal-200 to-emerald-400 text-ink-950',
  gold: 'from-amber-200 to-yellow-500 text-ink-950',
  silver: 'from-slate-200 to-slate-400 text-ink-950',
  bronze: 'from-orange-300 to-amber-700 text-ink-950',
}
const tierName = (id: string, tiers: SeasonInfo['tiers']): string => tiers.find((t) => t.id === id)?.name ?? id

/** A small fetch hook: data, error, reload. It loads again whenever `key` changes. */
function useApi<T>(load: () => Promise<T>, key = ''): { data: T | null; error: string | null; reload: () => void } {
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])
  const [state, setState] = useState<{ data: T | null; error: string | null; n: number }>({ data: null, error: null, n: 0 })
  const reload = useCallback(() => setState((s) => ({ ...s, n: s.n + 1 })), [])
  useEffect(() => {
    let alive = true
    loadRef.current()
      .then((data) => alive && setState((s) => ({ ...s, data, error: null })))
      .catch((err: unknown) => alive && setState((s) => ({ ...s, error: err instanceof Error ? err.message : 'Could not load.' })))
    return () => {
      alive = false
    }
  }, [state.n, key])
  return { data: state.data, error: state.error, reload }
}

/** Seasons, the weekly tournament, live games to watch, and clans. */
export function LeaguePanel() {
  const [tab, setTab] = useState<Tab>('season')
  const account = useStore(accountStore, (a) => a)
  if (account.status === 'loading' || account.status === 'unavailable') return null
  return (
    <section className="glass space-y-3 rounded-3xl p-4" data-league>
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/[0.05] p-1" role="tablist" aria-label="League">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-league-tab={t.id} className={`flex items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold sm:text-xs ${tab === t.id ? 'bg-accent text-ink-950' : 'text-slate-300'}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'season' && <SeasonTab />}
      {tab === 'tournament' && <TournamentTab signedIn={account.status === 'signed-in'} dev={account.config.dev === true} />}
      {tab === 'watch' && <WatchTab signedIn={account.status === 'signed-in'} />}
      {tab === 'clans' && <ClansTab signedIn={account.status === 'signed-in'} />}
    </section>
  )
}

function Problem({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <p className="flex items-center gap-2 text-xs text-red-200" role="alert">
      {error}
      <button type="button" className="underline" onClick={onRetry}>
        Retry
      </button>
    </p>
  )
}

const Loading = () => (
  <p className="flex items-center gap-1.5 text-xs text-slate-400">
    <Loader2 className="size-3.5 animate-spin" /> Loading…
  </p>
)

function SeasonTab() {
  const { data, error, reload } = useApi(api.season)
  const [now] = useState(() => Date.now())
  if (error) return <Problem error={error} onRetry={reload} />
  if (!data) return <Loading />
  const days = Math.max(0, Math.ceil((data.endsAt - now) / 86_400_000))
  return (
    <div className="space-y-3" data-season={data.season}>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold text-slate-200">Season {data.season}</span>
        <span>
          {days} day{days === 1 ? '' : 's'} left · then ratings move a quarter of the way back to 1500
        </span>
      </div>
      {data.me && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3" data-season-me>
          <span className={`rounded-xl bg-gradient-to-br px-3 py-2 font-display text-sm font-extrabold ${TIER_STYLE[data.me.tier] ?? ''}`}>{tierName(data.me.tier, data.tiers)}</span>
          <div className="min-w-0 flex-1 text-xs text-slate-300">
            <div className="font-mono text-lg font-bold text-white">{data.me.rating}</div>
            {data.me.games} games · {data.me.wins} wins · peak {data.me.peak}
            {data.me.rank ? ` · #${data.me.rank}` : ''}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {data.tiers.map((t) => (
          <span key={t.id} className={`rounded-md bg-gradient-to-br px-1.5 py-0.5 font-bold ${TIER_STYLE[t.id] ?? ''}`}>
            {t.name} {t.min > 0 ? `${t.min}+` : ''}
          </span>
        ))}
      </div>
      {data.table.length === 0 ? (
        <p className="text-xs text-slate-500">Nobody has played a rated game this season yet.</p>
      ) : (
        <ol className="space-y-1" aria-label="Season table">
          {data.table.slice(0, 15).map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1 text-xs">
              <span className="w-5 font-mono text-slate-500">{i + 1}</span>
              <span className={`rounded bg-gradient-to-br px-1 text-[9px] font-bold ${TIER_STYLE[r.tier] ?? ''}`}>{tierName(r.tier, data.tiers)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-200">{r.name}</span>
              <span className="font-mono text-white">{r.rating}</span>
            </li>
          ))}
        </ol>
      )}
      {data.history.length > 0 && (
        <div className="text-[11px] text-slate-400">
          Past seasons: {data.history.slice(0, 4).map((h) => `${h.season} ${tierName(h.tier, data.tiers)} #${h.rank}`).join(' · ')}
        </div>
      )}
    </div>
  )
}

function TournamentTab({ signedIn, dev }: { signedIn: boolean; dev: boolean }) {
  const { data, error, reload } = useApi(api.tournament)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // The server pings when sign-ups or results change.
  useEffect(() => getRanked().onEvent((e) => e.kind === 'tournament' && reload()), [reload])
  if (error) return <Problem error={error} onRetry={reload} />
  if (!data) return <Loading />
  const act = (fn: () => Promise<unknown>) => {
    setBusy(true)
    setMessage(null)
    fn()
      .then(reload)
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : 'Something went wrong.'))
      .finally(() => setBusy(false))
  }
  const starts = new Date(data.startsAt)
  return (
    <div className="space-y-3" data-tournament={data.status}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 to-orange-500 text-ink-950">
          <Trophy className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-extrabold text-white">{data.name}</div>
          <div className="text-xs text-slate-400">
            32-player knockout · {poolById(data.pool)?.label ?? data.pool} · rated
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-300">
            <CalendarClock className="size-3.5" />
            {data.status === 'signup' ? `Starts ${starts.toLocaleString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' })}` : data.status === 'running' ? 'In progress' : 'Finished'} · {data.entrants.length}/32 signed up
          </div>
        </div>
      </div>
      {data.previous?.champion && (
        <p className="flex items-center gap-1.5 text-xs text-amber-200">
          <Crown className="size-3.5" /> Last champion: {data.previous.champion.name} ({data.previous.players} players)
        </p>
      )}
      {data.status === 'signup' &&
        (signedIn ? (
          <div className="grid grid-cols-2 gap-2">
            {data.joined ? (
              <Button variant="secondary" disabled={busy} onClick={() => act(api.leaveTournament)} data-tournament-leave>
                Withdraw
              </Button>
            ) : (
              <Button variant="primary" disabled={busy} onClick={() => act(api.joinTournament)} icon={<Swords className="size-4" />} data-tournament-join>
                Sign up
              </Button>
            )}
            {dev && (
              <Button variant="ghost" disabled={busy} onClick={() => act(api.startTournament)} data-tournament-start>
                Start now (dev)
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Sign in to take part.</p>
        ))}
      {data.joined && data.status === 'signup' && <p className="text-[11px] text-slate-400">Be online in this tab when it starts: a player who isn’t there forfeits. A draw sends the higher seed through.</p>}
      {message && <p className="text-xs text-red-200">{message}</p>}
      {data.rounds.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1" data-bracket>
          {data.rounds.map((round, r) => (
            <div key={r} className="min-w-44 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{round.length === 1 ? 'Final' : round.length === 2 ? 'Semi-finals' : round.length === 4 ? 'Quarter-finals' : `Round of ${round.length * 2}`}</div>
              {round.map((m, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-[11px]">
                  {(['a', 'b'] as const).map((s) => (
                    <div key={s} className={`flex justify-between gap-2 ${m.winner === s ? 'font-semibold text-emerald-200' : m.winner ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      <span className="truncate">{m[s]?.name ?? 'bye'}</span>
                      <span className="font-mono">{m[s]?.rating ?? ''}</span>
                    </div>
                  ))}
                  {m.gameId && !m.winner && (
                    <button type="button" className="mt-1 flex items-center gap-1 text-sky-300" onClick={() => getRanked().watch(m.gameId!)} disabled={!signedIn}>
                      <Eye className="size-3" /> Watch live
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {data.champion && (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
          <Crown className="size-4" /> Champion: {data.champion.name}
        </p>
      )}
    </div>
  )
}

function WatchTab({ signedIn }: { signedIn: boolean }) {
  const { data, error, reload } = useApi(api.live)
  useEffect(() => {
    const t = window.setInterval(reload, 10_000)
    return () => window.clearInterval(t)
  }, [reload])
  if (error) return <Problem error={error} onRetry={reload} />
  if (!data) return <Loading />
  return (
    <div className="space-y-2" data-watch>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Rated games being played right now</span>
        <button type="button" onClick={reload} className="flex items-center gap-1 hover:text-white" aria-label="Refresh">
          <RefreshCw className="size-3.5" />
        </button>
      </div>
      {data.games.length === 0 ? (
        <p className="text-xs text-slate-500">No games in progress. Check back soon, or play one yourself!</p>
      ) : (
        data.games.map((g: LiveGameRow) => (
          <div key={g.gameId} className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-2 text-xs" data-live-game={g.gameId}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-slate-100">
                {g.white.name} <span className="font-mono text-slate-400">{g.white.rating}</span> vs {g.black.name} <span className="font-mono text-slate-400">{g.black.rating}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {g.label ?? poolById(g.pool)?.label ?? g.pool} · move {Math.floor(g.moves / 2) + 1} · {g.watchers} watching
              </div>
            </div>
            <Button size="sm" disabled={!signedIn} onClick={() => getRanked().watch(g.gameId)} icon={<Eye className="size-3.5" />} data-watch-game>
              Watch
            </Button>
          </div>
        ))
      )}
      {!signedIn && <p className="text-[11px] text-slate-500">Sign in to watch.</p>}
    </div>
  )
}

function ClansTab({ signedIn }: { signedIn: boolean }) {
  const { data, error, reload } = useApi<ClansInfo>(api.clans)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const myClan = data?.mine ?? null
  const mine = useApi<ClanInfo | null>(() => (myClan ? api.clan(myClan) : Promise.resolve(null)), `${myClan}`)
  if (error) return <Problem error={error} onRetry={reload} />
  if (!data) return <Loading />
  const act = (fn: () => Promise<unknown>) => {
    setMessage(null)
    fn()
      .then(reload)
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : 'Something went wrong.'))
  }
  return (
    <div className="space-y-3" data-clans>
      <p className="text-xs text-slate-400">Clan war, week {data.week.split('-W')[1]}: every rated win over another clan’s player earns your clan 3 points (a draw 1, a win over a player without a clan 1).</p>
      {data.last?.winner && (
        <p className="flex items-center gap-1.5 text-xs text-amber-200">
          <Crown className="size-3.5" /> Last week: [{data.last.winner.tag}] {data.last.winner.name} with {data.last.winner.points} points
        </p>
      )}
      {mine.data && (
        <div className="rounded-2xl border border-sky-300/30 bg-sky-400/10 p-3 text-xs" data-my-clan={mine.data.tag}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">
              [{mine.data.tag}] {mine.data.name}
            </span>
            <span className="font-mono text-sky-200">{mine.data.points} pts</span>
          </div>
          <div className="mt-1 text-slate-300">
            {mine.data.members.map((m) => `${m.name} (${m.rating})`).join(', ')}
          </div>
          <button type="button" className="mt-2 flex items-center gap-1 text-slate-400 hover:text-red-200" onClick={() => act(api.leaveClan)} data-clan-leave>
            <LogOut className="size-3.5" /> Leave clan
          </button>
        </div>
      )}
      {data.table.length === 0 ? (
        <p className="text-xs text-slate-500">No clans yet. Found the first one!</p>
      ) : (
        <ol className="space-y-1" aria-label="Clan war table">
          {data.table.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1 text-xs" data-clan-row={c.tag}>
              <span className="w-5 font-mono text-slate-500">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-slate-200">
                [{c.tag}] {c.name}
              </span>
              <span className="flex items-center gap-0.5 text-slate-400">
                <Users className="size-3" /> {c.members}
              </span>
              <span className="w-12 text-right font-mono text-white">{c.points}</span>
              {signedIn && !data.mine && (
                <button type="button" className="text-sky-300 hover:underline" onClick={() => act(() => api.joinClan(c.id))}>
                  Join
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {signedIn && !data.mine && (
        <form
          className="grid grid-cols-[minmax(0,1fr)_5rem_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            act(() => api.createClan(name, tag))
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Clan name" aria-label="Clan name" className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white" data-clan-name />
          <input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} maxLength={5} placeholder="TAG" aria-label="Clan tag" className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-sm text-white" data-clan-tag />
          <Button type="submit" size="sm" icon={<Plus className="size-3.5" />} data-clan-create>
            Found
          </Button>
        </form>
      )}
      {message && <p className="text-xs text-red-200">{message}</p>}
      {!signedIn && <p className="text-[11px] text-slate-500">Sign in to join or found a clan.</p>}
    </div>
  )
}

// ── Spectating ───────────────────────────────────────────────────────────────

/** Evaluations (White's view, centipawns) of the positions as they arrive, from your own Stockfish. */
function useLiveEvals(game: WatchGame): Array<number | null> {
  const engine = useEngine('analysis', true)
  const [evals, setEvals] = useState<{ id: string; values: Array<number | null> }>({ id: game.gameId, values: [] })
  const { search, status } = engine
  const fen = game.fen
  const ply = game.moves.length
  useEffect(() => {
    if (status !== 'ready') return
    let alive = true
    void search(fen, { depth: 12, moveTimeMs: 1500 })
      .then((r) => {
        const top = r.lines[0]
        if (!alive || !top) return
        const cp = scoreToCp(top.score) * (fen.split(' ')[1] === 'b' ? -1 : 1)
        setEvals((e) => {
          const values = e.id === game.gameId ? [...e.values] : []
          values[ply] = cp
          return { id: game.gameId, values }
        })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [fen, game.gameId, ply, search, status])
  return evals.id === game.gameId ? evals.values : []
}

function EvalGraph({ values, plies }: { values: ReadonlyArray<number | null>; plies: number }) {
  const n = Math.max(20, plies)
  const pts: Array<[number, number]> = []
  let last = 0
  for (let i = 0; i <= plies; i++) {
    const v = values[i]
    if (typeof v === 'number') last = v
    pts.push([(i / n) * 200, 30 - Math.max(-5, Math.min(5, last / 100)) * 5.6])
  }
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `0,30 ${line} ${pts.at(-1)?.[0].toFixed(1) ?? 0},30`
  const current = values[plies]
  return (
    <div data-eval-graph>
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        <span>Evaluation</span>
        <span className="font-mono normal-case tracking-normal text-slate-200">{typeof current === 'number' ? `${current >= 0 ? '+' : ''}${(current / 100).toFixed(1)}` : '…'}</span>
      </div>
      <svg viewBox="0 0 200 60" className="h-20 w-full rounded-lg bg-slate-900" role="img" aria-label="Evaluation over the game">
        <rect x="0" y="0" width="200" height="30" fill="rgba(241,245,249,0.04)" />
        <polygon points={area} fill="rgba(241,245,249,0.35)" />
        <polyline points={line} fill="none" stroke="#f8fafc" strokeWidth="0.8" />
        <line x1="0" y1="30" x2="200" y2="30" stroke="rgba(148,163,184,0.5)" strokeWidth="0.3" />
      </svg>
    </div>
  )
}

/** Watching a live rated game: the board, both clocks and a running evaluation graph. */
export function SpectateView({ game }: { game: WatchGame | 'loading' }) {
  const settings = useStore(settingsStore, (s) => s)
  const ranked = useRanked()
  const [now, setNow] = useState(() => Date.now())
  const running = game !== 'loading' && !game.result && game.running !== null
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [running])
  if (game === 'loading')
    return (
      <div className="safe-px mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-3 pt-10 text-center" data-spectate="loading">
        <Loader2 className="size-8 animate-spin text-sky-300" />
        <Button variant="ghost" onClick={() => getRanked().stopWatching()}>
          Cancel
        </Button>
        {ranked.error && <p className="text-xs text-red-200">{ranked.error}</p>}
      </div>
    )
  return <Spectating game={game} now={now} lowPower={settings.batterySaver} theme={settings.boardTheme} pieceSet={settings.pieceSet} />
}

function Spectating({ game, now, lowPower, theme, pieceSet }: { game: WatchGame; now: number; lowPower: boolean; theme: BoardThemeId; pieceSet: PieceSetId }) {
  const evals = useLiveEvals(game)
  const clocks = clocksNow(game, now)
  const initial = (poolById(game.pool)?.minutes ?? 5) * 60_000
  const turn = game.moves.length % 2 === 0 ? 'w' : 'b'
  const noop = useMemo(() => () => false, [])
  const result = game.result ? (game.result.winner === null ? `Draw (${game.result.reason})` : `${game.result.winner === 'w' ? game.white.name : game.black.name} wins (${game.result.reason})`) : null
  const bar = (side: 'w' | 'b') => {
    const p = side === 'w' ? game.white : game.black
    return (
      <div className="glass flex items-center gap-3 rounded-2xl px-3 py-2">
        <span className={`flex size-8 items-center justify-center rounded-lg ${side === 'w' ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-slate-100 ring-1 ring-white/20'}`}>♚</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white">{p.name}</div>
          <div className="font-mono text-xs text-slate-400">{p.rating}</div>
        </div>
        <ChessClock timeMs={clocks[side]} active={!game.result && game.running === side} initialMs={initial} />
      </div>
    )
  }
  return (
    <div className="safe-px mx-auto grid w-full max-w-6xl flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" data-spectate={game.gameId}>
      <div className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        {bar('b')}
        <ChessBoard id={`watch-${game.gameId}`} fen={game.fen} orientation="w" lastMove={game.lastMove} movableColor={null} onMove={noop} theme={getBoardTheme(theme)} pieceSet={getPieceSet(pieceSet)} lowPower={lowPower} showLegalMoves={false} showCoordinates />
        {bar('w')}
      </div>
      <aside className="flex flex-col gap-3">
        <div className="glass rounded-2xl px-4 py-3 text-sm text-slate-200" role="status" data-spectate-status>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">
            <Tv className="size-3.5" /> Watching live
          </div>
          <div className="mt-1">{result ?? `Move ${Math.floor(game.moves.length / 2) + 1} · ${turn === 'w' ? game.white.name : game.black.name} to move`}</div>
          {game.label && <div className="mt-1 text-xs text-amber-200">{game.label}</div>}
        </div>
        <div className="glass rounded-2xl p-3">
          <EvalGraph values={evals} plies={game.moves.length} />
          <p className="mt-1 text-[10px] text-slate-500">Evaluated by Stockfish on your device. Up is good for White.</p>
        </div>
        <Button variant="secondary" onClick={() => getRanked().stopWatching()} data-stop-watching>
          Stop watching
        </Button>
      </aside>
    </div>
  )
}
