// Gauntlet leaderboards. The local board lives in the gauntlet store; a
// global board needs a server, so it is an optional HTTP adapter enabled by
// setting VITE_LEADERBOARD_URL at build time (see README). Every response is
// validated — a misbehaving server can't inject junk into the UI.
import type { LeaderboardEntry } from '../types/gauntlet'
import { withRetry } from '../utils/retry'
import { isRecord } from '../utils/validate'

export interface GlobalLeaderboard {
  readonly endpoint: string
  top(limit: number): Promise<LeaderboardEntry[]>
  submit(entry: LeaderboardEntry): Promise<void>
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const TIMEOUT_MS = 6_000

export function sanitizeEntry(v: unknown): LeaderboardEntry | null {
  if (!isRecord(v)) return null
  const { id, name, score, defeated, bestStreak, date, title } = v
  if (typeof id !== 'string' || typeof name !== 'string' || typeof score !== 'number' || !Number.isFinite(score)) return null
  return {
    id: id.slice(0, 64),
    name: name.slice(0, 24),
    score: Math.max(0, Math.round(score)),
    defeated: typeof defeated === 'number' && Number.isFinite(defeated) ? Math.max(0, Math.round(defeated)) : 0,
    bestStreak: typeof bestStreak === 'number' && Number.isFinite(bestStreak) ? Math.max(0, Math.round(bestStreak)) : 0,
    date: typeof date === 'string' ? date : new Date(0).toISOString(),
    ...(typeof title === 'string' && title.length > 0 ? { title: title.slice(0, 40) } : {}),
  }
}

async function request(fetchImpl: FetchLike, url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new Error(`Leaderboard HTTP ${res.status}`)
    return res
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Minimal REST client: `GET {endpoint}?limit=N` → `LeaderboardEntry[]`,
 * `POST {endpoint}` with a `LeaderboardEntry` JSON body.
 */
export function createGlobalLeaderboard(endpoint: string, fetchImpl: FetchLike = (i, init) => fetch(i, init), delays: readonly number[] = [800]): GlobalLeaderboard {
  return {
    endpoint,
    async top(limit) {
      const res = await withRetry(() => request(fetchImpl, `${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}`), delays)
      const body: unknown = await res.json()
      const rows = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.entries) ? body.entries : []
      return rows
        .map(sanitizeEntry)
        .filter((e): e is LeaderboardEntry => e !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    },
    async submit(entry) {
      await withRetry(
        () => request(fetchImpl, endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }),
        delays,
      )
    },
  }
}

const configured = typeof import.meta.env.VITE_LEADERBOARD_URL === 'string' ? import.meta.env.VITE_LEADERBOARD_URL.trim() : ''

/** The global board, or null when no server is configured. */
export const globalLeaderboard: GlobalLeaderboard | null = configured ? createGlobalLeaderboard(configured) : null
