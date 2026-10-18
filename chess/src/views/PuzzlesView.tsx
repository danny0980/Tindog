import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Eye, Flame, Lightbulb, Library, RotateCcw, Target, Trophy } from 'lucide-react'
import { type CSSProperties, useCallback, useMemo, useState } from 'react'
import { sfx } from '../audio'
import { ChessBoard } from '../components/board/ChessBoard'
import { ConfettiCanvas } from '../components/effects/ConfettiCanvas'
import { Button } from '../components/ui/Button'
import { PUZZLE_REWARD } from '../constants/economy'
import { getBoardTheme, getPieceSet } from '../constants/themes'
import { PUZZLES } from '../data/puzzles'
import { usePuzzleSession } from '../hooks/usePuzzleSession'
import { useStore } from '../hooks/useStore'
import { profileStore } from '../stores/profileStore'
import { settingsStore } from '../stores/settingsStore'
import { showToast } from '../stores/toastStore'
import type { Puzzle } from '../types/puzzle'
import { localDateKey, msUntilTomorrow } from '../utils/date'
import { applyPuzzleSolve } from '../utils/progression'
import { getDailyPuzzles } from '../utils/puzzles'

type Mode = { kind: 'daily'; index: number } | { kind: 'library'; index: number }

export function PuzzlesView() {
  const today = localDateKey()
  const daily = useMemo(() => getDailyPuzzles(today), [today])
  const [mode, setMode] = useState<Mode>({ kind: 'daily', index: 0 })
  const [celebration, setCelebration] = useState(0)
  const profile = useStore(profileStore, (p) => p)
  const settings = useStore(settingsStore, (s) => s)

  const puzzle: Puzzle | undefined = mode.kind === 'daily' ? daily[mode.index] : PUZZLES[mode.index]
  const isDaily = mode.kind === 'daily'
  const solvedToday = daily.filter((p) => profile.puzzles.solved[p.id]).length
  const hoursLeft = Math.ceil(msUntilTomorrow() / 3_600_000)

  const onSolved = useCallback(
    (assisted: boolean) => {
      if (!puzzle) return
      const out = applyPuzzleSolve(profileStore.get(), puzzle, { daily: isDaily, assisted })
      profileStore.set(out.profile)
      if (!settingsStore.get().batterySaver) setCelebration((c) => c + 1)
      if (out.coins > 0) {
        window.setTimeout(() => sfx.coins(), 600)
        showToast('coins', `+${out.coins} coins`, assisted ? 'Solved with help — half reward.' : 'Daily puzzle solved!')
      } else if (!out.firstSolve) {
        showToast('success', 'Solved again!', 'Rewards are granted on the first solve.')
      } else {
        showToast('success', 'Puzzle solved!')
      }
      out.unlocked.forEach((a, i) =>
        window.setTimeout(() => {
          sfx.achievement()
          showToast('achievement', a.title, `${a.description} · +${a.reward} coins`, 5000)
        }, 900 + i * 1100),
      )
    },
    [isDaily, puzzle],
  )

  return (
    <div className="safe-px mx-auto grid w-full max-w-7xl flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6">
      <div className="mx-auto w-full" style={{ maxWidth: 'min(100%, max(18rem, calc(100dvh - 15rem)), 46rem)' }}>
        {puzzle ? (
          <PuzzleBoard key={`${mode.kind}-${puzzle.id}`} puzzle={puzzle} onSolved={onSolved} solvedBefore={Boolean(profile.puzzles.solved[puzzle.id])} />
        ) : (
          <div className="glass rounded-xl p-6 text-center text-slate-400">No puzzles available.</div>
        )}
      </div>

      <aside className="flex flex-col gap-3">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-ink-950">
              <CalendarDays className="size-6" />
            </div>
            <div className="flex-1">
              <div className="font-display text-sm font-extrabold tracking-wider text-white">DAILY PUZZLES</div>
              <div className="text-xs text-slate-400">New set in {hoursLeft}h · {solvedToday}/{daily.length} solved</div>
            </div>
            <div className="text-center">
              <div className={`flex items-center gap-1 font-mono text-xl font-bold ${profile.puzzles.streak > 0 ? 'text-orange-300' : 'text-slate-500'}`}>
                <Flame className={`size-5 ${profile.puzzles.streak > 0 ? 'idle-pause animate-bounce-soft' : ''}`} /> {profile.puzzles.streak}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">streak</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {daily.map((p, i) => {
              const solved = Boolean(profile.puzzles.solved[p.id])
              const selected = mode.kind === 'daily' && mode.index === i
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMode({ kind: 'daily', index: i })}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    selected ? 'border-accent bg-accent/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <span className={`flex size-8 items-center justify-center rounded-lg ${solved ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/10 text-slate-300'}`}>
                    {solved ? <CheckCircle2 className="size-5" /> : <Target className="size-4" />}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-white">Puzzle {i + 1} · Mate in {p.mateIn}</span>
                    <span className="block text-xs text-slate-400">{p.fen.split(' ')[1] === 'w' ? 'White' : 'Black'} to move</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-yellow-300">{solved ? '✓' : `+${PUZZLE_REWARD[p.mateIn]}`}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Library className="size-4 text-accent" /> Puzzle library
            <span className="ml-auto text-xs text-slate-400">
              {Object.keys(profile.puzzles.solved).length}/{PUZZLES.length} solved
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" icon={<ChevronLeft className="size-4" />} onClick={() => setMode((m) => ({ kind: 'library', index: m.kind === 'library' ? (m.index - 1 + PUZZLES.length) % PUZZLES.length : 0 }))} aria-label="Previous puzzle" />
            <button
              type="button"
              onClick={() => setMode((m) => ({ kind: 'library', index: m.kind === 'library' ? m.index : 0 }))}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-center text-sm transition ${mode.kind === 'library' ? 'border-accent bg-accent/10 text-white' : 'border-white/10 text-slate-300'}`}
            >
              {mode.kind === 'library' ? `#${mode.index + 1} · Mate in ${PUZZLES[mode.index]?.mateIn ?? 2}` : 'Free practice'}
            </button>
            <Button size="sm" icon={<ChevronRight className="size-4" />} onClick={() => setMode((m) => ({ kind: 'library', index: m.kind === 'library' ? (m.index + 1) % PUZZLES.length : 0 }))} aria-label="Next puzzle" />
          </div>
          <p className="mt-2 text-xs text-slate-500">Practice puzzles count towards achievements; coins come from daily puzzles.</p>
        </div>

        <div className="glass flex items-center gap-3 rounded-xl p-3 text-xs text-slate-400">
          <Trophy className="size-4 shrink-0 text-amber-300" /> Every puzzle is a forced mate verified by Stockfish. Any mating move is accepted on the final move.
        </div>
      </aside>
      <ConfettiCanvas burst={celebration} colors={getBoardTheme(settings.boardTheme).particles} disabled={settings.batterySaver} />
    </div>
  )
}

function PuzzleBoard({ puzzle, onSolved, solvedBefore }: { puzzle: Puzzle; onSolved: (assisted: boolean) => void; solvedBefore: boolean }) {
  const settings = useStore(settingsStore, (s) => s)
  const theme = getBoardTheme(settings.boardTheme)
  const session = usePuzzleSession(puzzle, onSolved)
  const sideName = session.solverColor === 'w' ? 'White' : 'Black'

  const extra: Record<string, CSSProperties> = {}
  if (session.hintMove) extra[session.hintMove.from] = theme.highlights.hint
  const arrows = session.hintMove && session.hintLevel === 2 ? [{ from: session.hintMove.from, to: session.hintMove.to, color: 'rgba(250, 204, 21, 0.85)' }] : []

  const message =
    session.status === 'solved'
      ? { title: 'Solved!', detail: session.mistakes > 0 ? `With ${session.mistakes} miss${session.mistakes === 1 ? '' : 'es'}` : 'Flawless — checkmate delivered.', tone: 'text-emerald-300' }
      : session.status === 'revealing' || session.status === 'revealed'
        ? { title: 'Solution', detail: 'Watch the winning line.', tone: 'text-accent' }
        : session.status === 'opponent'
          ? { title: 'Correct!', detail: 'Opponent is replying…', tone: 'text-emerald-300' }
          : session.mistakes > 0 && session.shake > 0
            ? { title: 'Not quite', detail: `Try again — ${sideName} mates in ${session.movesLeft}.`, tone: 'text-orange-300' }
            : { title: `${sideName} to move`, detail: `Find checkmate in ${session.movesLeft}.`, tone: 'text-white' }

  return (
    <div className="flex flex-col gap-3">
      <div className="glass flex items-center gap-3 rounded-xl px-4 py-3" role="status" aria-live="polite">
        <span className={`block size-5 shrink-0 rounded-full ring-2 ${session.solverColor === 'w' ? 'bg-slate-100 ring-white/40' : 'bg-slate-900 ring-white/30'}`} />
        <div className="min-w-0 flex-1">
          <div className={`text-base font-bold ${message.tone}`}>{message.title}</div>
          <div className="text-sm text-slate-400">{message.detail}</div>
        </div>
        <span className="rounded-lg bg-white/10 px-2 py-1 font-mono text-xs font-bold text-slate-200">M{puzzle.mateIn}</span>
        {solvedBefore && <CheckCircle2 className="size-5 text-emerald-300" aria-label="Solved before" />}
      </div>
      <ChessBoard
        id={`puzzle-${puzzle.id}`}
        fen={session.fen}
        orientation={session.solverColor}
        lastMove={session.lastMove}
        movableColor={session.status === 'solving' ? session.solverColor : null}
        onMove={session.onMove}
        theme={theme}
        pieceSet={getPieceSet(settings.pieceSet)}
        lowPower={settings.batterySaver}
        showLegalMoves={settings.showLegalMoves}
        showCoordinates={settings.showCoordinates}
        extraSquareStyles={extra}
        arrows={arrows}
        shakeKey={session.shake}
      />
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={session.hint} disabled={session.status !== 'solving'} icon={<Lightbulb className="size-4" />}>
          {session.hintLevel === 0 ? 'Hint' : 'More'}
        </Button>
        <Button onClick={session.reveal} disabled={session.status !== 'solving'} icon={<Eye className="size-4" />}>
          Solution
        </Button>
        <Button onClick={session.retry} icon={<RotateCcw className="size-4" />}>
          Retry
        </Button>
      </div>
    </div>
  )
}
