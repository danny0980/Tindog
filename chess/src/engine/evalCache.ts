import type { PositionEval } from '../types/analysis'

const MAX_ENTRIES = 600
const cache = new Map<string, PositionEval>()

/** Halfmove/fullmove counters don't change the evaluation, so drop them from the key. */
const keyOf = (fen: string): string => fen.split(' ').slice(0, 4).join(' ')

export function getCachedEval(fen: string, minDepth: number): PositionEval | null {
  const hit = cache.get(keyOf(fen))
  return hit && hit.depth >= minDepth ? hit : null
}

export function getAnyCachedEval(fen: string): PositionEval | null {
  return cache.get(keyOf(fen)) ?? null
}

export function setCachedEval(fen: string, evaluation: PositionEval): void {
  const key = keyOf(fen)
  const existing = cache.get(key)
  if (existing && existing.depth > evaluation.depth) return
  cache.delete(key)
  cache.set(key, evaluation)
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}
