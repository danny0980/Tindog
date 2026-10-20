import { Brain, Coins, Crown, Mic, Eye, Handshake, Hourglass, Infinity as InfinityIcon, Map as MapIcon, Microscope, RotateCcw, ScrollText, Share2, Skull, Swords, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { POTIONS } from '../../data/arena'
import { getGrandRealm } from '../../data/campaign/realms'
import { RelicTile } from '../campaign/RelicTile'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { ArtBackdrop } from '../fx/ArtBackdrop'
import { CelebrationParticles } from '../fx/CelebrationParticles'
import type { PortraitSpec } from '../../types/persona'
import { StarRow } from '../campaign/StarRow'
import type { GameEndSummary } from '../../hooks/useGameController'
import { describeResult } from '../../utils/chess'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface GameOverModalProps {
  open: boolean
  summary: GameEndSummary | null
  isAiMode: boolean
  moveCount: number
  onNewGame: () => void
  /** Same opponent and settings again (campaign battles). */
  onRematch: () => void
  onOpenCampaign: () => void
  onOpenGauntlet: () => void
  onReview: () => void
  onAnalyze: () => void
  onShare: () => void
  /** The character you faced (legend or boss): their portrait crowns the card. */
  opponent?: { spec: PortraitSpec; label: string } | null
  /** A true fact about the historical opponent (Classic Chess), shown after the game. */
  lesson?: { name: string; fact: string } | null
  /** After beating a Classic character: interview them, or take a quick history quiz. */
  history?: { name: string; onInterview: () => void; onQuiz: () => void } | null
}

export function GameOverModal({ open, summary, isAiMode, moveCount, onNewGame, onRematch, onOpenCampaign, onOpenGauntlet, onReview, onAnalyze, onShare, opponent = null, lesson = null, history = null }: GameOverModalProps) {
  if (!summary) return null
  const { title, detail } = describeResult(summary.result)
  const isDraw = summary.result.kind === 'draw'
  const won = summary.outcome === 'win'
  const lost = summary.outcome === 'loss'
  const headline = won ? 'Victory!' : lost ? 'Defeat' : title
  const Icon = isDraw ? Handshake : lost ? Skull : Crown
  const accent = lost ? 'from-slate-500 to-slate-700' : isDraw ? 'from-sky-400 to-indigo-500' : 'from-accent to-accent-2'
  const moves = Math.ceil(moveCount / 2)

  return (
    <Modal
      open={open}
      title="Game over"
      onClose={onReview}
      size="sm"
      footer={
        <div className="space-y-2">
          {summary.gauntlet ? (
            <Button variant="primary" className="w-full" onClick={onOpenGauntlet} icon={<InfinityIcon className="size-4" />}>
              {summary.gauntlet.ended ? 'Gauntlet results' : 'Continue the Gauntlet'}
            </Button>
          ) : null}
          {summary.arena && !summary.campaign ? (
            <Button variant="primary" className="w-full" onClick={onOpenCampaign} icon={<MapIcon className="size-4" />}>
              Back to the map
            </Button>
          ) : null}
          {summary.campaign ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={onOpenCampaign} icon={<MapIcon className="size-4" />}>
                World map
              </Button>
              <Button onClick={onRematch} icon={<Swords className="size-4" />}>
                Rematch
              </Button>
            </div>
          ) : null}
          {history ? (
            <div className="grid grid-cols-2 gap-2" data-gameover-history>
              <Button variant="primary" onClick={history.onInterview} icon={<Mic className="size-4" />} data-gameover-interview>
                Interview
              </Button>
              <Button onClick={history.onQuiz} icon={<Brain className="size-4" />} data-gameover-quiz>
                History quiz
              </Button>
            </div>
          ) : null}
          <Button variant={summary.campaign || summary.gauntlet || summary.arena ? 'secondary' : 'primary'} className="w-full" onClick={onAnalyze} icon={<Microscope className="size-4" />}>
            Analyze game
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" onClick={onReview} icon={<Eye className="size-4" />}>
              Board
            </Button>
            <Button size="sm" onClick={onShare} icon={<Share2 className="size-4" />}>
              Share
            </Button>
            <Button size="sm" onClick={onNewGame} icon={<RotateCcw className="size-4" />}>
              New
            </Button>
          </div>
        </div>
      }
    >
      <div className="relative isolate flex flex-col items-center overflow-hidden rounded-2xl py-3 text-center">
        {/* Art-pack victory / defeat backdrop (if installed). */}
        {(won || lost || (!isAiMode && !isDraw)) && <ArtBackdrop slot={lost ? 'defeat' : 'victory'} opacity={0.4} />}
        {(won || lost || (!isAiMode && !isDraw)) && <CelebrationParticles mood={lost ? 'defeat' : 'victory'} />}
        {opponent ? (
          <div className="relative mb-4" data-gameover-portrait>
            <PortraitEmblem spec={opponent.spec} label={opponent.label} size="xl" defeated={won} className={lost ? '' : won ? 'grayscale-[0.4]' : ''} ring={won ? 'ring-amber-300' : lost ? 'ring-red-400' : 'ring-sky-300'} />
            <span className={`absolute -right-2 -bottom-2 flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-ink-950 shadow-lg`}>
              <Icon className="size-5" />
            </span>
          </div>
        ) : (
          <div className={`idle-pause mb-4 flex size-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br ${accent} text-ink-950 shadow-[0_20px_50px_-15px_var(--accent)]`}>
            <Icon className="size-10" />
          </div>
        )}
        <div className={`font-display text-3xl font-extrabold tracking-wide ${won ? 'holo-text animate-shimmer' : 'text-white'}`}>{headline}</div>
        <div className="mt-1 text-sm text-slate-300">{headline !== title ? `${title} ${detail}` : detail}</div>
        <div className="mt-1 text-xs text-slate-500">
          {moves} {moves === 1 ? 'move' : 'moves'} played{isAiMode && !summary.rated ? ' · casual' : ''}
        </div>

        {isAiMode && (
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-slate-400">
                {summary.eloDelta !== null && summary.eloDelta < 0 ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />} Rating
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-white">{summary.eloAfter ?? '—'}</div>
              {summary.eloDelta !== null && (
                <div className={`font-mono text-xs font-bold ${summary.eloDelta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {summary.eloDelta >= 0 ? '+' : ''}
                  {summary.eloDelta}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-slate-400">
                <Coins className="size-3.5" /> Coins
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-yellow-300">+{summary.coins}</div>
            </div>
          </div>
        )}

        {lesson && (
          <div className="mt-3 w-full rounded-xl border border-amber-300/30 bg-amber-300/[0.07] p-3 text-left" data-gameover-lesson>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
              <ScrollText className="size-3.5" /> History lesson · {lesson.name}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-200">{lesson.fact}</p>
          </div>
        )}

        {summary.legend && summary.legend.coins > 0 && (
          <div className="mt-3 w-full rounded-xl border border-accent/40 bg-accent/10 p-3 text-left">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              <Hourglass className="size-3.5" /> {summary.legend.firstDefeat ? 'Legend defeated' : 'Chronos bounty'}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                {summary.legend.firstDefeat ? `First victory over ${summary.legend.name}!` : `Another win over ${summary.legend.name}`}
              </span>
              <span className="font-mono text-sm font-bold text-yellow-300">+{summary.legend.coins}</span>
            </div>
            {summary.legend.rewards.length > 0 && <div className="mt-1 text-xs text-slate-300">Unlocked: {summary.legend.rewards.join(' · ')}</div>}
          </div>
        )}

        {summary.gauntlet && (
          <div className="mt-3 w-full space-y-1 rounded-xl border border-fuchsia-300/40 bg-fuchsia-400/10 p-3 text-left" data-gauntlet-summary>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">
              <InfinityIcon className="size-3.5" /> Endless Gauntlet
            </div>
            <div className="text-sm font-semibold text-white">
              {summary.gauntlet.ended
                ? `Run over — ${summary.gauntlet.defeated} ${summary.gauntlet.defeated === 1 ? 'boss' : 'bosses'} defeated`
                : summary.gauntlet.outcome === 'win'
                  ? `${summary.gauntlet.bossName} falls! +${Math.round(summary.gauntlet.restoredMs / 1000)} s restored`
                  : `A draw with ${summary.gauntlet.bossName} — the run goes on`}
            </div>
            <div className="flex flex-wrap gap-x-3 font-mono text-xs text-slate-300">
              <span>Score {summary.gauntlet.score.toLocaleString()}</span>
              {summary.gauntlet.scoreGained > 0 && <span className="text-emerald-300">+{summary.gauntlet.scoreGained.toLocaleString()}</span>}
              {summary.gauntlet.coins > 0 && <span className="text-yellow-300">+{summary.gauntlet.coins} coins</span>}
              {summary.gauntlet.newBest && <span className="text-amber-200">New best!</span>}
            </div>
          </div>
        )}

        {summary.campaign && (
          <div className="mt-3 w-full space-y-2 rounded-xl border border-accent/40 bg-accent/10 p-3 text-left">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                <MapIcon className="size-3.5" /> {summary.campaign.firstClear ? 'Boss defeated' : 'Grand Campaign'}
              </div>
              <StarRow stars={summary.campaign.stars} size="md" fresh={Math.max(0, summary.campaign.stars - summary.campaign.previousStars)} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">
                {summary.campaign.stars === 0
                  ? `${summary.campaign.bossName} holds the line`
                  : summary.campaign.firstClear
                    ? `${summary.campaign.bossName} falls — the road opens!`
                    : summary.campaign.stars > summary.campaign.previousStars
                      ? `New best against ${summary.campaign.bossName}!`
                      : `Another win over ${summary.campaign.bossName}`}
              </span>
              {summary.campaign.coins > 0 && <span className="font-mono text-sm font-bold text-yellow-300">+{summary.campaign.coins}</span>}
            </div>
            {summary.campaign.relic && (
              <div className="flex items-center gap-2.5 rounded-lg bg-amber-300/10 p-2">
                <RelicTile relic={summary.campaign.relic} size="md" />
                <div className="min-w-0 text-xs">
                  <div className="font-bold text-amber-200">Relic found: {summary.campaign.relic.name}</div>
                  <div className="text-slate-300">{summary.campaign.relic.description}</div>
                </div>
              </div>
            )}
            {summary.campaign.realmCleared && (
              <div className="text-xs font-semibold text-emerald-300">
                {getGrandRealm(summary.campaign.realmCleared).name} cleared!
                {summary.campaign.rewards.length > 0 ? ` Unlocked: ${summary.campaign.rewards.join(' · ')}` : ''}
              </div>
            )}
          </div>
        )}

        {summary.ironman && (
          <div
            className={`mt-3 w-full rounded-xl border p-3 text-left text-xs ${summary.ironman.wiped ? 'border-red-400/50 bg-red-500/15 text-red-100' : 'border-zinc-300/30 bg-zinc-300/10 text-zinc-100'}`}
            data-ironman-summary
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]">
              <Skull className="size-3.5" /> Ironman
            </div>
            <div className="mt-1 text-sm font-semibold">
              {summary.ironman.wiped
                ? `Permadeath — the run is lost (${summary.ironman.lostBosses} ${summary.ironman.lostBosses === 1 ? 'boss' : 'bosses'} fall back into darkness).`
                : `The run survives · coins ×${summary.ironman.factor.toFixed(summary.ironman.factor % 1 === 0 ? 0 : 1)}`}
            </div>
          </div>
        )}

        {summary.arena && (
          <div
            className={`mt-3 w-full space-y-1 rounded-xl border p-3 text-left ${summary.arena.success ? 'border-emerald-300/40 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}
            data-arena-summary
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">{summary.arena.title}</div>
            <div className="text-sm font-semibold text-white">{summary.arena.detail}</div>
            {(summary.arena.coins > 0 || summary.arena.potion) && (
              <div className="flex flex-wrap gap-x-3 text-xs">
                {summary.arena.coins > 0 && <span className="text-yellow-300">+{summary.arena.coins} coins</span>}
                {summary.arena.potion && <span className="text-amber-200">+1 {POTIONS[summary.arena.potion].name}</span>}
              </div>
            )}
          </div>
        )}

        {summary.unlocked.length > 0 && (
          <div className="mt-3 w-full space-y-1.5">
            {summary.unlocked.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-left">
                <Trophy className="size-4 shrink-0 text-amber-300" />
                <span className="flex-1 truncate text-sm font-semibold text-amber-100">{a.title}</span>
                <span className="font-mono text-xs text-yellow-300">+{a.reward}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
