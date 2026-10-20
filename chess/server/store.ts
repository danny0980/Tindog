// The server's data: users, sessions, magic-link tokens, cloud saves and
// rated games. Kept in memory and written to one JSON file (atomically: a
// temp file, then rename), which needs no database to run anywhere — Windows
// included. The interface is small on purpose so a real database (Postgres)
// can replace this file later without touching the rest of the server.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { BracketMatch, Entrant } from './bracket'
import { type Clan, weekOf } from './clans'
import { type SeasonResult, type SeasonRow, seasonOf, softReset, tierFor } from './seasons'

export interface User {
  id: string
  email: string | null
  googleSub: string | null
  name: string
  createdAt: number
  rating: number
  games: number
  wins: number
  losses: number
  draws: number
}

export interface SessionRow {
  userId: string
  expiresAt: number
}

export interface MagicRow {
  email: string
  expiresAt: number
}

export interface SaveRow {
  /** The client's own save blob (validated by size only; the client sanitises on load). */
  data: unknown
  updatedAt: number
}

export interface GameRecord {
  id: string
  pool: string
  white: string
  black: string
  winner: 'w' | 'b' | null
  reason: string
  moves: string[]
  ratingChange: { w: number; b: number }
  endedAt: number
}

export interface TournamentState {
  id: string
  name: string
  startsAt: number
  pool: string
  status: 'signup' | 'running' | 'done'
  entrants: Entrant[]
  rounds: BracketMatch[][]
  champion: string | null
  finishedAt: number | null
  /** Last week's champion (for the lobby). */
  previous: { champion: string; players: number; finishedAt: number } | null
}

export interface ClanWar {
  week: string
  points: Record<string, number>
  /** Last week's final table (the winner first). */
  last: { week: string; points: Record<string, number> } | null
}

interface Db {
  version: 1
  users: Record<string, User>
  /** Keyed by SHA-256 of the session token (raw tokens are never stored). */
  sessions: Record<string, SessionRow>
  /** Keyed by SHA-256 of the magic-link token. */
  magic: Record<string, MagicRow>
  saves: Record<string, SaveRow>
  games: GameRecord[]
  seasons: { current: string; rows: Record<string, SeasonRow>; history: Record<string, SeasonResult[]> }
  tournament: TournamentState | null
  clans: Record<string, Clan>
  clanWar: ClanWar
}

const empty = (): Db => ({ version: 1, users: {}, sessions: {}, magic: {}, saves: {}, games: [], seasons: { current: '', rows: {}, history: {} }, tournament: null, clans: {}, clanWar: { week: '', points: {}, last: null } })
/** Seasons of history kept per player. */
const MAX_SEASON_HISTORY = 24
/** Rated games kept in the file (older ones are dropped; per-user stats stay on the user). */
const MAX_GAMES = 5000

export class Store {
  private db: Db
  private readonly file: string | null
  private timer: ReturnType<typeof setTimeout> | null = null

  /** `file` = null keeps everything in memory (tests). */
  constructor(file: string | null) {
    this.file = file
    this.db = empty()
    if (file && existsSync(file)) {
      try {
        const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
        if (raw && typeof raw === 'object' && (raw as Db).version === 1) this.db = { ...empty(), ...(raw as Db) }
      } catch (err) {
        throw new Error(`Could not read the data file ${file}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  /** Writes soon (changes in a burst become one write). */
  private changed(): void {
    if (!this.file || this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, 200)
  }

  /** Writes now (also on shutdown). */
  flush(): void {
    if (!this.file) return
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.db))
    renameSync(tmp, this.file)
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  user(id: string): User | null {
    return this.db.users[id] ?? null
  }
  userByEmail(email: string): User | null {
    return Object.values(this.db.users).find((u) => u.email === email) ?? null
  }
  userByGoogle(sub: string): User | null {
    return Object.values(this.db.users).find((u) => u.googleSub === sub) ?? null
  }
  putUser(user: User): User {
    this.db.users[user.id] = user
    this.changed()
    return user
  }

  // ── Sessions & magic links ────────────────────────────────────────────────
  session(hash: string): SessionRow | null {
    return this.db.sessions[hash] ?? null
  }
  putSession(hash: string, row: SessionRow): void {
    this.db.sessions[hash] = row
    this.changed()
  }
  dropSession(hash: string): void {
    delete this.db.sessions[hash]
    this.changed()
  }
  magic(hash: string): MagicRow | null {
    return this.db.magic[hash] ?? null
  }
  putMagic(hash: string, row: MagicRow): void {
    this.db.magic[hash] = row
    this.changed()
  }
  /** Single use: returns the row and deletes it. */
  takeMagic(hash: string): MagicRow | null {
    const row = this.db.magic[hash] ?? null
    if (row) {
      delete this.db.magic[hash]
      this.changed()
    }
    return row
  }
  /** Drops expired sessions and links. */
  sweep(now: number): void {
    for (const [k, s] of Object.entries(this.db.sessions)) if (s.expiresAt <= now) delete this.db.sessions[k]
    for (const [k, m] of Object.entries(this.db.magic)) if (m.expiresAt <= now) delete this.db.magic[k]
    this.changed()
  }

  // ── Cloud saves ───────────────────────────────────────────────────────────
  save(userId: string): SaveRow | null {
    return this.db.saves[userId] ?? null
  }
  putSave(userId: string, row: SaveRow): void {
    this.db.saves[userId] = row
    this.changed()
  }

  // ── Rated games ───────────────────────────────────────────────────────────
  addGame(game: GameRecord): void {
    this.db.games.push(game)
    if (this.db.games.length > MAX_GAMES) this.db.games.splice(0, this.db.games.length - MAX_GAMES)
    this.changed()
  }
  gamesOf(userId: string, limit: number): GameRecord[] {
    const out: GameRecord[] = []
    for (let i = this.db.games.length - 1; i >= 0 && out.length < limit; i--) {
      const g = this.db.games[i]!
      if (g.white === userId || g.black === userId) out.push(g)
    }
    return out
  }
  leaderboard(limit: number): User[] {
    return Object.values(this.db.users)
      .filter((u) => u.games > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
  }

  // ── Seasons ───────────────────────────────────────────────────────────────
  /** Starts a new season if the month has turned: final standings into history, ratings softly reset. */
  rollSeason(now: number): boolean {
    const season = seasonOf(now)
    const s = this.db.seasons
    if (s.current === season) return false
    if (s.current) {
      const ranked = Object.entries(s.rows)
        .filter(([id, row]) => row.games > 0 && this.db.users[id])
        .sort((a, b) => (this.db.users[b[0]]?.rating ?? 0) - (this.db.users[a[0]]?.rating ?? 0))
      ranked.forEach(([id, row], i) => {
        const rating = this.db.users[id]?.rating ?? 1200
        const result: SeasonResult = { season: s.current, rating, tier: tierFor(rating).id, rank: i + 1, games: row.games }
        s.history[id] = [result, ...(s.history[id] ?? [])].slice(0, MAX_SEASON_HISTORY)
      })
      for (const u of Object.values(this.db.users)) if (u.games > 0) u.rating = softReset(u.rating)
    }
    this.db.seasons = { current: season, rows: {}, history: s.history }
    this.changed()
    return true
  }
  seasonCurrent(): string {
    return this.db.seasons.current
  }
  seasonRow(userId: string): SeasonRow | null {
    return this.db.seasons.rows[userId] ?? null
  }
  recordSeasonGame(userId: string, won: boolean, rating: number): void {
    const row = this.db.seasons.rows[userId] ?? { games: 0, wins: 0, peak: rating }
    this.db.seasons.rows[userId] = { games: row.games + 1, wins: row.wins + (won ? 1 : 0), peak: Math.max(row.peak, rating) }
    this.changed()
  }
  /** This season's table: players with a game this season, by rating. */
  seasonTable(limit: number): Array<{ user: User; row: SeasonRow }> {
    return Object.entries(this.db.seasons.rows)
      .map(([id, row]) => ({ user: this.db.users[id], row }))
      .filter((x): x is { user: User; row: SeasonRow } => x.user !== undefined && x.row.games > 0)
      .sort((a, b) => b.user.rating - a.user.rating)
      .slice(0, limit)
  }
  seasonHistory(userId: string): SeasonResult[] {
    return this.db.seasons.history[userId] ?? []
  }

  // ── Weekly tournament ─────────────────────────────────────────────────────
  tournament(): TournamentState | null {
    return this.db.tournament
  }
  putTournament(t: TournamentState): void {
    this.db.tournament = t
    this.changed()
  }

  // ── Clans & clan war ──────────────────────────────────────────────────────
  clan(id: string): Clan | null {
    return this.db.clans[id] ?? null
  }
  clans(): Clan[] {
    return Object.values(this.db.clans)
  }
  clanOf(userId: string): Clan | null {
    return Object.values(this.db.clans).find((c) => c.members.includes(userId)) ?? null
  }
  clanByTag(tag: string): Clan | null {
    return Object.values(this.db.clans).find((c) => c.tag === tag) ?? null
  }
  putClan(clan: Clan): Clan {
    this.db.clans[clan.id] = clan
    this.changed()
    return clan
  }
  dropClan(id: string): void {
    delete this.db.clans[id]
    delete this.db.clanWar.points[id]
    this.changed()
  }
  /** This week's war table (a new week archives the last one first). */
  clanWar(now: number): ClanWar {
    const week = weekOf(now)
    const w = this.db.clanWar
    if (w.week !== week) {
      this.db.clanWar = { week, points: {}, last: w.week && Object.keys(w.points).length > 0 ? { week: w.week, points: w.points } : w.last }
      this.changed()
    }
    return this.db.clanWar
  }
  addWarPoints(clanId: string, points: number, now: number): void {
    if (points <= 0) return
    const w = this.clanWar(now)
    w.points[clanId] = (w.points[clanId] ?? 0) + points
    this.changed()
  }
}
