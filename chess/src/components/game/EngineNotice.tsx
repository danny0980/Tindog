import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'
import type { EngineStatus } from '../../types/engine'

/**
 * What the computer opponent's engine is doing, for modes that don't use the
 * main game banner: starting (or restarting after a crash), or failed with a
 * Retry button. Renders nothing once the engine is ready.
 */
export function EngineNotice({ status, error, onRetry, className = '' }: { status: EngineStatus; error: string | null; onRetry: () => void; className?: string }) {
  if (status === 'error') {
    return (
      <div className={`flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100 ${className}`} role="alert" data-engine-notice="error">
        <AlertTriangle className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">Stockfish isn’t running: {error ?? 'it failed to start.'}</span>
        <button type="button" onClick={onRetry} className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-white hover:bg-white/15" data-engine-retry>
          <RefreshCw className="size-3.5" /> Retry
        </button>
      </div>
    )
  }
  if (status === 'loading') {
    return (
      <div className={`flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-xs text-slate-300 ${className}`} role="status" data-engine-notice="loading">
        <LoaderCircle className="size-4 shrink-0 animate-spin" />
        <span>{error ?? 'Starting Stockfish…'}</span>
      </div>
    )
  }
  return null
}
