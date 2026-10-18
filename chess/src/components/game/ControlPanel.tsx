import { Flag, Plus, RefreshCcw, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface ControlPanelProps {
  canUndo: boolean
  canResign: boolean
  onNewGame: () => void
  onFlip: () => void
  onUndo: () => void
  onResign: () => void
}

export function ControlPanel({ canUndo, canResign, onNewGame, onFlip, onUndo, onResign }: ControlPanelProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <ControlButton label="New" icon={<Plus className="size-5" />} onClick={onNewGame} variant="primary" />
      <ControlButton label="Flip" icon={<RefreshCcw className="size-5" />} onClick={onFlip} />
      <ControlButton label="Undo" icon={<Undo2 className="size-5" />} onClick={onUndo} disabled={!canUndo} />
      <ControlButton label="Resign" icon={<Flag className="size-5" />} onClick={onResign} disabled={!canResign} variant="danger" />
    </div>
  )
}

const VARIANTS = {
  default: 'glass text-slate-200 hover:bg-white/10 hover:text-white',
  primary: 'bg-gradient-to-br from-accent to-accent-2 text-ink-950 shadow-[0_10px_30px_-10px_var(--accent)] hover:brightness-110',
  danger: 'glass text-red-200 hover:bg-red-500/15 hover:text-red-100',
} as const

function ControlButton({
  label,
  icon,
  onClick,
  disabled = false,
  variant = 'default',
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: keyof typeof VARIANTS
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-35 ${VARIANTS[variant]}`}
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
