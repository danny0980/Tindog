import type { ReactNode } from 'react'

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}
