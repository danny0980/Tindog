import { Check, Flag, Layers, Play, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { type CSSProperties, useCallback, useState } from 'react'
import { sfx } from '../../audio'
import { CARDS, type CardId, HAND_SIZE } from '../../cards/cardGame'
import { useCardGame } from '../../cards/useCardGame'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { settingsStore } from '../../stores/settingsStore'
import type { Color, MoveInput, Square } from '../../types/chess'
import { LEVELS, type VariantLevel } from '../../variants/useVariantGame'
import { ChessBoard } from '../board/ChessBoard'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Segmented } from '../ui/Segmented'

const KIND_LABEL = { move: 'Your move', drop: 'Your move', ward: 'Free action' } as const

function CardFace({ id, selected, used, onClick, small = false }: { id: CardId; selected?: boolean; used?: boolean; onClick?: () => void; small?: boolean }) {
  const c = CARDS[id]
  return (
    <button
      type="button"
      disabled={!onClick || used}
      onClick={onClick}
      data-card={id}
      data-card-used={used ? 'true' : undefined}
      aria-pressed={selected}
      className={`relative flex flex-col gap-1 rounded-2xl border p-3 text-left transition ${small ? 'min-h-24' : 'min-h-36'} ${used ? 'border-white/5 bg-white/[0.02] opacity-40' : selected ? 'border-amber-300 bg-gradient-to-br from-amber-300/25 to-fuchsia-500/20 shadow-[0_0_24px_-6px_rgba(251,191,36,0.8)]' : 'border-white/10 bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/10 enabled:hover:-translate-y-0.5 enabled:hover:border-white/30'}`}
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">{KIND_LABEL[c.kind]}</span>
      <span className={`font-display font-extrabold leading-tight text-white [overflow-wrap:anywhere] ${small ? 'text-[11px] sm:text-xs' : 'text-sm'}`}>{c.name}</span>
      {!small && <span className="text-[11px] leading-snug text-slate-300">{c.text}</span>}
      {used && <span className="absolute top-2 right-2 text-[10px] text-slate-400">used</span>}
    </button>
  )
}

/** Card Chess: draft three tactical cards, then play them at the right moment. */
export function CardChessView() {
  const cg = useCardGame(true)
  const settings = useStore(settingsStore, (s) => s)
  const [color, setColor] = useState<Color | 'random'>('random')
  const [level, setLevel] = useState<VariantLevel>('club')
  const [picked, setPicked] = useState<CardId[]>([])
  const [active, setActive] = useState<CardId | null>(null)
  const [seenResult, setSeenResult] = useState(-1)
  const onPickup = useCallback(() => sfx.pickup(), [])
  const game = cg.game
  const me = cg.myColor
  const myTurn = Boolean(game && !game.result && game.turn === me)
  const activeCard = active && game && game.available(me).includes(active) && myTurn ? active : null
  const kind = activeCard ? CARDS[activeCard].kind : null

  // What the selected card can do right now (the game is mutable, so this is worked out every render).
  const cardMoves = game && activeCard && kind !== 'ward' ? game.cardMoves().filter((m) => m.card === activeCard) : []
  const wardTargets = game && activeCard && kind === 'ward' ? game.wardTargets(activeCard as 'stone-wall' | 'aegis') : []
  const wardStyles: Record<string, CSSProperties> = {}
  if (game) for (const w of game.wards) if (w.until > game.ply) wardStyles[w.square] = { boxShadow: `inset 0 0 0 3px ${w.color === me ? 'rgba(52,211,153,0.9)' : 'rgba(244,114,182,0.9)'}`, background: w.color === me ? 'rgba(52,211,153,0.15)' : 'rgba(244,114,182,0.15)' }

  const onMove = (m: MoveInput): boolean => {
    if (activeCard && kind === 'move') {
      const cm = cardMoves.find((c) => c.from === m.from && c.to === m.to)
      if (cm && cg.playCard(cm)) {
        setActive(null)
        return true
      }
    }
    return cg.move(m.from, m.to, m.promotion)
  }

  if (cg.phase === 'setup') {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4" data-cards="setup">
        <section className="glass space-y-3 rounded-3xl p-5">
          <p className="text-sm text-slate-300">Normal chess, plus three cards you draft before the game. Each card can be played once, and the computer drafts its own three from the same five, so you know exactly what it holds.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.values(CARDS).map((c) => (
              <div key={c.id} className="rounded-xl bg-white/[0.04] p-2 text-[11px] text-slate-300">
                <span className="font-semibold text-white">{c.name}</span> · {c.text}
              </div>
            ))}
          </div>
          <Segmented
            label="Play as"
            options={[
              { id: 'w', label: 'White' },
              { id: 'random', label: 'Random' },
              { id: 'b', label: 'Black' },
            ]}
            value={color}
            onChange={(v) => setColor(v as Color | 'random')}
          />
          <Segmented label="Opponent" options={(Object.keys(LEVELS) as VariantLevel[]).map((id) => ({ id, label: `${LEVELS[id].name} ${LEVELS[id].elo}` }))} value={level} onChange={(v) => setLevel(v as VariantLevel)} />
          <Button variant="primary" size="lg" className="w-full" icon={<Layers className="size-5" />} onClick={() => (setPicked([]), cg.deal(color, level))} data-cards-deal>
            Deal the cards
          </Button>
        </section>
      </div>
    )
  }

  if (cg.phase === 'draft') {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4" data-cards="draft">
        <p className="text-sm text-slate-300">
          Choose {HAND_SIZE} of these five. The computer takes its pick from the same five.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {cg.offered.map((id) => (
            <CardFace key={id} id={id} selected={picked.includes(id)} onClick={() => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < HAND_SIZE ? [...p, id] : p))} />
          ))}
        </div>
        <Button variant="primary" size="lg" className="w-full" disabled={picked.length !== HAND_SIZE} icon={<Play className="size-5" fill="currentColor" />} onClick={() => cg.begin(picked)} data-cards-begin>
          {picked.length === HAND_SIZE ? 'Begin the game' : `Pick ${HAND_SIZE - picked.length} more`}
        </Button>
      </div>
    )
  }

  if (!game) return null
  const them: Color = me === 'w' ? 'b' : 'w'
  const result = game.result
  const showResult = result !== null && seenResult !== cg.version
  const resultText = result ? (result.winner === null ? `Draw (${result.reason})` : result.winner === me ? `You win (${result.reason})` : `You lose (${result.reason})`) : ''
  const status = result ? resultText : cg.thinking ? 'The computer is thinking…' : activeCard ? `${CARDS[activeCard].name}: ${kind === 'ward' ? 'tap the piece to protect' : kind === 'drop' ? 'tap a square on your second rank' : 'move a piece to a glowing square'}` : game.inCheck ? 'Check! Your move' : 'Your move'

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" data-cards="playing">
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        <ChessBoard
          id="cards-board"
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
          picker={
            kind === 'drop' && activeCard
              ? { squares: cardMoves.map((m) => m.to), tone: 'glue', onPick: (sq: Square) => { const cm = cardMoves.find((m) => m.to === sq); if (cm && cg.playCard(cm)) setActive(null) } }
              : kind === 'ward' && activeCard
                ? { squares: wardTargets, tone: 'glue', onPick: (sq: Square) => { if (cg.ward(activeCard as 'stone-wall' | 'aegis', sq)) setActive(null) } }
                : null
          }
        />
      </div>
      <aside className="flex flex-col gap-3">
        <div className="glass rounded-2xl px-4 py-3 text-sm text-white" role="status" data-cards-status>
          {status}
        </div>
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
            <ShieldCheck className="size-3.5" /> The computer’s hand
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
        <div className="grid grid-cols-2 gap-2">
          {result ? (
            <Button variant="primary" onClick={() => cg.leave()} icon={<RefreshCw className="size-4" />}>
              New game
            </Button>
          ) : (
            <Button variant="ghost" onClick={cg.resign} icon={<Flag className="size-4" />}>
              Resign
            </Button>
          )}
          <Button variant="secondary" onClick={cg.leave}>
            Leave
          </Button>
        </div>
      </aside>
      <Modal
        open={showResult}
        title="Card Chess"
        onClose={() => setSeenResult(cg.version)}
        size="sm"
        footer={
          <Button variant="primary" className="w-full" onClick={() => setSeenResult(cg.version)} icon={<Check className="size-4" />}>
            View the board
          </Button>
        }
      >
        <p className="py-3 text-center font-display text-xl font-extrabold text-white" data-cards-result>
          {resultText}
        </p>
      </Modal>
    </div>
  )
}
