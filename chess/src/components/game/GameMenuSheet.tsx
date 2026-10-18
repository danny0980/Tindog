import { Download, Flag, Hand, Plus, RefreshCcw, Settings, Share2, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from '../ui/Modal'
import { Toggle } from '../ui/Toggle'

interface GameMenuSheetProps {
  open: boolean
  onClose: () => void
  canResign: boolean
  canExport: boolean
  oneHanded: boolean
  onNewGame: () => void
  onFlip: () => void
  onResign: () => void
  onExport: () => void
  onShare: () => void
  onOpenSettings: () => void
  onToggleOneHanded: (value: boolean) => void
  onShowGestures: () => void
}

/** Thumb-friendly quick menu (also opened with a downward swipe). */
export function GameMenuSheet(props: GameMenuSheetProps) {
  const run = (action: () => void) => () => {
    props.onClose()
    action()
  }
  return (
    <Modal open={props.open} title="Game menu" onClose={props.onClose} size="sm">
      <div className="grid grid-cols-3 gap-2">
        <Tile label="New game" icon={<Plus className="size-6" />} onClick={run(props.onNewGame)} />
        <Tile label="Flip board" icon={<RefreshCcw className="size-6" />} onClick={run(props.onFlip)} />
        <Tile label="Resign" icon={<Flag className="size-6" />} onClick={run(props.onResign)} disabled={!props.canResign} danger />
        <Tile label="Export PGN" icon={<Download className="size-6" />} onClick={run(props.onExport)} disabled={!props.canExport} />
        <Tile label="Share" icon={<Share2 className="size-6" />} onClick={run(props.onShare)} disabled={!props.canExport} />
        <Tile label="Settings" icon={<Settings className="size-6" />} onClick={run(props.onOpenSettings)} />
      </div>
      <div className="mt-4 border-t border-white/5 pt-2">
        <Toggle label="One-handed mode" description="Controls in the thumb zone, board above" icon={<Hand className="size-5" />} checked={props.oneHanded} onChange={props.onToggleOneHanded} />
        <button type="button" onClick={run(props.onShowGestures)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left text-sm font-medium text-slate-200">
          <Sparkles className="size-5 text-slate-400" /> Show gesture guide
        </button>
      </div>
    </Modal>
  )
}

function Tile({ label, icon, onClick, disabled = false, danger = false }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/[0.05] text-xs font-semibold ring-1 ring-white/10 transition active:scale-95 disabled:opacity-30 ${
        danger ? 'text-red-300' : 'text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
