import { CLASSIFICATION_META } from '../../constants/classifications'
import type { MoveClassification } from '../../types/analysis'

interface ClassificationBadgeProps {
  classification: MoveClassification
  size?: 'xs' | 'sm' | 'md'
}

const SIZES = { xs: 'size-4 text-[8px]', sm: 'size-5 text-[10px]', md: 'size-7 text-xs' } as const
const ICON_SIZES = { xs: 'size-2.5', sm: 'size-3', md: 'size-4' } as const

export function ClassificationBadge({ classification, size = 'sm' }: ClassificationBadgeProps) {
  const meta = CLASSIFICATION_META[classification]
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black text-white shadow ${SIZES[size]}`}
      style={{ backgroundColor: meta.color }}
      title={meta.label}
      aria-label={meta.label}
    >
      {Icon ? <Icon className={ICON_SIZES[size]} strokeWidth={3} /> : meta.symbol}
    </span>
  )
}
