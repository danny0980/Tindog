import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Hand } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'

const GESTURES = [
  { icon: ArrowLeft, label: 'Swipe left', action: 'Undo your last move' },
  { icon: ArrowRight, label: 'Swipe right', action: 'Flip the board' },
  { icon: ArrowUp, label: 'Swipe up', action: 'Moves, time machine & analysis' },
  { icon: ArrowDown, label: 'Swipe down', action: 'Open / close the game menu' },
] as const

/** First-run coach marks for the swipe gestures. */
export function GestureGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      title="Gestures"
      onClose={onClose}
      size="sm"
      footer={
        <Button variant="primary" className="w-full" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <p className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <Hand className="size-5 text-accent" /> Swipe on the player bars or the control dock — never on the board, so piece drags stay precise.
      </p>
      <ul className="space-y-2">
        {GESTURES.map(({ icon: Icon, label, action }) => (
          <li key={label} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">{label}</span>
              <span className="block text-xs text-slate-400">{action}</span>
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
