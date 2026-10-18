/** Type-safe helpers for sanitising untrusted JSON (e.g. from localStorage). */
export type UnknownRecord = Record<string, unknown>

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {})

export const num = (value: unknown, fallback: number, min = -Infinity, max = Infinity): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

export const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

export const str = (value: unknown, fallback: string): string => (typeof value === 'string' ? value : fallback)

export function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

export function arrayOf<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : []
}

export function stringRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(asRecord(value))) if (typeof v === 'string') out[k] = v
  return out
}
