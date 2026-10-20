/** A compact labelled radio row (side, clock, level …). */
export function Segmented({ label, options, value, onChange }: { label: string; options: ReadonlyArray<{ id: string; label: string }>; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="grid gap-1 rounded-xl bg-white/[0.05] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${value === o.id ? 'bg-accent text-ink-950' : 'text-slate-300 hover:bg-white/5'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
