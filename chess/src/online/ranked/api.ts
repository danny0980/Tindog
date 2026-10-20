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
  /** Opens their public profile (absent from older servers). */
  id?: string
  name: string
  rating: number
}

export interface SeasonInfo {
  season: string
  endsAt: number
  tiers: Array<{ id: string; name: string; min: number }>
  table: Array<{ id?: string; name: string; rating: number; tier: string; games: number; wins: number }>
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
  /** The live leaderboard: champion, then whoever got furthest. */
  standings?: Array<{ player: PlayerRow; seed: number; round: string | null; status: 'champion' | 'in' | 'out' | 'entered' }>
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

export type RatedModeId = 'vanish' | 'cards' | 'royale'

export interface ModeRatingRow {
  rating: number
  games: number
  wins: number
  losses: number
  draws: number
}

export interface ModesInfo {
  /** Your rating per mode (null when signed out). */
  mine: Record<RatedModeId, ModeRatingRow> | null
  tables: Record<RatedModeId, Array<{ id?: string; name: string; rating: number; games: number; wins: number }>>
}

/** The Community tab: the whole player base at a glance. */
export interface CommunityInfo {
  stats: { players: number; ratedPlayers: number; games: number; gamesToday: number; activeThisWeek: number; clans: number; weekByMode: { chess: number; vanish: number; cards: number; royale: number } }
  live: { online: number; games: number; queued: number; modes: { cards: number; royale: number } }
  season: { id: string | null; endsAt: number | null }
  top: Record<'chess' | RatedModeId, Array<{ id: string; name: string; rating: number; games: number }>>
  champions: Array<{ id: string; name: string; finishedAt: number | null; players: number; champion: PlayerRow | null }>
  titles: Array<{ player: PlayerRow; titles: number }>
  clans: Array<{ id: string; name: string; tag: string; members: number; points: number }>
}

/** A player's public profile. */
export interface PlayerProfile {
  id: string
  name: string
  memberSince: number
  rating: number
  tier: string
  record: { games: number; wins: number; losses: number; draws: number }
  modes: Record<RatedModeId, ModeRatingRow>
  season: { row: { games: number; wins: number; peak: number } | null; rank: number | null; history: Array<{ season: string; rating: number; tier: string; rank: number; games: number }> }
  clan: { id: string; name: string; tag: string } | null
  titles: Array<{ id: string; finishedAt: number | null; players: number }>
  recent: Array<{ kind: 'chess' | 'vanish' | 'cards' | 'royale'; pool: string; opponent: string; result: 'win' | 'loss' | 'draw' | 'aborted'; endedAt: number }>
  online: boolean
}

export class ApiError extends Error {
  readonly status: number
  /** The server's JSON answer (e.g. a 409 carries the newer cloud save). */
  readonly body: unknown
  constructor(status: number, message: string, body: unknown = null) {
    super(message)
    this.status = status
    this.body = body
  }
}

/** Called when the server says the sign-in is no longer valid (a 401 on a signed-in route). */
export const unauthorizedListeners = new Set<() => void>()

/** One finished online game, in the history list. */
export interface HistoryRow {
  id: string
  kind: 'chess' | 'vanish' | 'cards' | 'royale'
  pool: string
  opponents: string[]
  result: 'win' | 'loss' | 'draw' | 'aborted'
  reason: string
  ratingChange: number
  moves: number
  /** Battle Royale: your finishing place. */
  place: number | null
  endedAt: number
}

/** A finished game in full, for its replay. */
export type HistoryGame =
  | { id: string; kind: 'chess' | 'vanish' | 'cards'; pool: string; color: 'w' | 'b'; white: string | null; black: string | null; winner: 'w' | 'b' | null; reason: string; moves: string[]; hands: { w: string[]; b: string[] } | null; ratingChange: number; endedAt: number }
  | { id: string; kind: 'royale'; seat: number; seats: string[]; ranking: number[]; reason: string; actions: unknown[] | null; ratingChange: number; endedAt: number }

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
  if (!res.ok) {
    if (res.status === 401) for (const fn of unauthorizedListeners) fn()
    throw new ApiError(res.status, typeof data.error === 'string' ? data.error : 'Something went wrong.', data)
  }
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
  /** `base` = the cloud save this device started from (null: none); a newer one on the server answers 409. Left out: overwrite. */
  putSave: (data: unknown, base?: number | null) => call<{ updatedAt: number }>('/save', { method: 'PUT', body: base === undefined ? { data } : { data, baseUpdatedAt: base } }),
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
  modes: () => call<ModesInfo>('/modes'),
  community: () => call<CommunityInfo>('/community'),
  player: (id: string) => call<PlayerProfile>(`/players/${encodeURIComponent(id)}`),
  history: (before?: number) => call<{ games: HistoryRow[]; next: number | null }>(`/history${before ? `?before=${before}` : ''}`),
  historyGame: (id: string) => call<HistoryGame>(`/history/${encodeURIComponent(id)}`),
  /** Everything the server holds about you, as JSON. */
  exportData: () => call<Record<string, unknown>>('/me/export'),
  deleteAccount: () => call<{ deleted: boolean }>('/me', { method: 'DELETE', body: { confirm: 'DELETE' } }),
}
