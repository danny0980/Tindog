import type { ReactNode } from 'react'

interface ToggleProps {
  label: string
  description?: string
  icon?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Toggle({ label, description, icon, checked, onChange }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-2.5">
      {icon && <span className="text-slate-400">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-100">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}
