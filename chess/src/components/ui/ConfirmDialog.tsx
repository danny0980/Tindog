import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** 'danger' (default) for destructive actions, 'primary' for a deliberate but safe choice. */
  confirmVariant?: 'danger' | 'primary'
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, confirmVariant = 'danger' }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-300">{message}</p>
    </Modal>
  )
}
