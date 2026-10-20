import { CARDS, type CardId } from '../../cards/cardGame'

const KIND_LABEL = { move: 'Your move', drop: 'Your move', ward: 'Free action' } as const

/** One Card Chess card (offline and online). */
export function CardFace({ id, selected, used, onClick, small = false }: { id: CardId; selected?: boolean; used?: boolean; onClick?: () => void; small?: boolean }) {
  const c = CARDS[id]
  return (
    <button
      type="button"
      disabled={!onClick || used}
      onClick={onClick}
      data-card={id}
      data-card-used={used ? 'true' : undefined}
      aria-pressed={selected}
      className={`relative flex flex-col gap-1 rounded-2xl border p-3 text-left transition ${small ? 'min-h-24' : 'min-h-36'} ${used ? 'border-white/5 bg-white/[0.02] opacity-40' : selected ? 'border-amber-300 bg-gradient-to-br from-amber-300/25 to-fuchsia-500/20 shadow-[0_0_24px_-6px_rgba(251,191,36,0.8)]' : 'border-white/10 bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/10 enabled:hover:-translate-y-0.5 enabled:hover:border-white/30'}`}
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-fuchsia-200">{KIND_LABEL[c.kind]}</span>
      <span className={`font-display font-extrabold leading-tight text-white [overflow-wrap:anywhere] ${small ? 'text-[11px] sm:text-xs' : 'text-sm'}`}>{c.name}</span>
      {!small && <span className="text-[11px] leading-snug text-slate-300">{c.text}</span>}
      {used && <span className="absolute top-2 right-2 text-[10px] text-slate-400">used</span>}
    </button>
  )
}

