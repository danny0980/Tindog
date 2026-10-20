// Tests for Phase D's server: knockout brackets, the weekly tournament (with
// forfeits, draws and a champion), monthly seasons, clans and the clan war,
// spectating, and the HTTP routes on a real server.
// Run with `npm run test:league`.
import type { AddressInfo } from 'node:net'
import { type ServerMessage, parseServerMessage } from '../src/online/ranked/protocol'
import { createApp } from '../server/app'
import { MAX_ENTRANTS, bySeed, nextRound, roundDone, roundName, seedBracket, seedOrder } from '../server/bracket'
import { cleanClanName, cleanTag, warPoints, weekOf } from '../server/clans'
import { loadConfig } from '../server/config'
import { type Conn, Hub } from '../server/hub'
import { seasonEnd, seasonOf, softReset, tierFor } from '../server/seasons'
import { Store, type User } from '../server/store'
import { TournamentManager, nextSaturday } from '../server/tournaments'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── Brackets ────────────────────────────────────────────────────────────────
check('seed order keeps the top seeds apart', seedOrder(8).join() === '1,8,4,5,2,7,3,6' && seedOrder(32).length === 32)
const thirteen = Array.from({ length: 13 }, (_, i) => ({ id: `p${i + 1}`, rating: 2000 - i * 10 }))
const r1 = seedBracket(thirteen)
check('13 players fill a bracket of 16 with 3 byes for the top seeds', r1.length === 8 && r1.filter((m) => !m.b || !m.a).length === 3 && ['p1', 'p2', 'p3'].every((p) => r1.some((m) => m.winner === p)))
check('the top seed meets the bottom of the draw', r1[0]?.a === 'p1' && r1[0].b === null)
check('a full field of 32 has no byes', seedBracket(Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, rating: i }))).filter((m) => m.a && m.b).length === MAX_ENTRANTS / 2)
check('rounds wait for every result', !roundDone(r1))
const done1 = r1.map((m) => ({ ...m, winner: m.winner ?? m.a }))
const r2 = nextRound(done1)!
check('winners meet in the next round', r2.length === 4 && roundDone(done1) && r2[0]?.a === 'p1')
check('round names', roundName(1) === 'Final' && roundName(2) === 'Semi-final' && roundName(4) === 'Quarter-final' && roundName(8) === 'Round of 16')
check('after the final there is no next round', nextRound([{ a: 'x', b: 'y', winner: 'x', gameId: null }]) === null)
check('the next tournament is on Saturday at 18:00 UTC', new Date(nextSaturday(Date.UTC(2026, 9, 20, 12))).toISOString() === '2026-10-24T18:00:00.000Z' && new Date(nextSaturday(Date.UTC(2026, 9, 24, 18))).toISOString() === '2026-10-31T18:00:00.000Z')

// ── Seasons & clans (pure) ──────────────────────────────────────────────────
check('tiers from rating', tierFor(2100).id === 'legend' && tierFor(1450).id === 'gold' && tierFor(800).id === 'bronze')
check('seasons are calendar months', seasonOf(Date.UTC(2026, 9, 31, 23)) === '2026-10' && seasonEnd('2026-12') === Date.UTC(2027, 0, 1))
check('a new season pulls ratings toward 1500', softReset(1900) === 1800 && softReset(1100) === 1200 && softReset(1500) === 1500)
check('clan names and tags are cleaned', cleanClanName('  The  Knights ') === 'The Knights' && cleanClanName('<x>') === null && cleanTag(' chrn ') === 'CHRN' && cleanTag('TOOLONG') === null)
check('ISO weeks', weekOf(Date.UTC(2026, 9, 20)) === '2026-W43' && weekOf(Date.UTC(2021, 0, 1)) === '2020-W53')
check('war points: beating another clan pays most, games inside a clan nothing', warPoints('a', 'b', 1) === 3 && warPoints('a', 'b', 0.5) === 1 && warPoints('a', null, 1) === 1 && warPoints('a', 'a', 1) === 0 && warPoints(null, 'b', 1) === 0)

// ── Hub + tournament, with fake connections and a manual clock ──────────────
let now = Date.UTC(2026, 9, 20, 12)
const timers: Array<{ at: number; fn: () => void; id: number }> = []
let timerId = 0
const setTimer = (fn: () => void, ms: number) => {
  const t = { at: now + ms, fn, id: ++timerId }
  timers.push(t)
  return t.id
}
const clearTimer = (h: unknown) => {
  const i = timers.findIndex((t) => t.id === h)
  if (i >= 0) timers.splice(i, 1)
}
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
const store = new Store(null)
const hub = new Hub({ store, now: () => now, setTimer, clearTimer, pairEveryMs: 0, graceMs: 1000 })
interface Fake {
  user: User
  conn: Conn
  inbox: ServerMessage[]
}
const fakes = new Map<string, Fake>()
const mkUser = (i: number, rating: number): Fake => {
  const user = store.putUser({ id: `user${String(i).padStart(4, '0')}`, email: null, googleSub: null, name: `Player ${i}`, createdAt: 0, rating, games: 5, wins: 0, losses: 0, draws: 0 })
  const inbox: ServerMessage[] = []
  const conn: Conn = { send: (t) => void (parseServerMessage(t) && inbox.push(parseServerMessage(t)!)), close: () => {} }
  const f = { user, conn, inbox }
  fakes.set(user.id, f)
  return f
}
const players = Array.from({ length: 13 }, (_, i) => mkUser(i + 1, 2000 - i * 40))
const absent = players[12]!
for (const p of players) if (p !== absent) hub.connect(p.user, p.conn)
let changes = 0
const tm = new TournamentManager({
  store,
  now: () => now,
  setTimer,
  clearTimer,
  startGame: (pl, pool, label, cb) => hub.startGame(pl, pool, label, cb),
  isAvailable: (id) => hub.isAvailable(id),
  changed: () => (changes += 1),
  firstStartsAt: now + 3_600_000,
})
check('a tournament opens for sign-ups', tm.state.status === 'signup' && tm.state.startsAt === now + 3_600_000)
for (const p of players) tm.join(p.user.id, p.user.rating)
check('players sign up once each', tm.state.entrants.length === 13 && tm.join(players[0]!.user.id, 1) === null && tm.state.entrants.length === 13)
tm.leave(players[11]!.user.id)
tm.join(players[11]!.user.id, players[11]!.user.rating)
check('sign-ups notify the clients', changes >= 14)
advance(3_600_000)
check('at the start time the bracket is seeded and games begin', tm.state.status === 'running' && tm.state.rounds.length === 1)
const found = players.filter((p) => p.inbox.some((m) => m.type === 'MATCH_FOUND'))
const labelled = players.flatMap((p) => p.inbox).find((m): m is Extract<ServerMessage, { type: 'MATCH_FOUND' }> => m.type === 'MATCH_FOUND')
check('tournament games are labelled for the players', labelled?.game.label === 'Weekly Knockout · Quarter-final' || labelled?.game.label === 'Weekly Knockout · Round of 16', labelled?.game.label ?? 'none')
const round1 = tm.state.rounds[0]!
const absentMatch = round1.find((m) => m.a === absent.user.id || m.b === absent.user.id)
check('a player who is not there forfeits', absentMatch?.winner !== null && absentMatch?.winner !== absent.user.id)
check('everyone present with an opponent has a game', found.length === 8, String(found.length))

// Spectating one of the games.
const watcher = mkUser(99, 1500)
hub.connect(watcher.user, watcher.conn)
const live = hub.liveGames()
check('live games are listed strongest first', live.length === 4 && live[0]!.white.rating + live[0]!.black.rating >= live[3]!.white.rating + live[3]!.black.rating)
const watched = live[0]!
hub.message(watcher.user.id, watcher.conn, JSON.stringify({ type: 'SPECTATE', gameId: watched.gameId }))
const start = watcher.inbox.find((m): m is Extract<ServerMessage, { type: 'SPECTATE_START' }> => m.type === 'SPECTATE_START')
check('a spectator gets the game so far', start?.game.gameId === watched.gameId && start.game.moves.length === 0 && start.game.label !== null)
check('the list counts watchers', hub.liveGames().find((g) => g.gameId === watched.gameId)?.watchers === 1)

/** Plays a quick decisive game: White mates (fool's mate reversed) or resigns, as chosen. */
const play = (gameId: string, winnerSide: 'w' | 'b' | 'draw') => {
  const room = [...fakes.values()].map((f) => f.inbox.find((m): m is Extract<ServerMessage, { type: 'MATCH_FOUND' }> => m.type === 'MATCH_FOUND' && m.game.gameId === gameId)).find(Boolean)
  if (!room) throw new Error('no such game')
  const sideOf = (want: 'w' | 'b'): Fake => [...fakes.values()].find((f) => f.inbox.some((m) => m.type === 'MATCH_FOUND' && m.game.gameId === gameId && m.game.color === want))!
  const w = sideOf('w')
  const b = sideOf('b')
  const mv = (f: Fake, ply: number, uci: string) => hub.message(f.user.id, f.conn, JSON.stringify({ type: 'MAKE_MOVE', gameId, ply, uci }))
  mv(w, 0, 'e2e4')
  mv(b, 1, 'e7e5')
  if (winnerSide === 'draw') {
    hub.message(w.user.id, w.conn, JSON.stringify({ type: 'OFFER_DRAW', gameId }))
    hub.message(b.user.id, b.conn, JSON.stringify({ type: 'ANSWER_DRAW', gameId, accept: true }))
  } else {
    const loser = winnerSide === 'w' ? b : w
    hub.message(loser.user.id, loser.conn, JSON.stringify({ type: 'RESIGN', gameId }))
  }
}
const firstGames = round1.filter((m) => m.gameId && !m.winner)
play(watched.gameId, 'w')
check('watchers see the moves and the result', watcher.inbox.some((m) => m.type === 'SPECTATE_MOVE') && watcher.inbox.some((m) => m.type === 'SPECTATE_OVER'))
// One drawn game: the higher seed goes through.
const drawn = tm.state.rounds[0]!.find((m) => m.gameId && !m.winner)!
const seed = (id: string | null) => bySeed(tm.state.entrants).findIndex((e) => e.id === id)
const higher = seed(drawn.a) <= seed(drawn.b) ? drawn.a : drawn.b
play(drawn.gameId!, 'draw')
check('a draw sends the higher seed through', tm.state.rounds[0]!.find((m) => m.a === drawn.a && m.b === drawn.b)?.winner === higher)
// Play out the rest of the tournament: Black always wins.
for (let guard = 0; guard < 40 && tm.state.status === 'running'; guard++) {
  const round = tm.state.rounds[tm.state.rounds.length - 1]!
  const next = round.find((m) => m.gameId && !m.winner)
  if (!next) break
  play(next.gameId!, 'b')
}
check(`the rounds play through to a champion (${firstGames.length} first-round games)`, store.tournament()?.previous?.champion !== undefined && store.tournament()?.status === 'signup' && store.tournament()?.previous?.players === 13)
check('the next week’s tournament is already open', (store.tournament()?.startsAt ?? 0) > now)

// Seasons and the clan war, from the games just played.
check('rated games go into this season’s table', store.seasonTable(50).length > 0 && store.seasonRow(players[0]!.user.id)?.games !== undefined)
store.putClan({ id: 'clan-a', name: 'Alpha', tag: 'ALP', ownerId: players[0]!.user.id, members: players.slice(0, 6).map((p) => p.user.id), createdAt: 0 })
store.putClan({ id: 'clan-b', name: 'Beta', tag: 'BET', ownerId: players[6]!.user.id, members: players.slice(6, 12).map((p) => p.user.id), createdAt: 0 })
const before = { ...store.clanWar(now).points }
const a = players[0]!
const b = players[6]!
for (const f of [a, b]) f.inbox.length = 0
const clanGame = hub.startGame({ w: a.user.id, b: b.user.id }, '3+2')!
play(clanGame, 'w')
check('a win over another clan earns 3 war points', (store.clanWar(now).points['clan-a'] ?? 0) - (before['clan-a'] ?? 0) === 3 && (store.clanWar(now).points['clan-b'] ?? 0) === (before['clan-b'] ?? 0))
now += 8 * 86_400_000
const nextWeek = store.clanWar(now)
check('a new week archives the war table', nextWeek.week !== weekOf(now - 8 * 86_400_000) && Object.keys(nextWeek.points).length === 0 && (nextWeek.last?.points['clan-a'] ?? 0) >= 3)
const ratingBefore = store.user(a.user.id)!.rating
now = Date.UTC(2026, 10, 2)
store.rollSeason(now)
check('a new month starts a new season: ratings softly reset, history kept', store.seasonCurrent() === '2026-11' && store.user(a.user.id)!.rating === softReset(ratingBefore) && store.seasonHistory(a.user.id)[0]?.season === '2026-10')
hub.close()
tm.close()

{
  // Sign-up order is not seeding: the lower-rated player joins first, the final is drawn, the higher seed wins.
  const st = new Store(null)
  const h = new Hub({ store: st, now: () => now, setTimer, clearTimer, pairEveryMs: 0, graceMs: 1000 })
  const weak = st.putUser({ id: 'weak00000001', email: null, googleSub: null, name: 'Weak', createdAt: 0, rating: 900, games: 5, wins: 0, losses: 0, draws: 0 })
  const strong = st.putUser({ id: 'strong000001', email: null, googleSub: null, name: 'Strong', createdAt: 0, rating: 2000, games: 5, wins: 0, losses: 0, draws: 0 })
  const inbox: ServerMessage[] = []
  const conn: Conn = { send: (t) => void (parseServerMessage(t) && inbox.push(parseServerMessage(t)!)), close: () => {} }
  h.connect(weak, conn)
  h.connect(strong, conn)
  const t2 = new TournamentManager({ store: st, now: () => now, setTimer, clearTimer, startGame: (pl, pool, label, cb) => h.startGame(pl, pool, label, cb), isAvailable: (id) => h.isAvailable(id), changed: () => {}, firstStartsAt: now + 1000 })
  t2.join(weak.id, weak.rating)
  t2.join(strong.id, strong.rating)
  t2.start()
  const gameId = t2.state.rounds[0]![0]!.gameId!
  const found = inbox.find((m): m is Extract<ServerMessage, { type: 'MATCH_FOUND' }> => m.type === 'MATCH_FOUND' && m.game.gameId === gameId)!
  const white = found.game.color === 'w' ? weak : strong
  const black = white === weak ? strong : weak
  h.message(white.id, conn, JSON.stringify({ type: 'MAKE_MOVE', gameId, ply: 0, uci: 'e2e4' }))
  h.message(black.id, conn, JSON.stringify({ type: 'MAKE_MOVE', gameId, ply: 1, uci: 'e7e5' }))
  h.message(white.id, conn, JSON.stringify({ type: 'OFFER_DRAW', gameId }))
  h.message(black.id, conn, JSON.stringify({ type: 'ANSWER_DRAW', gameId, accept: true }))
  check('a drawn final goes to the higher seed, not the first to sign up', st.tournament()?.previous?.champion === strong.id)
  h.close()
  t2.close()
}

// ── HTTP routes on a real server ────────────────────────────────────────────
const links: string[] = []
const app = createApp({
  config: { ...loadConfig({ PORT: '0', DATA_FILE: ':memory:' }, []), publicUrl: 'http://localhost:5175' },
  store: new Store(null),
  mailer: async (_to, link) => void links.push(link),
  google: null,
  log: () => {},
  hub: { graceMs: 400, pairEveryMs: 50 },
  tournamentStartsAt: Date.now() + 7 * 86_400_000,
})
await new Promise<void>((r) => app.server.listen(0, r))
const base = `http://localhost:${(app.server.address() as AddressInfo).port}`
const ORIGIN = 'http://localhost:5175'
const post = (path: string, body: unknown, cookie = '') => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, cookie }, body: JSON.stringify(body) })
const signIn = async (email: string): Promise<string> => {
  await post('/api/auth/email', { email })
  const token = new URL(links.at(-1)!).searchParams.get('signin')
  return ((await post('/api/auth/email/verify', { token })).headers.get('set-cookie') ?? '').split(';')[0] ?? ''
}
const get = async <T,>(path: string, cookie = ''): Promise<T> => (await (await fetch(base + path, { headers: { cookie } })).json()) as T
const ada = await signIn('ada@example.com')
const bob = await signIn('bob@example.com')
const season = await get<{ season: string; tiers: unknown[]; me: { tier: string } | null }>('/api/season', ada)
check('GET /api/season: the month, the tiers and you', season.season === seasonOf(Date.now()) && season.tiers.length === 6 && season.me?.tier === 'silver')
check('signing up for the tournament needs an account', (await post('/api/tournament/join', {})).status === 401)
await post('/api/tournament/join', {}, ada)
const t = await get<{ joined: boolean; entrants: unknown[]; status: string }>('/api/tournament', ada)
check('GET /api/tournament shows your sign-up', t.joined && t.entrants.length === 1 && t.status === 'signup')
const created = await post('/api/clans', { name: 'Knights of Chronos', tag: 'kchr' }, ada)
const clanId = ((await created.json()) as { id: string }).id
check('a clan can be founded', created.status === 200 && typeof clanId === 'string')
check('a taken tag is refused', (await post('/api/clans', { name: 'Other', tag: 'KCHR' }, bob)).status === 409)
check('a second clan for the same player is refused', (await post('/api/clans', { name: 'Another', tag: 'ANO' }, ada)).status === 409)
await post(`/api/clans/${clanId}/join`, {}, bob)
const clan = await get<{ tag: string; members: Array<{ name: string }> }>(`/api/clans/${clanId}`)
check('players join clans', clan.tag === 'KCHR' && clan.members.length === 2)
const clans = await get<{ table: Array<{ id: string }>; mine: string | null; week: string }>('/api/clans', bob)
check('GET /api/clans: the war table and your clan', clans.table[0]?.id === clanId && clans.mine === clanId && clans.week === weekOf(Date.now()))
await post('/api/clans/leave', {}, ada)
check('the founder can leave; the clan passes on', (await get<{ members: unknown[]; owner: string }>(`/api/clans/${clanId}`)).members.length === 1)
await post('/api/clans/leave', {}, bob)
check('the last one out closes the clan', (await fetch(`${base}/api/clans/${clanId}`)).status === 404)
check('GET /api/live lists games (none now)', (await get<{ games: unknown[] }>('/api/live')).games.length === 0)
await app.close()

console.log(failures === 0 ? '\nAll league checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
