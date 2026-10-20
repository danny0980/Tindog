import { Crosshair, Dices, EyeOff, Flag, Mountain, Play, RefreshCw, Shuffle, Sparkles } from 'lucide-react'
import { type CSSProperties, useCallback, useMemo, useState } from 'react'
import { sfx } from '../../audio'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { settingsStore } from '../../stores/settingsStore'
import type { Color } from '../../types/chess'
import { HILL, VARIANTS, VARIANT_IDS, type VariantId, chess960Rank, variantResultText } from '../../variants/rules'
import { LEVELS, type VariantLevel, useVariantGame } from '../../variants/useVariantGame'
import { ChessBoard } from '../board/ChessBoard'
import { EngineNotice } from '../game/EngineNotice'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

const ICONS: Record<VariantId, typeof Shuffle> = { chess960: Shuffle, koth: Mountain, threecheck: Crosshair, battle: Flag, vanish: EyeOff }
const COLORS: ReadonlyArray<{ id: Color | 'random'; label: string }> = [
  { id: 'w', label: 'White' },
  { id: 'random', label: 'Random' },
  { id: 'b', label: 'Black' },
]

/** Chess variants against the computer: Chess960, King of the Hill and Three-Check. */
export function VariantsView() {
  const v = useVariantGame(true)
  const [variant, setVariant] = useState<VariantId>('chess960')
  const [level, setLevel] = useState<VariantLevel>('club')
  const [color, setColor] = useState<Color | 'random'>('random')
  const [position, setPosition] = useState<string>('')
  const [seenResult, setSeenResult] = useState(0)
  const settings = useStore(settingsStore, (s) => s)
  const theme = getBoardTheme(settings.boardTheme)
  const onPickup = useCallback(() => sfx.pickup(), [])
  const game = v.game

  const startGame = () => {
    const n = Number(position)
    v.start({ variant, color, level, ...(variant === 'chess960' && position.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 959 ? { position960: n } : {}) })
  }

  // King of the Hill: the four centre squares glow.
  const hillStyles = useMemo<Record<string, CSSProperties>>(
    () => (game?.variant === 'koth' ? Object.fromEntries(HILL.map((s) => [s, { boxShadow: 'inset 0 0 0 3px rgba(250, 204, 21, 0.75), inset 0 0 0 200px rgba(250, 204, 21, 0.14)' }])) : {}),
    [game?.variant],
  )

  if (!game) {
    const pos = Number(position)
    const preview = variant === 'chess960' && position.trim() !== '' && Number.isInteger(pos) && pos >= 0 && pos <= 959 ? chess960Rank(pos) : null
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4" data-variants="setup">
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Variant">
          {VARIANT_IDS.map((id) => {
            const info = VARIANTS[id]
            const Icon = ICONS[id]
            const on = id === variant
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setVariant(id)}
                data-variant={id}
                className={`glass flex flex-col gap-2 rounded-3xl p-4 text-left transition ${on ? 'border-accent ring-1 ring-accent' : 'hover:-translate-y-0.5 hover:border-white/25'}`}
              >
                <span className={`flex size-11 items-center justify-center rounded-2xl ${on ? 'bg-accent text-ink-950' : 'bg-white/10 text-white'}`}>
                  <Icon className="size-6" />
                </span>
                <span className="font-display text-lg font-extrabold text-white">{info.name}</span>
                <span className="text-xs text-slate-400">{info.short}</span>
              </button>
            )
          })}
        </div>

        <section className="glass space-y-3 rounded-3xl p-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
            <Sparkles className="size-3.5" /> How {VARIANTS[variant].name} works
          </h3>
          <ul className="space-y-1.5 text-sm text-slate-300">
            {VARIANTS[variant].rules.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </section>

        <section className="glass grid gap-3 rounded-3xl p-4 sm:grid-cols-2">
          <Choice label="Computer" value={level} options={(Object.keys(LEVELS) as VariantLevel[]).map((id) => ({ id, label: `${LEVELS[id].name} ${LEVELS[id].elo}` }))} onChange={(id) => setLevel(id as VariantLevel)} />
          <Choice label="You play" value={color} options={COLORS} onChange={(id) => setColor(id as Color | 'random')} />
          {variant === 'chess960' && (
            <label className="sm:col-span-2">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                <Dices className="size-3.5" /> Start position
              </span>
              <span className="flex items-center gap-2">
                <input
                  className="w-32 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-white outline-none placeholder:font-sans placeholder:text-slate-500 focus:border-sky-300/60"
                  inputMode="numeric"
                  placeholder="Random"
                  value={position}
                  onChange={(e) => setPosition(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  aria-label="Chess960 position number (0 to 959)"
                  data-variant-position
                />
                <span className="font-mono text-sm tracking-[0.3em] text-amber-200">{preview ?? (position ? '0–959' : '')}</span>
              </span>
            </label>
          )}
          <Button variant="primary" size="lg" className="sm:col-span-2" icon={<Play className="size-5" fill="currentColor" />} onClick={startGame} data-variant-start>
            Play {VARIANTS[variant].name}
          </Button>
        </section>
      </div>
    )
  }

  const me = v.myColor
  const them: Color = me === 'w' ? 'b' : 'w'
  const result = game.result
  const showResult = result !== null && seenResult !== v.version
  const status = result ? variantResultText(result, me) : v.waitingForEngine ? 'Waiting for the engine…' : v.thinking ? 'The computer is thinking…' : game.inCheck ? 'Check! Your move' : 'Your move'

  const finish = () => setSeenResult(v.version)

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" data-variants="playing" data-variant-game={game.variant}>
      <div className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        {game.variant === 'threecheck' && <CheckPips label="Computer" count={game.checks[them]} />}
        <ChessBoard
          id={`variant-${game.variant}`}
          fen={game.fen}
          orientation={me}
          lastMove={game.last}
          movableColor={!result && game.turn === me ? me : null}
          onMove={v.move}
          onPickup={onPickup}
          theme={theme}
          pieceSet={getPieceSet(settings.pieceSet)}
          lowPower={settings.batterySaver}
          showLegalMoves={settings.showLegalMoves}
          showCoordinates={settings.showCoordinates}
          extraSquareStyles={hillStyles}
          specialTargets={v.castleTargets}
        />
        {game.variant === 'threecheck' && <CheckPips label="You" count={game.checks[me]} />}
      </div>
      <aside className="flex flex-col gap-3">
        {!result && <EngineNotice status={v.engineStatus} error={v.engineError} onRetry={v.retryEngine} />}
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
            {VARIANTS[game.variant].name}
            {game.position960 !== null && <span className="ml-2 font-mono normal-case tracking-normal text-slate-400">#{game.position960}</span>}
          </div>
          <div className="mt-1 text-sm text-white" role="status" data-variant-status>
            {status}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {LEVELS[v.level].name} computer · you play {me === 'w' ? 'White' : 'Black'}
          </div>
        </div>
        <div className="glass max-h-48 overflow-y-auto rounded-2xl px-4 py-3 font-mono text-xs text-slate-300" aria-label="Moves">
          {game.history.length === 0 ? (
            <span className="font-sans text-slate-500">No moves yet.</span>
          ) : (
            game.history.map((san, i) => (
              <span key={i} className="mr-1.5 inline-block">
                {i % 2 === 0 && <span className="text-slate-500">{i / 2 + 1}.</span>}
                {san}
              </span>
            ))
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {result ? (
            <Button variant="primary" onClick={startGame} icon={<RefreshCw className="size-4" />} data-variant-again>
              Play again
            </Button>
          ) : (
            <Button variant="ghost" onClick={v.resign} icon={<Flag className="size-4" />} data-variant-resign>
              Resign
            </Button>
          )}
          <Button variant="secondary" onClick={v.leave}>
            Change variant
          </Button>
        </div>
      </aside>

      <Modal
        open={showResult}
        title={VARIANTS[game.variant].name}
        onClose={finish}
        size="sm"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={finish}>
              View board
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                finish()
                startGame()
              }}
              icon={<RefreshCw className="size-4" />}
            >
              Play again
            </Button>
          </div>
        }
      >
        {result && (
          <div className="py-2 text-center" data-variant-result>
            <div className="font-display text-2xl font-extrabold text-white">{result.winner === null ? 'Draw' : result.winner === me ? 'Victory' : 'Defeat'}</div>
            <div className="mt-1 text-sm text-slate-300">{variantResultText(result, me)}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function CheckPips({ label, count }: { label: string; count: number }) {
  return (
    <div className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-slate-300" data-check-pips={label}>
      <span className="min-w-16">{label}</span>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`size-3 rounded-full ${i < count ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]' : 'bg-white/10'}`} />
      ))}
      <span className="ml-auto font-mono">{count}/3 checks</span>
    </div>
  )
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: ReadonlyArray<{ id: string; label: string }>; onChange: (id: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">{label}</div>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === value}
            onClick={() => onChange(o.id)}
            className={`rounded-xl border px-2 py-2 text-xs font-semibold transition sm:text-sm ${o.id === value ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
