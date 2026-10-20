import { Flag, Flame, Play, RefreshCw, ScrollText, Swords, Target } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { sfx } from '../../audio'
import { speakLine, voicesSupported } from '../../audio/voice'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { BATTLES, type Battle } from '../../data/battles'
import { getClassic } from '../../data/classic/roster'
import { classicPersona } from '../../data/personas'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { settingsStore } from '../../stores/settingsStore'
import type { Color } from '../../types/chess'
import type { Persona } from '../../types/persona'
import type { BattleObjective } from '../../variants/rules'
import { variantResultText } from '../../variants/rules'
import { LEVELS, type VariantLevel, useVariantGame } from '../../variants/useVariantGame'
import { ChessBoard } from '../board/ChessBoard'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

/** The commander you face: a Classic character when history has one in the game. */
function opponentOf(battle: Battle, me: Color): { name: string; persona: Persona | null } {
  const side = battle.sides[me === 'w' ? 'b' : 'w']
  const c = side.commander ? getClassic(side.commander) : undefined
  return c ? { name: c.name, persona: classicPersona(c) } : { name: side.name, persona: null }
}

function objectiveText(o: BattleObjective, move: number): string {
  const done = Math.max(0, move - 1)
  if (o.kind === 'survive') return `Move ${move} · ${o.side === 'w' ? 'White' : 'Black'} must hold to the end of move ${o.until} (${Math.max(0, o.until - done)} to go)`
  if (o.kind === 'win-by') return `Move ${move} · ${o.side === 'w' ? 'White' : 'Black'} must win by the end of move ${o.by} (${Math.max(0, o.by - done)} to go)`
  return `Move ${move} · material decides after move ${o.at} (${Math.max(0, o.at - done)} to go)`
}

/** "Play the Real Battle": famous battles as chess positions, with history's own twists. */
export function BattlesView() {
  const v = useVariantGame(true)
  const [chosen, setChosen] = useState<Battle>(BATTLES[0]!)
  const [side, setSide] = useState<Color>('w')
  const [level, setLevel] = useState<VariantLevel>('club')
  const [banner, setBanner] = useState<string | null>(null)
  const [seenResult, setSeenResult] = useState(-1)
  const settings = useStore(settingsStore, (s) => s)
  const won = useStore(profileStore, (p) => p.feats.battlesWon)
  const onPickup = useCallback(() => sfx.pickup(), [])
  const game = v.game
  const battle = v.battle
  const firedRef = useRef(0)
  const voice = voicesSupported() && settings.characterVoice !== 'off'

  const say = useCallback(
    (speaker: string, text: string) => {
      if (voice) speakLine({ speaker, text, mood: 'calm' }, settingsStore.get().sfxVolume)
    },
    [voice],
  )

  const start = (b: Battle, me: Color) => {
    firedRef.current = 0
    setBanner(null)
    v.start({ variant: 'battle', battle: b, color: me, level })
    const opp = opponentOf(b, me)
    say(opp.name, b.lines[me === 'w' ? 'b' : 'w'].intro)
  }

  // Reinforcements: announce each event once, as it happens.
  useEffect(() => {
    if (!game || !battle) return
    if (game.fired.length > firedRef.current) {
      const id = game.fired[game.fired.length - 1]
      const event = battle.setup.events.find((e) => e.id === id)
      firedRef.current = game.fired.length
      if (event) {
        sfx.pickup()
        say('Narrator', event.text)
        const t = window.setTimeout(() => setBanner(event.text), 0)
        return () => window.clearTimeout(t)
      }
    }
  }, [battle, game, say, v.version])

  // The opposing commander has the last word.
  const result = game?.result ?? null
  useEffect(() => {
    if (!result || !battle || !game) return
    const me = v.myColor
    const opp = opponentOf(battle, me)
    const lines = battle.lines[me === 'w' ? 'b' : 'w']
    say(opp.name, result.winner === me ? lines.defeat : result.winner === null ? lines.intro : lines.victory)
  }, [battle, game, result, say, v.myColor])

  if (!game || !battle) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4" data-battles="setup">
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Battle">
          {BATTLES.map((b) => {
            const on = b.id === chosen.id
            const done = won.some((k) => k.startsWith(`${b.id}:`))
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setChosen(b)}
                data-battle={b.id}
                className={`glass relative flex flex-col gap-1 rounded-3xl p-4 text-left transition ${on ? 'border-accent ring-1 ring-accent' : 'hover:-translate-y-0.5 hover:border-white/25'}`}
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">{b.date}</span>
                <span className="font-display text-xl font-extrabold text-white">{b.name}</span>
                <span className="line-clamp-3 text-xs text-slate-400">{b.history}</span>
                {done && <Flag className="absolute top-3 right-3 size-4 text-emerald-300" aria-label="Won" />}
              </button>
            )
          })}
        </div>

        <section className="glass space-y-3 rounded-3xl p-5" data-battle-detail={chosen.id}>
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">
            <ScrollText className="size-3.5" /> {chosen.name}, {chosen.date}
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">{chosen.history}</p>
          <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
            <Target className="size-3.5" /> On the board
          </h4>
          <ul className="space-y-1.5 text-sm text-slate-300">
            {chosen.rules.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </section>

        <section className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Command</div>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Side">
              {(['w', 'b'] as const).map((c) => {
                const s = chosen.sides[c]
                const opp = opponentOf(chosen, c)
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={side === c}
                    onClick={() => setSide(c)}
                    data-battle-side={c}
                    className={`rounded-2xl border p-3 text-left transition ${side === c ? 'border-sky-300 bg-sky-400/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'}`}
                  >
                    <span className="block font-semibold text-white">
                      {s.name} <span className="text-xs font-normal text-slate-400">({c === 'w' ? 'White' : 'Black'})</span>
                    </span>
                    <span className="block text-xs text-slate-300">{s.goal}</span>
                    <span className="mt-1 block text-[11px] text-slate-500">You face: {opp.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Opponent strength</div>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Opponent strength">
              {(Object.keys(LEVELS) as VariantLevel[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={level === id}
                  onClick={() => setLevel(id)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition sm:text-sm ${level === id ? 'border-sky-300 bg-sky-400/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}
                >
                  {LEVELS[id].name} {LEVELS[id].elo}
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" size="lg" className="sm:col-span-2" icon={<Play className="size-5" fill="currentColor" />} onClick={() => start(chosen, side)} data-battle-start>
            Fight the Battle of {chosen.name}
          </Button>
        </section>
      </div>
    )
  }

  const me = v.myColor
  const opp = opponentOf(battle, me)
  const showResult = result !== null && seenResult !== v.version
  const lines = battle.lines[me === 'w' ? 'b' : 'w']
  const said = result ? (result.winner === me ? lines.defeat : result.winner === null ? lines.intro : lines.victory) : lines.intro
  const status = result ? variantResultText(result, me) : v.thinking ? `${opp.name} is moving…` : game.inCheck ? 'Check! Your move' : 'Your move'

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" data-battles="playing" data-battle-game={battle.id}>
      <div className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        {banner && (
          <div className="flex animate-pop-in items-center gap-2 rounded-2xl border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-sm text-amber-100" role="status" data-battle-event>
            <Flame className="size-4 shrink-0" /> {banner}
          </div>
        )}
        <ChessBoard
          id={`battle-${battle.id}`}
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
        />
      </div>
      <aside className="flex flex-col gap-3">
        <div className="glass rounded-2xl px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">
            {battle.name} · {battle.date}
          </div>
          <div className="mt-1 text-sm text-white" role="status" data-battle-status>
            {status}
          </div>
          <div className="mt-1 text-xs text-slate-400" data-battle-objective>
            {objectiveText(battle.setup.objective, game.moveNumber)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            You command {battle.sides[me].name}: {battle.sides[me].goal}
          </div>
        </div>
        <div className="glass flex items-start gap-3 rounded-2xl p-3">
          {opp.persona ? (
            <PortraitEmblem spec={opp.persona.portrait} label={opp.name} size="md" defeated={result?.winner === me} />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
              <Swords className="size-6" />
            </span>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-white">{opp.name}</div>
            <p className="text-xs italic text-slate-300">“{said}”</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {result ? (
            <Button variant="primary" onClick={() => start(battle, me)} icon={<RefreshCw className="size-4" />} data-battle-again>
              Fight again
            </Button>
          ) : (
            <Button variant="ghost" onClick={v.resign} icon={<Flag className="size-4" />}>
              Surrender
            </Button>
          )}
          <Button variant="secondary" onClick={v.leave}>
            All battles
          </Button>
        </div>
      </aside>
      <Modal
        open={showResult}
        title={`The Battle of ${battle.name}`}
        onClose={() => setSeenResult(v.version)}
        size="sm"
        footer={
          <Button variant="primary" className="w-full" onClick={() => setSeenResult(v.version)}>
            View the board
          </Button>
        }
      >
        {result && (
          <div className="py-2 text-center" data-battle-result>
            <div className="font-display text-2xl font-extrabold text-white">{result.winner === null ? 'Undecided' : result.winner === me ? 'Victory' : 'Defeat'}</div>
            <div className="mt-1 text-sm text-slate-300">{variantResultText(result, me)}</div>
            <p className="mt-3 text-xs italic text-slate-400">
              {opp.name}: “{said}”
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
