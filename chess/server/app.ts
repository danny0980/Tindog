// The game server: a small JSON API (sign-in, account, cloud saves, rated
// games, leaderboard) and the /ws WebSocket for ranked play. In production it
// also serves the built app, so the cookie, the API and the socket share one
// origin.
import { existsSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { join } from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import { WebSocketServer, type WebSocket } from 'ws'
import { Auth, type GoogleVerifier, RateLimiter, SESSION_COOKIE, cleanDisplayName, normaliseEmail } from './auth'
import type { Config } from './config'
import { Hub } from './hub'
import type { Mailer } from './mailer'
import type { Store, User } from './store'

export interface AppDeps {
  config: Config
  store: Store
  mailer: Mailer
  /** null when Google sign-in isn't configured. */
  google: GoogleVerifier | null
  now?: () => number
  log?: (line: string) => void
  /** Overrides for tests (fast grace periods, pairing). */
  hub?: { graceMs?: number; pairEveryMs?: number }
}

export interface Running {
  server: Server
  hub: Hub
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

const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, google: u.googleSub !== null, rating: u.rating, games: u.games, wins: u.wins, losses: u.losses, draws: u.draws })

export function createApp(deps: AppDeps): Running {
  const { config, store, mailer, google } = deps
  const now = deps.now ?? Date.now
  const log = deps.log ?? console.log
  const auth = new Auth(store, config.sessionDays, now)
  const hub = new Hub({ store, now, log, ...deps.hub })
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
  app.set('trust proxy', config.production ? 1 : false)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    // Sign-in links carry a token in the URL: never leak it through a Referer.
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
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
  const setSession = (res: Response, userId: string): void => {
    const s = auth.startSession(userId)
    res.cookie(SESSION_COOKIE, s.token, { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/', maxAge: s.expiresAt - now() })
  }

  // ── Info ──────────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => void res.json({ ok: true, ...hub.stats() }))
  app.get('/api/config', (_req, res) => void res.json({ google: config.googleClientId, email: emailEnabled, devLinks: config.smtpUrl === null }))

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
    const data = (req.body as { data?: unknown } | undefined)?.data
    if (typeof data !== 'object' || data === null) return void res.status(400).json({ error: 'Nothing to save.' })
    if (JSON.stringify(data).length > MAX_SAVE_BYTES) return void res.status(413).json({ error: 'Save is too large.' })
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

  app.get('/api/leaderboard', (_req, res) => void res.json({ players: store.leaderboard(50).map((u) => ({ name: u.name, rating: u.rating, games: u.games })) }))

  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found.' }))

  // ── The built app (production) ────────────────────────────────────────────
  if (config.serveClient && existsSync(config.serveClient)) {
    const dir = config.serveClient
    app.use(express.static(dir, { index: 'index.html', maxAge: '1h' }))
    app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(join(dir, 'index.html')) : next()))
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
    auth,
    close: () =>
      new Promise((resolve) => {
        clearInterval(heartbeat)
        clearInterval(sweep)
        hub.close()
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
