import { AlertTriangle, BookOpen, Crown, Eye, Flag, Handshake, LoaderCircle, RefreshCw, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EngineStatus } from '../../types/engine'
import type { GameStatus } from '../../types/chess'
import type { DetectedOpening } from '../../types/opening'
import { colorName, describeResult } from '../../utils/chess'

interface GameStatusBannerProps {
  status: GameStatus
  aiThinking: boolean
  engineStatus: EngineStatus
  engineError: string | null
  isAiMode: boolean
  isLive: boolean
  isReview: boolean
  opening: DetectedOpening | null
  opponentName?: string
  /** Starts the engine again after it gave up. */
  onRetryEngine?: () => void
}

const TONES = {
  neutral: 'text-slate-200 [&_.banner-icon]:bg-white/10',
  success: 'border-accent/30 bg-accent/10 text-white [&_.banner-icon]:bg-accent/25 [&_.banner-icon]:text-accent',
  danger: 'border-red-400/30 bg-red-500/10 text-red-100 [&_.banner-icon]:bg-red-500/25',
} as const

function Banner({ tone, icon, title, detail, opening, action }: { tone: keyof typeof TONES; icon: ReactNode; title: string; detail: ReactNode; opening: DetectedOpening | null; action?: ReactNode }) {
  return (
    <div className={`glass rounded-xl px-4 py-3 transition-colors ${TONES[tone]}`} role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="banner-icon flex size-9 shrink-0 items-center justify-center rounded-lg">{icon}</div>
        <div className="min-w-0">
          <div className="truncate text-base font-bold leading-tight">{title}</div>
          <div className="truncate text-sm opacity-75">{detail}</div>
        </div>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      {opening && (
        <div className="mt-2.5 flex items-center gap-2 border-t border-white/5 pt-2.5 text-xs">
          <BookOpen className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold text-accent">{opening.eco}</span>
          <span className="truncate text-slate-300">{opening.name}</span>
        </div>
      )}
    </div>
  )
}

export function GameStatusBanner({ status, aiThinking, engineStatus, engineError, isAiMode, isLive, isReview, opening, opponentName = 'Stockfish', onRetryEngine }: GameStatusBannerProps) {
  if (isAiMode && engineStatus === 'error') {
    return (
      <Banner
        tone="danger"
        icon={<AlertTriangle className="size-5" />}
        title="Engine unavailable"
        opening={opening}
        detail={`${engineError ?? 'Stockfish failed to load.'} Retry, or play a local game.`}
        action={
          onRetryEngine && (
            <button type="button" onClick={onRetryEngine} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/15" data-engine-retry>
              <RefreshCw className="size-3.5" /> Retry
            </button>
          )
        }
      />
    )
  }
  if (!isLive) {
    return <Banner tone="neutral" icon={<Eye className="size-5" />} title="Time machine" detail="Reviewing an earlier position" opening={opening} />
  }
  if (status.kind === 'over') {
    const { title, detail } = describeResult(status.result)
    const r = status.result
    const icon =
      r.kind === 'draw' ? <Handshake className="size-5" /> : r.kind === 'resign' ? <Flag className="size-5" /> : r.kind === 'timeout' ? <Timer className="size-5" /> : <Crown className="size-5" />
    return <Banner tone={r.kind === 'draw' ? 'neutral' : 'success'} icon={icon} title={isReview ? `Review · ${title}` : title} detail={detail} opening={opening} />
  }
  if (isAiMode && engineStatus === 'loading') {
    return <Banner tone="neutral" icon={<LoaderCircle className="size-5 animate-spin" />} title={`Summoning ${opponentName}…`} detail={engineError ?? 'Preparing the engine'} opening={opening} />
  }
  if (status.inCheck) {
    return <Banner tone="danger" icon={<AlertTriangle className="size-5" />} title="Check!" detail={`${colorName(status.turn)} must get out of check`} opening={opening} />
  }
  return (
    <Banner
      tone="neutral"
      opening={opening}
      icon={
        aiThinking ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : (
          <span className={`block size-4 rounded-full ring-2 ${status.turn === 'w' ? 'bg-slate-100 ring-white/40' : 'bg-slate-900 ring-white/30'}`} />
        )
      }
      title={`${colorName(status.turn)} to move`}
      detail={aiThinking ? `${opponentName} is thinking…` : 'Make your move'}
    />
  )
}
