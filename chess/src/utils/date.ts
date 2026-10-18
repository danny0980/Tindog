/** Local calendar date as YYYY-MM-DD (puzzles refresh at local midnight). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function previousDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  date.setDate(date.getDate() - 1)
  return localDateKey(date)
}

/** Whole days since the Unix epoch for a local date key — stable daily index. */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.floor(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000)
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function msUntilTomorrow(now: Date = new Date()): number {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return tomorrow.getTime() - now.getTime()
}
