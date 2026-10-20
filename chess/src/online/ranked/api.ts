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
  /** A development server (e.g. the tournament can be started by hand). */
  dev?: boolean
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

export interface PlayerRow {
  name: string
  rating: number
}

export interface SeasonInfo {
  season: string
  endsAt: number
  tiers: Array<{ id: string; name: string; min: number }>
  table: Array<{ name: string; rating: number; tier: string; games: number; wins: number }>
  me: { rating: number; tier: string; games: number; wins: number; peak: number; rank: number | null } | null
  history: Array<{ season: string; rating: number; tier: string; rank: number; games: number }>
}

export interface TournamentInfo {
  id: string
  name: string
  startsAt: number
  pool: string
  status: 'signup' | 'running' | 'done'
  entrants: PlayerRow[]
  joined: boolean
  rounds: Array<Array<{ a: PlayerRow | null; b: PlayerRow | null; winner: 'a' | 'b' | null; gameId: string | null }>>
  champion: PlayerRow | null
  previous: { champion: PlayerRow | null; players: number; finishedAt: number } | null
}

export interface ClanRow {
  id: string
  name: string
  tag: string
  members: number
  points: number
}

export interface ClansInfo {
  week: string
  table: ClanRow[]
  last: { week: string; winner: { name: string; tag: string; points: number } | null } | null
  mine: string | null
}

export interface ClanInfo {
  id: string
  name: string
  tag: string
  owner: string
  points: number
  members: PlayerRow[]
}

export interface LiveGameRow {
  gameId: string
  white: PlayerRow
  black: PlayerRow
  pool: string
  moves: number
  label: string | null
  watchers: number
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
  season: () => call<SeasonInfo>('/season'),
  tournament: () => call<TournamentInfo>('/tournament'),
  joinTournament: () => call<{ ok: boolean }>('/tournament/join', { method: 'POST', body: {} }),
  leaveTournament: () => call<{ ok: boolean }>('/tournament/leave', { method: 'POST', body: {} }),
  /** Development servers only: start the tournament now. */
  startTournament: () => call<{ ok: boolean }>('/tournament/start', { method: 'POST', body: {} }),
  clans: () => call<ClansInfo>('/clans'),
  clan: (id: string) => call<ClanInfo>(`/clans/${encodeURIComponent(id)}`),
  createClan: (name: string, tag: string) => call<{ id: string }>('/clans', { method: 'POST', body: { name, tag } }),
  joinClan: (id: string) => call<{ ok: boolean }>(`/clans/${encodeURIComponent(id)}/join`, { method: 'POST', body: {} }),
  leaveClan: () => call<{ ok: boolean }>('/clans/leave', { method: 'POST', body: {} }),
  live: () => call<{ games: LiveGameRow[] }>('/live'),
}
