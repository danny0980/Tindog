import { Chess } from 'chess.js'
import { ArrowLeft, FastForward, Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveMaterial, sfx } from '../../audio'
import { playPieceSound } from '../../audio/pieceSounds'
import { getBoardTheme, getPieceSet } from '../../constants/themes'
import { getClassic, getClassicEra } from '../../data/classic/roster'
import { classicPersona } from '../../data/personas'
import { useEngine } from '../../hooks/useEngine'
import { useStore } from '../../hooks/useStore'
import { recordJourney } from '../../journey/journeyActions'
import { journeyStore } from '../../journey/journeyStore'
import type { DreamMatch } from '../../journey/modes'
import { settingsStore } from '../../stores/settingsStore'
import type { Color, Square } from '../../types/chess'
import type { Persona } from '../../types/persona'
import { ChessBoard } from '../board/ChessBoard'
import { EngineNotice } from '../game/EngineNotice'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'

const SPEEDS = [
  { id: 'slow', label: 'Slow', ms: 1800 },
  { id: 'normal', label: 'Normal', ms: 900 },
  { id: 'fast', label: 'Fast', ms: 250 },
] as const
const MAX_PLIES = 220
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const pick = (lines: readonly string[] | undefined): string | null => (lines && lines.length > 0 ? (lines[Math.floor(Math.random() * lines.length)] ?? null) : null)

/** Two characters play each other: the engine plays each side in that character's style and strength. */
export function DreamMatchViewer({ match, onClose }: { match: DreamMatch; onClose: () => void }) {
  const a = getClassic(match.a)
  const b = getClassic(match.b)
  const personas = useMemo<Record<Color, Persona> | null>(() => (a && b ? { w: classicPersona(a, b.id), b: classicPersona(b, a.id) } : null), [a, b])
  const settings = useStore(settingsStore, (s) => s)
  const engine = useEngine('variant', true)
  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(START)
  // Move count and side to move, kept in state for the status line.
  const [plies, setPlies] = useState(0)
  const [last, setLast] = useState<{ from: Square; to: Square } | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]['id']>('normal')
  const [said, setSaid] = useState<{ color: Color; text: string } | null>(() => (personas ? { color: 'w', text: pick(personas.w.quotes.intro) ?? 'Let us begin.' } : null))
  const [result, setResult] = useState<string | null>(null)
  const bookedRef = useRef(false)
  const theme = getBoardTheme(a ? getClassicEra(a.era).themeId : settings.boardTheme)
  const pieceSet = getPieceSet(b ? getClassicEra(b.era).pieceSetId : settings.pieceSet)

  const finish = useCallback(
    (chess: Chess) => {
      if (!personas) return
      let text: string
      if (chess.isCheckmate()) {
        const winner: Color = chess.turn() === 'w' ? 'b' : 'w'
        text = `${personas[winner].name} wins by checkmate!`
        setSaid({ color: winner, text: pick(personas[winner].quotes.legendWins) ?? 'Checkmate.' })
      } else {
        text = chess.isStalemate() ? 'Draw by stalemate.' : chess.isThreefoldRepetition() ? 'Draw by repetition.' : chess.isInsufficientMaterial() ? 'Draw: not enough material to mate.' : 'Draw.'
        setSaid({ color: 'b', text: pick(personas.b.quotes.draw) ?? 'A fair result.' })
      }
      setResult(text)
      if (!bookedRef.current) {
        bookedRef.current = true
        journeyStore.set((j) => ({ ...j, modes: { ...j.modes, dreams: j.modes.dreams + 1 } }))
        recordJourney({ outcome: null, base: 15 })
      }
    },
    [personas],
  )

  // One move at a time while playing: the side to move searches in its own style.
  useEffect(() => {
    if (!personas || !playing || result || engine.status !== 'ready') return
    let cancelled = false
    const chess = chessRef.current
    const side = chess.turn()
    const profile = personas[side].profile
    const delay = SPEEDS.find((s) => s.id === speed)?.ms ?? 900
    const started = Date.now()
    void (async () => {
      let uci: string | null = null
      try {
        const res = await engine.search(chess.fen(), { depth: Math.min(profile.depth, 12), skillLevel: profile.skillLevel, moveTimeMs: Math.min(profile.moveTimeMs, 1200), multiPv: 3 })
        const lines = res.lines.filter((l) => l.pv[0])
        const best = lines[0]
        const score = (l: (typeof lines)[number]) => (l.score.type === 'mate' ? Math.sign(l.score.value) * 10_000 : l.score.value)
        const near = best ? lines.filter((l) => score(l) >= score(best) - Math.max(10, profile.toleranceCp)) : []
        uci = near[Math.floor(Math.random() * near.length)]?.pv[0] ?? res.bestMove
      } catch {
        uci = null
      }
      await new Promise((r) => window.setTimeout(r, Math.max(0, delay - (Date.now() - started))))
      if (cancelled) return
      const moves = chess.moves({ verbose: true })
      const move = (uci ? moves.find((m) => m.from === uci!.slice(0, 2) && m.to === uci!.slice(2, 4) && (!uci![4] || m.promotion === uci![4])) : null) ?? moves[Math.floor(Math.random() * moves.length)]
      if (!move) return
      chess.move(move)
      const material = resolveMaterial(settingsStore.get().soundMaterial, theme)
      playPieceSound(material, move.san.startsWith('O-O') ? 'castle' : move.promotion ? 'promote' : move.captured ? 'capture' : 'move')
      setFen(chess.fen())
      setPlies(chess.history().length)
      setLast({ from: move.from, to: move.to })
      if (move.san.includes('+') && Math.random() < 0.35) setSaid({ color: side, text: pick(personas[side].quotes.checkGiven) ?? 'Check!' })
      else if (move.captured === 'q') setSaid({ color: side, text: pick(personas[side].quotes.advantage) ?? 'Your queen is mine.' })
      if (chess.isGameOver() || chess.history().length >= MAX_PLIES) finish(chess)
    })()
    return () => {
      cancelled = true
    }
  }, [engine, fen, finish, personas, playing, result, speed, theme])

  const restart = () => {
    chessRef.current = new Chess()
    bookedRef.current = false
    setFen(START)
    setPlies(0)
    setLast(null)
    setResult(null)
    setPlaying(true)
    if (personas) setSaid({ color: 'w', text: pick(personas.w.quotes.intro) ?? 'Let us begin.' })
    sfx.timeTravel()
  }

  if (!a || !b || !personas) return null
  const face = (c: Color) => (
    <div className={`flex items-center gap-2 rounded-2xl p-2 ${said?.color === c ? 'bg-amber-300/10 ring-1 ring-amber-300/40' : 'bg-white/[0.04]'}`}>
      <PortraitEmblem spec={personas[c].portrait} label={personas[c].name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">
          {personas[c].name} <span className="text-xs font-normal text-slate-500">({c === 'w' ? 'White' : 'Black'} · ~{personas[c].elo})</span>
        </div>
        {said?.color === c && <div className="text-xs italic text-amber-100">“{said.text}”</div>}
      </div>
    </div>
  )
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" data-dream-viewer>
      <div className="mx-auto flex w-full flex-col gap-2" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 17rem)), 44rem)' }}>
        {face('b')}
        <ChessBoard
          id={`dream-${match.a}-${match.b}`}
          fen={fen}
          orientation="w"
          lastMove={last}
          movableColor={null}
          onMove={() => false}
          theme={theme}
          pieceSet={pieceSet}
          lowPower={settings.batterySaver}
          showLegalMoves={false}
          showCoordinates={settings.showCoordinates}
        />
        {face('w')}
      </div>
      <aside className="flex flex-col gap-3">
        <EngineNotice status={engine.status} error={engine.error} onRetry={engine.retry} />
        <div className="glass rounded-2xl p-4">
          <div className="text-[11px] font-bold tracking-[0.2em] text-amber-200 uppercase">Dream match</div>
          <div className="font-display text-lg font-bold text-white">{match.title}</div>
          <div className="mt-1 text-sm text-slate-300" role="status" data-dream-status>
            {result ?? `Move ${Math.floor(plies / 2) + 1} · ${plies % 2 === 0 ? personas.w.name : personas.b.name} to move`}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={speed === s.id} onClick={() => setSpeed(s.id)} className={`rounded-xl px-2 py-2 text-xs font-semibold pointer-coarse:min-h-10 ${speed === s.id ? 'bg-accent text-ink-950' : 'bg-white/5 text-slate-300'}`}>
              {s.id === 'fast' ? <FastForward className="mx-auto size-4" /> : s.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => setPlaying((p) => !p)} disabled={result !== null} icon={playing ? <Pause className="size-4" /> : <Play className="size-4" />}>
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button onClick={restart} icon={<RotateCcw className="size-4" />}>
            Again
          </Button>
          <Button variant="ghost" onClick={onClose} icon={<ArrowLeft className="size-4" />}>
            Back
          </Button>
        </div>
      </aside>
    </div>
  )
}
