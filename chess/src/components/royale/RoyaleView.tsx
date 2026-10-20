import { Crown, Flag, Play, RefreshCw, Skull, Swords } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sfx } from '../../audio'
import { useStore } from '../../hooks/useStore'
import { applyFeat } from '../../stores/featActions'
import { profileStore } from '../../stores/profileStore'
import { recordModeResult } from '../../utils/feats'
import { MAX_PLIES, PLAYERS, type PlayerId, type Pos, type RMove, RoyaleGame, type RoyaleLevel, chooseRoyaleMove } from '../../royale/royale'
import { RoyaleBoard } from './RoyaleBoard'
import { ROYALE_COLOR as COLOR, samePos as same } from './royaleTheme'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Segmented'

const NAME: Record<PlayerId, string> = { red: 'You (Red)', blue: 'Blue', yellow: 'Yellow', green: 'Green' }
const AI_DELAY = 380
const ME: PlayerId = 'red'

/** Four-player Battle Royale on the cross-shaped board: you against three computer armies. */
export function RoyaleView() {
  const stats = useStore(profileStore, (p) => p.modes.royale)
  const [level, setLevel] = useState<RoyaleLevel>('normal')
  const [game, setGame] = useState<RoyaleGame | null>(null)
  const [version, setVersion] = useState(0)
  const [selected, setSelected] = useState<Pos | null>(null)
  const [recorded, setRecorded] = useState(false)
  const turn = game?.turn ?? ME
  const over = game ? game.result !== null || !game.alive(ME) : false

  // The computer armies move one after another.
  useEffect(() => {
    if (!game || over || turn === ME) return
    const t = window.setTimeout(() => {
      const m = chooseRoyaleMove(game, game.turn, level)
      if (m) {
        game.play(m)
        if (m.captured && m.captured.owner !== 'dead') sfx.pickup()
      } else game.resign(game.turn)
      setVersion((v) => v + 1)
    }, AI_DELAY)
    return () => window.clearTimeout(t)
  }, [game, level, over, turn, version])

  // Record the result once: you won, or you were knocked out (your place).
  const place = game ? (game.result ? game.result.ranking.indexOf(ME) + 1 : !game.alive(ME) ? 4 - game.out.indexOf(ME) : null) : null
  useEffect(() => {
    if (!game || recorded || place === null) return
    const t = window.setTimeout(() => {
      setRecorded(true)
      if (place === 1) sfx.victory()
      else sfx.defeat()
      applyFeat((p) => recordModeResult(p, 'royale', place === 1, place))
    }, 0)
    return () => window.clearTimeout(t)
  }, [game, place, recorded])

  // The game is mutable (`version` re-renders), so this is worked out every render.
  const myMoves = game && !over && turn === ME ? game.movesFor(ME) : []
  const targets = selected ? myMoves.filter((m) => same(m.from, selected)) : []

  if (!game) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4" data-royale="setup">
        <section className="glass space-y-3 rounded-3xl p-5">
          <p className="text-sm text-slate-300">Four armies on a cross-shaped board, every player for themselves. There is no check: a king can be captured, and an army whose king falls turns to grey rubble. Captures score points (a king 20). The last king standing wins; after 100 rounds, the most points among the survivors. Pawns promote to queens at the middle of the board; no castling or en passant.</p>
          <p className="text-xs text-slate-400">
            Your record: {stats.games} games · {stats.wins} wins{stats.best ? ` · best place ${stats.best}` : ''}
          </p>
          <Segmented
            label="Computer armies"
            options={[
              { id: 'easy', label: 'Easy' },
              { id: 'normal', label: 'Normal' },
              { id: 'hard', label: 'Hard' },
            ]}
            value={level}
            onChange={(l) => setLevel(l as RoyaleLevel)}
          />
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            icon={<Play className="size-5" fill="currentColor" />}
            onClick={() => {
              setGame(new RoyaleGame())
              setRecorded(false)
              setSelected(null)
            }}
            data-royale-start
          >
            Enter the arena
          </Button>
        </section>
      </div>
    )
  }

  const click = (pos: Pos) => {
    if (over || turn !== ME) return
    const move: RMove | undefined = selected ? targets.find((m) => same(m.to, pos)) : undefined
    if (move) {
      game.play(move)
      sfx.pickup()
      setSelected(null)
      setVersion((v) => v + 1)
      return
    }
    const piece = game.at(pos)
    setSelected(piece?.owner === ME && !(selected && same(selected, pos)) ? pos : null)
  }

  const status = game.result ? (game.result.winner === ME ? 'Victory: your king stands alone!' : `${NAME[game.result.winner]} wins (${game.result.reason === 'points' ? 'on points' : 'last king standing'})`) : !game.alive(ME) ? `Your king has fallen: you finish ${place}${place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'}.` : turn === ME ? 'Your move' : `${NAME[turn]} is moving…`

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start" data-royale="playing">
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(18rem, calc(100dvh - 14rem)), 46rem)' }}>
        <RoyaleBoard game={game} selected={selected} targets={targets} onCell={click} />
      </div>
      <aside className="flex flex-col gap-3">
        <div className="glass rounded-2xl px-4 py-3 text-sm text-white" role="status" data-royale-status>
          {status}
          <div className="mt-1 font-mono text-[11px] text-slate-400">
            Round {Math.floor(game.ply / 4) + 1} of {MAX_PLIES / 4}
          </div>
        </div>
        <ul className="glass space-y-1.5 rounded-2xl p-3" aria-label="Scoreboard">
          {PLAYERS.map((p) => (
            <li key={p} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${turn === p && !over ? 'bg-white/10' : ''}`} data-score={p}>
              <span className="size-3 rounded-full" style={{ background: COLOR[p] }} />
              <span className={`flex-1 ${game.alive(p) ? 'text-white' : 'text-slate-500 line-through'}`}>{NAME[p]}</span>
              {!game.alive(p) && <Skull className="size-3.5 text-slate-500" />}
              {game.result?.winner === p && <Crown className="size-3.5 text-amber-300" />}
              <span className="font-mono text-slate-200">{game.points[p]}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-2">
          {over ? (
            <Button variant="primary" onClick={() => (setGame(new RoyaleGame()), setRecorded(false), setSelected(null))} icon={<RefreshCw className="size-4" />}>
              New battle
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => (game.resign(ME), setVersion((v) => v + 1))} icon={<Flag className="size-4" />}>
              Resign
            </Button>
          )}
          <Button variant="secondary" onClick={() => setGame(null)} icon={<Swords className="size-4" />}>
            Leave
          </Button>
        </div>
      </aside>
    </div>
  )
}
