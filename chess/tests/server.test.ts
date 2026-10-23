// Tests for the game server: the referee (moves, clocks, aborts, draws),
// matchmaking, ratings, sign-in (magic links, Google, sessions), and a real
// server on a random port with real WebSockets — two players matched, a game
// played to mate, a disconnect, a reconnect and an abandonment.
// Run with `npm run test:server`.
import type { AddressInfo } from 'node:net'
import WebSocket from 'ws'
import { parseClientMessage, parseServerMessage, type ServerMessage } from '../src/online/ranked/protocol'
import { RankedManager, type SocketLike, clocksNow } from '../src/online/ranked/onlineManager'
import { createApp } from '../server/app'
import { Auth, RateLimiter, cleanDisplayName, normaliseEmail } from '../server/auth'
import { loadConfig } from '../server/config'
import { FIRST_MOVE_MS, GameRoom, eloChange } from '../server/game'
import { Matchmaker } from '../server/matchmaker'
import { Store } from '../server/store'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
const POOL = { id: '3+2', label: '3 + 2', minutes: 3, increment: 2 }

// ── Protocol ────────────────────────────────────────────────────────────────
check('junk from a browser is rejected', [null, '', 'x', '{"type":"MAKE_MOVE","gameId":"abc","ply":0,"uci":"e2e9"}', '{"type":"FIND_MATCH","pool":"1+0"}', `{"type":"PING","at":1,"x":"${'a'.repeat(5000)}"}`].every((m) => parseClientMessage(m) === null))
check('valid client messages parse', parseClientMessage('{"type":"MAKE_MOVE","gameId":"abcdef123456","ply":3,"uci":"e7e8q"}')?.type === 'MAKE_MOVE' && parseClientMessage('{"type":"FIND_MATCH","pool":"5+3"}')?.type === 'FIND_MATCH')
check('server messages are validated too', parseServerMessage('{"type":"GAME_OVER","gameId":"abcdef123456","winner":"x","reason":"resign","rating":{"before":1200,"after":1210}}') === null)

// ── The referee ─────────────────────────────────────────────────────────────
{
  const g = new GameRoom('game00000001', POOL, { w: 'alice', b: 'bob' }, 0)
  check('only the side to move may move', g.move('b', 0, 'e7e5', 10) === 'It is not your turn.')
  check('illegal moves are refused', g.move('w', 0, 'e2e5', 10) === 'Illegal move.')
  check('a move for the wrong ply is refused', g.move('w', 1, 'e2e4', 10) === 'Out of sync.')
  g.move('w', 0, 'f2f3', 1000)
  check('the clock starts with White’s first move', g.clocksAt(5000).w === 180_000 && g.clocksAt(5000).b === 176_000)
  g.move('b', 1, 'e7e5', 11_000)
  check('time is charged and the increment added', g.clocksAt(11_000).b === 172_000)
  g.move('w', 2, 'g2g4', 12_000)
  g.move('b', 3, 'd8h4', 13_000)
  check("fool's mate is checkmate", g.result?.winner === 'b' && g.result.reason === 'checkmate')
  check('no moves after the end', g.move('w', 4, 'e2e4', 14_000) === 'The game is over.')
}
{
  const g = new GameRoom('game00000002', POOL, { w: 'a', b: 'b' }, 0)
  check('nothing happens before the first-move deadline', g.tick(FIRST_MOVE_MS - 1) === null)
  check('a game nobody starts is aborted (unrated)', g.tick(FIRST_MOVE_MS)?.reason === 'aborted')
  const h = new GameRoom('game00000003', POOL, { w: 'a', b: 'b' }, 0)
  h.move('w', 0, 'e2e4', 100)
  h.move('b', 1, 'e7e5', 200)
  check('the deadline is the clock once both have moved (White’s untimed first move earns no increment)', h.msUntilDeadline(200) === 180_000)
  const flag = h.tick(200 + 180_000)
  check('a flag loses on time', flag?.winner === 'b' && flag.reason === 'timeout')
  const r = new GameRoom('game00000004', POOL, { w: 'a', b: 'b' }, 0)
  check('resigning before both have moved aborts', r.resign('w')?.reason === 'aborted')
  const d = new GameRoom('game00000005', POOL, { w: 'a', b: 'b' }, 0)
  d.move('w', 0, 'e2e4', 1)
  check('no draw offers before both have moved', !d.offerDraw('w'))
  d.move('b', 1, 'e7e5', 2)
  check('a draw offer can be declined, then accepted', d.offerDraw('w') && d.answerDraw('b', false) === 'declined' && d.offerDraw('b') && (d.answerDraw('w', true) as { reason: string } | null)?.reason === 'agreement')
}

// ── Matchmaking & rating ────────────────────────────────────────────────────
{
  const mm = new Matchmaker()
  mm.join('a', 1500, '3+2', 0)
  mm.join('b', 1550, '3+2', 0)
  mm.join('c', 1520, '5+3', 0)
  mm.join('d', 2100, '3+2', 0)
  const pairs = mm.pair(0)
  check('close ratings in the same pool are paired', pairs.length === 1 && pairs[0]!.map((s) => s.userId).sort().join() === 'a,b')
  check('different pools never meet', mm.isQueued('c'))
  mm.join('e', 1600, '3+2', 0)
  check('a wide gap waits…', mm.pair(1000).length === 0)
  check('…until the windows have widened', mm.pair(60_000).length === 1)
  const self = new Matchmaker()
  self.join('x', 1500, '3+2', 0)
  self.join('x', 1500, '3+2', 0)
  check('nobody is paired with themselves', self.pair(0).length === 0)
}
check('Elo: the underdog gains more', eloChange(1200, 1600, 1, 30) > eloChange(1600, 1200, 1, 30) && eloChange(1500, 1500, 0.5, 30) === 0)
check('new players move faster', Math.abs(eloChange(1500, 1500, 1, 5)) > Math.abs(eloChange(1500, 1500, 1, 50)))

// ── Accounts ────────────────────────────────────────────────────────────────
{
  let t = 1000
  const store = new Store(null)
  const auth = new Auth(store, 30, () => t)
  const link = auth.createMagicLink('ada@example.com')
  const user = auth.redeemMagicLink(link)
  check('a magic link signs you in (and creates the account)', user?.email === 'ada@example.com' && user.rating === 1200)
  check('a magic link works only once', auth.redeemMagicLink(link) === null)
  const old = auth.createMagicLink('ada@example.com')
  t += 16 * 60_000
  check('magic links expire after 15 minutes', auth.redeemMagicLink(old) === null)
  const code = auth.createSignInCode('code@example.com')
  const unused = auth.createMagicLink('code@example.com')
  check('sign-in codes are 6 digits', /^\d{6}$/.test(code))
  check('a wrong code or another email fails', auth.redeemSignInCode('code@example.com', code === '000000' ? '111111' : '000000') === null && auth.redeemSignInCode('ada@example.com', code) === null)
  check('the code signs you in, once', auth.redeemSignInCode('code@example.com', code)?.email === 'code@example.com' && auth.redeemSignInCode('code@example.com', code) === null)
  check('signing in by code cancels that email’s link (and the other way round)', auth.redeemMagicLink(unused) === null)
  const late = auth.createSignInCode('code@example.com')
  t += 16 * 60_000
  check('sign-in codes expire after 15 minutes', auth.redeemSignInCode('code@example.com', late) === null)
  const s = auth.startSession(user!.id)
  check('sessions find their user', auth.userFor(s.token)?.id === user!.id && auth.userFor('nope') === null)
  t += 31 * 86_400_000
  check('sessions expire', auth.userFor(s.token) === null)
  const linked = auth.googleUser({ sub: 'g-1', email: 'ADA@example.com', emailVerified: true, name: 'Ada L.' })
  check('Google sign-in joins the account with the same verified email', linked.id === user!.id && linked.googleSub === 'g-1')
  const unverified = auth.googleUser({ sub: 'g-2', email: 'ada@example.com', emailVerified: false, name: 'Mallory' })
  check('an unverified Google email never takes over an account', unverified.id !== user!.id)
  check('emails and names are cleaned', normaliseEmail(' Ada@Example.COM ') === 'ada@example.com' && normaliseEmail('nope') === null && cleanDisplayName('<b>Ada</b>‮', 'x') === 'bAda/b')
  const rl = new RateLimiter(2, 1000, () => t)
  check('rate limits hold', rl.take('k') && rl.take('k') && !rl.take('k'))
}

// ── A real server ───────────────────────────────────────────────────────────
const links: string[] = []
const codes: string[] = []
const store = new Store(null)
const app = createApp({
  config: { ...loadConfig({ PORT: '0', DATA_FILE: ':memory:' }, []), publicUrl: 'http://localhost:5175' },
  store,
  mailer: async (_to, link, code) => void (links.push(link), code && codes.push(code)),
  google: async (credential) => (credential === 'good-google-token' ? { sub: 'google-42', email: 'gm@example.com', emailVerified: true, name: 'Grace M' } : null),
  log: () => {},
  hub: { graceMs: 400, pairEveryMs: 50 },
})
await new Promise<void>((r) => app.server.listen(0, r))
const base = `http://localhost:${(app.server.address() as AddressInfo).port}`
const ORIGIN = 'http://localhost:5175'
const post = (path: string, body: unknown, cookie = '', origin = ORIGIN) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', origin, cookie }, body: JSON.stringify(body) })
const cookieOf = (res: Response): string => (res.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

async function signIn(email: string): Promise<string> {
  await post('/api/auth/email', { email })
  const token = new URL(links.at(-1)!).searchParams.get('signin')
  return cookieOf(await post('/api/auth/email/verify', { token }))
}

check('a forged cross-site request is refused', (await post('/api/auth/email', { email: 'x@example.com' }, '', 'https://evil.example')).status === 403)
const ada = await signIn('ada@example.com')
const meRes = await fetch(`${base}/api/me`, { headers: { cookie: ada } })
const me = (await meRes.json()) as { user: { name: string; rating: number } }
check('email sign-in sets a session cookie', ada.startsWith('cc_session=') && me.user.rating === 1200)
check('the link points at the page that asked for it', links.at(-1)!.startsWith(`${ORIGIN}/?signin=`))
check('signed-out: /api/me says nobody, and private data is refused', ((await (await fetch(`${base}/api/me`)).json()) as { user: unknown }).user === null && (await fetch(`${base}/api/save`)).status === 401)
const googleRes = await post('/api/auth/google', { credential: 'good-google-token' })
check('Google sign-in works with a verified token', googleRes.status === 200 && cookieOf(googleRes).startsWith('cc_session='))
check('a bad Google token is refused', (await post('/api/auth/google', { credential: 'forged' })).status === 401)
const bob = await signIn('bob@example.com')
await fetch(`${base}/api/me`, { method: 'PATCH', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: bob }, body: JSON.stringify({ name: 'Bobby' }) })

// Cloud saves.
const putSave = await fetch(`${base}/api/save`, { method: 'PUT', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: ada }, body: JSON.stringify({ data: { profile: { coins: 42 } } }) })
const gotSave = (await (await fetch(`${base}/api/save`, { headers: { cookie: ada } })).json()) as { data: { profile: { coins: number } } }
check('cloud saves round-trip', putSave.status === 200 && gotSave.data.profile.coins === 42)
const huge = await fetch(`${base}/api/save`, { method: 'PUT', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie: ada }, body: JSON.stringify({ data: { blob: 'x'.repeat(1_100_000) } }) })
check('oversized saves are refused', huge.status === 413)

// WebSockets.
const wsUrl = base.replace('http', 'ws') + '/ws'
interface Client {
  ws: WebSocket
  inbox: ServerMessage[]
  next: (type: ServerMessage['type'], timeout?: number) => Promise<ServerMessage>
  send: (msg: unknown) => void
}
function connect(cookie: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: { cookie, origin: ORIGIN } })
    const inbox: ServerMessage[] = []
    const waiters: Array<{ type: string; resolve: (m: ServerMessage) => void }> = []
    ws.on('message', (data) => {
      const msg = parseServerMessage(data.toString())
      if (!msg) return
      const w = waiters.findIndex((x) => x.type === msg.type)
      if (w >= 0) waiters.splice(w, 1)[0]!.resolve(msg)
      else inbox.push(msg)
    })
    ws.on('error', reject)
    const client: Client = {
      ws,
      inbox,
      send: (msg) => ws.send(JSON.stringify(msg)),
      next: (type, timeout = 3000) =>
        new Promise((res, rej) => {
          const i = inbox.findIndex((m) => m.type === type)
          if (i >= 0) return res(inbox.splice(i, 1)[0]!)
          const timer = setTimeout(() => rej(new Error(`timed out waiting for ${type}`)), timeout)
          waiters.push({ type, resolve: (m) => (clearTimeout(timer), res(m)) })
        }),
    }
    ws.on('open', () => resolve(client))
  })
}
const refused = await new Promise<number>((r) => {
  const ws = new WebSocket(wsUrl, { headers: { origin: ORIGIN } })
  ws.on('unexpected-response', (_req, res) => r(res.statusCode ?? 0))
  ws.on('error', () => r(-1))
})
check('the socket refuses signed-out players', refused === 401)

const A = await connect(ada)
const B = await connect(bob)
check('HELLO greets each player', (await A.next('HELLO')).type === 'HELLO' && (await B.next('HELLO')).type === 'HELLO')
A.send({ type: 'FIND_MATCH', pool: '3+2' })
check('FIND_MATCH puts you in the queue', (await A.next('SEARCHING')).type === 'SEARCHING')
B.send({ type: 'FIND_MATCH', pool: '3+2' })
const ma = (await A.next('MATCH_FOUND')) as Extract<ServerMessage, { type: 'MATCH_FOUND' }>
const mb = (await B.next('MATCH_FOUND')) as Extract<ServerMessage, { type: 'MATCH_FOUND' }>
check('two seekers are matched, with opposite colours', ma.game.gameId === mb.game.gameId && ma.game.color !== mb.game.color)
check('each sees the other’s name and rating', ma.game.opponent.name === 'Bobby' && mb.game.opponent.rating === 1200)
const white = ma.game.color === 'w' ? A : B
const black = white === A ? B : A
const gameId = ma.game.gameId
black.send({ type: 'MAKE_MOVE', gameId, ply: 0, uci: 'e7e5' })
check('a move out of turn is rejected with the true position', ((await black.next('MOVE_REJECTED')) as { reason: string }).reason === 'It is not your turn.')
const fools = ['f2f3', 'e7e5', 'g2g4']
for (const [i, uci] of fools.entries()) {
  const mover = i % 2 === 0 ? white : black
  const other = mover === white ? black : white
  mover.send({ type: 'MAKE_MOVE', gameId, ply: i, uci })
  await mover.next('MOVE_ACCEPTED')
  const om = (await other.next('OPPONENT_MOVE')) as { uci: string }
  if (om.uci !== uci) check(`OPPONENT_MOVE carries ${uci}`, false)
}
check('MAKE_MOVE → OPPONENT_MOVE syncs live moves', true)

// The black player drops and comes back within the grace period.
black.ws.close()
check('the opponent hears about a disconnect', ((await white.next('OPPONENT_DISCONNECTED')) as { graceMs: number }).graceMs === 400)
const blackAgain = await connect(black === A ? ada : bob)
const resumed = (await blackAgain.next('MATCH_FOUND')) as Extract<ServerMessage, { type: 'MATCH_FOUND' }>
check('reconnecting resumes the same game, moves and all', resumed.game.gameId === gameId && resumed.game.moves.join() === 'f2f3,e7e5,g2g4')
check('…and the opponent hears they are back', (await white.next('OPPONENT_RECONNECTED')).type === 'OPPONENT_RECONNECTED')
blackAgain.send({ type: 'MAKE_MOVE', gameId, ply: 3, uci: 'd8h4' })
const overW = (await white.next('GAME_OVER')) as Extract<ServerMessage, { type: 'GAME_OVER' }>
const overB = (await blackAgain.next('GAME_OVER')) as Extract<ServerMessage, { type: 'GAME_OVER' }>
check('checkmate ends the game for both', overW.reason === 'checkmate' && overW.winner === 'b' && overB.winner === 'b')
check('ratings move: the winner up, the loser down', overB.rating.after > overB.rating.before && overW.rating.after < overW.rating.before)
const history = (await (await fetch(`${base}/api/games`, { headers: { cookie: ada } })).json()) as { games: Array<{ reason: string }> }
const board = (await (await fetch(`${base}/api/leaderboard`)).json()) as { players: Array<{ games: number }> }
check('the rated game is in the history and on the leaderboard', history.games[0]?.reason === 'checkmate' && board.players.length === 2)

// Second game: someone leaves for good.
white.send({ type: 'FIND_MATCH', pool: '5+3' })
blackAgain.send({ type: 'FIND_MATCH', pool: '5+3' })
const g2a = (await white.next('MATCH_FOUND')) as Extract<ServerMessage, { type: 'MATCH_FOUND' }>
await blackAgain.next('MATCH_FOUND')
const w2 = g2a.game.color === 'w' ? white : blackAgain
const b2 = w2 === white ? blackAgain : white
w2.send({ type: 'MAKE_MOVE', gameId: g2a.game.gameId, ply: 0, uci: 'e2e4' })
await b2.next('OPPONENT_MOVE')
b2.send({ type: 'MAKE_MOVE', gameId: g2a.game.gameId, ply: 1, uci: 'e7e5' })
await w2.next('OPPONENT_MOVE')
b2.ws.close()
await w2.next('OPPONENT_DISCONNECTED')
const left = (await w2.next('GAME_OVER', 3000)) as Extract<ServerMessage, { type: 'GAME_OVER' }>
check('a player who does not come back loses by abandonment', left.reason === 'abandon' && left.winner === 'w')
check('finished rooms are cleaned up', app.hub.stats().games === 0)

for (const c of [A, B, blackAgain, white]) c.ws.close()

// ── The browser's onlineManager against the real server ─────────────────────
const until = async (cond: () => boolean, what: string, ms = 3000) => {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error(`timed out: ${what}`)
    await new Promise((r) => setTimeout(r, 20))
  }
}
const managerFor = (cookie: string, retryBaseMs = 100) => new RankedManager({ retryBaseMs, open: () => new WebSocket(wsUrl, { headers: { cookie, origin: ORIGIN } }) as unknown as SocketLike })
await new Promise((r) => setTimeout(r, 500)) // let the earlier sockets' grace periods settle
const carol = await signIn('carol@example.com')
const dave = await signIn('dave@example.com')
const mc = managerFor(carol)
const md = managerFor(dave)
mc.connect()
md.connect()
await until(() => mc.state.phase === 'idle' && md.state.phase === 'idle', 'managers connect')
check('the manager connects and knows who you are', mc.state.me?.rating === 1200)
mc.findMatch('10+0')
await until(() => mc.state.phase === 'searching', 'searching')
check('Find Match shows the searching state', mc.state.searching?.pool === '10+0')
md.findMatch('10+0')
await until(() => mc.state.phase === 'playing' && md.state.phase === 'playing', 'matched')
const whiteMgr = mc.state.game!.color === 'w' ? mc : md
const blackMgr = whiteMgr === mc ? md : mc
check('both managers get a board colour', mc.state.game!.color !== md.state.game!.color)
check('your move shows at once…', whiteMgr.move({ from: 'e2', to: 'e4' }) && whiteMgr.state.game!.moves.length === 1)
await until(() => blackMgr.state.game!.moves.length === 1, 'opponent sees move')
check('…and reaches the opponent live', blackMgr.state.game!.fen === whiteMgr.state.game!.fen)
check('you cannot move out of turn', !whiteMgr.move({ from: 'd2', to: 'd4' }))
blackMgr.move({ from: 'e7', to: 'e5' })
await until(() => whiteMgr.state.game!.moves.length === 2, 'reply arrives')
check('clocks run for the side to move', whiteMgr.state.game!.running === 'w' && clocksNow(whiteMgr.state.game!, Date.now()) .w <= 600_000)
// Drop black's socket under it: the manager reconnects and the server resends the game.
;(blackMgr as unknown as { socket: SocketLike }).socket.close()
await until(() => whiteMgr.state.game!.opponentAwayUntil !== null, 'opponent marked away')
await until(() => blackMgr.state.phase === 'playing' && blackMgr.state.error === null && whiteMgr.state.game!.opponentAwayUntil === null, 'reconnected', 5000)
check('a dropped connection reconnects into the same game', blackMgr.state.game!.moves.join() === 'e2e4,e7e5')
whiteMgr.move({ from: 'g1', to: 'f3' })
await until(() => blackMgr.state.game!.moves.length === 3, 'play continues')
blackMgr.resign()
await until(() => whiteMgr.state.phase === 'over' && blackMgr.state.phase === 'over', 'game over')
check('resigning ends the game, with the rating change', whiteMgr.state.game!.result?.reason === 'resign' && whiteMgr.state.me!.rating > 1200 && blackMgr.state.me!.rating < 1200)
// A player who drops for longer than the grace period learns the result when they come back.
const erin = await signIn('erin@example.com')
const frank = await signIn('frank@example.com')
const me1 = managerFor(erin)
const mf = managerFor(frank, 2000)
me1.connect()
mf.connect()
await until(() => me1.state.phase === 'idle' && mf.state.phase === 'idle', 'connect 2')
me1.findMatch('15+10')
mf.findMatch('15+10')
await until(() => me1.state.phase === 'playing' && mf.state.phase === 'playing', 'matched 2')
const w3 = me1.state.game!.color === 'w' ? me1 : mf
const b3 = w3 === me1 ? mf : me1
w3.move({ from: 'd2', to: 'd4' })
await until(() => b3.state.game!.moves.length === 1, 'm1')
b3.move({ from: 'd7', to: 'd5' })
await until(() => w3.state.game!.moves.length === 2, 'm2')
;(mf as unknown as { socket: SocketLike }).socket.close() // Frank's retry (2 s) is slower than the 0.4 s grace period
await until(() => mf.state.phase === 'over', 'late returner learns the result', 6000)
check('coming back after the grace period shows the lost game', mf.state.game!.result?.reason === 'abandon' && mf.state.game!.result.winner !== mf.state.game!.color)
me1.disconnect()
mf.disconnect()
mc.disconnect()
md.disconnect()
check('disconnect() goes offline', mc.state.phase === 'offline')

// ── The iOS / Android apps: a token instead of the cookie, CORS, and the socket's subprotocol ──
const APP = 'https://localhost' // Capacitor's Android origin
const appPost = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: APP, 'x-chronos-client': 'native', ...headers }, body: JSON.stringify(body) })
const preflight = await fetch(`${base}/api/me`, { method: 'OPTIONS', headers: { origin: APP, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' } })
check('the apps’ CORS preflight is answered', preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === APP && /authorization/.test(preflight.headers.get('access-control-allow-headers') ?? ''))
const noCors = await fetch(`${base}/api/config`, { headers: { origin: 'https://evil.example' } })
check('other sites get no CORS', noCors.headers.get('access-control-allow-origin') === null)
check('the apps may ask for a sign-in email', (await appPost('/api/auth/email', { email: 'app@example.com' })).status === 200 && codes.length > 0)
check('a wrong code is refused', (await appPost('/api/auth/email/code', { email: 'app@example.com', code: codes.at(-1) === '000000' ? '111111' : '000000' })).status === 400)
const codeRes = await appPost('/api/auth/email/code', { email: 'app@example.com', code: codes.at(-1) })
const signedApp = (await codeRes.json()) as { user: { email: string }; token?: string }
check('the emailed code signs the app in and returns its token', codeRes.status === 200 && signedApp.user.email === 'app@example.com' && typeof signedApp.token === 'string' && codeRes.headers.get('access-control-allow-origin') === APP)
const appToken = signedApp.token ?? ''
const webCode = await (async () => {
  await post('/api/auth/email', { email: 'web@example.com' })
  return (await (await post('/api/auth/email/code', { email: 'web@example.com', code: codes.at(-1) })).json()) as { token?: string }
})()
check('the website never gets the token in the body', webCode.token === undefined)
const appMe = (await (await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${appToken}`, origin: APP } })).json()) as { user: { email: string } | null }
check('the Bearer token signs requests in', appMe.user?.email === 'app@example.com')
check('a bad Bearer token is nobody', ((await (await fetch(`${base}/api/me`, { headers: { authorization: 'Bearer nope' } })).json()) as { user: unknown }).user === null)
const tries = await Promise.all(Array.from({ length: 9 }, () => appPost('/api/auth/email/code', { email: 'app@example.com', code: '123456' })))
check('guessing codes is rate-limited', tries.some((r) => r.status === 429))
const appSocket = await new Promise<string>((resolve) => {
  const ws = new WebSocket(wsUrl, ['chronos', `chronos.token.${appToken}`], { headers: { origin: APP } })
  ws.on('message', (data) => {
    const msg = parseServerMessage(data.toString())
    if (msg?.type === 'HELLO') {
      resolve(`${ws.protocol}:${msg.type}`)
      ws.close()
    }
  })
  ws.on('unexpected-response', (_req, res) => resolve(String(res.statusCode)))
  ws.on('error', () => resolve('error'))
})
check('the apps’ socket signs in with its token as a subprotocol', appSocket === 'chronos:HELLO')
const badSocket = await new Promise<number>((resolve) => {
  const ws = new WebSocket(wsUrl, ['chronos', 'chronos.token.nope'], { headers: { origin: APP } })
  ws.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0))
  ws.on('error', () => resolve(-1))
})
check('a bad socket token is refused', badSocket === 401)
const appOut = await appPost('/api/auth/logout', {}, { authorization: `Bearer ${appToken}` })
const afterOut = (await (await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${appToken}` } })).json()) as { user: unknown }
check('signing out ends the app’s token', appOut.status === 200 && afterOut.user === null)

await app.close()

console.log(failures === 0 ? '\nAll server checks passed.' : `\n${failures} check(s) FAILED`)
process.exit(failures > 0 ? 1 : 0)
