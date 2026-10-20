// The game server's JSON API, as seen from the app. Same origin (Vite
// proxies /api in development; the server serves the app in production), so
// the session cookie travels on its own.

export interface AccountUser {
  id: string
  name: string
  email: string | null
  google: boolean
  rating: number
  games: number
  wins: number
  losses: number
  draws: number
}

export interface ServerConfig {
  /** Google client id, or null if Google sign-in is off. */
  google: string | null
  email: boolean
  /** Development server without SMTP: sign-in links are printed in its console. */
  devLinks: boolean
}

export interface RatedGame {
  id: string
  pool: string
  color: 'w' | 'b'
  opponent: string
  result: 'win' | 'loss' | 'draw'
  reason: string
  ratingChange: number
  moves: number
  endedAt: number
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      credentials: 'same-origin',
      headers: init?.body !== undefined ? { 'content-type': 'application/json' } : {},
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    })
  } catch {
    throw new ApiError(0, "Can't reach the game server.")
  }
  const type = res.headers.get('content-type') ?? ''
  // No server behind /api (e.g. a static host): the app's own HTML comes back instead of JSON.
  if (!type.includes('application/json')) throw new ApiError(0, 'The game server is not running.')
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new ApiError(res.status, typeof data.error === 'string' ? data.error : 'Something went wrong.')
  return data
}

const isUser = (u: unknown): u is AccountUser => typeof u === 'object' && u !== null && typeof (u as AccountUser).id === 'string' && typeof (u as AccountUser).rating === 'number'

export const api = {
  config: () => call<ServerConfig>('/config'),
  me: async (): Promise<AccountUser | null> => {
    const r = await call<{ user: unknown }>('/me')
    return isUser(r.user) ? r.user : null
  },
  rename: (name: string) => call<{ user: AccountUser }>('/me', { method: 'PATCH', body: { name } }),
  requestEmailLink: (email: string) => call<{ sent: boolean }>('/auth/email', { method: 'POST', body: { email } }),
  verifyEmailLink: (token: string) => call<{ user: AccountUser }>('/auth/email/verify', { method: 'POST', body: { token } }),
  google: (credential: string) => call<{ user: AccountUser }>('/auth/google', { method: 'POST', body: { credential } }),
  logout: () => call<{ ok: boolean }>('/auth/logout', { method: 'POST', body: {} }),
  getSave: async (): Promise<{ data: unknown; updatedAt: number } | null> => {
    const r = await call<{ data: unknown; updatedAt: number | null }>('/save')
    return r.data === null || r.updatedAt === null ? null : { data: r.data, updatedAt: r.updatedAt }
  },
  putSave: (data: unknown) => call<{ updatedAt: number }>('/save', { method: 'PUT', body: { data } }),
  games: () => call<{ games: RatedGame[] }>('/games'),
  leaderboard: () => call<{ players: Array<{ name: string; rating: number; games: number }> }>('/leaderboard'),
}
