import type { ButtonHTMLAttributes, ReactNode } from 'react'

const VARIANTS = {
  primary:
    'bg-gradient-to-br from-accent to-accent-2 text-ink-950 font-bold shadow-[0_12px_32px_-12px_var(--accent)] hover:brightness-110',
  secondary: 'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
  ghost: 'text-slate-300 hover:bg-white/10 hover:text-white',
  danger: 'bg-red-500 text-white shadow-[0_10px_30px_-10px_rgba(239,68,68,0.8)] hover:bg-red-400',
} as const

const SIZES = {
  sm: 'gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
  md: 'gap-2 rounded-xl px-4 py-2.5 text-sm',
  lg: 'gap-2 rounded-xl px-5 py-3.5 text-base',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, className = '', children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-semibold transition duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
