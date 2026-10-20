import { Cloud, CloudAlert, CloudCheck, Eye, EyeOff, Flag, Handshake, Loader2, LogOut, Mail, Swords, Trophy, UserRound, WifiOff, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { sfx } from '../../audio'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { accountStore, patchUser, signOut, signedIn } from '../../online/ranked/account'
import { api } from '../../online/ranked/api'
import { resolveConflict, syncStore } from '../../online/ranked/cloudSync'
import { type RankedGame, STALE_GAME, clocksNow, rankedResultText } from '../../online/ranked/onlineManager'
import { RANKED_POOLS, poolById } from '../../online/ranked/protocol'
import { getRanked, useRanked } from '../../online/ranked/rankedSession'
import { settingsStore } from '../../stores/settingsStore'
import { PEEKS, hiddenCount, vanishMask } from '../../vanish/vanish'
import type { Color, MoveInput } from '../../types/chess'
import { ChessBoard } from '../board/ChessBoard'
import { ChessClock } from '../game/ChessClock'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { GoogleButton } from './GoogleButton'

/** Sign in (Google or an email link), your rating and record, and your cloud save. */
export function AccountPanel() {
  const account = useStore(accountStore, (a) => a)
  const sync = useStore(syncStore, (s) => s)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const onGoogle = useCallback(async (credential: string) => {
    setError(null)
    try {
      signedIn((await api.google(credential)).user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
    }
  }, [])

  if (account.status === 'loading') {
    return (
      <section className="glass flex items-center gap-2 rounded-3xl p-5 text-sm text-slate-400" data-account="loading">
        <Loader2 className="size-4 animate-spin" /> Connecting to the game server…
      </section>
    )
  }
  if (account.status === 'unavailable') {
    return (
      <section className="glass rounded-3xl p-5 text-sm" data-account="unavailable">
        <div className="flex items-center gap-2 font-semibold text-slate-200">
          <WifiOff className="size-4 text-amber-300" /> Ranked play is offline
        </div>
        <p className="mt-1 text-xs text-slate-400">{account.message} Playing a friend with a room code (below) still works.</p>
      </section>
    )
  }
  if (account.status === 'signed-in') {
    const u = account.user
    return (
      <section className="glass space-y-3 rounded-3xl p-5" data-account="signed-in">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-300 to-indigo-600 text-ink-950">
            <UserRound className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-white">{u.name}</div>
            <div className="truncate text-[11px] text-slate-400">{u.email ?? 'Google account'}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl font-bold text-white" data-online-rating>
              {u.rating}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">online rating</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-mono">
            {u.wins}W · {u.losses}L · {u.draws}D
          </span>
          <SyncBadge />
          <button type="button" onClick={() => void signOut()} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-slate-300 hover:bg-white/5" data-sign-out>
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
        <RenameRow name={u.name} />
        {sync.status === 'conflict' && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3 text-xs" data-sync-conflict>
            <div className="mb-2 font-semibold text-amber-100">This device and your cloud save both have progress. Which should we keep?</div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => void resolveConflict('device')}>
                This device ({sync.device.elo} Elo · {sync.device.games} games)
              </Button>
              <Button size="sm" variant="primary" onClick={() => void resolveConflict('cloud')}>
                Cloud ({sync.cloud.elo} Elo · {sync.cloud.games} games)
              </Button>
            </div>
          </div>
        )}
      </section>
    )
  }

  const cfg = account.config
  return (
    <section className="glass space-y-3 rounded-3xl p-5" data-account="signed-out">
      <div>
        <h3 className="font-display text-lg font-extrabold text-white">Sign in for ranked play</h3>
        <p className="text-xs text-slate-400">Get matched with players around the world, earn an online rating, and keep your progress in the cloud on every device.</p>
      </div>
      {cfg.google && <GoogleButton clientId={cfg.google} onCredential={(c) => void onGoogle(c)} />}
      {cfg.email &&
        (sent ? (
          <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-xs text-emerald-100" data-email-sent>
            Check your inbox: we sent a sign-in link to <b>{sent}</b>. It works once and expires in 15 minutes.
            {cfg.devLinks && <div className="mt-1 text-emerald-200/80">(Development server: the link is printed in the server’s console.)</div>}
          </div>
        ) : (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              setBusy(true)
              setError(null)
              api
                .requestEmailLink(email)
                .then(() => setSent(email.trim()))
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not send the email.'))
                .finally(() => setBusy(false))
            }}
          >
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email address"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-sky-300/60"
              data-email-input
            />
            <Button type="submit" variant="secondary" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} data-email-submit>
              Email me a link
            </Button>
          </form>
        ))}
      {error && (
        <p className="text-xs text-red-200" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

function SyncBadge() {
  const sync = useStore(syncStore, (s) => s)
  if (sync.status === 'off') return null
  const [Icon, text, tone] =
    sync.status === 'synced'
      ? [CloudCheck, 'Cloud save on', 'text-emerald-300']
      : sync.status === 'syncing'
        ? [Cloud, 'Saving…', 'text-slate-300']
        : sync.status === 'conflict'
          ? [CloudAlert, 'Choose a save', 'text-amber-200']
          : [CloudAlert, sync.message, 'text-red-200']
  return (
    <span className={`flex items-center gap-1 ${tone}`} data-sync={sync.status}>
      <Icon className="size-3.5" /> {text}
    </span>
  )
}

function RenameRow({ name }: { name: string }) {
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const changed = value.trim() !== name && value.trim().length >= 2
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        api
          .rename(value)
          .then((r) => {
            patchUser(r.user)
            setError(null)
          })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not rename.'))
      }}
    >
      <input value={value} maxLength={20} onChange={(e) => setValue(e.target.value)} aria-label="Display name" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-sky-300/60" />
      <Button type="submit" size="sm" disabled={!changed}>
        Rename
      </Button>
      {error && <span className="text-[11px] text-red-200">{error}</span>}
    </form>
  )
}

/** Find Match: choose a time control and get paired with a player of similar rating. */
export function FindMatchPanel() {
  const account = useStore(accountStore, (a) => a)
  const view = useRanked()
  const [pool, setPool] = useState('5+3')
  const now = useTicker(view.phase === 'searching')
  // Signed in → keep the connection to the game server open.
  useEffect(() => {
    if (account.status === 'signed-in') getRanked().connect()
  }, [account.status])
  if (account.status !== 'signed-in') return null
  const searching = view.phase === 'searching' && view.searching
  return (
    <section className="glass space-y-3 rounded-3xl p-5" data-ranked="find">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
        <Trophy className="size-3.5" /> Ranked match
      </h3>
      {searching ? (
        <div className="flex items-center gap-3" data-ranked-searching>
          <Loader2 className="size-6 animate-spin text-sky-300" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white">Finding an opponent…</div>
            <div className="text-xs text-slate-400">
              {poolById(searching.pool)?.label} · {Math.floor((now - searching.since) / 1000)}s · {searching.queued > 1 ? `${searching.queued} players searching` : 'the search widens as you wait'}
            </div>
          </div>
          <Button variant="ghost" onClick={() => getRanked().cancelSearch()} icon={<X className="size-4" />} data-ranked-cancel>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Time control">
            {RANKED_POOLS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === pool}
                onClick={() => setPool(p.id)}
                className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${p.id === pool ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="primary" size="lg" className="w-full" icon={<Swords className="size-5" />} onClick={() => getRanked().findMatch(pool)} disabled={view.phase === 'connecting' || view.phase === 'offline'} data-find-match>
            {view.phase === 'connecting' || view.phase === 'offline' ? 'Connecting…' : 'Find match'}
          </Button>
        </>
      )}
      {view.error && <p className="text-xs text-amber-200">{view.error}</p>}
    </section>
  )
}

function useTicker(running: boolean, every = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), every)
    return () => window.clearInterval(id)
  }, [running, every])
  return now
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
/** How long a Vanishing peek shows the whole board. */
const PEEK_MS = 1500

/** A ranked game in progress (or just finished). */
export function RankedGameView({ game }: { game: RankedGame }) {
  const ranked = getRanked()
  const view = useRanked()
  const settings = useStore(settingsStore, (s) => s)
  const [confirmResign, setConfirmResign] = useState(false)
  // Vanishing Chess: pieces fade a few moves after they last moved; three peeks per game.
  const vanish = poolById(game.pool)?.mode === 'vanish'
  const [peeks, setPeeks] = useState({ gameId: game.gameId, left: PEEKS })
  const [peeking, setPeeking] = useState(false)
  const peeksLeft = peeks.gameId === game.gameId ? peeks.left : PEEKS
  useEffect(() => {
    if (!peeking) return
    const t = window.setTimeout(() => setPeeking(false), PEEK_MS)
    return () => window.clearTimeout(t)
  }, [peeking])
  const mask = vanish && !game.result && !peeking ? vanishMask(START_FEN, game.moves) : null
  const now = useTicker(!game.result && (game.running !== null || game.opponentAwayUntil !== null))
  const clocks = clocksNow(game, now)
  const me = game.color
  const them: Color = me === 'w' ? 'b' : 'w'
  const turn: Color = game.moves.length % 2 === 0 ? 'w' : 'b'
  const pool = poolById(game.pool)
  const initial = (pool?.minutes ?? 5) * 60_000
  const onMove = useCallback((m: MoveInput) => ranked.move(m), [ranked])
  const onPickup = useCallback(() => sfx.pickup(), [])
  const awayFor = game.opponentAwayUntil !== null ? Math.max(0, Math.ceil((game.opponentAwayUntil - now) / 1000)) : null
  const status = game.result ? rankedResultText(game) : awayFor !== null ? `Your opponent disconnected — they have ${awayFor}s to return` : turn === me ? 'Your move' : `${game.opponent.name} is thinking…`
  const delta = game.result ? game.result.rating.after - game.result.rating.before : 0
  const myName = useMemo(() => (view.me ? `${view.me.name}` : 'You'), [view.me])

  const bar = (color: Color, name: string, rating: number | null, mine: boolean) => (
    <div className="glass flex items-center gap-3 rounded-2xl px-3 py-2" data-ranked-player={mine ? 'me' : 'them'}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-lg ${color === 'w' ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-slate-100 ring-1 ring-white/20'}`}>♚</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">
          {name} {mine && <span className="text-xs font-normal text-slate-400">(you)</span>}
        </div>
        <div className="font-mono text-xs text-slate-400">{rating ?? 'Vanishing rating'}</div>
      </div>
      {turn === color && !game.result && <span className="size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.7)]" aria-label="To move" />}
      <ChessClock timeMs={clocks[color]} active={game.running === color && !game.result} initialMs={initial} />
    </div>
  )

  return (
    <div className="safe-px mx-auto grid w-full max-w-6xl flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" data-ranked="playing">
      <div className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        {bar(them, game.opponent.name, game.opponent.rating, false)}
        <ChessBoard
          id={`ranked-${game.gameId}`}
          fen={game.fen}
          orientation={me}
          lastMove={game.lastMove}
          movableColor={!game.result && turn === me ? me : null}
          onMove={onMove}
          onPickup={onPickup}
          theme={getBoardTheme(settings.boardTheme)}
          pieceSet={getPieceSet(settings.pieceSet)}
          lowPower={settings.batterySaver}
          showLegalMoves={settings.showLegalMoves}
          showCoordinates={settings.showCoordinates}
          pieceOpacity={mask}
        />
        {bar(me, myName, vanish ? null : (view.me?.rating ?? 0), true)}
      </div>
      <aside className="flex flex-col gap-3">
        {game.label && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-semibold text-amber-100" data-ranked-label>
            <Trophy className="mr-1 inline size-3.5" /> {game.label}
          </div>
        )}
        {vanish && !game.result && (
          <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2 text-xs text-slate-300" data-vanish-online>
            <EyeOff className="size-4 shrink-0 text-fuchsia-300" />
            <span className="flex-1">{mask ? `${hiddenCount(mask)} pieces hidden` : 'Peeking…'}</span>
            <Button size="sm" onClick={() => (setPeeks({ gameId: game.gameId, left: peeksLeft - 1 }), setPeeking(true))} disabled={peeksLeft <= 0 || peeking} icon={<Eye className="size-4" />} data-vanish-online-peek>
              Peek ({peeksLeft})
            </Button>
          </div>
        )}
        <div className={`glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${awayFor !== null && !game.result ? 'text-amber-200' : 'text-slate-200'}`} role="status" data-ranked-status>
          {awayFor !== null && !game.result ? <WifiOff className="size-4 shrink-0" /> : <Trophy className="size-4 shrink-0 text-sky-300" />}
          <span>{status}</span>
        </div>
        {game.result && view.error === STALE_GAME && (
          <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs text-amber-100" data-stale-game>
            {STALE_GAME}
          </p>
        )}
        {game.result && game.result.reason !== 'aborted' && (
          <div className="glass rounded-2xl px-4 py-3 text-center" data-ranked-rating-change>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">{vanish ? 'Vanishing rating' : 'Online rating'}</div>
            <div className="font-mono text-2xl font-bold text-white">
              {game.result.rating.after}{' '}
              <span className={delta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                ({delta >= 0 ? '+' : ''}
                {delta})
              </span>
            </div>
          </div>
        )}
        {game.drawOffer && !game.result && (
          <div className="glass rounded-2xl border border-sky-300/30 p-3 text-sm">
            {game.drawOffer === me ? (
              <span className="text-slate-300">Draw offered — waiting for an answer…</span>
            ) : (
              <>
                <div className="mb-2 font-semibold text-white">{game.opponent.name} offers a draw</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="primary" onClick={() => ranked.answerDraw(true)}>
                    Accept
                  </Button>
                  <Button onClick={() => ranked.answerDraw(false)}>Decline</Button>
                </div>
              </>
            )}
          </div>
        )}
        {game.result ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => ranked.findMatch(game.pool)} icon={<Swords className="size-4" />} data-ranked-again>
              New match
            </Button>
            <Button variant="ghost" onClick={() => ranked.dismissGame()} data-ranked-close>
              Back
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={game.drawOffer !== null || game.moves.length < 2} onClick={() => ranked.offerDraw()} icon={<Handshake className="size-4" />}>
              Offer draw
            </Button>
            <Button variant="ghost" onClick={() => setConfirmResign(true)} icon={<Flag className="size-4" />} data-ranked-resign>
              {game.moves.length < 2 ? 'Abort' : 'Resign'}
            </Button>
          </div>
        )}
        <p className="px-1 text-[11px] text-slate-500">{pool?.label} · rated{vanish ? ' (Vanishing rating)' : ''} · the server keeps the official clock.</p>
      </aside>
      <Modal
        open={confirmResign}
        title={game.moves.length < 2 ? 'Abort this game?' : 'Resign this game?'}
        onClose={() => setConfirmResign(false)}
        size="sm"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setConfirmResign(false)}>
              Keep playing
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmResign(false)
                ranked.resign()
              }}
              data-ranked-resign-confirm
            >
              {game.moves.length < 2 ? 'Abort' : 'Resign'}
            </Button>
          </div>
        }
      >
        <p className="py-2 text-sm text-slate-300">{game.moves.length < 2 ? 'Before both sides have moved, the game is simply cancelled (no rating change).' : 'Your opponent wins and your rating changes.'}</p>
      </Modal>
    </div>
  )
}
