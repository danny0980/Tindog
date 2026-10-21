// The server's data: users, sessions, magic-link tokens, cloud saves, rated
// games, seasons, the weekly tournament, clans and the clan war, and the
// ratings of the online modes. Kept in SQLite (better-sqlite3: synchronous,
// transactional, WAL-journaled), so every change is durable the moment the
// call returns and a crash can't leave half a write behind.
//
// The interface is the one the JSON-file store had, so the rest of the server
// didn't change. A JSON data file from an older version is imported once, on
// first start (see `importLegacy`).
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
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
  /** The pool ('5+3', 'vanish-5+3', 'cards-5+3' …). */
  pool: string
  white: string
  black: string
  winner: 'w' | 'b' | null
  reason: string
  /** UCI moves (Card Chess: its own action notation). */
  moves: string[]
  ratingChange: { w: number; b: number }
  endedAt: number
  /** What a replay needs beyond the moves (Card Chess: both hands). */
  extra?: { hands?: { w: string[]; b: string[] } }
}

/** A finished online Battle Royale (four seats; computer seats have no user). */
export interface RoyaleRecord {
  id: string
  /** Seat order red, blue, yellow, green: a user id, or null for a computer army. */
  seats: Array<string | null>
  /** Seat indexes, the winner first. */
  ranking: number[]
  reason: string
  plies: number
  ratingChange: Record<string, number>
  endedAt: number
  /** The action log, for replays (absent for games before 6.16). */
  actions?: unknown[]
}

/** Community-wide counts for the Community tab. */
export interface CommunityStats {
  players: number
  ratedPlayers: number
  games: number
  gamesToday: number
  activeThisWeek: number
  clans: number
  /** Games finished in the last 7 days, per mode. */
  weekByMode: { chess: number; vanish: number; cards: number; royale: number }
}

/** A game in progress, saved after every move so a restarted server can resume it. */
export interface LiveRow {
  id: string
  kind: 'chess' | 'cards' | 'royale'
  state: unknown
  updatedAt: number
}

/** The online modes with their own rating (standard chess uses the user's own rating). */
export type RatedMode = 'vanish' | 'cards' | 'royale'
export const RATED_MODES: readonly RatedMode[] = ['vanish', 'cards', 'royale']

export interface ModeRating {
  rating: number
  games: number
  wins: number
  losses: number
  draws: number
}
export const START_MODE_RATING = 1200

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

/** The JSON-file database of versions up to 6.14 (imported once). */
export interface LegacyDb {
  version: 1
  users?: Record<string, User>
  sessions?: Record<string, SessionRow>
  magic?: Record<string, MagicRow>
  saves?: Record<string, SaveRow>
  games?: GameRecord[]
  seasons?: { current: string; rows: Record<string, SeasonRow>; history: Record<string, SeasonResult[]> }
  tournament?: TournamentState | null
  clans?: Record<string, Clan>
  clanWar?: ClanWar
}

/** Seasons of history kept per player. */
const MAX_SEASON_HISTORY = 24
/** Rated games kept (older ones are dropped; per-user stats stay on the user). */
const MAX_GAMES = 50_000
/** Bumped with each schema change; `migrate` brings older files up to date. */
export const SCHEMA_VERSION = 2

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  google_sub TEXT UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS users_rating ON users (rating DESC) WHERE games > 0;
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);
CREATE TABLE IF NOT EXISTS magic (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS saves (user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS games (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  pool TEXT NOT NULL,
  white TEXT NOT NULL,
  black TEXT NOT NULL,
  winner TEXT,
  reason TEXT NOT NULL,
  moves TEXT NOT NULL,
  change_w INTEGER NOT NULL,
  change_b INTEGER NOT NULL,
  ended_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS games_white ON games (white, seq DESC);
CREATE INDEX IF NOT EXISTS games_black ON games (black, seq DESC);
CREATE TABLE IF NOT EXISTS royale_games (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  seats TEXT NOT NULL,
  ranking TEXT NOT NULL,
  reason TEXT NOT NULL,
  plies INTEGER NOT NULL,
  changes TEXT NOT NULL,
  ended_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mode_ratings (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  rating INTEGER NOT NULL,
  games INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  draws INTEGER NOT NULL,
  PRIMARY KEY (user_id, mode)
);
CREATE INDEX IF NOT EXISTS mode_ratings_table ON mode_ratings (mode, rating DESC);
CREATE TABLE IF NOT EXISTS season_rows (user_id TEXT PRIMARY KEY, games INTEGER NOT NULL, wins INTEGER NOT NULL, peak INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS season_history (
  user_id TEXT NOT NULL,
  season TEXT NOT NULL,
  rating INTEGER NOT NULL,
  tier TEXT NOT NULL,
  rank INTEGER NOT NULL,
  games INTEGER NOT NULL,
  PRIMARY KEY (user_id, season)
);
CREATE TABLE IF NOT EXISTS tournaments (id TEXT PRIMARY KEY, seq INTEGER NOT NULL, status TEXT NOT NULL, state TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clans (id TEXT PRIMARY KEY, name TEXT NOT NULL, tag TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS clans_name ON clans (name COLLATE NOCASE);
CREATE TABLE IF NOT EXISTS clan_members (user_id TEXT PRIMARY KEY, clan_id TEXT NOT NULL REFERENCES clans (id) ON DELETE CASCADE, position INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS clan_members_clan ON clan_members (clan_id, position);
CREATE TABLE IF NOT EXISTS clan_war (week TEXT NOT NULL, clan_id TEXT NOT NULL, points INTEGER NOT NULL, PRIMARY KEY (week, clan_id));
CREATE TABLE IF NOT EXISTS live_games (id TEXT PRIMARY KEY, kind TEXT NOT NULL, state TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS games_ended ON games (ended_at DESC);
`

interface UserRow {
  id: string
  email: string | null
  google_sub: string | null
  name: string
  created_at: number
  rating: number
  games: number
  wins: number
  losses: number
  draws: number
}
interface GameRow {
  id: string
  pool: string
  white: string
  black: string
  winner: string | null
  reason: string
  moves: string
  change_w: number
  change_b: number
  ended_at: number
  extra: string | null
}
interface ClanRow {
  id: string
  name: string
  tag: string
  owner_id: string
  created_at: number
}

interface RoyaleRow {
  id: string
  seats: string
  ranking: string
  reason: string
  plies: number
  changes: string
  ended_at: number
  actions: string | null
}
const toRoyale = (r: RoyaleRow): RoyaleRecord => ({
  id: r.id,
  seats: JSON.parse(r.seats) as Array<string | null>,
  ranking: JSON.parse(r.ranking) as number[],
  reason: r.reason,
  plies: r.plies,
  ratingChange: JSON.parse(r.changes) as Record<string, number>,
  endedAt: r.ended_at,
  ...(r.actions ? { actions: JSON.parse(r.actions) as unknown[] } : {}),
})

const toUser = (r: UserRow): User => ({ id: r.id, email: r.email, googleSub: r.google_sub, name: r.name, createdAt: r.created_at, rating: r.rating, games: r.games, wins: r.wins, losses: r.losses, draws: r.draws })
const toGame = (r: GameRow): GameRecord => ({ id: r.id, pool: r.pool, white: r.white, black: r.black, winner: r.winner === 'w' || r.winner === 'b' ? r.winner : null, reason: r.reason, moves: JSON.parse(r.moves) as string[], ratingChange: { w: r.change_w, b: r.change_b }, endedAt: r.ended_at, ...(r.extra ? { extra: JSON.parse(r.extra) as GameRecord['extra'] } : {}) })

export class Store {
  readonly db: Database.Database
  /** Where the database lives (null = in memory). */
  readonly file: string | null
  private readonly q

  /** `file` = null keeps everything in memory (tests). */
  constructor(file: string | null) {
    this.file = file
    if (file) mkdirSync(dirname(file), { recursive: true })
    this.db = new Database(file ?? ':memory:')
    if (file) {
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('synchronous = NORMAL')
    }
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('busy_timeout = 5000')
    this.migrate()
    const db = this.db
    this.q = {
      user: db.prepare<[string], UserRow>('SELECT * FROM users WHERE id = ?'),
      userByEmail: db.prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?'),
      userByGoogle: db.prepare<[string], UserRow>('SELECT * FROM users WHERE google_sub = ?'),
      putUser: db.prepare(
        `INSERT INTO users (id, email, google_sub, name, created_at, rating, games, wins, losses, draws) VALUES (@id, @email, @googleSub, @name, @createdAt, @rating, @games, @wins, @losses, @draws)
         ON CONFLICT (id) DO UPDATE SET email = excluded.email, google_sub = excluded.google_sub, name = excluded.name, rating = excluded.rating, games = excluded.games, wins = excluded.wins, losses = excluded.losses, draws = excluded.draws`,
      ),
      session: db.prepare<[string], { user_id: string; expires_at: number }>('SELECT user_id, expires_at FROM sessions WHERE hash = ?'),
      putSession: db.prepare('INSERT OR REPLACE INTO sessions (hash, user_id, expires_at) VALUES (?, ?, ?)'),
      dropSession: db.prepare('DELETE FROM sessions WHERE hash = ?'),
      magic: db.prepare<[string], { email: string; expires_at: number }>('SELECT email, expires_at FROM magic WHERE hash = ?'),
      putMagic: db.prepare('INSERT OR REPLACE INTO magic (hash, email, expires_at) VALUES (?, ?, ?)'),
      dropMagic: db.prepare('DELETE FROM magic WHERE hash = ?'),
      sweepSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
      sweepMagic: db.prepare('DELETE FROM magic WHERE expires_at <= ?'),
      save: db.prepare<[string], { data: string; updated_at: number }>('SELECT data, updated_at FROM saves WHERE user_id = ?'),
      putSave: db.prepare('INSERT OR REPLACE INTO saves (user_id, data, updated_at) VALUES (?, ?, ?)'),
      addGame: db.prepare('INSERT OR IGNORE INTO games (id, pool, white, black, winner, reason, moves, change_w, change_b, ended_at, extra) VALUES (@id, @pool, @white, @black, @winner, @reason, @moves, @w, @b, @endedAt, @extra)'),
      gamesPage: db.prepare<[string, string, number, number], GameRow>('SELECT * FROM games WHERE (white = ? OR black = ?) AND ended_at < ? ORDER BY ended_at DESC LIMIT ?'),
      gameById: db.prepare<[string], GameRow>('SELECT * FROM games WHERE id = ?'),
      royalePage: db.prepare<[string, number, number], RoyaleRow>('SELECT * FROM royale_games WHERE EXISTS (SELECT 1 FROM json_each(royale_games.seats) WHERE value = ?) AND ended_at < ? ORDER BY ended_at DESC LIMIT ?'),
      royaleById: db.prepare<[string], RoyaleRow>('SELECT * FROM royale_games WHERE id = ?'),
      putLive: db.prepare('INSERT OR REPLACE INTO live_games (id, kind, state, updated_at) VALUES (?, ?, ?, ?)'),
      dropLive: db.prepare('DELETE FROM live_games WHERE id = ?'),
      liveAll: db.prepare<[string], { id: string; kind: string; state: string; updated_at: number }>('SELECT * FROM live_games WHERE kind = ?'),
      trimGames: db.prepare('DELETE FROM games WHERE seq <= (SELECT MAX(seq) FROM games) - ?'),
      gamesOf: db.prepare<[string, string, number], GameRow>('SELECT * FROM games WHERE white = ? OR black = ? ORDER BY seq DESC LIMIT ?'),
      addRoyale: db.prepare('INSERT OR IGNORE INTO royale_games (id, seats, ranking, reason, plies, changes, ended_at, actions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
      leaderboard: db.prepare<[number], UserRow>('SELECT * FROM users WHERE games > 0 ORDER BY rating DESC LIMIT ?'),
      modeRating: db.prepare<[string, string], ModeRating>('SELECT rating, games, wins, losses, draws FROM mode_ratings WHERE user_id = ? AND mode = ?'),
      putModeRating: db.prepare('INSERT OR REPLACE INTO mode_ratings (user_id, mode, rating, games, wins, losses, draws) VALUES (@userId, @mode, @rating, @games, @wins, @losses, @draws)'),
      modeTable: db.prepare<[string, number], ModeRating & { id: string; name: string }>('SELECT u.id, u.name, m.rating, m.games, m.wins, m.losses, m.draws FROM mode_ratings m JOIN users u ON u.id = m.user_id WHERE m.mode = ? AND m.games > 0 ORDER BY m.rating DESC LIMIT ?'),
      meta: db.prepare<[string], { value: string }>('SELECT value FROM meta WHERE key = ?'),
      putMeta: db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)'),
      seasonRow: db.prepare<[string], SeasonRow>('SELECT games, wins, peak FROM season_rows WHERE user_id = ?'),
      putSeasonRow: db.prepare('INSERT OR REPLACE INTO season_rows (user_id, games, wins, peak) VALUES (?, ?, ?, ?)'),
      seasonTable: db.prepare<[number], UserRow & { s_games: number; s_wins: number; peak: number }>('SELECT u.*, s.games AS s_games, s.wins AS s_wins, s.peak FROM season_rows s JOIN users u ON u.id = s.user_id WHERE s.games > 0 ORDER BY u.rating DESC LIMIT ?'),
      seasonHistory: db.prepare<[string, number], SeasonResult>('SELECT season, rating, tier, rank, games FROM season_history WHERE user_id = ? ORDER BY season DESC LIMIT ?'),
      putHistory: db.prepare('INSERT OR REPLACE INTO season_history (user_id, season, rating, tier, rank, games) VALUES (?, ?, ?, ?, ?, ?)'),
      trimHistory: db.prepare('DELETE FROM season_history WHERE user_id = ? AND season NOT IN (SELECT season FROM season_history WHERE user_id = ? ORDER BY season DESC LIMIT ?)'),
      tournament: db.prepare<[], { state: string }>('SELECT state FROM tournaments ORDER BY seq DESC LIMIT 1'),
      putTournament: db.prepare('INSERT INTO tournaments (id, seq, status, state) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET status = excluded.status, state = excluded.state'),
      tournamentSeq: db.prepare<[string], { seq: number }>('SELECT seq FROM tournaments WHERE id = ?'),
      maxTournamentSeq: db.prepare<[], { seq: number | null }>('SELECT MAX(seq) AS seq FROM tournaments'),
      clan: db.prepare<[string], ClanRow>('SELECT * FROM clans WHERE id = ?'),
      clans: db.prepare<[], ClanRow>('SELECT * FROM clans ORDER BY created_at'),
      clanByTag: db.prepare<[string], ClanRow>('SELECT * FROM clans WHERE tag = ?'),
      clanOf: db.prepare<[string], { clan_id: string }>('SELECT clan_id FROM clan_members WHERE user_id = ?'),
      members: db.prepare<[string], { user_id: string }>('SELECT user_id FROM clan_members WHERE clan_id = ? ORDER BY position'),
      putClan: db.prepare('INSERT INTO clans (id, name, tag, owner_id, created_at) VALUES (@id, @name, @tag, @ownerId, @createdAt) ON CONFLICT (id) DO UPDATE SET name = excluded.name, tag = excluded.tag, owner_id = excluded.owner_id'),
      clearMembers: db.prepare('DELETE FROM clan_members WHERE clan_id = ?'),
      addMember: db.prepare('INSERT OR REPLACE INTO clan_members (user_id, clan_id, position) VALUES (?, ?, ?)'),
      dropClan: db.prepare('DELETE FROM clans WHERE id = ?'),
      warPoints: db.prepare<[string], { clan_id: string; points: number }>('SELECT clan_id, points FROM clan_war WHERE week = ? ORDER BY points DESC'),
      addWar: db.prepare('INSERT INTO clan_war (week, clan_id, points) VALUES (?, ?, ?) ON CONFLICT (week, clan_id) DO UPDATE SET points = points + excluded.points'),
      dropWar: db.prepare('DELETE FROM clan_war WHERE week = ? AND clan_id = ?'),
      pruneWar: db.prepare('DELETE FROM clan_war WHERE week NOT IN (?, ?)'),
    }
  }

  /** Creates the tables, or brings an older database up to the current schema. */
  private migrate(): void {
    this.db.exec(SCHEMA)
    const row = this.db.prepare<[], { value: string }>("SELECT value FROM meta WHERE key = 'schema'").get()
    const version = row ? Number(row.value) : 0
    if (version > SCHEMA_VERSION) throw new Error(`The database ${this.file ?? ''} was written by a newer server (schema ${version}); upgrade this server first.`)
    // Schema changes, oldest first; each runs once, in the same transaction as the new version number.
    this.db.transaction(() => {
      if (version < 2) {
        // 6.16: replays (Card Chess hands, Battle Royale action logs).
        this.db.exec('ALTER TABLE games ADD COLUMN extra TEXT')
        this.db.exec('ALTER TABLE royale_games ADD COLUMN actions TEXT')
      }
      if (version < SCHEMA_VERSION) this.db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema', ?)").run(String(SCHEMA_VERSION))
    })()
  }

  private getMeta(key: string): string | null {
    return this.q.meta.get(key)?.value ?? null
  }
  private setMeta(key: string, value: string): void {
    this.q.putMeta.run(key, value)
  }

  /** Runs `fn` as one transaction (all of it is written, or none). */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  /** True when the database answers (for /api/health). */
  healthy(): boolean {
    try {
      return this.db.prepare<[], { ok: number }>('SELECT 1 AS ok').get()?.ok === 1
    } catch {
      return false
    }
  }

  /** Every write is already durable; this checkpoints the write-ahead log (on shutdown). */
  flush(): void {
    if (this.file && this.db.open) this.db.pragma('wal_checkpoint(TRUNCATE)')
  }

  close(): void {
    if (!this.db.open) return
    this.flush()
    this.db.close()
  }

  /** A consistent copy of the live database (safe while the server runs). */
  async backup(to: string): Promise<void> {
    mkdirSync(dirname(to), { recursive: true })
    await this.db.backup(to)
  }

  /** True when nothing has been stored yet (a fresh database). */
  isEmpty(): boolean {
    return this.db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM users').get()?.n === 0 && this.getMeta('season') === null && this.q.tournament.get() === undefined
  }

  // ── Import from the JSON data file of earlier versions ───────────────────
  /** Copies a version-1 JSON database in, in one transaction. Returns what was imported. */
  importLegacy(raw: unknown): { users: number; games: number; clans: number } {
    if (!raw || typeof raw !== 'object' || (raw as LegacyDb).version !== 1) throw new Error('Not a Chronos Chess data file (version 1).')
    const d = raw as LegacyDb
    const users = Object.values(d.users ?? {})
    const games = d.games ?? []
    const clans = Object.values(d.clans ?? {})
    this.transaction(() => {
      for (const u of users) this.putUser(u)
      for (const [hash, s] of Object.entries(d.sessions ?? {})) if (d.users?.[s.userId]) this.putSession(hash, s)
      for (const [hash, m] of Object.entries(d.magic ?? {})) this.putMagic(hash, m)
      for (const [id, s] of Object.entries(d.saves ?? {})) if (d.users?.[id]) this.putSave(id, s)
      for (const g of games) this.addGame(g)
      const seasons = d.seasons
      if (seasons?.current) this.setMeta('season', seasons.current)
      for (const [id, row] of Object.entries(seasons?.rows ?? {})) this.q.putSeasonRow.run(id, row.games, row.wins, row.peak)
      for (const [id, list] of Object.entries(seasons?.history ?? {})) for (const r of list) this.q.putHistory.run(id, r.season, r.rating, r.tier, r.rank, r.games)
      if (d.tournament) this.putTournament(d.tournament)
      for (const c of clans) this.putClan(c)
      const war = d.clanWar
      if (war?.week) {
        this.setMeta('clanWar.week', war.week)
        for (const [clan, pts] of Object.entries(war.points)) if (d.clans?.[clan]) this.q.addWar.run(war.week, clan, pts)
      }
      if (war?.last) this.setMeta('clanWar.last', JSON.stringify(war.last))
    })
    return { users: users.length, games: games.length, clans: clans.length }
  }

  /**
   * On first start with a fresh database: imports the old JSON data file if
   * there is one, then renames it (`.imported`) so it is never imported twice.
   */
  importLegacyFile(jsonFile: string): { users: number; games: number; clans: number } | null {
    if (!existsSync(jsonFile) || !this.isEmpty()) return null
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(jsonFile, 'utf8'))
    } catch (err) {
      throw new Error(`Could not read the old data file ${jsonFile}: ${err instanceof Error ? err.message : String(err)}`)
    }
    const out = this.importLegacy(raw)
    renameSync(jsonFile, `${jsonFile}.imported`)
    return out
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  user(id: string): User | null {
    const r = this.q.user.get(id)
    return r ? toUser(r) : null
  }
  userByEmail(email: string): User | null {
    const r = this.q.userByEmail.get(email)
    return r ? toUser(r) : null
  }
  userByGoogle(sub: string): User | null {
    const r = this.q.userByGoogle.get(sub)
    return r ? toUser(r) : null
  }
  putUser(user: User): User {
    this.q.putUser.run(user)
    return user
  }

  // ── Sessions & magic links ────────────────────────────────────────────────
  session(hash: string): SessionRow | null {
    const r = this.q.session.get(hash)
    return r ? { userId: r.user_id, expiresAt: r.expires_at } : null
  }
  putSession(hash: string, row: SessionRow): void {
    this.q.putSession.run(hash, row.userId, row.expiresAt)
  }
  dropSession(hash: string): void {
    this.q.dropSession.run(hash)
  }
  /** Cancels every pending sign-in link and code for an email (one was just used). */
  dropMagicFor(email: string): void {
    this.db.prepare('DELETE FROM magic WHERE email = ?').run(email)
  }
  dropSessionsOf(userId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  }
  magic(hash: string): MagicRow | null {
    const r = this.q.magic.get(hash)
    return r ? { email: r.email, expiresAt: r.expires_at } : null
  }
  putMagic(hash: string, row: MagicRow): void {
    this.q.putMagic.run(hash, row.email, row.expiresAt)
  }
  /** Single use: returns the row and deletes it. */
  takeMagic(hash: string): MagicRow | null {
    return this.transaction(() => {
      const row = this.magic(hash)
      if (row) this.q.dropMagic.run(hash)
      return row
    })
  }
  /** Drops expired sessions and links. */
  sweep(now: number): void {
    this.q.sweepSessions.run(now)
    this.q.sweepMagic.run(now)
  }

  // ── Cloud saves ───────────────────────────────────────────────────────────
  save(userId: string): SaveRow | null {
    const r = this.q.save.get(userId)
    return r ? { data: JSON.parse(r.data) as unknown, updatedAt: r.updated_at } : null
  }
  putSave(userId: string, row: SaveRow): void {
    this.q.putSave.run(userId, JSON.stringify(row.data), row.updatedAt)
  }

  // ── Rated games ───────────────────────────────────────────────────────────
  addGame(game: GameRecord): void {
    this.q.addGame.run({ id: game.id, pool: game.pool, white: game.white, black: game.black, winner: game.winner, reason: game.reason, moves: JSON.stringify(game.moves), w: game.ratingChange.w, b: game.ratingChange.b, endedAt: game.endedAt, extra: game.extra ? JSON.stringify(game.extra) : null })
    this.q.trimGames.run(MAX_GAMES)
  }
  gamesOf(userId: string, limit: number): GameRecord[] {
    return this.q.gamesOf.all(userId, userId, limit).map(toGame)
  }
  addRoyaleGame(r: RoyaleRecord): void {
    this.q.addRoyale.run(r.id, JSON.stringify(r.seats), JSON.stringify(r.ranking), r.reason, r.plies, JSON.stringify(r.ratingChange), r.endedAt, r.actions ? JSON.stringify(r.actions) : null)
  }

  // ── History (newest first, paged by end time) ─────────────────────────────
  /** A player's two-player games ending before `before`. */
  gamesPage(userId: string, before: number, limit: number): GameRecord[] {
    return this.q.gamesPage.all(userId, userId, before, limit).map(toGame)
  }
  game(id: string): GameRecord | null {
    const r = this.q.gameById.get(id)
    return r ? toGame(r) : null
  }
  /** A player's Battle Royale games ending before `before`. */
  royalePage(userId: string, before: number, limit: number): RoyaleRecord[] {
    return this.q.royalePage.all(userId, before, limit).map(toRoyale)
  }
  royaleGame(id: string): RoyaleRecord | null {
    const r = this.q.royaleById.get(id)
    return r ? toRoyale(r) : null
  }

  // ── Games in progress (survive a restart) ─────────────────────────────────
  putLive(id: string, kind: LiveRow['kind'], state: unknown, now: number): void {
    this.q.putLive.run(id, kind, JSON.stringify(state), now)
  }
  dropLive(id: string): void {
    this.q.dropLive.run(id)
  }
  liveGames(kind: LiveRow['kind']): LiveRow[] {
    return this.q.liveAll.all(kind).map((r) => ({ id: r.id, kind, state: JSON.parse(r.state) as unknown, updatedAt: r.updated_at }))
  }

  // ── Community ─────────────────────────────────────────────────────────────
  /** Counts across the whole community (all from indexed or small tables). */
  communityStats(now: number): CommunityStats {
    const one = <T>(sql: string, ...args: Array<string | number>): T => this.db.prepare(sql).get(...args) as T
    const day = now - 86_400_000
    const week = now - 7 * 86_400_000
    const byPool = this.db.prepare<[number], { pool: string; n: number }>('SELECT pool, COUNT(*) AS n FROM games WHERE ended_at > ? GROUP BY pool').all(week)
    const weekByMode = { chess: 0, vanish: 0, cards: 0, royale: one<{ n: number }>('SELECT COUNT(*) AS n FROM royale_games WHERE ended_at > ?', week).n }
    for (const r of byPool) weekByMode[r.pool.startsWith('vanish-') ? 'vanish' : r.pool.startsWith('cards-') ? 'cards' : 'chess'] += r.n
    return {
      players: one<{ n: number }>('SELECT COUNT(*) AS n FROM users').n,
      ratedPlayers: one<{ n: number }>('SELECT COUNT(*) AS n FROM users u WHERE u.games > 0 OR EXISTS (SELECT 1 FROM mode_ratings m WHERE m.user_id = u.id AND m.games > 0)').n,
      games: one<{ n: number }>('SELECT (SELECT COUNT(*) FROM games) + (SELECT COUNT(*) FROM royale_games) AS n').n,
      gamesToday: one<{ n: number }>('SELECT (SELECT COUNT(*) FROM games WHERE ended_at > ?) + (SELECT COUNT(*) FROM royale_games WHERE ended_at > ?) AS n', day, day).n,
      activeThisWeek: one<{ n: number }>(
        `SELECT COUNT(DISTINCT p) AS n FROM (
           SELECT white AS p FROM games WHERE ended_at > ? UNION SELECT black FROM games WHERE ended_at > ?
           UNION SELECT j.value FROM royale_games r, json_each(r.seats) j WHERE r.ended_at > ? AND j.value IS NOT NULL)`,
        week,
        week,
        week,
      ).n,
      clans: one<{ n: number }>('SELECT COUNT(*) AS n FROM clans').n,
      weekByMode,
    }
  }

  /** Finished weekly tournaments, newest first (from the tournaments table's history). */
  pastTournaments(limit: number): TournamentState[] {
    return this.db
      .prepare<[number], { state: string }>("SELECT state FROM tournaments WHERE status = 'done' ORDER BY seq DESC LIMIT ?")
      .all(limit)
      .map((r) => JSON.parse(r.state) as TournamentState)
  }

  /** Tournament titles per player (who has won the Weekly Knockout most). */
  titles(): Map<string, number> {
    const out = new Map<string, number>()
    for (const t of this.pastTournaments(100_000)) if (t.champion) out.set(t.champion, (out.get(t.champion) ?? 0) + 1)
    return out
  }

  /** A player's rank in this season's table (1 = first), or null without a game this season. */
  seasonRank(userId: string): number | null {
    const row = this.seasonRow(userId)
    const user = this.user(userId)
    if (!row || row.games === 0 || !user) return null
    const above = this.db.prepare<[number], { n: number }>('SELECT COUNT(*) AS n FROM season_rows s JOIN users u ON u.id = s.user_id WHERE s.games > 0 AND u.rating > ?').get(user.rating)
    return (above?.n ?? 0) + 1
  }

  // ── Your data: export and deletion ────────────────────────────────────────
  /** Everything stored about a user, for a download. */
  exportUser(userId: string): Record<string, unknown> | null {
    const user = this.user(userId)
    if (!user) return null
    return {
      exportedAt: new Date().toISOString(),
      account: user,
      modeRatings: Object.fromEntries(RATED_MODES.map((m) => [m, this.modeRating(userId, m)])),
      season: { current: this.seasonCurrent(), row: this.seasonRow(userId), history: this.seasonHistory(userId) },
      clan: this.clanOf(userId),
      cloudSave: this.save(userId),
      games: this.gamesPage(userId, Number.MAX_SAFE_INTEGER, 1_000_000),
      battleRoyale: this.royalePage(userId, Number.MAX_SAFE_INTEGER, 1_000_000),
    }
  }

  /**
   * Deletes a user and everything that is only theirs: the account, sign-ins,
   * cloud save, ratings, season rows and clan membership (in one transaction).
   * Finished games stay for their opponents' history, under an id that no
   * longer leads to a name.
   */
  deleteUser(userId: string): boolean {
    const user = this.user(userId)
    if (!user) return false
    this.transaction(() => {
      this.db.prepare('DELETE FROM season_rows WHERE user_id = ?').run(userId)
      this.db.prepare('DELETE FROM season_history WHERE user_id = ?').run(userId)
      this.db.prepare('DELETE FROM clan_members WHERE user_id = ?').run(userId)
      if (user.email) this.db.prepare('DELETE FROM magic WHERE email = ?').run(user.email)
      // Sessions, the cloud save and mode ratings go with the user (ON DELETE CASCADE).
      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    })
    return true
  }
  leaderboard(limit: number): User[] {
    return this.q.leaderboard.all(limit).map(toUser)
  }

  // ── Ratings of the online modes ───────────────────────────────────────────
  modeRating(userId: string, mode: RatedMode): ModeRating {
    return this.q.modeRating.get(userId, mode) ?? { rating: START_MODE_RATING, games: 0, wins: 0, losses: 0, draws: 0 }
  }
  putModeRating(userId: string, mode: RatedMode, row: ModeRating): void {
    this.q.putModeRating.run({ userId, mode, ...row })
  }
  modeLeaderboard(mode: RatedMode, limit: number): Array<ModeRating & { id: string; name: string }> {
    return this.q.modeTable.all(mode, limit)
  }

  // ── Seasons ───────────────────────────────────────────────────────────────
  /** Starts a new season if the month has turned: final standings into history, ratings softly reset. */
  rollSeason(now: number): boolean {
    const season = seasonOf(now)
    const current = this.getMeta('season') ?? ''
    if (current === season) return false
    this.transaction(() => {
      if (current) {
        const ranked = this.db.prepare<[], { id: string; rating: number; s_games: number }>('SELECT u.id, u.rating, s.games AS s_games FROM season_rows s JOIN users u ON u.id = s.user_id WHERE s.games > 0 ORDER BY u.rating DESC').all()
        ranked.forEach((r, i) => {
          this.q.putHistory.run(r.id, current, r.rating, tierFor(r.rating).id, i + 1, r.s_games)
          this.q.trimHistory.run(r.id, r.id, MAX_SEASON_HISTORY)
        })
        const reset = this.db.prepare('UPDATE users SET rating = ? WHERE id = ?')
        for (const u of this.db.prepare<[], { id: string; rating: number }>('SELECT id, rating FROM users WHERE games > 0').all()) reset.run(softReset(u.rating), u.id)
      }
      this.db.prepare('DELETE FROM season_rows').run()
      this.setMeta('season', season)
    })
    return true
  }
  seasonCurrent(): string {
    return this.getMeta('season') ?? ''
  }
  seasonRow(userId: string): SeasonRow | null {
    return this.q.seasonRow.get(userId) ?? null
  }
  recordSeasonGame(userId: string, won: boolean, rating: number): void {
    const row = this.seasonRow(userId) ?? { games: 0, wins: 0, peak: rating }
    this.q.putSeasonRow.run(userId, row.games + 1, row.wins + (won ? 1 : 0), Math.max(row.peak, rating))
  }
  /** This season's table: players with a game this season, by rating. */
  seasonTable(limit: number): Array<{ user: User; row: SeasonRow }> {
    return this.q.seasonTable.all(limit).map((r) => ({ user: toUser(r), row: { games: r.s_games, wins: r.s_wins, peak: r.peak } }))
  }
  seasonHistory(userId: string): SeasonResult[] {
    return this.q.seasonHistory.all(userId, MAX_SEASON_HISTORY)
  }

  // ── Weekly tournament ─────────────────────────────────────────────────────
  /** The current (latest) tournament; past ones stay in the table as history. */
  tournament(): TournamentState | null {
    const r = this.q.tournament.get()
    return r ? (JSON.parse(r.state) as TournamentState) : null
  }
  putTournament(t: TournamentState): void {
    const seq = this.q.tournamentSeq.get(t.id)?.seq ?? (this.q.maxTournamentSeq.get()?.seq ?? 0) + 1
    this.q.putTournament.run(t.id, seq, t.status, JSON.stringify(t))
  }

  // ── Clans & clan war ──────────────────────────────────────────────────────
  private toClan(r: ClanRow): Clan {
    return { id: r.id, name: r.name, tag: r.tag, ownerId: r.owner_id, createdAt: r.created_at, members: this.q.members.all(r.id).map((m) => m.user_id) }
  }
  clan(id: string): Clan | null {
    const r = this.q.clan.get(id)
    return r ? this.toClan(r) : null
  }
  clans(): Clan[] {
    return this.q.clans.all().map((r) => this.toClan(r))
  }
  clanOf(userId: string): Clan | null {
    const m = this.q.clanOf.get(userId)
    return m ? this.clan(m.clan_id) : null
  }
  clanByTag(tag: string): Clan | null {
    const r = this.q.clanByTag.get(tag)
    return r ? this.toClan(r) : null
  }
  putClan(clan: Clan): Clan {
    this.transaction(() => {
      this.q.putClan.run(clan)
      this.q.clearMembers.run(clan.id)
      clan.members.forEach((id, i) => this.q.addMember.run(id, clan.id, i))
    })
    return clan
  }
  dropClan(id: string): void {
    this.transaction(() => {
      this.q.dropClan.run(id)
      this.q.dropWar.run(this.getMeta('clanWar.week') ?? '', id)
    })
  }
  private points(week: string): Record<string, number> {
    const out: Record<string, number> = {}
    for (const r of this.q.warPoints.all(week)) out[r.clan_id] = r.points
    return out
  }
  /** This week's war table (a new week archives the last one first). */
  clanWar(now: number): ClanWar {
    const week = weekOf(now)
    const stored = this.getMeta('clanWar.week') ?? ''
    if (stored !== week) {
      this.transaction(() => {
        const points = stored ? this.points(stored) : {}
        if (stored && Object.keys(points).length > 0) this.setMeta('clanWar.last', JSON.stringify({ week: stored, points }))
        this.setMeta('clanWar.week', week)
        this.q.pruneWar.run(week, week)
      })
    }
    const last = this.getMeta('clanWar.last')
    return { week, points: this.points(week), last: last ? (JSON.parse(last) as ClanWar['last']) : null }
  }
  addWarPoints(clanId: string, points: number, now: number): void {
    if (points <= 0) return
    const w = this.clanWar(now)
    this.q.addWar.run(w.week, clanId, points)
  }
}
