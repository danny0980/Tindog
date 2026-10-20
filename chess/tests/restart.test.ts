// Tests for production hardening (6.16): a restarted server resumes games in
// progress (chess, Vanishing, Card Chess, Battle Royale) with clocks paused
// while it was down; players who don't return lose (or the game is aborted);
// the weekly tournament no longer forfeits everyone after a restart; the app
// drops games the server no longer has; sliding sessions; cloud-save
// conflicts (409); the game history, data export and account deletion.
// Run with `npm run test:restart`.
import { mkdtempSync, rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server/app'
import { Auth } from '../server/auth'
import { loadConfig } from '../server/config'
import { type Conn, Hub } from '../server/hub'
import { Store, type User } from '../server/store'
import { TournamentManager } from '../server/tournaments'
import { replayAt } from '../src/online/ranked/history'
import { RankedManager, STALE_GAME, type SocketLike } from '../src/online/ranked/onlineManager'
import { type ServerMessage, parseServerMessage } from '../src/online/ranked/protocol'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// A manual clock and timers (each hub gets its own list, as a real restart would).
let now = Date.UTC(2026, 9, 20, 12)
type Timer = { at: number; fn: () => void; id: number; owner: number }
let timers: Timer[] = []
let timerId = 0
const clockFor = (owner: number) => ({
  now: () => now,
  setTimer: (fn: () => void, ms: number) => {
    const t = { at: now + ms, fn, id: ++timerId, owner }
    timers.push(t)
    return t.id
  },
  clearTimer: (h: unknown) => {
    timers = timers.filter((t) => t.id !== h)
  },
})
const advance = (ms: number) => {
  const end = now + ms
  for (;;) {
    timers.sort((a, b) => a.at - b.at)
    const t = timers[0]
    if (!t || t.at > end) break
    timers.shift()
    now = t.at
    t.fn()
  }
  now = end
}
/** The server process dies: its timers die with it. */
const crash = (owner: number) => {
  timers = timers.filter((t) => t.owner !== owner)
}

interface Fake {
  user: User
  conn: Conn
  inbox: ServerMessage[]
}
const fake = (store: Store, n: number, rating = 1500): Fake => {
  const user = store.user(`user${String(n).padStart(4, '0')}`) ?? store.putUser({ id: `user${String(n).padStart(4, '0')}`, email: `p${n}@example.com`, googleSub: null, name: `Player ${n}`, createdAt: 0, rating, games: 5, wins: 0, losses: 0, draws: 0 })
  const inbox: ServerMessage[] = []
  return { user, inbox, conn: { send: (t) => void (parseServerMessage(t) && inbox.push(parseServerMessage(t)!)), close: () => {} } }
}
/** The same player on a fresh connection (after the restart). */
const again = (f: Fake): Fake => {
  const inbox: ServerMessage[] = []
  return { ...f, inbox, conn: { send: (t) => void (parseServerMessage(t) && inbox.push(parseServerMessage(t)!)), close: () => {} } }
}
const last = <T extends ServerMessage['type']>(f: Fake, type: T): Extract<ServerMessage, { type: T }> | undefined => f.inbox.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type).at(-1)

const dir = mkdtempSync(join(tmpdir(), 'chess-restart-'))
const file = join(dir, 'chess.db')

// ── Chess: a game survives a restart ────────────────────────────────────────
{
  let store = new Store(file)
  const hub1 = new Hub({ store, ...clockFor(1), pairEveryMs: 0, graceMs: 1000, restoreGraceMs: 5000 })
  const a = fake(store, 1)
  const b = fake(store, 2)
  hub1.connect(a.user, a.conn)
  hub1.connect(b.user, b.conn)
  const gameId = hub1.startGame({ w: a.user.id, b: b.user.id }, '5+3')!
  const say = (h: Hub, f: Fake, msg: unknown) => h.message(f.user.id, f.conn, JSON.stringify(msg))
  say(hub1, a, { type: 'MAKE_MOVE', gameId, ply: 0, uci: 'e2e4' })
  advance(4000)
  say(hub1, b, { type: 'MAKE_MOVE', gameId, ply: 1, uci: 'e7e5' })
  advance(7000) // White thinks for 7 s, then the server dies.
  const whiteClockBefore = (last(a, 'OPPONENT_MOVE')?.clocks.w ?? 0)
  check('every move is saved as it happens', store.liveGames('chess').length === 1)
  crash(1)
  store.close()

  // Ten minutes later the server is back.
  now += 10 * 60_000
  store = new Store(file)
  const hub2 = new Hub({ store, ...clockFor(2), pairEveryMs: 0, graceMs: 1000, restoreGraceMs: 5000 })
  check('the restarted server brings the game back', hub2.restoreLive() === 1 && hub2.hasGame(gameId) && hub2.isPlaying(a.user.id))
  const b2 = again(b)
  hub2.connect(b2.user, b2.conn)
  const hello = b2.inbox.find((m): m is Extract<ServerMessage, { type: 'HELLO' }> => m.type === 'HELLO')
  check('HELLO tells the app which game it is in', hello?.active?.gameId === gameId && hello.active.kind === 'chess')
  const snapB = last(b2, 'MATCH_FOUND')?.game
  check('a returning player gets the game as it stood', snapB?.moves.join() === 'e2e4,e7e5' && snapB.gameId === gameId)
  check('while the player to move is away, no clock runs (the downtime is not counted)', snapB?.running === null && snapB.clocks.w === whiteClockBefore)
  check('the opponent sees the other player is still away', last(b2, 'OPPONENT_DISCONNECTED')?.gameId === gameId)
  advance(3000)
  const a2 = again(a)
  hub2.connect(a2.user, a2.conn)
  const snapA = last(a2, 'MATCH_FOUND')?.game
  check('when the player to move returns, their clock starts again from where it was', snapA?.running === 'w' && snapA.clocks.w === whiteClockBefore)
  check('and the opponent is told they are back', last(b2, 'OPPONENT_RECONNECTED')?.gameId === gameId)
  say(hub2, a2, { type: 'MAKE_MOVE', gameId, ply: 2, uci: 'g1f3' })
  check('play simply continues', last(b2, 'OPPONENT_MOVE')?.uci === 'g1f3')
  advance(6000)
  check('nobody is forfeited once both are back', hub2.hasGame(gameId))
  say(hub2, b2, { type: 'RESIGN', gameId })
  check('the result is recorded and the saved game cleared', last(a2, 'GAME_OVER')?.winner === 'w' && store.liveGames('chess').length === 0 && store.gamesOf(a.user.id, 1)[0]?.id === gameId)
  hub2.close()
  store.close()
}

// ── Players who don't come back ─────────────────────────────────────────────
{
  let store = new Store(file)
  const hub1 = new Hub({ store, ...clockFor(3), pairEveryMs: 0, graceMs: 1000, restoreGraceMs: 5000 })
  const [a, b, c, d] = [fake(store, 3), fake(store, 4), fake(store, 5), fake(store, 6)]
  for (const f of [a, b, c, d]) hub1.connect(f.user, f.conn)
  const g1 = hub1.startGame({ w: a.user.id, b: b.user.id }, 'vanish-5+3')!
  const g2 = hub1.startGame({ w: c.user.id, b: d.user.id }, '3+2')!
  for (const [gid, w, bl] of [[g1, a, b], [g2, c, d]] as const) {
    hub1.message(w.user.id, w.conn, JSON.stringify({ type: 'MAKE_MOVE', gameId: gid, ply: 0, uci: 'd2d4' }))
    hub1.message(bl.user.id, bl.conn, JSON.stringify({ type: 'MAKE_MOVE', gameId: gid, ply: 1, uci: 'd7d5' }))
  }
  crash(3)
  store.close()
  store = new Store(file)
  const hub2 = new Hub({ store, ...clockFor(4), pairEveryMs: 0, graceMs: 1000, restoreGraceMs: 5000 })
  check('a Vanishing game comes back too', hub2.restoreLive() === 2)
  const a2 = again(a)
  hub2.connect(a2.user, a2.conn)
  advance(5100)
  check('after the grace period, the player who never came back loses', last(a2, 'GAME_OVER')?.winner === 'w' && last(a2, 'GAME_OVER')?.reason === 'abandon')
  check('a Vanishing result still moves the Vanishing rating', store.modeRating(a.user.id, 'vanish').wins === 1)
  check('when neither player returns, the game is aborted (unrated)', !hub2.hasGame(g2) && store.gamesOf(c.user.id, 1)[0]?.id !== g2 && store.liveGames('chess').length === 0)
  const c2 = again(c)
  hub2.connect(c2.user, c2.conn)
  check('…and the late player hears about it when they come back', last(c2, 'GAME_OVER')?.reason === 'aborted' && c2.inbox.findIndex((m) => m.type === 'GAME_OVER') < c2.inbox.findIndex((m) => m.type === 'HELLO'))
  check('HELLO then says there is no game', c2.inbox.find((m): m is Extract<ServerMessage, { type: 'HELLO' }> => m.type === 'HELLO')?.active === null)
  hub2.close()
  store.close()
}

// ── Card Chess and Battle Royale survive a restart ──────────────────────────
{
  let store = new Store(file)
  const hub1 = new Hub({ store, ...clockFor(5), pairEveryMs: 0, graceMs: 1000, restoreGraceMs: 5000, modes: { botDelayMs: 100, royaleFillMs: 1000, royaleSoloMs: 50_000 } })
  const [a, b, c, d] = [fake(store, 7), fake(store, 8), fake(store, 9), fake(store, 10)]
  for (const f of [a, b, c, d]) hub1.connect(f.user, f.conn)
  const say = (h: Hub, f: Fake, msg: unknown) => h.message(f.user.id, f.conn, JSON.stringify(msg))
  say(hub1, a, { type: 'FIND_MODE', mode: 'cards' })
  say(hub1, b, { type: 'FIND_MODE', mode: 'cards' })
  const cg = last(a, 'CARD_STATE')!.game
  say(hub1, a, { type: 'CARD_DRAFT', gameId: cg.gameId, cards: cg.offer.slice(0, 3) })
  say(hub1, b, { type: 'CARD_DRAFT', gameId: cg.gameId, cards: cg.offer.slice(2, 5) })
  const white = last(a, 'CARD_STATE')!.game.color === 'w' ? a : b
  const black = white === a ? b : a
  say(hub1, white, { type: 'CARD_ACTION', gameId: cg.gameId, ply: 0, action: { k: 'm', uci: 'e2e4' } })
  say(hub1, black, { type: 'CARD_ACTION', gameId: cg.gameId, ply: 1, action: { k: 'm', uci: 'e7e5' } })
  say(hub1, c, { type: 'FIND_MODE', mode: 'royale' })
  say(hub1, d, { type: 'FIND_MODE', mode: 'royale' })
  advance(1000)
  hub1.pairNow()
  const rs = last(c, 'ROYALE_STATE')!.game
  advance(600) // a few computer moves
  const playedBefore = c.inbox.filter((m) => m.type === 'ROYALE_PLAYED').length + rs.actions.length
  check('mode games are saved as they go', store.liveGames('cards').length === 1 && store.liveGames('royale').length === 1)
  crash(5)
  store.close()
  now += 60_000
  store = new Store(file)
  const hub2 = new Hub({ store, ...clockFor(6), pairEveryMs: 0, graceMs: 1000, restoreGraceMs: 5000, modes: { botDelayMs: 100, royaleFillMs: 1000, royaleSoloMs: 50_000 } })
  check('Card Chess and Battle Royale come back after a restart', hub2.restoreLive() === 2)
  const w2 = again(white)
  hub2.connect(w2.user, w2.conn)
  const st = last(w2, 'CARD_STATE')?.game
  check('the Card Chess game resumes with both hands and its moves', st?.phase === 'play' && st.actions.length === 2 && st.hands.w?.length === 3 && st.hands.b?.length === 3)
  check('…and the clock to move starts when that player is back', st?.running === 'w')
  say(hub2, w2, { type: 'CARD_ACTION', gameId: cg.gameId, ply: 2, action: { k: 'm', uci: 'g1f3' } })
  check('Card Chess play continues', last(w2, 'CARD_PLAYED')?.ply === 2)
  const c2 = again(c)
  hub2.connect(c2.user, c2.conn)
  const rs2 = last(c2, 'ROYALE_STATE')?.game
  check('the Battle Royale table resumes with its whole log', rs2?.gameId === rs.gameId && (rs2?.actions.length ?? 0) === playedBefore)
  advance(5100)
  check('a Card Chess player who never returns loses', last(w2, 'MODE_OVER')?.result.reason === 'abandon' && last(w2, 'MODE_OVER')?.result.winner === 'w')
  const rec = store.gamesOf(white.user.id, 1)[0]
  check('the finished Card Chess game keeps both hands for its replay', rec?.extra?.hands?.w.length === 3)
  const replay = rec ? replayAt({ id: rec.id, kind: 'cards', pool: rec.pool, color: 'w', white: 'a', black: 'b', winner: rec.winner, reason: rec.reason, moves: rec.moves, hands: rec.extra?.hands ?? null, ratingChange: 0, endedAt: 0 }, 99) : null
  check('…and the replay rebuilds it move by move', replay?.kind === 'board' && replay.total === 3 && replay.moves.join(' ') === 'e4 e5 Nf3')
  hub2.close()
  store.close()
}

// ── The tournament after a restart ──────────────────────────────────────────
{
  let store = new Store(file)
  const hub1 = new Hub({ store, ...clockFor(7), pairEveryMs: 0, graceMs: 1000, restoreGraceMs: 120_000 })
  const players = [11, 12, 13, 14].map((n, i) => fake(store, n, 1800 - i * 50))
  for (const p of players) hub1.connect(p.user, p.conn)
  const t1 = new TournamentManager({ store, ...clockFor(7), startGame: (pl, pool, label, cb) => hub1.startGame(pl, pool, label, cb), isAvailable: (id) => hub1.isAvailable(id), attachResult: (g, cb) => hub1.attachResultHook(g, cb), changed: () => {}, firstStartsAt: now + 1000 })
  for (const p of players) t1.join(p.user.id, p.user.rating)
  advance(1000)
  const round = store.tournament()!.rounds[0]!
  check('the knockout starts with two semi-finals', store.tournament()?.status === 'running' && round.filter((m) => m.gameId).length === 2)
  crash(7)
  store.close()
  now += 30_000
  store = new Store(file)
  const hub2 = new Hub({ store, ...clockFor(8), pairEveryMs: 0, graceMs: 1000, restoreGraceMs: 120_000 })
  hub2.restoreLive()
  const t2 = new TournamentManager({ store, ...clockFor(8), startGame: (pl, pool, label, cb) => hub2.startGame(pl, pool, label, cb), isAvailable: (id) => hub2.isAvailable(id), attachResult: (g, cb) => hub2.attachResultHook(g, cb), changed: () => {}, resumeGraceMs: 180_000 })
  hub2.onConnect = () => t2.playerConnected()
  const st = store.tournament()!
  check('a restart no longer forfeits everyone or crowns a champion at once', st.status === 'running' && st.rounds.length === 1 && st.rounds[0]!.every((m) => !m.winner))
  check('the games in progress keep going', st.rounds[0]!.every((m) => m.gameId && hub2.hasGame(m.gameId)))
  // The first semi-final: both come back and one resigns. The result reaches the bracket.
  const semi = st.rounds[0]![0]!
  const pa = again(players.find((p) => p.user.id === semi.a)!)
  const pb = again(players.find((p) => p.user.id === semi.b)!)
  hub2.connect(pa.user, pa.conn)
  hub2.connect(pb.user, pb.conn)
  hub2.message(pb.user.id, pb.conn, JSON.stringify({ type: 'RESIGN', gameId: semi.gameId }))
  check('a resumed game’s result still decides the bracket', store.tournament()!.rounds[0]![0]!.winner === semi.a)
  // Nobody from the other semi-final returns.
  advance(100_000)
  check('players who aren’t back are waited for during the grace period', store.tournament()!.status === 'running' && store.tournament()!.rounds.length === 1)
  // After the grace periods: their game is aborted (the higher seed goes through), and the absent finalist forfeits the final.
  advance(80_000)
  const prev = store.tournament()!.previous
  check('after the grace period, absent players forfeit and the player who came back wins', prev?.champion === semi.a && store.tournament()!.status === 'signup')
  hub2.close()
  t2.close()
  store.close()
}

// ── The app closes games the server no longer has ───────────────────────────
{
  const sent: string[] = []
  let deliver: ((text: string) => void) | null = null
  const m = new RankedManager({
    now: () => now,
    ...clockFor(9),
    open: () => {
      const sock: SocketLike = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null, send: (d) => void sent.push(d), close: () => {} }
      deliver = (text) => sock.onmessage?.({ data: text } as MessageEvent)
      return sock
    },
  })
  m.connect()
  const user = { id: 'user9999', name: 'Zed', rating: 1500 }
  deliver!(JSON.stringify({ type: 'HELLO', protocol: 2, user, active: null }))
  deliver!(JSON.stringify({ type: 'MATCH_FOUND', game: { gameId: 'gameaaaa1111', color: 'w', opponent: { name: 'Y', rating: 1500 }, pool: '5+3', moves: ['e2e4'], clocks: { w: 300000, b: 300000 }, running: 'b', drawOffer: null } }))
  const events: string[] = []
  m.onEvent((e) => events.push(e.kind))
  // The server restarted and couldn't resume it: HELLO says no game.
  deliver!(JSON.stringify({ type: 'HELLO', protocol: 2, user, active: null }))
  check('a game the server no longer has is closed (shown as cancelled), never left hanging', m.state.game?.result?.reason === 'aborted' && m.state.phase === 'over' && m.state.error === STALE_GAME)
  deliver!(JSON.stringify({ type: 'GAME_OVER', gameId: 'gamebbbb2222', winner: 'w', reason: 'resign', rating: { before: 1500, after: 1512 } }))
  check('a result for a game no longer on screen is reported, not dropped', events.includes('missed-result'))
  // An older server (no `active`) never closes games.
  const m2 = new RankedManager({ now: () => now, ...clockFor(9), open: () => {
    const sock: SocketLike = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null, send: () => {}, close: () => {} }
    deliver = (text) => sock.onmessage?.({ data: text } as MessageEvent)
    return sock
  } })
  m2.connect()
  deliver!(JSON.stringify({ type: 'MATCH_FOUND', game: { gameId: 'gamecccc3333', color: 'w', opponent: { name: 'Y', rating: 1500 }, pool: '5+3', moves: [], clocks: { w: 300000, b: 300000 }, running: null, drawOffer: null } }))
  deliver!(JSON.stringify({ type: 'HELLO', protocol: 1, user }))
  check('an older server that sends no game list never closes a game', m2.state.game?.result === null && m2.state.phase === 'playing')
}

// ── Sliding sessions ────────────────────────────────────────────────────────
{
  const store = new Store(null)
  const auth = new Auth(store, 30, () => now)
  store.putUser({ id: 'sess00000001', email: null, googleSub: null, name: 'S', createdAt: 0, rating: 1200, games: 0, wins: 0, losses: 0, draws: 0 })
  const s = auth.startSession('sess00000001')
  check('a fresh session is not extended', auth.touch(s.token) === null)
  now += 20 * 86_400_000
  const ext = auth.touch(s.token)
  check('a session used in the second half of its life is extended to a full 30 days', ext === now + 30 * 86_400_000 && auth.userFor(s.token)?.id === 'sess00000001')
  now += 40 * 86_400_000
  check('an expired session is not revived', auth.touch(s.token) === null && auth.userFor(s.token) === null)
  store.close()
}

// ── HTTP: cloud-save conflicts, history, export, deletion ───────────────────
{
  const links: string[] = []
  const store = new Store(null)
  const app = createApp({ config: { ...loadConfig({ PORT: '0', DATA_FILE: ':memory:' }, []), publicUrl: 'http://localhost:5175' }, store, mailer: async (_to, link) => void links.push(link), google: null, log: () => {}, hub: { pairEveryMs: 0 } })
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()))
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
  const headers = { origin: 'http://localhost:5175', 'content-type': 'application/json' }
  const signIn = async (email: string): Promise<string> => {
    await fetch(`${base}/api/auth/email`, { method: 'POST', headers, body: JSON.stringify({ email }) })
    const token = new URL(links.at(-1)!).searchParams.get('signin')!
    const r = await fetch(`${base}/api/auth/email/verify`, { method: 'POST', headers, body: JSON.stringify({ token }) })
    return (r.headers.get('set-cookie') ?? '').split(';')[0]!
  }
  const cookie = await signIn('dana@example.com')
  const put = (body: unknown) => fetch(`${base}/api/save`, { method: 'PUT', headers: { ...headers, cookie }, body: JSON.stringify(body) })
  const first = (await (await put({ data: { version: 1, profile: { coins: 1 } }, baseUpdatedAt: null })).json()) as { updatedAt: number }
  check('the first save from a device is accepted', typeof first.updatedAt === 'number')
  // Another device saves on top of it.
  await new Promise((r) => setTimeout(r, 5))
  const second = (await (await put({ data: { version: 1, profile: { coins: 2 } }, baseUpdatedAt: first.updatedAt })).json()) as { updatedAt: number }
  // The first device, still on the old version, tries to save.
  const stale = await put({ data: { version: 1, profile: { coins: 99 } }, baseUpdatedAt: first.updatedAt })
  const body = (await stale.json()) as { cloud?: { data: { profile: { coins: number } }; updatedAt: number } }
  check('a save from a device that missed a newer save is refused (409) with the newer save', stale.status === 409 && body.cloud?.data.profile.coins === 2 && body.cloud.updatedAt === second.updatedAt)
  const kept = store.save(store.userByEmail('dana@example.com')!.id)?.data as { profile: { coins: number } } | undefined
  check('nothing was overwritten', kept?.profile.coins === 2)
  check('an older app (no version) still saves as before', (await put({ data: { version: 1, profile: { coins: 3 } } })).status === 200)

  // History: two finished games of different kinds.
  const me = store.userByEmail('dana@example.com')!
  store.putUser({ id: 'oppo00000001', email: null, googleSub: null, name: 'Opponent', createdAt: 0, rating: 1500, games: 1, wins: 0, losses: 0, draws: 0 })
  store.addGame({ id: 'hist00000001', pool: '5+3', white: me.id, black: 'oppo00000001', winner: 'w', reason: 'checkmate', moves: ['f2f3', 'e7e5', 'g2g4', 'd8h4'].slice(0, 2), ratingChange: { w: 9, b: -9 }, endedAt: now - 2000 })
  store.addRoyaleGame({ id: 'hist00000002', seats: ['oppo00000001', me.id, null, null], ranking: [1, 0, 2, 3], reason: 'last-king', plies: 0, ratingChange: { [me.id]: 12 }, endedAt: now - 1000, actions: [] })
  const hist = (await (await fetch(`${base}/api/history`, { headers: { cookie } })).json()) as { games: Array<{ id: string; kind: string; result: string; place: number | null; opponents: string[] }> }
  check('the history lists every kind of online game, newest first', hist.games.map((g) => g.id).join() === 'hist00000002,hist00000001' && hist.games[0]?.kind === 'royale' && hist.games[0].place === 1 && hist.games[1]?.result === 'win' && hist.games[1].opponents[0] === 'Opponent')
  const one = (await (await fetch(`${base}/api/history/hist00000001`, { headers: { cookie } })).json()) as { moves: string[]; color: string }
  check('a game opens with its moves for the replay', one.moves.join() === 'f2f3,e7e5' && one.color === 'w')
  const outsider = await signIn('eve@example.com')
  check('other people’s games are not visible', (await fetch(`${base}/api/history/hist00000001`, { headers: { cookie: outsider } })).status === 404)
  const paged = (await (await fetch(`${base}/api/history?before=${now - 1500}`, { headers: { cookie } })).json()) as { games: Array<{ id: string }> }
  check('the history pages by date', paged.games.length === 1 && paged.games[0]?.id === 'hist00000001')

  // Export and deletion.
  const exp = await fetch(`${base}/api/me/export`, { headers: { cookie } })
  const data = (await exp.json()) as { account: { email: string }; games: unknown[]; battleRoyale: unknown[]; cloudSave: unknown }
  check('the export is a download with the account, games and save', (exp.headers.get('content-disposition') ?? '').includes('attachment') && data.account.email === 'dana@example.com' && data.games.length === 1 && data.battleRoyale.length === 1 && data.cloudSave !== null)
  const del = (body: unknown) => fetch(`${base}/api/me`, { method: 'DELETE', headers: { ...headers, cookie }, body: JSON.stringify(body) })
  check('deleting needs the typed confirmation', (await del({})).status === 400)
  store.putClan({ id: 'clan-del', name: 'Leavers', tag: 'LV', ownerId: me.id, members: [me.id, 'oppo00000001'], createdAt: 0 })
  const gone = await del({ confirm: 'DELETE' })
  check('the account is deleted and signed out', gone.status === 200 && store.user(me.id) === null && store.save(me.id) === null && (await fetch(`${base}/api/me`, { headers: { cookie } }).then((r) => r.json() as Promise<{ user: unknown }>)).user === null)
  check('the clan passes to the next member', store.clan('clan-del')?.ownerId === 'oppo00000001' && store.clan('clan-del')?.members.join() === 'oppo00000001')
  check('opponents keep the game, without the name', store.game('hist00000001') !== null)
  check('a deleted session can’t act any more', (await fetch(`${base}/api/save`, { headers: { cookie } })).status === 401)
  await app.close()
  store.close()
}

rmSync(dir, { recursive: true, force: true })
if (failures > 0) {
  console.error(`\n${failures} restart check(s) failed.`)
  process.exit(1)
}
console.log('\nAll restart checks passed.')
