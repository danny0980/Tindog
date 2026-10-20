// Tests for the production server: the SQLite store (durable across restarts,
// transactional, constraints), the one-time import of the old JSON data file,
// backups, the settings, and the production HTTP layer (security headers,
// caching, the health check).
// Run with `npm run test:storage`.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { createApp } from '../server/app'
import { backupName, backupNow } from '../server/backup'
import { startWatchdog } from '../server/watchdog'
import { configWarnings, loadConfig } from '../server/config'
import { type LegacyDb, SCHEMA_VERSION, Store, type User } from '../server/store'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const threw = (fn: () => unknown): boolean => {
  try {
    fn()
    return false
  } catch {
    return true
  }
}

const dir = mkdtempSync(join(tmpdir(), 'chess-store-'))
const user = (id: string, extra: Partial<User> = {}): User => ({ id, email: `${id}@example.com`, googleSub: null, name: id, createdAt: 1, rating: 1500, games: 3, wins: 2, losses: 1, draws: 0, ...extra })

// ── Durable across restarts ─────────────────────────────────────────────────
const file = join(dir, 'chess.db')
{
  const s = new Store(file)
  s.putUser(user('alice00001'))
  s.putUser(user('bob0000001', { email: null, googleSub: 'g-123' }))
  s.putSession('hash1', { userId: 'alice00001', expiresAt: 10_000 })
  s.putMagic('m1', { email: 'x@example.com', expiresAt: 10_000 })
  s.putSave('alice00001', { data: { elo: 1700, nested: { ok: true } }, updatedAt: 5 })
  s.addGame({ id: 'game000001', pool: '5+3', white: 'alice00001', black: 'bob0000001', winner: 'w', reason: 'checkmate', moves: ['e2e4', 'e7e5'], ratingChange: { w: 8, b: -8 }, endedAt: 9 })
  s.putModeRating('alice00001', 'cards', { rating: 1333, games: 4, wins: 3, losses: 1, draws: 0 })
  s.putClan({ id: 'clan1', name: 'Knights', tag: 'KN', ownerId: 'alice00001', members: ['alice00001', 'bob0000001'], createdAt: 1 })
  s.addWarPoints('clan1', 3, Date.UTC(2026, 9, 20))
  s.rollSeason(Date.UTC(2026, 9, 20))
  s.recordSeasonGame('alice00001', true, 1508)
  s.putTournament({ id: 't1', name: 'Weekly Knockout', startsAt: 100, pool: '5+3', status: 'signup', entrants: [{ id: 'alice00001', rating: 1500 }], rounds: [], champion: null, finishedAt: null, previous: null })
  s.close()
}
{
  const s = new Store(file)
  check('users survive a restart', s.user('alice00001')?.rating === 1500 && s.userByEmail('alice00001@example.com')?.id === 'alice00001' && s.userByGoogle('g-123')?.id === 'bob0000001')
  check('sessions and magic links survive', s.session('hash1')?.userId === 'alice00001' && s.magic('m1')?.email === 'x@example.com')
  check('cloud saves keep their JSON', JSON.stringify(s.save('alice00001')?.data) === '{"elo":1700,"nested":{"ok":true}}')
  check('rated games survive, newest first per player', s.gamesOf('bob0000001', 5)[0]?.moves.join() === 'e2e4,e7e5' && s.gamesOf('bob0000001', 5)[0]?.ratingChange.b === -8)
  check('mode ratings survive (and default to 1200)', s.modeRating('alice00001', 'cards').rating === 1333 && s.modeRating('alice00001', 'royale').rating === 1200)
  check('clans keep their member order', s.clan('clan1')?.members.join() === 'alice00001,bob0000001' && s.clanOf('bob0000001')?.tag === 'KN' && s.clanByTag('KN')?.id === 'clan1')
  check('the clan war survives', s.clanWar(Date.UTC(2026, 9, 20)).points.clan1 === 3)
  check('the season survives', s.seasonCurrent() === '2026-10' && s.seasonRow('alice00001')?.wins === 1 && s.seasonTable(10)[0]?.user.id === 'alice00001')
  check('the tournament survives', s.tournament()?.entrants[0]?.id === 'alice00001')
  check('the database is in WAL mode', s.db.pragma('journal_mode', { simple: true }) === 'wal')
  check('the schema version is recorded', (s.db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() as { value: string }).value === String(SCHEMA_VERSION))

  // Constraints and transactions.
  check('two accounts cannot share an email', threw(() => s.putUser(user('carol00001', { email: 'alice00001@example.com' }))))
  check('a session must belong to a real user', threw(() => s.putSession('h2', { userId: 'nobody', expiresAt: 1 })))
  check('two clans cannot share a tag', threw(() => s.putClan({ id: 'clan2', name: 'Other', tag: 'KN', ownerId: 'x', members: [], createdAt: 1 })))
  check('a user is in one clan at most (joining moves them)', (s.putClan({ id: 'clan3', name: 'Rooks', tag: 'RK', ownerId: 'bob0000001', members: ['bob0000001'], createdAt: 2 }), s.clanOf('bob0000001')?.id === 'clan3'))
  const failed = threw(() =>
    s.transaction(() => {
      s.putUser(user('dave000001'))
      throw new Error('boom')
    }),
  )
  check('a failed transaction writes nothing', failed && s.user('dave000001') === null)
  check('magic links are single use', s.takeMagic('m1')?.email === 'x@example.com' && s.takeMagic('m1') === null)
  s.sweep(20_000)
  check('expired sessions are swept', s.session('hash1') === null)
  s.dropClan('clan1')
  check('dropping a clan removes its members and war points', s.clan('clan1') === null && s.clanOf('alice00001') === null && s.clanWar(Date.UTC(2026, 9, 20)).points.clan1 === undefined)
  // A new month archives the season.
  s.rollSeason(Date.UTC(2026, 10, 2))
  check('a new season archives standings and softly resets', s.seasonHistory('alice00001')[0]?.season === '2026-10' && s.user('alice00001')!.rating === 1500)
  check('the database answers', s.healthy())

  // Backups: a consistent copy that opens on its own; old ones pruned.
  const backups = join(dir, 'backups')
  mkdirSync(backups, { recursive: true })
  for (const name of ['chess-20200101-000000.db', 'chess-20200102-000000.db', 'chess-20200103-000000.db']) writeFileSync(join(backups, name), '')
  writeFileSync(join(backups, 'keep-me.txt'), 'x')
  const copy = await backupNow(s, backups, 2, Date.UTC(2026, 9, 20, 18))
  check('backup file names sort by time', backupName(Date.UTC(2026, 9, 20, 18)) === 'chess-20261020-180000.db' && copy.endsWith('chess-20261020-180000.db'))
  const left = readdirSync(backups).sort()
  check('only the newest backups are kept (other files untouched)', left.join() === 'chess-20200103-000000.db,chess-20261020-180000.db,keep-me.txt', left.join())
  const restored = new Store(copy)
  check('a backup opens as a full database', restored.user('alice00001')?.name === 'alice00001' && restored.gamesOf('alice00001', 5).length === 1)
  restored.close()
  s.close()
}
{
  // A database from a newer server is refused rather than damaged.
  const newer = join(dir, 'newer.db')
  new Store(newer).close()
  const raw = new Database(newer)
  raw.prepare("UPDATE meta SET value = '99' WHERE key = 'schema'").run()
  raw.close()
  check('a database from a newer server is refused', threw(() => new Store(newer)))
}

{
  // A 6.15 database (schema 1) is upgraded in place: replay columns are added, nothing is lost.
  const v1 = join(dir, 'v1.db')
  const raw = new Database(v1)
  raw.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO meta VALUES ('schema', '1');
    CREATE TABLE games (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, pool TEXT NOT NULL, white TEXT NOT NULL, black TEXT NOT NULL, winner TEXT, reason TEXT NOT NULL, moves TEXT NOT NULL, change_w INTEGER NOT NULL, change_b INTEGER NOT NULL, ended_at INTEGER NOT NULL);
    CREATE TABLE royale_games (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, seats TEXT NOT NULL, ranking TEXT NOT NULL, reason TEXT NOT NULL, plies INTEGER NOT NULL, changes TEXT NOT NULL, ended_at INTEGER NOT NULL);
    INSERT INTO games (id, pool, white, black, winner, reason, moves, change_w, change_b, ended_at) VALUES ('old0000001', '5+3', 'a', 'b', 'w', 'resign', '["e2e4"]', 5, -5, 1);`)
  raw.close()
  const up = new Store(v1)
  const cols = (t: string) => (up.db.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>).map((c) => c.name)
  check('a schema-1 database is upgraded to schema 2 in place', (up.db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() as { value: string }).value === '2' && cols('games').includes('extra') && cols('royale_games').includes('actions'))
  check('…keeping its games', up.game('old0000001')?.moves.join() === 'e2e4' && up.game('old0000001')?.extra === undefined)
  up.putLive('live000001', 'chess', { a: 1 }, 5)
  check('games in progress are stored and listed by kind', up.liveGames('chess')[0]?.id === 'live000001' && up.liveGames('cards').length === 0)
  up.dropLive('live000001')
  up.close()
}

// ── Importing the JSON data file of earlier versions ────────────────────────
{
  const legacy: LegacyDb = {
    version: 1,
    users: { u1: user('u1aaaaaaaa', { id: 'u1' }), u2: user('u2', { email: null, googleSub: 'g2', rating: 1720 }) },
    sessions: { s1: { userId: 'u1', expiresAt: 99 }, orphan: { userId: 'gone', expiresAt: 99 } },
    magic: { m: { email: 'a@b.co', expiresAt: 99 } },
    saves: { u1: { data: { coins: 5 }, updatedAt: 7 } },
    games: [{ id: 'g1', pool: '3+2', white: 'u1', black: 'u2', winner: null, reason: 'agreement', moves: ['d2d4'], ratingChange: { w: 0, b: 0 }, endedAt: 3 }],
    seasons: { current: '2026-09', rows: { u1: { games: 2, wins: 1, peak: 1550 } }, history: { u2: [{ season: '2026-08', rating: 1700, tier: 'platinum', rank: 1, games: 9 }] } },
    tournament: { id: 'tX', name: 'Weekly Knockout', startsAt: 5, pool: '5+3', status: 'done', entrants: [], rounds: [], champion: 'u2', finishedAt: 6, previous: null },
    clans: { c1: { id: 'c1', name: 'Old Guard', tag: 'OG', ownerId: 'u2', members: ['u2', 'u1'], createdAt: 1 } },
    clanWar: { week: '2026-W39', points: { c1: 12 }, last: { week: '2026-W38', points: { c1: 4 } } },
  }
  const json = join(dir, 'db.json')
  writeFileSync(json, JSON.stringify(legacy))
  const s = new Store(join(dir, 'imported.db'))
  const out = s.importLegacyFile(json)
  check('the old JSON file is imported', out?.users === 2 && out.games === 1 && out.clans === 1)
  check('accounts, sessions and saves come across', s.user('u2')?.rating === 1720 && s.session('s1')?.userId === 'u1' && s.session('orphan') === null && JSON.stringify(s.save('u1')?.data) === '{"coins":5}')
  check('games, seasons and history come across', s.gamesOf('u1', 5)[0]?.reason === 'agreement' && s.seasonCurrent() === '2026-09' && s.seasonRow('u1')?.peak === 1550 && s.seasonHistory('u2')[0]?.tier === 'platinum')
  check('the tournament and clans come across', s.tournament()?.champion === 'u2' && s.clan('c1')?.members.join() === 'u2,u1' && s.clanOf('u1')?.tag === 'OG')
  check('the clan war table comes across', s.clanWar(Date.UTC(2026, 8, 24)).points.c1 === 12)
  check('the old file is renamed so it is never imported twice', !existsSync(json) && existsSync(`${json}.imported`))
  writeFileSync(json, JSON.stringify(legacy))
  check('a database that already has data is never overwritten by an import', s.importLegacyFile(json) === null && existsSync(json))
  check('a file that isn’t ours is refused', threw(() => new Store(null).importLegacy({ hello: 'world' })))
  s.close()
}

// ── Settings ────────────────────────────────────────────────────────────────
{
  const dev = loadConfig({}, [])
  check('development: SQLite in server-data, no backups, no proxy', dev.dataFile?.endsWith(join('server-data', 'chess.db')) === true && dev.backupDir === null && dev.trustProxy === 0 && dev.legacyDataFile?.endsWith(join('server-data', 'db.json')) === true)
  const old = loadConfig({ DATA_FILE: 'data/my.json' }, [])
  check('an old DATA_FILE=*.json setting keeps working (imported next to it)', old.dataFile?.endsWith(join('data', 'my.db')) === true && old.legacyDataFile?.endsWith(join('data', 'my.json')) === true)
  check('in memory for tests', loadConfig({ DATA_FILE: ':memory:' }, []).dataFile === null)
  const prod = loadConfig({ NODE_ENV: 'production', PUBLIC_URL: 'https://chess.example.com/', SMTP_URL: 'smtp://x', DATABASE_FILE: '/var/lib/chess/chess.db' }, [])
  check('production: daily backups next to the database, one proxy trusted', prod.production && prod.backupDir === join('/var/lib/chess', 'backups') && prod.backupHours === 24 && prod.trustProxy === 1 && prod.publicUrl === 'https://chess.example.com')
  check('production needs PUBLIC_URL and a sign-in method', threw(() => loadConfig({ NODE_ENV: 'production' }, [])) && threw(() => loadConfig({ NODE_ENV: 'production', PUBLIC_URL: 'https://x.com' }, [])))
  check('PUBLIC_URL must be an origin', threw(() => loadConfig({ NODE_ENV: 'production', PUBLIC_URL: 'https://x.com/app', SMTP_URL: 'smtp://mail.example.com' }, [])))
  check('bad numbers fall back to defaults', loadConfig({ PORT: 'abc', SESSION_DAYS: '9999', BACKUP_KEEP: '0' }, []).port === 8787 && loadConfig({ SESSION_DAYS: '9999' }, []).sessionDays === 30)
  check('a malformed SMTP_URL stops the server at start-up', threw(() => loadConfig({ SMTP_URL: 'mail.example.com' }, [])) && !threw(() => loadConfig({ SMTP_URL: 'smtps://u:p@mail.example.com:465' }, [])))
  const warn = configWarnings(loadConfig({ NODE_ENV: 'production', PUBLIC_URL: 'http://chess.example.com', SMTP_URL: 'smtp://mail.example.com', GOOGLE_CLIENT_ID: 'nonsense', BACKUP_DIR: 'off' }, []))
  check('likely mistakes are warned about: plain http, a malformed Google id, localhost mail, no backups', warn.length === 4 && warn.some((w) => w.includes('http')) && warn.some((w) => w.includes('GOOGLE')) && warn.some((w) => w.includes('MAIL_FROM')) && warn.some((w) => w.includes('backups')))
  check('a clean production setup has no warnings', configWarnings(loadConfig({ NODE_ENV: 'production', PUBLIC_URL: 'https://chess.example.com', SMTP_URL: 'smtp://mail.example.com', MAIL_FROM: 'Chess <hi@chess.example.com>', GOOGLE_CLIENT_ID: '1-abc.apps.googleusercontent.com' }, [])).length === 0)
  check('backups can be switched off', loadConfig({ NODE_ENV: 'production', PUBLIC_URL: 'https://x.com', SMTP_URL: 'smtp://mail.example.com', BACKUP_DIR: 'off' }, []).backupDir === null)
}

// ── The watchdog: a server that lost its database restarts itself ──────────
{
  const queue: Array<() => void> = []
  const run = () => queue.shift()?.()
  let answers = [true, false, false, true, false, false, false]
  let dead: string | null = null
  const stop = startWatchdog({ healthy: () => answers.shift() ?? false, onDead: (why) => (dead = why), setTimer: (fn) => queue.push(fn), clearTimer: () => {}, failures: 3 })
  for (let i = 0; i < 6; i++) run()
  check('two failed checks are tolerated (a recovery resets the count)', dead === null)
  run()
  check('three failed checks in a row: the process gives up so its supervisor restarts it', dead !== null && queue.length === 0)
  stop()
  answers = [false, false, false]
  dead = null
  const stop2 = startWatchdog({ healthy: () => answers.shift() ?? false, onDead: (why) => (dead = why), setTimer: (fn) => queue.push(fn), clearTimer: () => {}, failures: 3 })
  stop2()
  run()
  check('a stopped watchdog does nothing', dead === null)
}

// ── The production HTTP layer ───────────────────────────────────────────────
{
  const client = join(dir, 'dist')
  mkdirSync(join(client, 'assets'), { recursive: true })
  mkdirSync(join(client, 'stockfish'), { recursive: true })
  writeFileSync(join(client, 'index.html'), '<!doctype html><html><head><script>window.boot = 1</script><script type="module" src="/assets/app.js"></script></head><body></body></html>')
  writeFileSync(join(client, 'assets', 'app-abc123.js'), 'console.log(1)'.repeat(200))
  writeFileSync(join(client, 'stockfish', 'sf.js'), '//')
  const store = new Store(null)
  const config = { ...loadConfig({ NODE_ENV: 'production', PUBLIC_URL: 'https://chess.example.com', SMTP_URL: 'smtp://x', DATA_FILE: ':memory:', CLIENT_DIR: client }, []), port: 0 }
  const app = createApp({ config, store, mailer: async () => {}, google: null, log: () => {} })
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()))
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
  const page = await fetch(`${base}/some/route`)
  const csp = page.headers.get('content-security-policy') ?? ''
  check('the app is served for any route', page.status === 200 && (await page.text()).includes('window.boot'))
  check('a Content-Security-Policy allows our scripts, WebAssembly and Google Sign-In', csp.includes("script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client") && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"))
  check('the inline boot script is allowed by its hash only', /'sha256-[A-Za-z0-9+/=]{44}'/.test(csp) && !csp.includes("script-src 'self' 'unsafe-inline'"))
  check('HSTS, nosniff, no referrer, no framing', page.headers.get('strict-transport-security')?.includes('max-age=31536000') === true && page.headers.get('x-content-type-options') === 'nosniff' && page.headers.get('referrer-policy') === 'no-referrer' && page.headers.get('x-frame-options') === 'DENY')
  check('the page itself is always revalidated', page.headers.get('cache-control') === 'no-cache')
  const asset = await fetch(`${base}/assets/app-abc123.js`, { headers: { 'accept-encoding': 'gzip' } })
  check('hashed assets are cached for a year', asset.headers.get('cache-control') === 'public, max-age=31536000, immutable')
  check('responses are compressed', asset.headers.get('content-encoding') === 'gzip')
  check('the engine files are cached for a week', (await fetch(`${base}/stockfish/sf.js`)).headers.get('cache-control') === 'public, max-age=604800')
  const health = await fetch(`${base}/api/health`)
  const h = (await health.json()) as { ok: boolean; db: boolean; modes: { cards: number; royale: number } }
  check('the health check reports the database and the live modes', health.status === 200 && h.ok && h.db && h.modes.cards === 0)
  const modes = (await (await fetch(`${base}/api/modes`)).json()) as { mine: unknown; tables: Record<string, unknown[]> }
  check('the mode tables are public; your ratings need a sign-in', modes.mine === null && Array.isArray(modes.tables.vanish) && Array.isArray(modes.tables.cards) && Array.isArray(modes.tables.royale))
  const cross = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' })
  check('changes from another site are refused', cross.status === 403)
  const unknown = await fetch(`${base}/api/nothing`)
  check('unknown API routes are JSON 404s, not the app', unknown.status === 404 && (unknown.headers.get('content-type') ?? '').includes('json'))
  await app.close()
  store.close()
}

rmSync(dir, { recursive: true, force: true })
if (failures > 0) {
  console.error(`\n${failures} storage check(s) failed.`)
  process.exit(1)
}
console.log('\nAll storage checks passed.')
