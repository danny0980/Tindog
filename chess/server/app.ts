// The game server: a small JSON API (sign-in, account, cloud saves, rated
// games, leaderboard) and the /ws WebSocket for ranked play. In production it
// also serves the built app, so the cookie, the API and the socket share one
// origin.
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { join } from 'node:path'
import compression from 'compression'
import express, { type NextFunction, type Request, type Response } from 'express'
import { WebSocketServer, type WebSocket } from 'ws'
import { Auth, type GoogleVerifier, RateLimiter, SESSION_COOKIE, cleanDisplayName, normaliseEmail } from './auth'
import type { Config } from './config'
import { MAX_MEMBERS, cleanClanName, cleanTag } from './clans'
import { Hub } from './hub'
import { TIERS, seasonEnd, tierFor } from './seasons'
import { tournamentStandings } from './bracket'
import { TournamentManager } from './tournaments'
import type { Mailer } from './mailer'
import { RATED_MODES, type RatedMode, type Store, type User } from './store'

export interface AppDeps {
  config: Config
  store: Store
  mailer: Mailer
  /** null when Google sign-in isn't configured. */
  google: GoogleVerifier | null
  now?: () => number
  log?: (line: string) => void
  /** Overrides for tests (fast grace periods, pairing). */
  hub?: { graceMs?: number; pairEveryMs?: number; restoreGraceMs?: number }
  /** After a restart, how long tournament players get to reconnect (tests). */
  tournamentResumeGraceMs?: number
  /** When the first weekly tournament starts (tests). */
  tournamentStartsAt?: number
}

export interface Running {
  server: Server
  hub: Hub
  tournaments: TournamentManager
  auth: Auth
  close: () => Promise<void>
}

/** Cloud saves above this are refused (a full profile is a few tens of kB). */
const MAX_SAVE_BYTES = 1_000_000

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

const newClanId = (): string => `c${randomBytes(9).toString('hex')}`

const SEAT_COLORS = ['Red', 'Blue', 'Yellow', 'Green'] as const

/** Who else sat at a Battle Royale table: "2 players + 1 computer army". */
function royaleOpponents(seats: ReadonlyArray<string | null>, me: string): string {
  const people = seats.filter((s) => s !== null && s !== me).length
  const bots = seats.filter((s) => s === null).length
  const p = `${people} ${people === 1 ? 'player' : 'players'}`
  return bots === 0 ? p : people === 0 ? `${bots} computer armies` : `${p} + ${bots} computer ${bots === 1 ? 'army' : 'armies'}`
}
const VERSION = process.env.APP_VERSION ?? process.env.npm_package_version ?? 'dev'

/**
 * The Content-Security-Policy for the built app: our own scripts (and the
 * inline boot guard, by hash), WebAssembly for Stockfish, Google Sign-In,
 * Google Fonts, and connections to this server and the PeerJS broker.
 */
export function contentSecurityPolicy(clientDir: string): string {
  let hashes: string[] = []
  try {
    const html = readFileSync(join(clientDir, 'index.html'), 'utf8')
    hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1] ?? '').digest('base64')}'`)
  } catch {
    // No build yet: no inline scripts to allow.
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "connect-src 'self' https: wss:",
    "worker-src 'self' blob:",
    'frame-src https://accounts.google.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, google: u.googleSub !== null, rating: u.rating, games: u.games, wins: u.wins, losses: u.losses, draws: u.draws })

export function createApp(deps: AppDeps): Running {
  const { config, store, mailer, google } = deps
  const now = deps.now ?? Date.now
  const log = deps.log ?? console.log
  const auth = new Auth(store, config.sessionDays, now)
  const hub = new Hub({ store, now, log, ...deps.hub })
  // Games that were being played when the server last stopped come back first, so the tournament can follow them.
  hub.restoreLive()
  const tournaments = new TournamentManager({
    store,
    now,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    startGame: (players, pool, label, onResult) => hub.startGame(players, pool, label, onResult),
    isAvailable: (id) => hub.isAvailable(id),
    attachResult: (gameId, onResult) => hub.attachResultHook(gameId, onResult),
    ...(deps.tournamentResumeGraceMs !== undefined ? { resumeGraceMs: deps.tournamentResumeGraceMs } : {}),
    changed: () => hub.broadcast({ type: 'TOURNAMENT_CHANGED' }),
    log,
    ...(deps.tournamentStartsAt !== undefined ? { firstStartsAt: deps.tournamentStartsAt } : {}),
  })
  // After a restart, a returning player may let a tournament game start.
  hub.onConnect = () => tournaments.playerConnected()
  const perEmail = new RateLimiter(5, 15 * 60_000, now)
  const perIp = new RateLimiter(30, 15 * 60_000, now)
  const allowedOrigin = config.publicUrl ? new URL(config.publicUrl).origin : null
  // Email sign-in needs real email in production; in development the link is printed instead.
  const emailEnabled = config.smtpUrl !== null || !config.production

  /** Only pages from our own origin may make cookie-authenticated changes (CSRF) or open the socket. */
  const originOk = (origin: string | undefined): boolean => {
    if (!origin) return !config.production
    return origin === allowedOrigin || (!config.production && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
  }

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy > 0 ? config.trustProxy : false)
  const csp = config.serveClient ? contentSecurityPolicy(config.serveClient) : null
  const https = config.publicUrl.startsWith('https://')
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    // Sign-in links carry a token in the URL: never leak it through a Referer.
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    // Google Sign-In opens a popup that must be able to talk back.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    if (csp) res.setHeader('Content-Security-Policy', csp)
    if (config.production && https) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    next()
  })
  if (config.production) app.use(compression())
  // A light cap on changes per address (sign-in emails have their own, stricter one).
  const perIpWrites = new RateLimiter(240, 60_000, now)
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && !perIpWrites.take(`w:${req.ip}`)) return void res.status(429).json({ error: 'Too many requests. Slow down a little.' })
    next()
  })
  app.use('/api', express.json({ limit: MAX_SAVE_BYTES + 1024 }))
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && !originOk(req.headers.origin)) return void res.status(403).json({ error: 'Bad origin.' })
    next()
  })

  const sessionToken = (req: Request): string | null => readCookie(req.headers.cookie, SESSION_COOKIE)
  const signedIn = (req: Request): User | null => auth.userFor(sessionToken(req))
  const requireUser = (req: Request, res: Response): User | null => {
    const user = signedIn(req)
    if (!user) res.status(401).json({ error: 'Please sign in.' })
    return user
  }
  const cookieOptions = (expiresAt: number) => ({ httpOnly: true, sameSite: 'lax' as const, secure: config.production, path: '/', maxAge: expiresAt - now() })
  const setSession = (res: Response, userId: string): void => {
    const s = auth.startSession(userId)
    res.cookie(SESSION_COOKIE, s.token, cookieOptions(s.expiresAt))
  }
  // Sliding sessions: a session in the second half of its life is extended, and its cookie renewed.
  app.use('/api', (req, _res, next) => {
    const t = sessionToken(req)
    const extended = auth.touch(t)
    if (t && extended) _res.cookie(SESSION_COOKIE, t, cookieOptions(extended))
    next()
  })

  // ── Info ──────────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    const db = store.healthy()
    res.status(db ? 200 : 503).json({ ok: db, db, version: VERSION, uptime: Math.round(process.uptime()), ...hub.stats() })
  })
  app.get('/api/config', (_req, res) => void res.json({ google: config.googleClientId, email: emailEnabled, devLinks: config.smtpUrl === null, dev: !config.production }))

  // ── Sign-in ───────────────────────────────────────────────────────────────
  app.post('/api/auth/email', async (req, res) => {
    if (!emailEnabled) return void res.status(404).json({ error: 'Email sign-in is not set up on this server.' })
    const email = normaliseEmail((req.body as { email?: unknown } | undefined)?.email)
    if (!email) return void res.status(400).json({ error: 'Please enter a valid email address.' })
    if (!perIp.take(`ip:${req.ip}`) || !perEmail.take(`email:${email}`)) return void res.status(429).json({ error: 'Too many sign-in emails. Try again in a few minutes.' })
    // In development the link opens the dev server the request came from (whatever port Vite chose).
    const origin = req.headers.origin
    const base = !config.production && origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : config.publicUrl
    const link = `${base}/?signin=${auth.createMagicLink(email)}`
    try {
      await mailer(email, link)
    } catch (err) {
      log(`mail to ${email} failed: ${err instanceof Error ? err.message : String(err)}`)
      return void res.status(502).json({ error: 'We could not send the email. Please try again.' })
    }
    // Same answer whether or not the account exists.
    res.json({ sent: true })
  })

  app.post('/api/auth/email/verify', (req, res) => {
    const user = auth.redeemMagicLink((req.body as { token?: unknown } | undefined)?.token)
    if (!user) return void res.status(400).json({ error: 'That sign-in link has expired or was already used. Please request a new one.' })
    setSession(res, user.id)
    res.json({ user: publicUser(user) })
  })

  app.post('/api/auth/google', async (req, res) => {
    if (!google) return void res.status(404).json({ error: 'Google sign-in is not set up on this server.' })
    const credential = (req.body as { credential?: unknown } | undefined)?.credential
    if (typeof credential !== 'string' || credential.length > 4096) return void res.status(400).json({ error: 'Missing Google credential.' })
    const identity = await google(credential)
    if (!identity) return void res.status(401).json({ error: 'Google sign-in failed. Please try again.' })
    const user = auth.googleUser(identity)
    setSession(res, user.id)
    res.json({ user: publicUser(user) })
  })

  app.post('/api/auth/logout', (req, res) => {
    auth.endSession(sessionToken(req))
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    res.json({ ok: true })
  })

  // ── Account ───────────────────────────────────────────────────────────────
  // Who is signed in (null when nobody is: asking isn't an error).
  app.get('/api/me', (req, res) => {
    const user = signedIn(req)
    res.json({ user: user ? publicUser(user) : null })
  })

  app.patch('/api/me', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const name = cleanDisplayName((req.body as { name?: unknown } | undefined)?.name, '')
    if (!name) return void res.status(400).json({ error: 'Names are 2–20 characters.' })
    res.json({ user: publicUser(store.putUser({ ...user, name })) })
  })

  // ── Cloud save ────────────────────────────────────────────────────────────
  app.get('/api/save', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    // No cloud save yet is a normal answer for a new account.
    res.json(store.save(user.id) ?? { data: null, updatedAt: null })
  })

  app.put('/api/save', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const body = req.body as { data?: unknown; baseUpdatedAt?: unknown } | undefined
    const data = body?.data
    if (typeof data !== 'object' || data === null) return void res.status(400).json({ error: 'Nothing to save.' })
    if (JSON.stringify(data).length > MAX_SAVE_BYTES) return void res.status(413).json({ error: 'Save is too large.' })
    // Another device saved since this one last synced: refuse, and send the newer save so the player can choose.
    // (`baseUpdatedAt` = the cloud save this device started from; null = it had none. Left out = overwrite, as before 6.16.)
    if ('baseUpdatedAt' in (body ?? {})) {
      const base = body?.baseUpdatedAt
      if (base !== null && typeof base !== 'number') return void res.status(400).json({ error: 'Bad save version.' })
      const current = store.save(user.id)
      if (current && current.updatedAt !== base) return void res.status(409).json({ error: 'Another device saved newer progress.', cloud: current })
    }
    const updatedAt = now()
    store.putSave(user.id, { data, updatedAt })
    res.json({ updatedAt })
  })

  // ── Rated games ───────────────────────────────────────────────────────────
  app.get('/api/games', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const games = store.gamesOf(user.id, 20).map((g) => {
      const side = g.white === user.id ? 'w' : 'b'
      const opp = store.user(side === 'w' ? g.black : g.white)
      return { id: g.id, pool: g.pool, color: side, opponent: opp?.name ?? 'Player', result: g.winner === null ? 'draw' : g.winner === side ? 'win' : 'loss', reason: g.reason, ratingChange: g.ratingChange[side], moves: g.moves.length, endedAt: g.endedAt }
    })
    res.json({ games })
  })

  // ── Crash reports from browsers (logged, a few per address) ───────────────
  const perIpReports = new RateLimiter(20, 10 * 60_000, now)
  app.post('/api/client-error', (req, res) => {
    if (!perIpReports.take(`r:${req.ip}`)) return void res.status(429).json({ error: 'Too many reports.' })
    const b = (req.body ?? {}) as Record<string, unknown>
    // oxlint-disable-next-line no-control-regex -- stripping control characters keeps the log readable
    const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').slice(0, max) : '')
    const message = text(b.message, 500)
    if (!message) return void res.status(400).json({ error: 'Nothing to report.' })
    log(`client-error [${text(b.where, 60)}] ${message} @ ${text(b.url, 200)} v${text(b.version, 20)} | ${text(req.headers['user-agent'], 160)}${b.stack ? `\n  ${text(b.stack, 2000).replace(/ {4}at /g, '\n    at ')}` : ''}`)
    res.status(204).end()
  })

  // ── Online game history ───────────────────────────────────────────────────
  const name = (id: string | null) => (id ? (store.user(id)?.name ?? 'Deleted player') : null)
  const kindOf = (pool: string): 'chess' | 'vanish' | 'cards' => (pool.startsWith('vanish-') ? 'vanish' : pool.startsWith('cards-') ? 'cards' : 'chess')
  app.get('/api/history', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const before = Number(req.query.before)
    const cursor = Number.isFinite(before) && before > 0 ? before : Number.MAX_SAFE_INTEGER
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20))
    const two = store.gamesPage(user.id, cursor, limit).map((g) => {
      const side = g.white === user.id ? 'w' : 'b'
      return { id: g.id, kind: kindOf(g.pool), pool: g.pool, opponents: [name(side === 'w' ? g.black : g.white) ?? 'Player'], result: g.reason === 'aborted' ? 'aborted' : g.winner === null ? 'draw' : g.winner === side ? 'win' : 'loss', reason: g.reason, ratingChange: g.ratingChange[side], moves: g.moves.length, place: null, endedAt: g.endedAt }
    })
    const royale = store.royalePage(user.id, cursor, limit).map((r) => {
      const seat = r.seats.indexOf(user.id)
      const place = r.ranking.indexOf(seat) + 1
      return { id: r.id, kind: 'royale', pool: 'royale', opponents: r.seats.flatMap((s, i) => (i === seat ? [] : [name(s) ?? `${SEAT_COLORS[i]} army`])), result: place === 1 ? 'win' : 'loss', reason: r.reason, ratingChange: r.ratingChange[user.id] ?? 0, moves: r.plies, place: place || null, endedAt: r.endedAt }
    })
    const games = [...two, ...royale].sort((a, b) => b.endedAt - a.endedAt).slice(0, limit)
    res.json({ games, next: games.length === limit ? (games.at(-1)?.endedAt ?? null) : null })
  })
  app.get('/api/history/:id', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const id = String(req.params.id)
    const g = store.game(id)
    // Only your own games (a game id is not a secret, but other people's history is theirs).
    if (g && (g.white === user.id || g.black === user.id)) {
      return void res.json({ id: g.id, kind: kindOf(g.pool), pool: g.pool, color: g.white === user.id ? 'w' : 'b', white: name(g.white), black: name(g.black), winner: g.winner, reason: g.reason, moves: g.moves, hands: g.extra?.hands ?? null, ratingChange: g.ratingChange[g.white === user.id ? 'w' : 'b'], endedAt: g.endedAt })
    }
    const r = store.royaleGame(id)
    if (r && r.seats.includes(user.id)) {
      return void res.json({ id: r.id, kind: 'royale', seat: r.seats.indexOf(user.id), seats: r.seats.map((s, i) => name(s) ?? `${SEAT_COLORS[i]} army`), ranking: r.ranking, reason: r.reason, actions: r.actions ?? null, ratingChange: r.ratingChange[user.id] ?? 0, endedAt: r.endedAt })
    }
    res.status(404).json({ error: 'No such game in your history.' })
  })

  // ── Your data: export and account deletion ────────────────────────────────
  app.get('/api/me/export', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    res.setHeader('Content-Disposition', `attachment; filename="chronos-chess-${user.id}.json"`)
    res.json(store.exportUser(user.id))
  })
  app.delete('/api/me', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    if ((req.body as { confirm?: unknown } | undefined)?.confirm !== 'DELETE') return void res.status(400).json({ error: 'Type DELETE to confirm.' })
    if (hub.isPlaying(user.id)) return void res.status(409).json({ error: 'Finish or resign your game in progress first.' })
    // Out of the weekly tournament, the queues and your clan (the clan passes on, or closes when you were the last).
    tournaments.leave(user.id)
    const clan = store.clanOf(user.id)
    if (clan) {
      const members = clan.members.filter((m) => m !== user.id)
      if (members.length === 0) store.dropClan(clan.id)
      else store.putClan({ ...clan, members, ownerId: clan.ownerId === user.id ? members[0]! : clan.ownerId })
    }
    hub.kick(user.id)
    auth.endAllSessions(user.id)
    store.deleteUser(user.id)
    log(`account ${user.id} deleted`)
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    res.json({ deleted: true })
  })

  // ── Community: global stats, champions, top players, public profiles ─────
  app.get('/api/community', (_req, res) => {
    const war = store.clanWar(now())
    const titles = [...store.titles().entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    res.json({
      stats: store.communityStats(now()),
      live: hub.stats(),
      season: { id: store.seasonCurrent() || null, endsAt: store.seasonCurrent() ? seasonEnd(store.seasonCurrent()) : null },
      top: {
        chess: store.leaderboard(10).map((u) => ({ id: u.id, name: u.name, rating: u.rating, games: u.games })),
        ...Object.fromEntries(RATED_MODES.map((m) => [m, store.modeLeaderboard(m, 10).map((r) => ({ id: r.id, name: r.name, rating: r.rating, games: r.games }))])),
      },
      champions: store
        .pastTournaments(10)
        .filter((t) => t.champion)
        .map((t) => ({ id: t.id, name: t.name, finishedAt: t.finishedAt, players: t.entrants.length, champion: pub(t.champion) })),
      titles: titles.map(([id, n]) => ({ player: pub(id), titles: n })).filter((t) => t.player !== null),
      clans: store
        .clans()
        .map((c) => ({ id: c.id, name: c.name, tag: c.tag, members: c.members.length, points: war.points[c.id] ?? 0 }))
        .sort((a, b) => b.points - a.points || b.members - a.members)
        .slice(0, 10),
    })
  })
  app.get('/api/players/:id', (req, res) => {
    const u = store.user(String(req.params.id))
    if (!u) return void res.status(404).json({ error: 'No such player.' })
    const clan = store.clanOf(u.id)
    const recent = [...store.gamesPage(u.id, Number.MAX_SAFE_INTEGER, 10).map((g) => {
      const side = g.white === u.id ? 'w' : 'b'
      return { kind: kindOf(g.pool), pool: g.pool, opponent: name(side === 'w' ? g.black : g.white) ?? 'Player', result: g.reason === 'aborted' ? 'aborted' : g.winner === null ? 'draw' : g.winner === side ? 'win' : 'loss', endedAt: g.endedAt }
    }), ...store.royalePage(u.id, Number.MAX_SAFE_INTEGER, 10).map((r) => {
      const place = r.ranking.indexOf(r.seats.indexOf(u.id)) + 1
      return { kind: 'royale' as const, pool: 'royale', opponent: royaleOpponents(r.seats, u.id), result: place === 1 ? 'win' : 'loss', endedAt: r.endedAt }
    })].sort((a, b) => b.endedAt - a.endedAt).slice(0, 10)
    const titleList = store.pastTournaments(100_000).filter((t) => t.champion === u.id).map((t) => ({ id: t.id, finishedAt: t.finishedAt, players: t.entrants.length }))
    res.json({
      id: u.id,
      name: u.name,
      memberSince: u.createdAt,
      rating: u.rating,
      tier: tierFor(u.rating).id,
      record: { games: u.games, wins: u.wins, losses: u.losses, draws: u.draws },
      modes: Object.fromEntries(RATED_MODES.map((m) => [m, store.modeRating(u.id, m)])),
      season: { row: store.seasonRow(u.id), rank: store.seasonRank(u.id), history: store.seasonHistory(u.id).slice(0, 6) },
      clan: clan ? { id: clan.id, name: clan.name, tag: clan.tag } : null,
      titles: titleList,
      recent,
      online: hub.isOnline(u.id),
    })
  })

  app.get('/api/leaderboard', (_req, res) => void res.json({ players: store.leaderboard(50).map((u) => ({ id: u.id, name: u.name, rating: u.rating, games: u.games })) }))

  // ── Online modes: your ratings and the tables ─────────────────────────────
  app.get('/api/modes', (req, res) => {
    const user = signedIn(req)
    const table = (mode: RatedMode) => store.modeLeaderboard(mode, 20).map((r) => ({ id: r.id, name: r.name, rating: r.rating, games: r.games, wins: r.wins }))
    res.json({
      mine: user ? Object.fromEntries(RATED_MODES.map((m) => [m, store.modeRating(user.id, m)])) : null,
      tables: Object.fromEntries(RATED_MODES.map((m) => [m, table(m)])),
    })
  })

  // ── Watch: live games ─────────────────────────────────────────────────────
  app.get('/api/live', (_req, res) => void res.json({ games: hub.liveGames() }))

  // ── Seasons ───────────────────────────────────────────────────────────────
  app.get('/api/season', (req, res) => {
    store.rollSeason(now())
    const season = store.seasonCurrent()
    const table = store.seasonTable(50).map(({ user, row }) => ({ id: user.id, name: user.name, rating: user.rating, tier: tierFor(user.rating).id, games: row.games, wins: row.wins }))
    const user = signedIn(req)
    const row = user ? store.seasonRow(user.id) : null
    const rank = user ? store.seasonRank(user.id) : null
    res.json({
      season,
      endsAt: seasonEnd(season),
      tiers: TIERS.map((t) => ({ id: t.id, name: t.name, min: t.min })),
      table,
      me: user ? { rating: user.rating, tier: tierFor(user.rating).id, games: row?.games ?? 0, wins: row?.wins ?? 0, peak: row?.peak ?? user.rating, rank: rank || null } : null,
      history: user ? store.seasonHistory(user.id) : [],
    })
  })

  // ── Weekly tournament ─────────────────────────────────────────────────────
  const pub = (id: string | null) => {
    const u = id ? store.user(id) : null
    return u ? { id: u.id, name: u.name, rating: u.rating } : null
  }
  app.get('/api/tournament', (req, res) => {
    const t = tournaments.state
    const user = signedIn(req)
    res.json({
      id: t.id,
      name: t.name,
      startsAt: t.startsAt,
      pool: t.pool,
      status: t.status,
      entrants: t.entrants.map((e) => pub(e.id)).filter((p) => p !== null),
      joined: user ? t.entrants.some((e) => e.id === user.id) : false,
      rounds: t.rounds.map((r) => r.map((m) => ({ a: pub(m.a), b: pub(m.b), winner: m.winner === null ? null : m.winner === m.a ? 'a' : 'b', gameId: m.winner ? null : m.gameId }))),
      champion: pub(t.champion),
      standings: tournamentStandings(t).map((s) => ({ ...s, player: pub(s.id) })).filter((s) => s.player !== null),
      previous: t.previous ? { champion: pub(t.previous.champion), players: t.previous.players, finishedAt: t.previous.finishedAt } : null,
    })
  })
  app.post('/api/tournament/join', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const refused = tournaments.join(user.id, user.rating)
    if (refused) return void res.status(409).json({ error: refused })
    res.json({ ok: true })
  })
  app.post('/api/tournament/leave', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    tournaments.leave(user.id)
    res.json({ ok: true })
  })
  // Development only: start the tournament now (to try it without waiting for Saturday).
  app.post('/api/tournament/start', (req, res) => {
    if (config.production) return void res.status(404).json({ error: 'Not found.' })
    if (!requireUser(req, res)) return
    tournaments.start()
    res.json({ ok: true })
  })

  // ── Clans & the weekly clan war ───────────────────────────────────────────
  app.get('/api/clans', (req, res) => {
    const war = store.clanWar(now())
    const user = signedIn(req)
    const table = store
      .clans()
      .map((c) => ({ id: c.id, name: c.name, tag: c.tag, members: c.members.length, points: war.points[c.id] ?? 0 }))
      .sort((a, b) => b.points - a.points || b.members - a.members || a.name.localeCompare(b.name))
      .slice(0, 50)
    const lastWinner = war.last ? Object.entries(war.last.points).sort((a, b) => b[1] - a[1])[0] : undefined
    const lastClan = lastWinner ? store.clan(lastWinner[0]) : null
    res.json({ week: war.week, table, last: war.last ? { week: war.last.week, winner: lastClan ? { name: lastClan.name, tag: lastClan.tag, points: lastWinner![1] } : null } : null, mine: user ? (store.clanOf(user.id)?.id ?? null) : null })
  })
  app.get('/api/clans/:id', (req, res) => {
    const c = store.clan(String(req.params.id))
    if (!c) return void res.status(404).json({ error: 'No such clan.' })
    const war = store.clanWar(now())
    res.json({ id: c.id, name: c.name, tag: c.tag, owner: pub(c.ownerId)?.name ?? '', points: war.points[c.id] ?? 0, members: c.members.map((m) => pub(m)).filter((p) => p !== null).sort((a, b) => b.rating - a.rating) })
  })
  app.post('/api/clans', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    if (store.clanOf(user.id)) return void res.status(409).json({ error: 'Leave your clan first.' })
    const body = req.body as { name?: unknown; tag?: unknown } | undefined
    const name = cleanClanName(body?.name)
    const tag = cleanTag(body?.tag)
    if (!name || !tag) return void res.status(400).json({ error: 'Names are 3–24 characters; tags 2–5 letters or digits.' })
    if (store.clanByTag(tag) || store.clans().some((c) => c.name.toLowerCase() === name.toLowerCase())) return void res.status(409).json({ error: 'That clan name or tag is taken.' })
    const clan = store.putClan({ id: newClanId(), name, tag, ownerId: user.id, members: [user.id], createdAt: now() })
    res.json({ id: clan.id })
  })
  app.post('/api/clans/:id/join', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const c = store.clan(String(req.params.id))
    if (!c) return void res.status(404).json({ error: 'No such clan.' })
    if (store.clanOf(user.id)) return void res.status(409).json({ error: 'Leave your clan first.' })
    if (c.members.length >= MAX_MEMBERS) return void res.status(409).json({ error: `That clan is full (${MAX_MEMBERS} members).` })
    store.putClan({ ...c, members: [...c.members, user.id] })
    res.json({ ok: true })
  })
  app.post('/api/clans/leave', (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    const c = store.clanOf(user.id)
    if (!c) return void res.json({ ok: true })
    const members = c.members.filter((m) => m !== user.id)
    if (members.length === 0) store.dropClan(c.id)
    else store.putClan({ ...c, members, ownerId: c.ownerId === user.id ? members[0]! : c.ownerId })
    res.json({ ok: true })
  })

  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found.' }))

  // ── The built app (production) ────────────────────────────────────────────
  if (config.serveClient && existsSync(config.serveClient)) {
    const dir = config.serveClient
    // Hashed build files never change: cache them for a year. Everything else is checked each time.
    app.use(
      express.static(dir, {
        index: false,
        setHeaders: (res, path) => {
          const rel = path.slice(dir.length).replace(/\\/g, '/')
          res.setHeader('Cache-Control', rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : rel.startsWith('/stockfish/') ? 'public, max-age=604800' : 'no-cache')
        },
      }),
    )
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(join(dir, 'index.html'))
    })
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number' ? err.status : 500
    if (status >= 500) log(`error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`)
    res.status(status).json({ error: status === 413 ? 'Request too large.' : status >= 500 ? 'Server error.' : 'Bad request.' })
  })

  // ── WebSocket: ranked play ────────────────────────────────────────────────
  const server = createServer(app)
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 })
  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const path = (req.url ?? '').split('?')[0]
    const user = path === '/ws' && originOk(req.headers.origin) ? auth.userFor(readCookie(req.headers.cookie, SESSION_COOKIE)) : null
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => attach(ws, user))
  })

  const alive = new WeakMap<WebSocket, boolean>()
  function attach(ws: WebSocket, user: User): void {
    const conn = { send: (text: string) => ws.readyState === ws.OPEN && ws.send(text), close: (code?: number, reason?: string) => ws.close(code, reason) }
    alive.set(ws, true)
    ws.on('pong', () => alive.set(ws, true))
    ws.on('message', (data, isBinary) => {
      if (isBinary) return conn.close(1003, 'Text only')
      hub.message(user.id, conn, data.toString())
    })
    ws.on('close', () => hub.disconnect(user.id, conn))
    ws.on('error', () => ws.terminate())
    hub.connect(user, conn)
  }
  // Drop sockets that stopped answering pings (sleeping laptops, dead networks).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate()
        continue
      }
      alive.set(ws, false)
      ws.ping()
    }
  }, 30_000)
  const sweep = setInterval(() => store.sweep(now()), 60 * 60_000)

  return {
    server,
    hub,
    tournaments,
    auth,
    close: () =>
      new Promise((resolve) => {
        clearInterval(heartbeat)
        clearInterval(sweep)
        hub.close()
        tournaments.close()
        for (const ws of wss.clients) ws.terminate()
        wss.close()
        server.close(() => {
          store.flush()
          resolve()
        })
        server.closeAllConnections()
      }),
  }
}
