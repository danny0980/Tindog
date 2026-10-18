import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { Color, PromotionPiece } from '../../types/chess'
import type { PieceSet } from '../../types/theme'
import { PieceIcon } from '../ui/PieceIcon'

const CHOICES: ReadonlyArray<{ piece: PromotionPiece; label: string }> = [
  { piece: 'q', label: 'Queen' },
  { piece: 'r', label: 'Rook' },
  { piece: 'b', label: 'Bishop' },
  { piece: 'n', label: 'Knight' },
]

interface PromotionDialogProps {
  color: Color
  pieceSet: PieceSet
  onSelect: (piece: PromotionPiece) => void
  onCancel: () => void
}

export function PromotionDialog({ color, pieceSet, onSelect, onCancel }: PromotionDialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
      const match = CHOICES.find((c) => c.piece === event.key.toLowerCase())
      if (match) onSelect(match.piece)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, onSelect])

  return (
    <div
      className="absolute inset-0 z-30 flex animate-fade-in items-center justify-center rounded-xl bg-black/55 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose promotion piece"
        className="glass-strong w-full max-w-xs animate-pop-in rounded-2xl p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-slate-200">Promote pawn to</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Cancel promotion"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {CHOICES.map(({ piece, label }) => (
            <button
              key={piece}
              type="button"
              onClick={() => onSelect(piece)}
              className="group flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-white/5 p-1.5 transition hover:-translate-y-0.5 hover:border-accent/60 hover:bg-accent/10 active:scale-95"
              aria-label={label}
              title={label}
            >
              <PieceIcon color={color} type={piece} set={pieceSet} className="size-full transition group-hover:scale-110" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
