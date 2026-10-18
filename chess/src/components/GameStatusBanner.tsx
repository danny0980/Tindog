import { AlertTriangle, Crown, Flag, Handshake, LoaderCircle, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EngineStatus } from '../hooks/useStockfish'
import type { GameStatus } from '../types/chess'
import { colorName, describeResult } from '../utils/chess'

interface GameStatusBannerProps {
  status: GameStatus
  aiThinking: boolean
  engineStatus: EngineStatus
  engineError: string | null
  isAiMode: boolean
}

export function GameStatusBanner({ status, aiThinking, engineStatus, engineError, isAiMode }: GameStatusBannerProps) {
  if (isAiMode && engineStatus === 'error') {
    return (
      <Banner tone="danger" icon={<AlertTriangle className="size-5" />} title="Engine unavailable">
        {engineError ?? 'Stockfish failed to load.'} Try reloading, or play a local game.
      </Banner>
    )
  }

  if (status.kind === 'over') {
    const { title, detail } = describeResult(status.result)
    const icon =
      status.result.kind === 'draw' ? (
        <Handshake className="size-5" />
      ) : status.result.kind === 'resign' ? (
        <Flag className="size-5" />
      ) : status.result.kind === 'timeout' ? (
        <Timer className="size-5" />
      ) : (
        <Crown className="size-5" />
      )
    return (
      <Banner tone={status.result.kind === 'draw' ? 'neutral' : 'success'} icon={icon} title={title}>
        {detail}
      </Banner>
    )
  }

  if (isAiMode && engineStatus === 'loading') {
    return (
      <Banner tone="neutral" icon={<LoaderCircle className="size-5 animate-spin" />} title="Loading Stockfish…">
        Preparing the engine
      </Banner>
    )
  }

  if (status.inCheck) {
    return (
      <Banner tone="danger" icon={<AlertTriangle className="size-5" />} title="Check!">
        {colorName(status.turn)} must get out of check
      </Banner>
    )
  }

  return (
    <Banner
      tone="neutral"
      icon={
        aiThinking ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : (
          <span
            className={`block size-4 rounded-full ring-2 ${status.turn === 'w' ? 'bg-slate-100 ring-white/40' : 'bg-slate-900 ring-white/30'}`}
          />
        )
      }
      title={`${colorName(status.turn)} to move`}
    >
      {aiThinking ? 'Stockfish is thinking…' : 'Make your move'}
    </Banner>
  )
}

const TONES = {
  neutral: 'text-slate-200 [&_.banner-icon]:bg-white/10',
  success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100 [&_.banner-icon]:bg-emerald-400/20',
  danger: 'border-red-400/30 bg-red-500/10 text-red-100 [&_.banner-icon]:bg-red-500/25',
} as const

interface BannerProps {
  tone: keyof typeof TONES
  icon: ReactNode
  title: string
  children: ReactNode
}

function Banner({ tone, icon, title, children }: BannerProps) {
  return (
    <div className={`glass flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${TONES[tone]}`} role="status" aria-live="polite">
      <div className="banner-icon flex size-9 shrink-0 items-center justify-center rounded-lg">{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-base font-bold leading-tight">{title}</div>
        <div className="truncate text-sm opacity-75">{children}</div>
      </div>
    </div>
  )
}
