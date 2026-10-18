import { Star } from 'lucide-react'
import type { StarCount } from '../../types/campaign'

const SIZES = { xs: 'size-2.5', sm: 'size-3.5', md: 'size-5', lg: 'size-8' } as const

/** One to three star rating; `fresh` stars (just earned) pop in. */
export function StarRow({ stars, size = 'sm', fresh = 0, className = '' }: { stars: StarCount; size?: keyof typeof SIZES; fresh?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${stars} of 3 stars`}>
      {[1, 2, 3].map((n) => {
        const lit = n <= stars
        const isNew = lit && n > stars - fresh
        return (
          <Star
            key={n}
            className={`${SIZES[size]} ${lit ? 'fill-amber-300 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.6)]' : 'fill-white/5 text-white/25'} ${isNew ? 'animate-pop-in' : ''}`}
            style={isNew ? { animationDelay: `${300 + (n - 1) * 250}ms` } : undefined}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        )
      })}
    </span>
  )
}
