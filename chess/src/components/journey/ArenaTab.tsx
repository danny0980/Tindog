import { CalendarDays, Castle, Flame, Landmark, Shield, Timer, Users, Zap } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { CLASSIC_ROSTER, type ClassicCharacter, classicUnlockedThrough, getClassic } from '../../data/classic/roster'
import { SPELLS, TACTICS } from '../../data/spells'
import { classicPersona } from '../../data/personas'
import { beatenIds } from '../../data/trophyAvatars'
import { useStore } from '../../hooks/useStore'
import { currentEvent, nextEvent } from '../../journey/events'
import { payRewards, recordJourney } from '../../journey/journeyActions'
import { journeyStore } from '../../journey/journeyStore'
import { PHASES, PLAYER_POWERS, bulletOpponent, powerFor } from '../../journey/modes'
import { FAMOUS_GAMES, type FamousGame, positionRules } from '../../journey/positions'
import { profileStore } from '../../stores/profileStore'
import type { TacticId } from '../../types/spells'
import { LEVELS } from '../../variants/useVariantGame'
import { Button } from '../ui/Button'
import { DefenseGame } from './DefenseGame'
import { JourneyBoardGame } from './JourneyBoardGame'
import type { JourneyLaunch } from './launch'
import { Card, Choice, ClassicFace, Pill } from './ui'

type Screen = 'menu' | 'defense' | 'position' | 'event'

/** The new ways to play: bosses with phases, powers, co-op, tower defence, famous positions, events, bullet. */
export function ArenaTab({ launch }: { launch: JourneyLaunch }) {
  const [screen, setScreen] = useState<Screen>('menu')
  const [position, setPosition] = useState<FamousGame | null>(null)
  if (screen === 'defense') return <DefenseGame onLeave={() => setScreen('menu')} />
  if (screen === 'position' && position) return <PositionGame game={position} onLeave={() => setScreen('menu')} />
  if (screen === 'event') return <EventGame onLeave={() => setScreen('menu')} />
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-arena>
      <EventCard onPlay={() => setScreen('event')} />
      <BulletCard launch={launch} />
      <PhaseBossCard launch={launch} />
      <PowersCard launch={launch} />
      <CoopCard launch={launch} />
      <Card title="Hold the Line" icon={<Shield className="size-4" />} data-arena-mode="defense">
        <p className="text-sm text-slate-300">Chess tower defence. Waves of enemy pawns and knights march down the board — move your pieces, recruit reinforcements with the gold you capture, and don’t let them through.</p>
        <Button variant="primary" className="mt-3 w-full" icon={<Castle className="size-4" />} onClick={() => setScreen('defense')} data-defense-open>
          Defend the board
        </Button>
      </Card>
      <PositionsCard
        onPlay={(g) => {
          setPosition(g)
          setScreen('position')
        }}
      />
    </div>
  )
}

/** Characters you may challenge: the ones you have beaten, plus the next on the ladder. */
function useChallengers(): ClassicCharacter[] {
  const profile = useStore(profileStore, (p) => p)
  return useMemo(() => {
    const beaten = beatenIds(profile).classicIds
    const through = classicUnlockedThrough(beaten)
    return CLASSIC_ROSTER.filter((c) => c.rank <= through)
  }, [profile])
}

function OpponentPicker({ value, onChange, list }: { value: string; onChange: (id: string) => void; list: readonly ClassicCharacter[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white" aria-label="Opponent">
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} (~{c.elo})
        </option>
      ))}
    </select>
  )
}

function PhaseBossCard({ launch }: { launch: JourneyLaunch }) {
  const list = useChallengers()
  const cleared = useStore(journeyStore, (j) => j.modes.phases)
  const [id, setId] = useState(() => list[list.length - 1]?.id ?? 'sargon')
  const c = getClassic(id)
  return (
    <Card title="Three-phase bosses" icon={<Flame className="size-4" />} data-arena-mode="phases" action={<Pill tone="gold">{cleared.length} broken</Pill>}>
      <p className="text-sm text-slate-300">Take their material and they transform. Each phase changes the rules mid-game:</p>
      <ul className="mt-2 space-y-1 text-xs text-slate-400">
        {PHASES.slice(1).map((p) => (
          <li key={p.phase}>
            <span className="font-semibold text-amber-200">Phase {p.phase} — {p.name}</span> (after losing {p.lost} points): {p.spell ? SPELLS[p.spell].name : ''}, stronger play.
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        {c && <ClassicFace c={c} size="sm" defeated={cleared.includes(c.id)} />}
        <OpponentPicker value={id} onChange={setId} list={list} />
      </div>
      <Button variant="primary" className="mt-3 w-full" icon={<Flame className="size-4" />} onClick={() => launch.playClassic(id, { color: 'random', timeControlId: 'none' }, { kind: 'phases', tactics: [], journey: { kind: 'phases' } })} data-phases-play>
        Fight the boss
      </Button>
    </Card>
  )
}

function PowersCard({ launch }: { launch: JourneyLaunch }) {
  const list = useChallengers()
  const wins = useStore(journeyStore, (j) => j.modes.powersWins)
  const [id, setId] = useState(() => list[list.length - 1]?.id ?? 'sargon')
  const [power, setPower] = useState<TacticId>('knights-boot')
  const [timed, setTimed] = useState<'none' | 'blitz-5-3'>('blitz-5-3')
  const c = getClassic(id)
  const usable = PLAYER_POWERS.filter((t) => timed !== 'none' || !TACTICS[t].needsClock)
  const theirs = c ? SPELLS[powerFor(c)] : null
  return (
    <Card title="Duel of Powers" icon={<Zap className="size-4" />} data-arena-mode="powers" action={<Pill tone="sky">{wins} wins</Pill>}>
      <p className="text-sm text-slate-300">You bring one special ability; they bring their signature power.</p>
      <div className="mt-3 flex items-center gap-2">
        {c && <ClassicFace c={c} size="sm" />}
        <OpponentPicker value={id} onChange={setId} list={list} />
      </div>
      {theirs && (
        <p className="mt-2 text-xs text-red-200">
          Their power: <span className="font-semibold">{theirs.name}</span> — {theirs.description}
        </p>
      )}
      <div className="mt-3 space-y-3">
        <Choice label="Clock" value={timed} onChange={(v) => setTimed(v)} options={[{ id: 'blitz-5-3', label: '5 + 3' }, { id: 'none', label: 'No clock' }]} />
        <div>
          <div className="mb-1.5 text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">Your power</div>
          <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Your power">
            {usable.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={power === t}
                onClick={() => setPower(t)}
                data-power={t}
                className={`rounded-xl border p-2 text-left text-xs transition ${power === t ? 'border-accent bg-accent/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}
              >
                <span className="block font-semibold">{TACTICS[t].name}</span>
                <span className="block text-[11px] text-slate-400">{TACTICS[t].description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <Button
        variant="primary"
        className="mt-3 w-full"
        icon={<Zap className="size-4" />}
        onClick={() => launch.playClassic(id, { color: 'random', timeControlId: timed }, { kind: 'powers', tactics: [usable.includes(power) ? power : 'knights-boot'], journey: { kind: 'powers' } })}
        data-powers-play
      >
        Duel
      </Button>
    </Card>
  )
}

function CoopCard({ launch }: { launch: JourneyLaunch }) {
  const list = useChallengers()
  const wins = useStore(journeyStore, (j) => j.modes.coopWins)
  const [names, setNames] = useState<[string, string]>(['Player 1', 'Player 2'])
  const [id, setId] = useState(() => list[list.length - 1]?.id ?? 'sargon')
  return (
    <Card title="Co-op" icon={<Users className="size-4" />} data-arena-mode="coop" action={<Pill tone="green">{wins} wins together</Pill>}>
      <p className="text-sm text-slate-300">Two players, one army, against a boss 200 Elo stronger than usual. You take turns moving: pass the device after every move.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {names.map((n, i) => (
          <input
            key={i}
            value={n}
            maxLength={16}
            onChange={(e) => setNames((prev) => (i === 0 ? [e.target.value, prev[1]] : [prev[0], e.target.value]))}
            className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-accent"
            aria-label={`Player ${i + 1} name`}
          />
        ))}
      </div>
      <div className="mt-2">
        <OpponentPicker value={id} onChange={setId} list={list} />
      </div>
      <Button
        variant="primary"
        className="mt-3 w-full"
        icon={<Users className="size-4" />}
        onClick={() => launch.playClassic(id, { color: 'w', timeControlId: 'none' }, { kind: 'legend', tactics: [], journey: { kind: 'coop', players: [names[0].trim() || 'Player 1', names[1].trim() || 'Player 2'] } })}
        data-coop-play
      >
        Fight together
      </Button>
    </Card>
  )
}

function BulletCard({ launch }: { launch: JourneyLaunch }) {
  const streak = useStore(journeyStore, (j) => j.modes.bulletStreak)
  const best = useStore(journeyStore, (j) => j.modes.bulletBest)
  const elo = useStore(profileStore, (p) => p.elo)
  const next = bulletOpponent(elo, streak)
  return (
    <Card title="Bullet Gauntlet" icon={<Timer className="size-4" />} data-arena-mode="bullet" action={<Pill tone="red">Best {best}</Pill>}>
      <p className="text-sm text-slate-300">One minute each, no increment. Every win climbs the ladder to a stronger character; one loss ends the run.</p>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-2">
        <ClassicFace c={next} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{next.name}</div>
          <div className="text-[11px] text-slate-400">
            ~{next.elo} · current streak {streak}
          </div>
        </div>
      </div>
      <Button variant="primary" className="mt-3 w-full" icon={<Timer className="size-4" />} onClick={() => launch.playClassic(next.id, { color: 'random', timeControlId: 'bullet-1-0' }, { kind: 'legend', tactics: [], journey: { kind: 'bullet', streak } })} data-bullet-play>
        {streak > 0 ? `Continue the run (${streak})` : 'Start a run'}
      </Button>
    </Card>
  )
}

function EventCard({ onPlay }: { onPlay: () => void }) {
  const info = currentEvent()
  const won = useStore(journeyStore, (j) => j.modes.events[info.event.id] === info.weekId)
  const upcoming = nextEvent()
  return (
    <Card title="Weekend event" icon={<CalendarDays className="size-4" />} className="relative overflow-hidden lg:col-span-2" data-arena-mode="event" data-event={info.event.id}>
      <div className="pointer-events-none absolute -top-20 -right-10 size-64 rounded-full bg-accent-2/25 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-xl font-extrabold text-white">{info.event.name}</span>
            {info.live ? <Pill tone="green">Live · {info.days} day{info.days === 1 ? '' : 's'} left</Pill> : <Pill tone="slate">Starts in {info.days} day{info.days === 1 ? '' : 's'}</Pill>}
            {won && <Pill tone="gold">Won this weekend</Pill>}
          </div>
          <p className="text-sm text-amber-100">{info.event.tagline}</p>
          <p className="mt-1 text-xs text-slate-400">{info.event.rules}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {info.live ? `First win this weekend: +${info.event.coins} coins.` : 'Practise now; rewards start on Friday.'} Next weekend: {upcoming.name}.
          </p>
        </div>
        <Button variant="primary" className="w-full sm:w-auto" icon={<CalendarDays className="size-4" />} onClick={onPlay} data-event-play>
          {info.live ? 'Play the event' : 'Practise'}
        </Button>
      </div>
    </Card>
  )
}

function EventGame({ onLeave }: { onLeave: () => void }) {
  const info = currentEvent()
  const e = info.event
  const setup = e.variant ? { variant: e.variant } : { variant: 'battle' as const, rules: { fen: e.fen ?? '', objective: { kind: 'material' as const, at: 9999 }, events: [] } }
  return (
    <JourneyBoardGame
      id={`event-${e.id}`}
      title={e.name}
      subtitle={e.rules}
      setup={setup}
      color="w"
      onLeave={onLeave}
      onResult={(r, me, level) => {
        const won = r.winner === me
        recordJourney({ outcome: r.winner === null ? 'draw' : won ? 'win' : 'loss', opponentElo: LEVELS[level].rating })
        const j = journeyStore.get()
        if (won && info.live && j.modes.events[e.id] !== info.weekId) {
          journeyStore.set({ ...j, modes: { ...j.modes, events: { ...j.modes.events, [e.id]: info.weekId } } })
          payRewards([{ kind: 'coins', amount: e.coins }], `${e.name} medal`)
          return `Event medal won! +${e.coins} coins.`
        }
        return won ? 'Another win in the event.' : null
      }}
    />
  )
}

function PositionsCard({ onPlay }: { onPlay: (g: FamousGame) => void }) {
  const won = useStore(journeyStore, (j) => j.modes.positions)
  return (
    <Card title="Famous positions" icon={<Landmark className="size-4" />} className="lg:col-span-2" data-arena-mode="positions" action={<Pill tone="gold">{won.length}/{FAMOUS_GAMES.length}</Pill>}>
      <p className="mb-3 text-sm text-slate-300">Step into the critical moment of a famous game, take the winner’s side, and finish the job against Stockfish.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FAMOUS_GAMES.map((g) => (
          <li key={g.id}>
            <button type="button" onClick={() => onPlay(g)} className="glass flex h-full w-full flex-col gap-1 rounded-2xl p-3 text-left hover:border-white/25" data-position={g.id}>
              <span className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider text-amber-200 uppercase">
                  {g.place}, {g.year}
                </span>
                {won.includes(g.id) && <Pill tone="green">Won</Pill>}
              </span>
              <span className="font-display font-bold text-white">{g.name}</span>
              <span className="text-[11px] text-slate-400">{g.players}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function PositionGame({ game, onLeave }: { game: FamousGame; onLeave: () => void }) {
  const rules = positionRules(game)
  const c = game.opponent ? getClassic(game.opponent) : null
  if (!rules) return null
  const info: ReactNode = (
    <div className="space-y-1">
      <p>{game.story}</p>
      <p className="text-amber-200">
        Goal: checkmate within {game.within} moves, playing {game.side === 'w' ? 'White' : 'Black'}.
      </p>
    </div>
  )
  return (
    <JourneyBoardGame
      id={`position-${game.id}`}
      title={game.name}
      subtitle={`${game.players} · ${game.place}, ${game.year}`}
      setup={{ variant: 'battle', rules }}
      color={game.side}
      opponent={c ? { persona: classicPersona(c), intro: 'Let us see if you find what history found.' } : null}
      info={info}
      defaultLevel="club"
      onLeave={onLeave}
      onResult={(r, me, level) => {
        const won = r.winner === me
        recordJourney({ outcome: r.winner === null ? 'draw' : won ? 'win' : 'loss', opponentElo: LEVELS[level].rating })
        const j = journeyStore.get()
        if (won && !j.modes.positions.includes(game.id)) {
          journeyStore.set({ ...j, modes: { ...j.modes, positions: [...j.modes.positions, game.id] } })
          payRewards([{ kind: 'coins', amount: 200 }], game.name)
        }
        return `What actually happened: ${game.actual}`
      }}
    />
  )
}

