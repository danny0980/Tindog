import { Crown, EyeOff, Flag, Layers, Loader2, Play, ShieldCheck, Skull, Sparkles, Swords, Trophy, WifiOff, X } from 'lucide-react'
import { type CSSProperties, type ReactNode, useCallback, useEffect, useState } from 'react'
import { sfx } from '../../audio'
import { CARDS, type CardId, HAND_SIZE } from '../../cards/cardGame'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { accountStore } from '../../online/ranked/account'
import { type ModesInfo, type RatedModeId, api } from '../../online/ranked/api'
import { CARDS_POOL, ROYALE_MOVE_MS } from '../../online/ranked/modeProtocol'
import { seatPlayer } from '../../online/ranked/modeRules'
import { type CardsOnline, type RoyaleOnline, clocksNow } from '../../online/ranked/onlineManager'
import { VANISH_POOLS, poolById } from '../../online/ranked/protocol'
import { getRanked, useRanked } from '../../online/ranked/rankedSession'
import type { Pos } from '../../royale/royale'
import { settingsStore } from '../../stores/settingsStore'
import type { Color, MoveInput, Square } from '../../types/chess'
import { ChessBoard } from '../board/ChessBoard'
import { CardFace } from '../cards/CardFace'
import { ChessClock } from '../game/ChessClock'
import { RoyaleBoard } from '../royale/RoyaleBoard'
import { ROYALE_COLOR, samePos } from '../royale/royaleTheme'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

const SEATS = ['Red', 'Blue', 'Yellow', 'Green'] as const
const MODE_NAME: Record<RatedModeId, string> = { vanish: 'Vanishing Chess', cards: 'Card Chess', royale: 'Battle Royale' }
const REASON: Record<string, string> = {
  checkmate: 'by checkmate',
  stalemate: 'by stalemate',
  insufficient: 'by insufficient material',
  threefold: 'by threefold repetition',
  'fifty-move': 'by the fifty-move rule',
  resign: 'by resignation',
  timeout: 'on time',
  abandon: '— your opponent left',
  aborted: '— game aborted (unrated)',
  'last-king': 'last king standing',
  points: 'on points',
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

const ordinal = (n: number): string => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`

// ── The lobby panel ─────────────────────────────────────────────────────────

/** Online modes: Vanishing Chess (ranked), Card Chess and the four-player Battle Royale. */
export function OnlineModesPanel() {
  const account = useStore(accountStore, (a) => a)
  const view = useRanked()
  const [info, setInfo] = useState<ModesInfo | null>(null)
  const [vanishPool, setVanishPool] = useState(VANISH_POOLS[1]?.id ?? 'vanish-5+3')
  const [table, setTable] = useState<RatedModeId | null>(null)
  const now = useTicker(view.modeSearch !== null || (view.phase === 'searching' && view.searching?.pool.startsWith('vanish-') === true))
  const signedIn = account.status === 'signed-in'
  // Refresh the ratings when a game ends (the panel shows again then).
  const busy = view.cards !== null || view.royale !== null || view.game !== null
  useEffect(() => {
    if (!signedIn || busy) return
    let live = true
    api
      .modes()
      .then((i) => live && setInfo(i))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [signedIn, busy])
  if (!signedIn) return null
  const connecting = view.phase === 'connecting' || view.phase === 'offline'
  const vanishSearch = view.phase === 'searching' && view.searching?.pool.startsWith('vanish-') ? view.searching : null
  const modeSearch = view.modeSearch
  const rating = (m: RatedModeId) => info?.mine?.[m]?.rating ?? 1200

  const searchingRow = (label: string, since: number, queued: number, hint: string) => (
    <div className="flex items-center gap-3 rounded-2xl border border-sky-300/30 bg-sky-400/10 p-3" data-mode-searching>
      <Loader2 className="size-5 shrink-0 animate-spin text-sky-300" />
      <div className="min-w-0 flex-1 text-xs">
        <div className="font-semibold text-white">Finding {label}…</div>
        <div className="text-slate-400">
          {Math.floor((now - since) / 1000)}s · {queued > 1 ? `${queued} players waiting` : hint}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => getRanked().cancelSearch()} icon={<X className="size-4" />} data-mode-cancel>
        Cancel
      </Button>
    </div>
  )

  const card = (mode: RatedModeId, icon: ReactNode, text: string, action: ReactNode) => (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3" data-online-mode={mode}>
      <div className="flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-400/30 to-indigo-500/30 text-fuchsia-100">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-white">{MODE_NAME[mode]}</div>
          <button type="button" className="font-mono text-[11px] text-slate-400 underline-offset-2 hover:underline" onClick={() => setTable(mode)} data-mode-rating={mode}>
            {rating(mode)} · {info?.mine?.[mode]?.games ?? 0} games
          </button>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-slate-400">{text}</p>
      <div className="mt-auto">{action}</div>
    </div>
  )

  return (
    <section className="glass space-y-3 rounded-3xl p-5" data-online-modes>
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">
        <Sparkles className="size-3.5" /> Online modes · each with its own rating
      </h3>
      {vanishSearch && searchingRow(poolById(vanishSearch.pool)?.label ?? 'a Vanishing game', vanishSearch.since, vanishSearch.queued, 'the search widens as you wait')}
      {modeSearch && searchingRow(modeSearch.mode === 'cards' ? 'a Card Chess opponent' : 'a Battle Royale table', modeSearch.since, modeSearch.queued, modeSearch.mode === 'royale' ? 'computer armies fill empty seats after 20 s with two or more, or after a minute alone (unrated)' : 'the search widens as you wait')}
      <div className="grid gap-2 sm:grid-cols-3">
        {card(
          'vanish',
          <EyeOff className="size-5" />,
          'Ranked blindfold chess: pieces fade from view a few moves after they move. Three peeks per game.',
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Vanishing time control">
              {VANISH_POOLS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={p.id === vanishPool} onClick={() => setVanishPool(p.id)} className={`rounded-lg border px-1 py-1 text-[11px] font-semibold ${p.id === vanishPool ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/10 text-slate-300'}`}>
                  {p.minutes} + {p.increment}
                </button>
              ))}
            </div>
            <Button size="sm" variant="primary" className="w-full" disabled={connecting || vanishSearch !== null || modeSearch !== null} onClick={() => getRanked().findMatch(vanishPool)} icon={<Swords className="size-4" />} data-find-vanish>
              Find match
            </Button>
          </div>,
        )}
        {card(
          'cards',
          <Layers className="size-5" />,
          `Both players secretly draft ${HAND_SIZE} of the same five cards, then play ${CARDS_POOL.minutes} + ${CARDS_POOL.increment}. The server referees every card.`,
          <Button size="sm" variant="primary" className="w-full" disabled={connecting || modeSearch !== null || vanishSearch !== null} onClick={() => getRanked().findMode('cards')} icon={<Swords className="size-4" />} data-find-cards>
            Find match
          </Button>,
        )}
        {card(
          'royale',
          <Crown className="size-5" />,
          `Four armies on the cross board, every player for themselves. ${ROYALE_MOVE_MS / 1000} s per move; miss two turns and your army is out.`,
          <Button size="sm" variant="primary" className="w-full" disabled={connecting || modeSearch !== null || vanishSearch !== null} onClick={() => getRanked().findMode('royale')} icon={<Swords className="size-4" />} data-find-royale>
            Find table
          </Button>,
        )}
      </div>
      {view.error && (view.modeSearch || view.cards || view.royale) && <p className="text-xs text-amber-200">{view.error}</p>}
      <Modal open={table !== null} title={table ? `${MODE_NAME[table]} · top players` : ''} onClose={() => setTable(null)} size="sm">
        <ol className="space-y-1 py-2 text-sm" data-mode-table>
          {table && (info?.tables[table] ?? []).length === 0 && <li className="text-slate-400">No rated games yet. Be the first!</li>}
          {table &&
            (info?.tables[table] ?? []).map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex items-center gap-2">
                <span className="w-6 text-right font-mono text-slate-500">{i + 1}</span>
                <span className="flex-1 truncate text-white">{r.name}</span>
                <span className="font-mono text-slate-300">{r.rating}</span>
                <span className="w-16 text-right text-[11px] text-slate-500">{r.games} games</span>
              </li>
            ))}
        </ol>
      </Modal>
    </section>
  )
}

// ── Card Chess online ───────────────────────────────────────────────────────

function ModeResultCard({ text, rating }: { text: string; rating: { before: number; after: number } | null }) {
  const delta = rating ? rating.after - rating.before : 0
  return (
    <div className="glass rounded-2xl px-4 py-3 text-center" data-mode-result>
      <div className="font-display text-lg font-extrabold text-white">{text}</div>
      {rating && (
        <div className="mt-1 font-mono text-sm text-slate-300">
          {rating.after}{' '}
          <span className={delta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
            ({delta >= 0 ? '+' : ''}
            {delta})
          </span>
        </div>
      )}
    </div>
  )
}

export function CardsOnlineView({ cards }: { cards: CardsOnline }) {
  const ranked = getRanked()
  const view = useRanked()
  const settings = useStore(settingsStore, (s) => s)
  const [picked, setPicked] = useState<CardId[]>([])
  const [active, setActive] = useState<CardId | null>(null)
  const [confirmResign, setConfirmResign] = useState(false)
  const onPickup = useCallback(() => sfx.pickup(), [])
  const now = useTicker(!cards.result)
  const me = cards.color
  const them: Color = me === 'w' ? 'b' : 'w'
  const game = cards.game

  if (cards.phase === 'draft' || !game) {
    const mine = cards.hands[me]
    const left = cards.draftEndsAt === null ? 0 : Math.max(0, Math.ceil((cards.draftEndsAt - now) / 1000))
    return (
      <div className="safe-px mx-auto w-full max-w-4xl space-y-4 pb-4" data-cards-online="draft">
        <section className="glass space-y-1 rounded-3xl p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">Card Chess · online draft</div>
          <p className="text-sm text-slate-300">
            You play <b className="text-white">{me === 'w' ? 'White' : 'Black'}</b> against <b className="text-white">{cards.opponent.name}</b> ({cards.opponent.rating}). Pick {HAND_SIZE} of these five; they pick from the same five in secret. Hands are revealed when the game starts.
          </p>
          <p className="font-mono text-xs text-amber-200" data-draft-timer>
            {left}s left — if time runs out, the computer picks for you
          </p>
        </section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cards.offer.map((id) => (
            <CardFace key={id} id={id} selected={(mine ?? picked).includes(id)} onClick={mine ? undefined : () => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < HAND_SIZE ? [...p, id] : p))} />
          ))}
        </div>
        {mine ? (
          <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm text-slate-200" data-draft-waiting>
            <Loader2 className="size-4 animate-spin text-sky-300" /> Waiting for {cards.opponent.name} to draft…
          </div>
        ) : (
          <Button variant="primary" size="lg" className="w-full" disabled={picked.length !== HAND_SIZE} icon={<Play className="size-5" fill="currentColor" />} onClick={() => ranked.draftCards(picked)} data-cards-online-draft>
            {picked.length === HAND_SIZE ? 'Lock in my cards' : `Pick ${HAND_SIZE - picked.length} more`}
          </Button>
        )}
      </div>
    )
  }

  const result = cards.result
  const myTurn = !result && !game.result && game.turn === me
  const activeCard = active && game.available(me).includes(active) && myTurn ? active : null
  const kind = activeCard ? CARDS[activeCard].kind : null
  // The position object is replaced on every change, so these are worked out every render.
  const cardMoves = activeCard && kind !== 'ward' ? game.cardMoves().filter((m) => m.card === activeCard) : []
  const wardTargets = activeCard && kind === 'ward' ? game.wardTargets(activeCard as 'stone-wall' | 'aegis') : []
  const wardStyles: Record<string, CSSProperties> = {}
  for (const w of game.wards) if (w.until > game.ply) wardStyles[w.square] = { boxShadow: `inset 0 0 0 3px ${w.color === me ? 'rgba(52,211,153,0.9)' : 'rgba(244,114,182,0.9)'}`, background: w.color === me ? 'rgba(52,211,153,0.15)' : 'rgba(244,114,182,0.15)' }
  const clocks = clocksNow(cards, now)
  const initial = CARDS_POOL.minutes * 60_000
  const awayFor = cards.opponentAwayUntil !== null ? Math.max(0, Math.ceil((cards.opponentAwayUntil - now) / 1000)) : null

  const onMove = (m: MoveInput): boolean => {
    if (activeCard && kind === 'move') {
      const cm = cardMoves.find((c) => c.from === m.from && c.to === m.to)
      if (cm && ranked.cardAction({ k: 'c', card: cm.card, from: cm.from, to: cm.to })) {
        setActive(null)
        return true
      }
    }
    return ranked.cardAction({ k: 'm', uci: `${m.from}${m.to}${m.promotion ?? ''}` })
  }
  const pick = (sq: Square) => {
    if (!activeCard) return
    if (kind === 'ward') {
      if (ranked.cardAction({ k: 'w', card: activeCard as 'stone-wall' | 'aegis', sq })) setActive(null)
      return
    }
    const cm = cardMoves.find((m) => m.to === sq)
    if (cm && ranked.cardAction({ k: 'c', card: cm.card, from: cm.from, to: cm.to })) setActive(null)
  }

  const resultText = result ? (result.reason === 'aborted' ? 'Game aborted (unrated)' : result.winner === null ? `Draw ${REASON[result.reason] ?? ''}` : `${result.winner === me ? 'You won' : 'You lost'} ${REASON[result.reason] ?? ''}`) : ''
  const status = result ? resultText : awayFor !== null ? `${cards.opponent.name} disconnected — ${awayFor}s to return` : activeCard ? `${CARDS[activeCard].name}: ${kind === 'ward' ? 'tap the piece to protect' : kind === 'drop' ? 'tap a square on your second rank' : 'move a piece to a glowing square'}` : myTurn ? (game.inCheck ? 'Check! Your move' : 'Your move') : `${cards.opponent.name} is thinking…`

  const bar = (color: Color, name: string, rating: number | null, mine: boolean) => (
    <div className="glass flex items-center gap-3 rounded-2xl px-3 py-2" data-cards-player={mine ? 'me' : 'them'}>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-lg ${color === 'w' ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-slate-100 ring-1 ring-white/20'}`}>♚</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{name}</div>
        <div className="font-mono text-[11px] text-slate-400">{rating ?? 'you'}</div>
      </div>
      <ChessClock timeMs={clocks[color]} active={cards.running === color && !result} initialMs={initial} />
    </div>
  )

  return (
    <div className="safe-px mx-auto grid w-full max-w-6xl flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" data-cards-online="playing">
      <div className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        {bar(them, cards.opponent.name, cards.opponent.rating, false)}
        <ChessBoard
          id={`cards-online-${cards.gameId}`}
          fen={game.fen}
          orientation={me}
          lastMove={game.lastMove}
          movableColor={myTurn ? me : null}
          onMove={onMove}
          onPickup={onPickup}
          theme={getBoardTheme(settings.boardTheme)}
          pieceSet={getPieceSet(settings.pieceSet)}
          lowPower={settings.batterySaver}
          showLegalMoves={settings.showLegalMoves}
          showCoordinates={settings.showCoordinates}
          extraSquareStyles={wardStyles}
          specialTargets={kind === 'move' ? cardMoves.flatMap((m) => (m.from ? [{ from: m.from, to: m.to, kind: m.card }] : [])) : undefined}
          picker={(kind === 'drop' || kind === 'ward') && activeCard ? { squares: kind === 'ward' ? wardTargets : cardMoves.map((m) => m.to), tone: 'glue', onPick: pick } : null}
        />
        {bar(me, view.me?.name ?? 'You', null, true)}
      </div>
      <aside className="flex flex-col gap-3">
        <div className={`glass flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${awayFor !== null && !result ? 'text-amber-200' : 'text-white'}`} role="status" data-cards-online-status>
          {awayFor !== null && !result && <WifiOff className="size-4 shrink-0" />}
          {status}
        </div>
        {result && <ModeResultCard text={resultText} rating={result.rating} />}
        <div className="glass space-y-2 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
            <Sparkles className="size-3.5" /> Your hand
          </div>
          <div className="grid grid-cols-3 gap-2">
            {game.hands[me].map((id) => (
              <CardFace key={id} id={id} small used={game.used[me].includes(id)} selected={activeCard === id} onClick={myTurn ? () => setActive((a) => (a === id ? null : id)) : undefined} />
            ))}
          </div>
          {activeCard && <p className="text-[11px] text-slate-300">{CARDS[activeCard].text}</p>}
          {activeCard && kind !== 'ward' && cardMoves.length === 0 && <p className="text-[11px] text-amber-200">No legal way to play this card right now.</p>}
        </div>
        <div className="glass space-y-2 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-pink-200">
            <ShieldCheck className="size-3.5" /> {cards.opponent.name}’s hand
          </div>
          <div className="grid grid-cols-3 gap-2">
            {game.hands[them].map((id) => (
              <CardFace key={id} id={id} small used={game.used[them].includes(id)} />
            ))}
          </div>
        </div>
        <ol className="glass max-h-40 overflow-auto rounded-2xl p-3 font-mono text-[11px] text-slate-300" aria-label="Moves">
          {game.sans.map((s, i) => (
            <li key={i} className={s.includes(':') ? 'text-amber-200' : ''}>
              {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : '… '}
              {s}
            </li>
          ))}
        </ol>
        {result ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => ranked.findMode('cards')} icon={<Swords className="size-4" />} data-cards-again>
              New match
            </Button>
            <Button variant="ghost" onClick={() => ranked.dismissMode()} data-mode-close>
              Back
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmResign(true)} icon={<Flag className="size-4" />} data-mode-resign>
            {game.ply < 2 ? 'Abort' : 'Resign'}
          </Button>
        )}
        <p className="px-1 text-[11px] text-slate-500">{CARDS_POOL.label} · rated · the server referees the cards and keeps the clock.</p>
      </aside>
      <ResignModal open={confirmResign} onClose={() => setConfirmResign(false)} title={game.ply < 2 ? 'Abort this game?' : 'Resign this game?'} text={game.ply < 2 ? 'Before both sides have moved, the game is simply cancelled (no rating change).' : 'Your opponent wins and your Card Chess rating changes.'} />
    </div>
  )
}

function ResignModal({ open, onClose, title, text }: { open: boolean; onClose: () => void; title: string; text: string }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose}>
            Keep playing
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose()
              getRanked().resignMode()
            }}
            data-mode-resign-confirm
          >
            Confirm
          </Button>
        </div>
      }
    >
      <p className="py-2 text-sm text-slate-300">{text}</p>
    </Modal>
  )
}

// ── Battle Royale online ────────────────────────────────────────────────────

export function RoyaleOnlineView({ royale }: { royale: RoyaleOnline }) {
  const ranked = getRanked()
  const [selected, setSelected] = useState<Pos | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const result = royale.result
  const now = useTicker(!result && royale.turnEndsAt !== null)
  const game = royale.game
  const me = seatPlayer(royale.seat)
  const alive = game.alive(me)
  const turnSeat = ['red', 'blue', 'yellow', 'green'].indexOf(game.turn)
  const myTurn = !result && !game.result && alive && game.turn === me
  const myMoves = myTurn ? game.movesFor(me) : []
  const targets = selected ? myMoves.filter((m) => samePos(m.from, selected)) : []
  const secondsLeft = royale.turnEndsAt === null ? null : Math.max(0, Math.ceil((royale.turnEndsAt - now) / 1000))

  const click = (pos: Pos) => {
    if (!myTurn) return
    const move = selected ? targets.find((m) => samePos(m.to, pos)) : undefined
    if (move) {
      ranked.royaleMove([move.from[0], move.from[1]], [move.to[0], move.to[1]])
      setSelected(null)
      return
    }
    const piece = game.at(pos)
    setSelected(piece?.owner === me && !(selected && samePos(selected, pos)) ? pos : null)
  }

  const place = result && result.ranking.length > 0 ? result.ranking.indexOf(royale.seat) + 1 : null
  const status = result
    ? place
      ? place === 1
        ? 'Victory: your king stands alone!'
        : `You finished ${ordinal(place)} — ${royale.seats[result.ranking[0] ?? 0]?.name ?? ''} wins (${REASON[result.reason] ?? result.reason})`
      : 'You left the battle'
    : !alive
      ? 'Your army is out — watch the rest, or leave'
      : myTurn
        ? `Your move · ${secondsLeft ?? 0}s`
        : `${royale.seats[turnSeat]?.name ?? SEATS[turnSeat]} is moving${secondsLeft !== null && !royale.seats[turnSeat]?.bot ? ` · ${secondsLeft}s` : '…'}`

  return (
    <div className="safe-px mx-auto grid w-full max-w-6xl flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start" data-royale-online>
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(18rem, calc(100dvh - 14rem)), 46rem)' }}>
        <RoyaleBoard game={game} seat={royale.seat} selected={selected} targets={targets} onCell={click} />
      </div>
      <aside className="flex flex-col gap-3">
        <div className={`glass rounded-2xl px-4 py-3 text-sm ${myTurn && (secondsLeft ?? 99) <= 10 ? 'text-amber-200' : 'text-white'}`} role="status" data-royale-online-status>
          {status}
          <div className="mt-1 font-mono text-[11px] text-slate-400">
            You are {SEATS[royale.seat]} · move {game.ply + 1} · {royale.rated ? 'rated' : 'unrated (one person)'}
          </div>
        </div>
        {result && result.ranking.length > 0 && <ModeResultCard text={place === 1 ? 'Last king standing' : `${place ? ordinal(place) : ''} place`} rating={result.rating} />}
        <ul className="glass space-y-1.5 rounded-2xl p-3" aria-label="Scoreboard">
          {royale.seats.map((s, i) => {
            const p = seatPlayer(i)
            return (
              <li key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${turnSeat === i && !game.result ? 'bg-white/10' : ''}`} data-seat={i}>
                <span className="size-3 shrink-0 rounded-full" style={{ background: ROYALE_COLOR[p] }} />
                <span className={`min-w-0 flex-1 truncate ${game.alive(p) ? 'text-white' : 'text-slate-500 line-through'}`}>
                  {s.name}
                  {i === royale.seat && <span className="text-xs text-slate-400"> (you)</span>}
                  {!s.bot && <span className="ml-1 font-mono text-[10px] text-slate-500">{s.rating}</span>}
                </span>
                {!game.alive(p) && <Skull className="size-3.5 text-slate-500" />}
                {game.result?.winner === p && <Crown className="size-3.5 text-amber-300" />}
                <span className="font-mono text-slate-200">{game.points[p]}</span>
              </li>
            )
          })}
        </ul>
        {result ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => ranked.findMode('royale')} icon={<Trophy className="size-4" />} data-royale-again>
              New battle
            </Button>
            <Button variant="ghost" onClick={() => ranked.dismissMode()} data-mode-close>
              Back
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmLeave(true)} icon={<Flag className="size-4" />} data-mode-resign>
            {alive ? 'Resign' : 'Leave'}
          </Button>
        )}
        <p className="px-1 text-[11px] text-slate-500">{ROYALE_MOVE_MS / 1000} s per move: out of time, the computer moves for you; miss two turns in a row and your army is out. No castling or en passant.</p>
      </aside>
      <ResignModal open={confirmLeave} onClose={() => setConfirmLeave(false)} title={alive ? 'Resign the battle?' : 'Leave the battle?'} text={alive ? 'Your army turns to rubble and you place where you fell.' : 'Your place is already decided; your rating updates when the battle ends.'} />
    </div>
  )
}
