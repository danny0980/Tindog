// Records for the new modes: Card Chess and Battle Royale results, the
// Vanishing Chess rating, and Escape Room best times. Pure, with sanitising.

export interface ModeStats {
  cards: { games: number; wins: number }
  royale: { games: number; wins: number; /** Best finishing place (1 = won), or null. */ best: number | null }
  /** Vanishing Chess has its own rating. */
  vanish: { rating: number; games: number; wins: number; peak: number }
  /** Escape rooms solved: best time (ms) and stars (fewest mistakes). */
  escape: Record<string, { bestMs: number; stars: number }>
}

export const DEFAULT_MODES: ModeStats = {
  cards: { games: 0, wins: 0 },
  royale: { games: 0, wins: 0, best: null },
  vanish: { rating: 1200, games: 0, wins: 0, peak: 1200 },
  escape: {},
}

/** Standard Elo, K = 32. */
export function eloAfter(rating: number, opponent: number, score: 0 | 0.5 | 1): number {
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400))
  return Math.max(100, Math.round(rating + 32 * (score - expected)))
}

const n = (v: unknown, min = 0, max = 1e9): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min)
const rec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})

export function sanitizeModes(raw: unknown): ModeStats {
  const r = rec(raw)
  const cards = rec(r.cards)
  const royale = rec(r.royale)
  const vanish = rec(r.vanish)
  const escape: ModeStats['escape'] = {}
  for (const [id, v] of Object.entries(rec(r.escape)).slice(0, 50)) {
    const e = rec(v)
    if (/^[a-z0-9-]{1,40}$/.test(id) && typeof e.bestMs === 'number' && e.bestMs > 0) escape[id] = { bestMs: n(e.bestMs, 1), stars: n(e.stars, 0, 3) }
  }
  const best = typeof royale.best === 'number' ? n(royale.best, 1, 4) : null
  const rating = typeof vanish.rating === 'number' ? n(vanish.rating, 100, 4000) : 1200
  return {
    cards: { games: n(cards.games), wins: n(cards.wins) },
    royale: { games: n(royale.games), wins: n(royale.wins), best },
    vanish: { rating, games: n(vanish.games), wins: n(vanish.wins), peak: Math.max(rating, n(vanish.peak, 100, 4000)) },
    escape,
  }
}
