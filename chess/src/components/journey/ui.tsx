// Small building blocks shared by the Journey screens.
import type { ReactNode } from 'react'
import { type ClassicCharacter, classicPortrait } from '../../data/classic/roster'
import { type FrameDef, frameBackground, frameDef } from '../../journey/cosmetics'
import { journeyStore } from '../../journey/journeyStore'
import { useStore } from '../../hooks/useStore'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import type { PORTRAIT_SIZES } from '../legends/portraitIcons'

export function Card({ title, icon, children, className = '', action, ...rest }: { title?: ReactNode; icon?: ReactNode; children: ReactNode; className?: string; action?: ReactNode } & Record<`data-${string}`, string | undefined>) {
  return (
    <section className={`glass rounded-3xl p-4 sm:p-5 ${className}`} {...rest}>
      {(title || action) && (
        <div className="mb-3 flex items-center gap-2">
          {icon && <span className="text-accent">{icon}</span>}
          {title && <h3 className="min-w-0 flex-1 font-display text-sm font-extrabold tracking-wider text-white uppercase">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Bar({ value, color = 'var(--accent)', className = '', label }: { value: number; color?: string; className?: string; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/10 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'gold' | 'green' | 'red' | 'sky' }) {
  const tones = {
    slate: 'bg-white/10 text-slate-200',
    gold: 'bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/40',
    green: 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/40',
    red: 'bg-red-400/15 text-red-200 ring-1 ring-red-300/40',
    sky: 'bg-sky-400/15 text-sky-200 ring-1 ring-sky-300/40',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${tones[tone]}`}>{children}</span>
}

export function ClassicFace({ c, size = 'sm', locked = false, defeated = false }: { c: ClassicCharacter; size?: keyof typeof PORTRAIT_SIZES; locked?: boolean; defeated?: boolean }) {
  return <PortraitEmblem spec={classicPortrait(c)} label={c.name} size={size} locked={locked} defeated={defeated} />
}

/** Wraps an avatar in a frame (yours by default). */
export function FrameRing({ frame, children, className = '' }: { frame?: FrameDef | null; children: ReactNode; className?: string }) {
  const mine = useStore(journeyStore, (j) => j.frame)
  const f = frame === undefined ? frameDef(mine) : frame
  if (!f) return <>{children}</>
  return (
    <span
      className={`relative inline-flex shrink-0 rounded-[1.05rem] p-[3px] ${f.shimmer ? 'animate-frame-spin' : ''} ${className}`}
      style={{ background: frameBackground(f), boxShadow: `0 0 14px ${f.glow}` }}
      data-frame={f.id}
    >
      {children}
    </span>
  )
}

export function FrameSwatch({ frame, size = 40 }: { frame: FrameDef; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-2xl p-[3px]" style={{ width: size, height: size, background: frameBackground(frame), boxShadow: `0 0 12px ${frame.glow}` }}>
      <span className="size-full rounded-[0.9rem] bg-ink-900" />
    </span>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
      <div className="text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">{label}</div>
      <div className="font-mono text-lg font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

export function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: ReadonlyArray<{ id: T; label: string; sub?: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">{label}</div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-xl border px-2 py-2 text-xs font-semibold transition pointer-coarse:min-h-10 ${value === o.id ? 'border-accent bg-accent/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}
          >
            {o.label}
            {o.sub && <span className="block text-[10px] font-normal text-slate-400">{o.sub}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
