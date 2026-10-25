import { ArrowLeft, Flag, Lightbulb, RefreshCw } from 'lucide-react'
import { type ReactNode, useCallback, useState } from 'react'
import { sfx } from '../../audio'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { settingsStore } from '../../stores/settingsStore'
import type { Color } from '../../types/chess'
import type { Persona } from '../../types/persona'
import { type VariantResult, variantResultText } from '../../variants/rules'
import { LEVELS, type VariantLevel, type VariantSetup, useVariantGame } from '../../variants/useVariantGame'
import { ChessBoard } from '../board/ChessBoard'
import { EngineNotice } from '../game/EngineNotice'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Choice } from './ui'

export interface BoardGameProps {
  id: string
  title: string
  subtitle: string
  /** The game to start (without the level and colour, chosen here). */
  setup: Omit<VariantSetup, 'level' | 'color' | 'onResult'>
  color: Color
  /** Who you face (portrait and words), if a character. */
  opponent?: { persona: Persona; intro: string } | null
  /** Advice shown beside the board (endgame lessons). */
  tips?: readonly string[]
  /** Books the result; returns a line for the result card. */
  onResult: (result: VariantResult, me: Color, level: VariantLevel) => string | null
  onLeave: () => void
  /** Shown under the status (objective text, the story of the position…). */
  info?: ReactNode
  defaultLevel?: VariantLevel
}

/** A Journey game on its own board: famous positions, weekend events, endgame lessons. */
export function JourneyBoardGame({ id, title, subtitle, setup, color, opponent = null, tips = [], onResult, onLeave, info, defaultLevel = 'club' }: BoardGameProps) {
  const v = useVariantGame(true)
  const settings = useStore(settingsStore, (s) => s)
  const [level, setLevel] = useState<VariantLevel>(defaultLevel)
  const [note, setNote] = useState<string | null>(null)
  const [seen, setSeen] = useState(-1)
  const [tip, setTip] = useState(0)
  const game = v.game
  const start = (lvl: VariantLevel) => {
    setNote(null)
    setTip(0)
    v.start({ ...setup, level: lvl, color, onResult: (r, me) => setNote(onResult(r, me, lvl)) })
  }
  const onPickup = useCallback(() => sfx.pickup(), [])

  if (!game) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3" data-board-game={id} data-board-game-state="setup">
        <section className="glass space-y-3 rounded-3xl p-5">
          <div className="flex items-start gap-3">
            {opponent && <PortraitEmblem spec={opponent.persona.portrait} label={opponent.persona.name} size="md" />}
            <div className="min-w-0">
              <h3 className="font-display text-xl font-extrabold text-white">{title}</h3>
              <p className="text-sm text-slate-300">{subtitle}</p>
            </div>
          </div>
          {info}
          <Choice label="Computer strength" value={level} onChange={setLevel} options={(Object.keys(LEVELS) as VariantLevel[]).map((l) => ({ id: l, label: LEVELS[l].name, sub: LEVELS[l].elo }))} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => start(level)} data-board-game-start>
              Play as {color === 'w' ? 'White' : 'Black'}
            </Button>
            <Button variant="secondary" onClick={onLeave} icon={<ArrowLeft className="size-4" />}>
              Back
            </Button>
          </div>
        </section>
      </div>
    )
  }

  const me = v.myColor
  const result = game.result
  const status = result ? variantResultText(result, me) : v.waitingForEngine ? 'Waiting for the engine…' : v.thinking ? `${opponent?.persona.name ?? 'The computer'} is thinking…` : game.inCheck ? 'Check! Your move' : 'Your move'
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" data-board-game={id} data-board-game-state="playing">
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        <ChessBoard
          id={`journey-${id}`}
          fen={game.fen}
          orientation={me}
          lastMove={game.last}
          movableColor={!result && game.turn === me ? me : null}
          onMove={v.move}
          onPickup={onPickup}
          theme={getBoardTheme(settings.boardTheme)}
          pieceSet={getPieceSet(settings.pieceSet)}
          lowPower={settings.batterySaver}
          showLegalMoves={settings.showLegalMoves}
          showCoordinates={settings.showCoordinates}
          specialTargets={v.castleTargets}
        />
      </div>
      <aside className="flex flex-col gap-3">
        {!result && <EngineNotice status={v.engineStatus} error={v.engineError} onRetry={v.retryEngine} />}
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] font-bold tracking-[0.2em] text-amber-200 uppercase">{title}</div>
          <div className="mt-1 text-sm text-white" role="status" data-board-game-status>
            {status}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Move {game.moveNumber} · {LEVELS[v.level].name} computer
          </div>
          {info && <div className="mt-2 text-xs text-slate-300">{info}</div>}
        </div>
        {opponent && (
          <div className="glass flex items-start gap-3 rounded-2xl p-3">
            <PortraitEmblem spec={opponent.persona.portrait} label={opponent.persona.name} size="md" defeated={result?.winner === me} />
            <div className="min-w-0">
              <div className="font-semibold text-white">{opponent.persona.name}</div>
              <p className="text-xs italic text-slate-300">“{opponent.intro}”</p>
            </div>
          </div>
        )}
        {tips.length > 0 && (
          <div className="glass rounded-2xl p-3 text-sm text-slate-200" data-board-game-tip>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.2em] text-amber-200 uppercase">
              <Lightbulb className="size-3.5" /> Tip {tip + 1} of {tips.length}
            </div>
            {tips[tip]}
            {tips.length > 1 && (
              <button type="button" className="mt-2 block text-xs text-sky-300 hover:underline" onClick={() => setTip((t) => (t + 1) % tips.length)}>
                Next tip
              </button>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {result ? (
            <Button variant="primary" onClick={() => start(v.level)} icon={<RefreshCw className="size-4" />} data-board-game-again>
              Play again
            </Button>
          ) : (
            <Button variant="ghost" onClick={v.resign} icon={<Flag className="size-4" />}>
              Resign
            </Button>
          )}
          <Button variant="secondary" onClick={() => (v.leave(), onLeave())}>
            Leave
          </Button>
        </div>
      </aside>
      <Modal
        open={result !== null && seen !== v.version}
        title={title}
        onClose={() => setSeen(v.version)}
        size="sm"
        footer={
          <Button variant="primary" className="w-full" onClick={() => setSeen(v.version)}>
            View the board
          </Button>
        }
      >
        {result && (
          <div className="py-2 text-center" data-board-game-result={result.winner === me ? 'win' : result.winner === null ? 'draw' : 'loss'}>
            <div className="font-display text-2xl font-extrabold text-white">{result.winner === null ? 'Draw' : result.winner === me ? 'Victory' : 'Defeat'}</div>
            <div className="mt-1 text-sm text-slate-300">{variantResultText(result, me)}</div>
            {note && <p className="mt-3 text-sm text-amber-200">{note}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
