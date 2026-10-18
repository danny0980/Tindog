import { Coins, Crown, Flag, Play, Rocket, Sparkles, Timer, Zap } from 'lucide-react'
import { useCallback } from 'react'
import { sfx } from '../audio'
import { ClassificationBadge } from '../components/analysis/ClassificationBadge'
import { ChessBoard } from '../components/board/ChessBoard'
import { ConfettiCanvas } from '../components/effects/ConfettiCanvas'
import { RushHud } from '../components/rush/RushHud'
import { ScorePopups } from '../components/rush/ScorePopups'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { RUSH_POINTS_PER_COIN, RUSH_ROUND_BONUS_MS, RUSH_START_MS } from '../constants/rush'
import { getBoardTheme, getPieceSet } from '../constants/themes'
import { useStore } from '../hooks/useStore'
import { useTimeRush } from '../hooks/useTimeRush'
import { profileStore } from '../stores/profileStore'
import { settingsStore } from '../stores/settingsStore'

const RULES = [
  { icon: Timer, text: `${RUSH_START_MS / 60_000} minutes on the clock — it only runs on your turn.` },
  { icon: Zap, text: 'Fast moves score up to ×3. Strong moves build a combo up to ×3 and add time.' },
  { icon: Crown, text: `Checkmate the AI to clear the round: +${RUSH_ROUND_BONUS_MS / 1000}s and a tougher opponent.` },
  { icon: Flag, text: 'Blunders cost time and break your combo. Get mated and the run ends.' },
]

const END_REASONS = { timeout: "Time's up!", mated: 'Checkmated!', quit: 'Run ended' } as const

/** Blitz Arena: Time Rush — arcade chess against the clock. */
export function RushView({ active }: { active: boolean }) {
  const rush = useTimeRush(active)
  const settings = useStore(settingsStore, (s) => s)
  const rushRecord = useStore(profileStore, (p) => p.rush)
  const theme = getBoardTheme(settings.boardTheme)
  const onPickup = useCallback(() => sfx.pickup(), [])

  if (rush.phase === 'ready') {
    return (
      <div className="safe-px mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 pb-4">
        <section className="glass relative overflow-hidden rounded-3xl p-6 text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <div className="idle-pause mx-auto flex size-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-orange-400 to-accent-2 text-ink-950 shadow-[0_20px_60px_-15px_var(--accent-2)]">
              <Rocket className="size-10" />
            </div>
            <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.3em] text-accent">Blitz Arena</div>
            <h2 className="font-display text-4xl font-extrabold tracking-wider text-white">TIME RUSH</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Race the countdown against Stockfish. Speed and precision multiply your score.</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Stat label="Best score" value={rushRecord.bestScore.toLocaleString()} />
              <Stat label="Best round" value={String(rushRecord.bestRound)} />
              <Stat label="Runs" value={String(rushRecord.runs)} />
            </div>
            <Button variant="primary" size="lg" className="mt-6 w-full" onClick={rush.start} icon={<Play className="size-5" fill="currentColor" />}>
              Start rush
            </Button>
            {rush.engineStatus !== 'ready' && <p className="mt-2 text-xs text-slate-500">Warming up Stockfish…</p>}
          </div>
        </section>
        <section className="glass rounded-2xl p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">How it works</h3>
          <ul className="space-y-2.5">
            {RULES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-slate-300">
                <Icon className="mt-0.5 size-4 shrink-0 text-accent" /> {text}
              </li>
            ))}
            <li className="flex items-start gap-3 text-sm text-slate-300">
              <Coins className="mt-0.5 size-4 shrink-0 text-yellow-300" /> Earn 1 coin per {RUSH_POINTS_PER_COIN} points.
            </li>
          </ul>
        </section>
      </div>
    )
  }

  return (
    <div className="safe-px mx-auto grid w-full max-w-6xl flex-1 gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="mx-auto flex w-full flex-col gap-3" style={{ maxWidth: 'min(100%, max(16rem, calc(100dvh - 19rem)), 44rem)' }}>
        <div className="lg:hidden">
          <RushHud timeLeft={rush.timeLeft} score={rush.score} combo={rush.combo} round={rush.round} difficulty={rush.level?.difficulty ?? 'beginner'} best={rushRecord.bestScore} />
        </div>
        <ChessBoard
          id={`rush-board-${rush.runId}`}
          fen={rush.fen}
          orientation="w"
          lastMove={rush.lastMove}
          movableColor={rush.movable ? 'w' : null}
          onMove={rush.onMove}
          onPickup={onPickup}
          theme={theme}
          pieceSet={getPieceSet(settings.pieceSet)}
          lowPower={settings.batterySaver}
          showLegalMoves={settings.showLegalMoves}
          showCoordinates={settings.showCoordinates}
        >
          {!settings.batterySaver && <ScorePopups popups={rush.popups} />}
        </ChessBoard>
        <div className="flex items-center gap-2">
          <div className="glass flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300">
            {rush.lastQuality ? <ClassificationBadge classification={rush.lastQuality} size="sm" /> : <Sparkles className="size-4 text-accent" />}
            <span className="truncate">{rush.aiThinking ? 'Stockfish is replying…' : 'Your move — the clock is running!'}</span>
          </div>
          <Button variant="ghost" onClick={rush.quit} icon={<Flag className="size-4" />}>
            Quit
          </Button>
        </div>
      </div>
      <aside className="hidden flex-col gap-3 lg:flex">
        <RushHud timeLeft={rush.timeLeft} score={rush.score} combo={rush.combo} round={rush.round} difficulty={rush.level?.difficulty ?? 'beginner'} best={rushRecord.bestScore} />
        <div className="glass grid grid-cols-2 gap-2 rounded-2xl p-3">
          <Stat label="Moves" value={String(rush.stats.moves)} />
          <Stat label="Perfect" value={String(rush.stats.perfectMoves)} />
          <Stat label="Captures" value={String(rush.stats.captures)} />
          <Stat label="Best combo" value={String(rush.stats.bestCombo)} />
        </div>
      </aside>

      <ConfettiCanvas burst={rush.summary?.newBest ? rush.runId : 0} colors={theme.particles} disabled={settings.batterySaver} />

      <Modal
        open={rush.phase === 'over' && rush.summary !== null && active}
        title="Rush complete"
        onClose={rush.start}
        size="sm"
        footer={
          <Button variant="primary" className="w-full" onClick={rush.start} icon={<Play className="size-4" fill="currentColor" />}>
            Play again
          </Button>
        }
      >
        {rush.summary && (
          <div className="py-2 text-center">
            <div className="text-sm font-semibold text-slate-400">{END_REASONS[rush.summary.reason]}</div>
            {rush.summary.newBest && <div className="mt-1 text-xs font-black uppercase tracking-[0.3em] text-amber-300">New best!</div>}
            <div className="holo-text mt-1 font-display text-5xl font-extrabold tabular-nums">{rush.summary.score.toLocaleString()}</div>
            <div className="mt-1 flex items-center justify-center gap-1 font-mono text-sm font-bold text-yellow-300">
              <Coins className="size-4" /> +{rush.summary.coins}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Rounds won" value={String(rush.summary.stats.roundsWon)} />
              <Stat label="Perfect moves" value={String(rush.summary.stats.perfectMoves)} />
              <Stat label="Best combo" value={String(rush.summary.stats.bestCombo)} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.05] px-2 py-2 text-center">
      <div className="font-mono text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  )
}
