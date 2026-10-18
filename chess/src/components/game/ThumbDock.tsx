import { ChevronsUp, LoaderCircle, Menu, Plus, ScrollText, Undo2 } from 'lucide-react'
import type { MouseEvent, PointerEvent, ReactNode } from 'react'
import type { StatusTone } from '../../utils/status'

interface SwipeProps {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onClickCapture: (e: MouseEvent<HTMLElement>) => void
  style?: { touchAction: 'none' }
}

interface ThumbDockProps {
  status: { title: string; detail: string; tone: StatusTone }
  thinking: boolean
  clock: ReactNode
  player: ReactNode
  canUndo: boolean
  gestures: boolean
  swipe: SwipeProps
  onUndo: () => void
  onNewGame: () => void
  onMoves: () => void
  onMenu: () => void
}

const TONES: Record<StatusTone, string> = {
  neutral: 'text-white',
  success: 'text-accent',
  danger: 'text-red-300',
}

/**
 * One-handed control surface anchored in the thumb zone. Every primary action
 * is reachable without moving the grip, and the whole dock is a swipe surface.
 */
export function ThumbDock({ status, thinking, clock, player, canUndo, gestures, swipe, onUndo, onNewGame, onMoves, onMenu }: ThumbDockProps) {
  return (
    <div
      {...swipe}
      className="glass-strong safe-px z-30 shrink-0 rounded-t-3xl border-b-0 pt-2 pb-3 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.8)] select-none"
      aria-label="Game controls"
    >
      <button type="button" onClick={onMoves} className="mx-auto mb-1 flex flex-col items-center text-slate-500" aria-label="Show moves and analysis">
        <span className="h-1 w-10 rounded-full bg-white/20" />
        {gestures && <ChevronsUp className="idle-pause mt-0.5 size-3.5 animate-float" aria-hidden="true" />}
      </button>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <div className={`flex items-center gap-1.5 truncate text-base font-bold ${TONES[status.tone]}`}>
            {thinking && <LoaderCircle className="size-4 shrink-0 animate-spin text-accent" />}
            {status.title}
          </div>
          <div className="truncate text-xs text-slate-400">{status.detail}</div>
        </div>
        {clock}
      </div>

      {/* On short phones the player row is dropped so the board keeps its size. */}
      <div className="mt-2 [@media(max-height:720px)]:hidden">{player}</div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <DockButton label="Undo" onClick={onUndo} disabled={!canUndo} icon={<Undo2 className="size-6" />} />
        <DockButton label="New" onClick={onNewGame} primary icon={<Plus className="size-6" />} />
        <DockButton label="Moves" onClick={onMoves} icon={<ScrollText className="size-6" />} />
        <DockButton label="Menu" onClick={onMenu} icon={<Menu className="size-6" />} />
      </div>
    </div>
  )
}

function DockButton({ label, icon, onClick, disabled = false, primary = false }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl [@media(max-height:720px)]:min-h-13 text-xs font-bold transition active:scale-95 disabled:opacity-30 ${
        primary
          ? 'bg-gradient-to-br from-accent to-accent-2 text-ink-950 shadow-[0_10px_30px_-10px_var(--accent)]'
          : 'bg-white/[0.06] text-slate-200 ring-1 ring-white/10 hover:bg-white/10'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
