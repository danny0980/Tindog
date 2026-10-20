import { Check, Copy, Flag, Globe2, Handshake, Link2, Loader2, LogOut, RefreshCw, Share2, Swords, UserRound, Users, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { sfx } from '../audio'
import { ChessBoard } from '../components/board/ChessBoard'
import { ChessClock } from '../components/game/ChessClock'
import { CapturedPieces } from '../components/game/CapturedPieces'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { getBoardTheme, getPieceSet } from '../constants/themes'
import { useStore } from '../hooks/useStore'
import { type MatchState, clocksAt, hasClock, replay, resultText, turnOf } from '../online/match'
import { getOnlineSession, onlineName, onlineScreen, useOnlineSession } from '../online/onlineSession'
import { useRanked } from '../online/ranked/rankedSession'
import { AccountPanel, FindMatchPanel, RankedGameView } from '../components/online/Ranked'
import { type ColorChoice, TIME_CONTROLS, parseRoomCode, trimName } from '../online/protocol'
import { profileStore } from '../stores/profileStore'
import { settingsStore, updateSettings } from '../stores/settingsStore'
import type { Color, MoveInput } from '../types/chess'
import { getCapturedPieces } from '../utils/chess'

const COLORS: ReadonlyArray<{ id: ColorChoice; label: string }> = [
  { id: 'w', label: 'White' },
  { id: 'random', label: 'Random' },
  { id: 'b', label: 'Black' },
]

/** The invite link for a room: this app's address with ?room=CODE. */
const inviteLink = (code: string): string => {
  const url = new URL(window.location.href)
  url.search = `?room=${code}`
  url.hash = ''
  return url.toString()
}

/** Online play: create a room and share its code, or join a friend's. Peer-to-peer, no account. */
export function OnlineView({ inviteCode, onInviteUsed }: { inviteCode: string | null; onInviteUsed: () => void }) {
  const view = useOnlineSession()
  const session = getOnlineSession()
  const ranked = useRanked()

  useEffect(() => {
    onlineScreen.visible = true
    return () => {
      onlineScreen.visible = false
    }
  }, [])

  // An invite link opens straight into the room.
  useEffect(() => {
    if (!inviteCode) return
    if (session.state.phase === 'idle' || session.state.phase === 'error') session.join(inviteCode)
    onInviteUsed()
  }, [inviteCode, session, onInviteUsed])

  // A ranked game (matched by the server) takes the screen while it runs, and until you leave its result.
  if (ranked.game) return <RankedGameView game={ranked.game} />
  if (view.phase === 'playing' && view.match) return <OnlineGame match={view.match} opponent={view.opponent} link={view.link} />
  if (view.phase === 'opening' || view.phase === 'waiting') return <WaitingRoom code={view.code ?? ''} ready={view.phase === 'waiting'} onCancel={() => session.leave()} />
  if (view.phase === 'joining') return <Connecting code={view.code ?? ''} onCancel={() => session.leave()} />
  return <Lobby error={view.error} />
}

function Lobby({ error }: { error: string | null }) {
  const session = getOnlineSession()
  const name = useStore(settingsStore, (s) => s.onlineName)
  const tcId = useStore(settingsStore, (s) => s.onlineTimeControl)
  const elo = useStore(profileStore, (p) => Math.round(p.elo))
  const [color, setColor] = useState<ColorChoice>('random')
  const [code, setCode] = useState('')
  const parsed = parseRoomCode(code)
  const tc = TIME_CONTROLS.find((t) => t.id === tcId) ?? TIME_CONTROLS[0]!

  return (
    <div className="safe-px mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 pb-4" data-online="lobby">
      <section className="glass relative overflow-hidden rounded-3xl p-6 text-center">
        <div className="pointer-events-none absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-300 to-indigo-600 text-ink-950 shadow-[0_20px_60px_-15px_rgba(56,189,248,0.8)]">
            <Globe2 className="size-10" />
          </div>
          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.3em] text-sky-300">Online</div>
          <h2 className="font-display text-3xl font-extrabold tracking-wider text-white sm:text-4xl">PLAY ONLINE</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Ranked matches against players around the world, or a private game with a friend.</p>
        </div>
      </section>

      <AccountPanel />
      <FindMatchPanel />

      <h3 className="mt-2 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400" data-online-friends>
        <Users className="size-3.5" /> Play a friend · no account needed
      </h3>

      {error && (
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100" role="alert" data-online-error>
          {error}
        </div>
      )}

      <section className="glass space-y-4 rounded-3xl p-5">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
            <UserRound className="size-3.5" /> Your name
          </span>
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-sky-300/60"
            value={name}
            maxLength={20}
            placeholder="Chess player"
            onChange={(e) => updateSettings({ onlineName: trimName(e.target.value) === '' ? '' : e.target.value.slice(0, 20) })}
            onBlur={(e) => updateSettings({ onlineName: trimName(e.target.value) })}
            data-online-name
          />
          <span className="mt-1 block text-[11px] text-slate-500">Your opponent sees this name and your rating ({elo}).</span>
        </label>

        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Clock</div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Clock">
            {TIME_CONTROLS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.id === tc.id}
                onClick={() => updateSettings({ onlineTimeControl: t.id })}
                className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${t.id === tc.id ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">You play</div>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Your colour">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === color}
                onClick={() => setColor(c.id)}
                className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${c.id === color ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <Button variant="primary" size="lg" className="w-full" icon={<Users className="size-5" />} onClick={() => session.host(tc.tc, color)} data-online-create>
          Create a room
        </Button>
      </section>

      <section className="glass rounded-3xl p-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (parsed) session.join(parsed)
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-lg uppercase tracking-[0.3em] text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:border-sky-300/60"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Friend's code or invite link"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            data-online-code-input
          />
          <Button type="submit" variant="secondary" size="lg" disabled={!parsed} icon={<Link2 className="size-5" />} data-online-join>
            Join
          </Button>
        </form>
        <p className="mt-2 text-[11px] text-slate-500">Moves travel directly between your two devices (WebRTC). Ratings aren't changed by online games.</p>
      </section>
    </div>
  )
}

function WaitingRoom({ code, ready, onCancel }: { code: string; ready: boolean; onCancel: () => void }) {
  const [copied, setCopied] = useState(false)
  const link = inviteLink(code)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  const canShare = typeof navigator.share === 'function'
  return (
    <div className="safe-px mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 pb-4" data-online="waiting">
      <section className="glass rounded-3xl p-6 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-sky-300">Your room</div>
        <div className="mt-3 flex justify-center gap-1.5 sm:gap-2" aria-label={`Room code ${code.split('').join(' ')}`} data-online-code={code}>
          {code.split('').map((c, i) => (
            <span key={i} className="flex h-14 w-11 items-center justify-center rounded-xl border border-sky-300/40 bg-sky-400/10 font-mono text-3xl font-bold text-white sm:h-16 sm:w-12">
              {c}
            </span>
          ))}
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-300">
          {ready ? (
            <>
              <Loader2 className="size-4 animate-spin text-sky-300" /> Waiting for your friend to join…
            </>
          ) : (
            <>
              <Loader2 className="size-4 animate-spin text-slate-400" /> Opening the room…
            </>
          )}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="primary" onClick={() => void copy()} disabled={!ready} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} data-online-copy>
            {copied ? 'Link copied' : 'Copy invite link'}
          </Button>
          {canShare ? (
            <Button variant="secondary" disabled={!ready} onClick={() => void navigator.share({ title: 'Chronos Chess', text: `Play me at chess! Room code ${code}`, url: link }).catch(() => {})} icon={<Share2 className="size-4" />}>
              Share
            </Button>
          ) : (
            <Button variant="ghost" onClick={onCancel} icon={<LogOut className="size-4" />}>
              Cancel
            </Button>
          )}
        </div>
        {canShare && (
          <Button variant="ghost" className="mt-2 w-full" onClick={onCancel} icon={<LogOut className="size-4" />}>
            Cancel
          </Button>
        )}
      </section>
      <p className="text-center text-xs text-slate-500">Keep this screen open (or this app in the background) until your friend joins.</p>
    </div>
  )
}

function Connecting({ code, onCancel }: { code: string; onCancel: () => void }) {
  return (
    <div className="safe-px mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-4 pb-4 pt-10 text-center" data-online="joining">
      <Loader2 className="size-10 animate-spin text-sky-300" />
      <p className="text-sm text-slate-300">
        Connecting to room <span className="font-mono font-bold tracking-[0.2em] text-white">{code}</span>…
      </p>
      <Button variant="ghost" onClick={onCancel} icon={<LogOut className="size-4" />}>
        Cancel
      </Button>
    </div>
  )
}

function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(id)
  }, [running])
  return now
}

function OnlineGame({ match, opponent, link }: { match: MatchState; opponent: { name: string; elo: number } | null; link: 'connected' | 'reconnecting' | 'offline' }) {
  const session = getOnlineSession()
  const settings = useStore(settingsStore, (s) => s)
  const elo = useStore(profileStore, (p) => Math.round(p.elo))
  const theme = getBoardTheme(settings.boardTheme)
  const [confirmResign, setConfirmResign] = useState(false)
  const [resultSeen, setResultSeen] = useState<string | null>(null)
  const clockRunning = hasClock(match) && match.turnStartedAt !== null && !match.result
  const now = useNow(clockRunning)
  const clocks = clocksAt(match, now)
  const turn = turnOf(match)
  const me = match.myColor
  const them: Color = me === 'w' ? 'b' : 'w'
  const captured = useMemo(() => getCapturedPieces(replay(match.moves)?.history({ verbose: true }) ?? []), [match.moves])
  const onMove = useCallback((m: MoveInput) => session.move(m), [session])
  const onPickup = useCallback(() => sfx.pickup(), [])
  const initial = match.game.tc.minutes * 60_000
  const showResult = match.result !== null && resultSeen !== match.game.gameId

  const bar = (color: Color, name: string, rating: number, mine: boolean) => (
    <div className="glass flex items-center gap-3 rounded-2xl px-3 py-2" data-online-player={mine ? 'me' : 'them'}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-lg ${color === 'w' ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-slate-100 ring-1 ring-white/20'}`}>♚</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">
          {name} {mine && <span className="text-xs font-normal text-slate-400">(you)</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono">{rating}</span>
          <CapturedPieces pieces={captured[color]} pieceColor={color === 'w' ? 'b' : 'w'} pieceSet={getPieceSet(settings.pieceSet)} advantage={Math.max(0, color === 'w' ? captured.materialDiff : -captured.materialDiff)} />
        </div>
      </div>
      {turn === color && !match.result && <span className="size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.7)]" aria-label="To move" />}
      {hasClock(match) && <ChessClock timeMs={clocks[color]} active={turn === color && clockRunning} initialMs={initial} />}
    </div>
  )

  const status = match.result
    ? resultText(match.result, me)
    : link === 'reconnecting'
      ? 'Connection lost — reconnecting…'
      : link === 'offline'
        ? 'Disconnected'
        : turn === me
          ? 'Your move'
          : `${opponent?.name ?? 'Opponent'} is thinking…`

  return (
    <div className="safe-px mx-auto grid w-full max-w-6xl flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" data-online="playing">
      <div className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        {bar(them, opponent?.name ?? 'Opponent', opponent?.elo ?? 0, false)}
        <ChessBoard
          id={`online-${match.game.gameId}`}
          fen={match.fen}
          orientation={me}
          lastMove={match.lastMove}
          movableColor={!match.result && turn === me ? me : null}
          onMove={onMove}
          onPickup={onPickup}
          theme={theme}
          pieceSet={getPieceSet(settings.pieceSet)}
          lowPower={settings.batterySaver}
          showLegalMoves={settings.showLegalMoves}
          showCoordinates={settings.showCoordinates}
        />
        {bar(me, onlineName(), elo, true)}
      </div>

      <aside className="flex flex-col gap-3">
        <div className={`glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${link !== 'connected' && !match.result ? 'text-amber-200' : 'text-slate-200'}`} role="status" data-online-status>
          {link !== 'connected' && !match.result ? <WifiOff className="size-4 shrink-0" /> : <Swords className="size-4 shrink-0 text-sky-300" />}
          <span className="truncate">{status}</span>
        </div>

        {match.drawOffer && !match.result && (
          <div className="glass rounded-2xl border border-sky-300/30 p-3 text-sm" data-online-draw-offer>
            {match.drawOffer.from === me ? (
              <span className="text-slate-300">Draw offered — waiting for an answer…</span>
            ) : (
              <>
                <div className="mb-2 font-semibold text-white">{opponent?.name ?? 'Your opponent'} offers a draw</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="primary" onClick={() => session.answerDraw(true)} data-online-draw-accept>
                    Accept
                  </Button>
                  <Button variant="secondary" onClick={() => session.answerDraw(false)}>
                    Decline
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {!match.result ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={match.drawOffer !== null || match.moves.length < 2} onClick={() => session.offerDraw()} icon={<Handshake className="size-4" />} data-online-offer-draw>
              Offer draw
            </Button>
            <Button variant="ghost" onClick={() => setConfirmResign(true)} icon={<Flag className="size-4" />} data-online-resign>
              Resign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" disabled={match.rematch.me || link !== 'connected'} onClick={() => session.rematch()} icon={<RefreshCw className="size-4" />} data-online-rematch>
              {match.rematch.me ? 'Rematch asked…' : match.rematch.them ? 'Accept rematch' : 'Rematch'}
            </Button>
            <Button variant="ghost" onClick={() => session.leave()} icon={<LogOut className="size-4" />} data-online-leave>
              Leave
            </Button>
          </div>
        )}
        <p className="px-1 text-[11px] text-slate-500">
          {hasClock(match) ? `${match.game.tc.minutes}+${match.game.tc.increment} · ` : 'No clock · '}
          the clock starts with White's first move.
        </p>
      </aside>

      <Modal
        open={confirmResign}
        title="Resign this game?"
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
                session.resign()
              }}
              data-online-resign-confirm
            >
              Resign
            </Button>
          </div>
        }
      >
        <p className="py-2 text-sm text-slate-300">Your opponent wins the game.</p>
      </Modal>

      <Modal
        open={showResult}
        title="Game over"
        onClose={() => setResultSeen(match.game.gameId)}
        size="sm"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setResultSeen(match.game.gameId)}>
              View board
            </Button>
            <Button
              variant="primary"
              disabled={match.rematch.me || link !== 'connected'}
              onClick={() => {
                setResultSeen(match.game.gameId)
                session.rematch()
              }}
              icon={<RefreshCw className="size-4" />}
            >
              {match.rematch.them ? 'Accept rematch' : 'Rematch'}
            </Button>
          </div>
        }
      >
        {match.result && (
          <div className="py-2 text-center" data-online-result>
            <div className="font-display text-2xl font-extrabold text-white">{match.result.winner === null ? 'Draw' : match.result.winner === me ? 'Victory' : 'Defeat'}</div>
            <div className="mt-1 text-sm text-slate-300">{resultText(match.result, me)}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}
