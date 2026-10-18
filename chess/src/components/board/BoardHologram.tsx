interface BoardHologramProps {
  text: string
  tone: 'danger' | 'accent' | 'gold'
}

const TONES = {
  danger: 'text-red-300 [text-shadow:0_0_12px_rgba(239,68,68,0.95),0_0_32px_rgba(239,68,68,0.7)]',
  accent: 'holo-text [filter:drop-shadow(0_0_12px_var(--accent))]',
  gold: 'text-amber-200 [text-shadow:0_0_12px_rgba(251,191,36,0.95),0_0_36px_rgba(251,191,36,0.6)]',
} as const

/** Floating holographic callout (CHECK!, CHECKMATE…) projected over the board. Re-mount to replay. */
export function BoardHologram({ text, tone }: BoardHologramProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl" aria-hidden="true">
      <div
        className={`absolute top-1/2 left-1/2 animate-hologram font-display text-[clamp(1.1rem,6.5vw,2.75rem)] font-extrabold uppercase whitespace-nowrap ${TONES[tone]}`}
      >
        {text}
      </div>
      <div className="absolute inset-0 animate-hologram bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.05)_0_1px,transparent_1px_4px)] [transform:none!important]" />
    </div>
  )
}
