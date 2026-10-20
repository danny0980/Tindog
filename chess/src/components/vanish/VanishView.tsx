import { Eye, EyeOff, Flag, Play, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { sfx } from '../../audio'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { settingsStore } from '../../stores/settingsStore'
import type { Color } from '../../types/chess'
import { PEEKS, hiddenCount, vanishMask, visibleFor } from '../../vanish/vanish'
import { variantResultText } from '../../variants/rules'
import { LEVELS, type VariantLevel, useVariantGame } from '../../variants/useVariantGame'
import { ChessBoard } from '../board/ChessBoard'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'

/** How long a peek shows the whole board. */
const PEEK_MS = 1500

/** Blindfold Vanishing Chess: rated against the computer, with pieces that fade from view. */
export function VanishView() {
  const v = useVariantGame(true)
  const settings = useStore(settingsStore, (s) => s)
  const stats = useStore(profileStore, (p) => p.modes.vanish)
  const [color, setColor] = useState<Color | 'random'>('random')
  const [level, setLevel] = useState<VariantLevel>('club')
  const [peeks, setPeeks] = useState(PEEKS)
  const [peeking, setPeeking] = useState(false)
  const onPickup = useCallback(() => sfx.pickup(), [])
  const game = v.game

  useEffect(() => {
    if (!peeking) return
    const t = window.setTimeout(() => setPeeking(false), PEEK_MS)
    return () => window.clearTimeout(t)
  }, [peeking])

  if (!game) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4" data-vanish="setup">
        <section className="glass space-y-3 rounded-3xl p-5">
          <p className="text-sm text-slate-300">Ordinary chess, played from memory. Every piece, yours too, fades from view a few moves after it last moved, and the fade gets quicker as the game goes on: {visibleFor(0)} moves at the start, down to {visibleFor(200)}. You get {PEEKS} peeks at the whole board per game.</p>
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3" data-vanish-rating>
            <EyeOff className="size-6 text-indigo-200" />
            <div className="text-xs text-slate-300">
              <div className="font-mono text-xl font-bold text-white">{stats.rating}</div>
              Vanishing rating · {stats.games} games · {stats.wins} wins · peak {stats.peak}
            </div>
          </div>
          <Segmented
            label="Play as"
            options={[
              { id: 'w', label: 'White' },
              { id: 'random', label: 'Random' },
              { id: 'b', label: 'Black' },
            ]}
            value={color}
            onChange={(c) => setColor(c as Color | 'random')}
          />
          <Segmented label="Opponent (rated)" options={(Object.keys(LEVELS) as VariantLevel[]).map((id) => ({ id, label: `${LEVELS[id].name} ${LEVELS[id].elo}` }))} value={level} onChange={(l) => setLevel(l as VariantLevel)} />
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            icon={<Play className="size-5" fill="currentColor" />}
            onClick={() => {
              setPeeks(PEEKS)
              v.start({ variant: 'vanish', color, level })
            }}
            data-vanish-start
          >
            Start
          </Button>
        </section>
      </div>
    )
  }

  const me = v.myColor
  const result = game.result
  // Everything shows once the game is over, or during a peek.
  const mask = result || peeking ? null : vanishMask(game.startFen, game.uciHistory)
  const hidden = mask ? hiddenCount(mask) : 0
  const status = result ? variantResultText(result, me) : v.thinking ? 'The computer is thinking…' : game.inCheck ? 'Check! Your move' : 'Your move'

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" data-vanish="playing">
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        <ChessBoard
          id="vanish-board"
          fen={game.fen}
          orientation={me}
          lastMove={game.last}
          movableColor={!result && game.turn === me ? me : null}
          onMove={v.move}
          onPickup={onPickup}
          theme={getBoardTheme(settings.boardTheme)}
          pieceSet={getPieceSet(settings.pieceSet)}
          lowPower={settings.batterySaver}
          showLegalMoves={false}
          showCoordinates
          pieceOpacity={mask}
        />
      </div>
      <aside className="flex flex-col gap-3">
        <div className="glass rounded-2xl px-4 py-3 text-sm text-white" role="status" data-vanish-status>
          {status}
          <div className="mt-1 text-xs text-slate-400" data-vanish-hidden={hidden}>
            {result ? 'All pieces revealed.' : `${hidden} piece${hidden === 1 ? '' : 's'} hidden · pieces stay visible ${visibleFor(game.uciHistory.length)} moves`}
          </div>
        </div>
        {!result && (
          <Button onClick={() => (setPeeks((p) => p - 1), setPeeking(true))} disabled={peeks <= 0 || peeking} icon={<Eye className="size-4" />} data-vanish-peek>
            Peek ({peeks} left)
          </Button>
        )}
        <p className="px-1 text-[11px] text-slate-500">Move hints are off. Tap a square where you remember your piece, then its destination.</p>
        <div className="grid grid-cols-2 gap-2">
          {result ? (
            <Button variant="primary" onClick={() => (setPeeks(PEEKS), v.start({ variant: 'vanish', color, level }))} icon={<RefreshCw className="size-4" />}>
              Play again
            </Button>
          ) : (
            <Button variant="ghost" onClick={v.resign} icon={<Flag className="size-4" />}>
              Resign
            </Button>
          )}
          <Button variant="secondary" onClick={v.leave}>
            Leave
          </Button>
        </div>
      </aside>
    </div>
  )
}
