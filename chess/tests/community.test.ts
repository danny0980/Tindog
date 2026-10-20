// Tests for the community layer (6.17): global stats, the top players in
// each mode, the hall of champions and most titles, clan standings, public
// player profiles, the knockout's live standings, and player ids in every
// list (so names open profiles). Run with `npm run test:community`.
import type { AddressInfo } from 'node:net'
import { createApp } from '../server/app'
import { tournamentStandings } from '../server/bracket'
import { loadConfig } from '../server/config'
import { Store, type TournamentState } from '../server/store'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── Knockout standings (pure) ───────────────────────────────────────────────
{
  const entrants = [
    { id: 'p1', rating: 2000 },
    { id: 'p2', rating: 1900 },
    { id: 'p3', rating: 1800 },
    { id: 'p4', rating: 1700 },
  ]
  // Semi-finals: p1 beat p4, p2 v p3 still playing.
  const running = { entrants, champion: null, rounds: [[{ a: 'p1', b: 'p4', winner: 'p1', gameId: null }, { a: 'p2', b: 'p3', winner: null, gameId: 'g' }]] }
  const st = tournamentStandings(running)
  check('standings: those still in come first, by seed; the knocked out last', st.map((s) => `${s.id}:${s.status}`).join() === 'p1:in,p2:in,p3:in,p4:out' && st[0]?.round === 'Semi-final')
  const done = { entrants, champion: 'p3', rounds: [running.rounds[0]!.map((m) => (m.winner ? m : { ...m, winner: 'p3' })), [{ a: 'p1', b: 'p3', winner: 'p3', gameId: null }]] }
  const fin = tournamentStandings(done)
  check('standings: the champion first, then the finalist, then by how far each got', fin.map((s) => s.id).join() === 'p3,p1,p2,p4' && fin[0]?.status === 'champion' && fin[1]?.round === 'Final')
  check('standings before the start: everyone entered, by seed', tournamentStandings({ entrants, champion: null, rounds: [] }).every((s, i) => s.status === 'entered' && s.seed === i + 1))
}

// ── A community on a real server ────────────────────────────────────────────
const now = Date.UTC(2026, 9, 20, 12)
const store = new Store(null)
const mk = (id: string, name: string, rating: number, games = 10, createdAt = 0) => store.putUser({ id, email: null, googleSub: null, name, createdAt, rating, games, wins: games / 2, losses: games / 2, draws: 0 })
mk('ann000000001', 'Ann', 1900)
mk('ben000000001', 'Ben', 1700)
mk('cy0000000001', 'Cy', 1500, 0)
mk('dee000000001', 'Dee', 1600, 0)
store.putModeRating('cy0000000001', 'cards', { rating: 1333, games: 4, wins: 3, losses: 1, draws: 0 })
store.putModeRating('ann000000001', 'vanish', { rating: 1250, games: 2, wins: 1, losses: 1, draws: 0 })
store.addGame({ id: 'g00000000001', pool: '5+3', white: 'ann000000001', black: 'ben000000001', winner: 'w', reason: 'checkmate', moves: ['e2e4'], ratingChange: { w: 8, b: -8 }, endedAt: now - 3600_000 })
store.addGame({ id: 'g00000000002', pool: 'vanish-5+3', white: 'ben000000001', black: 'ann000000001', winner: 'b', reason: 'resign', moves: ['d2d4'], ratingChange: { w: -8, b: 8 }, endedAt: now - 2 * 86_400_000 })
store.addGame({ id: 'g00000000003', pool: 'cards-5+3', white: 'cy0000000001', black: 'ann000000001', winner: 'w', reason: 'resign', moves: ['e2e4'], ratingChange: { w: 8, b: -8 }, endedAt: now - 30 * 86_400_000 })
store.addRoyaleGame({ id: 'r00000000001', seats: ['dee000000001', null, 'ben000000001', null], ranking: [2, 0, 1, 3], reason: 'last-king', plies: 40, ratingChange: { dee000000001: -5, ben000000001: 5 }, endedAt: now - 7200_000 })
const t = (id: string, champion: string, finishedAt: number): TournamentState => ({ id, name: 'Weekly Knockout', startsAt: finishedAt - 3600_000, pool: '5+3', status: 'done', entrants: [{ id: 'ann000000001', rating: 1900 }, { id: 'ben000000001', rating: 1700 }], rounds: [[{ a: 'ann000000001', b: 'ben000000001', winner: champion, gameId: null }]], champion, finishedAt, previous: null })
store.putTournament(t('t1', 'ann000000001', now - 14 * 86_400_000))
store.putTournament(t('t2', 'ben000000001', now - 7 * 86_400_000))
store.putTournament(t('t3', 'ann000000001', now - 86_400_000))
store.putClan({ id: 'clan1', name: 'Knights', tag: 'KN', ownerId: 'ann000000001', members: ['ann000000001', 'cy0000000001'], createdAt: 0 })
store.addWarPoints('clan1', 6, now)
store.rollSeason(now)
store.recordSeasonGame('ann000000001', true, 1900)
store.recordSeasonGame('ben000000001', false, 1700)

const app = createApp({ config: { ...loadConfig({ PORT: '0', DATA_FILE: ':memory:' }, []), publicUrl: 'http://localhost:5175' }, store, mailer: async () => {}, google: null, now: () => now, log: () => {}, hub: { pairEveryMs: 0 } })
await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()))
const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
const get = async <T>(path: string): Promise<{ status: number; body: T }> => {
  const r = await fetch(`${base}${path}`)
  return { status: r.status, body: (await r.json()) as T }
}

interface Community {
  stats: { players: number; ratedPlayers: number; games: number; gamesToday: number; activeThisWeek: number; clans: number; weekByMode: Record<string, number> }
  live: { online: number }
  top: Record<string, Array<{ id: string; name: string; rating: number }>>
  champions: Array<{ id: string; champion: { id: string; name: string } }>
  titles: Array<{ player: { id: string; name: string }; titles: number }>
  clans: Array<{ tag: string; points: number; members: number }>
}
const c = (await get<Community>('/api/community')).body
check('community stats: players, rated players, games', c.stats.players === 4 && c.stats.ratedPlayers === 3 && c.stats.games === 4, JSON.stringify(c.stats))
check('games today and players active this week (two-player and Battle Royale)', c.stats.gamesToday === 2 && c.stats.activeThisWeek === 3)
check('this week by mode', c.stats.weekByMode.chess === 1 && c.stats.weekByMode.vanish === 1 && c.stats.weekByMode.cards === 0 && c.stats.weekByMode.royale === 1)
check('live counts come along', c.live.online === 0 && c.stats.clans === 1)
check('top players per mode, with ids for their profiles', c.top.chess?.[0]?.name === 'Ann' && c.top.chess.length === 2 && c.top.cards?.[0]?.id === 'cy0000000001' && c.top.vanish?.[0]?.rating === 1250 && c.top.royale?.length === 0)
check('the hall of champions, newest first', c.champions.map((x) => x.id).join() === 't3,t2,t1' && c.champions[0]?.champion.name === 'Ann')
check('most titles', c.titles[0]?.player.name === 'Ann' && c.titles[0].titles === 2 && c.titles[1]?.titles === 1)
check('clan standings with this week’s points', c.clans[0]?.tag === 'KN' && c.clans[0].points === 6 && c.clans[0].members === 2)

interface Profile {
  name: string
  rating: number
  tier: string
  modes: Record<string, { rating: number }>
  season: { rank: number | null; row: { games: number } | null }
  clan: { tag: string } | null
  titles: unknown[]
  recent: Array<{ kind: string; opponent: string; result: string }>
  online: boolean
}
const ann = (await get<Profile>('/api/players/ann000000001')).body
check('a public profile: ratings in every mode, tier and clan', ann.name === 'Ann' && ann.rating === 1900 && ann.tier === 'diamond' && ann.modes.vanish?.rating === 1250 && ann.modes.cards?.rating === 1200 && ann.clan?.tag === 'KN')
check('…season rank, titles and recent games (newest first, every mode)', ann.season.rank === 1 && ann.titles.length === 2 && ann.recent.map((g) => g.kind).join() === 'chess,vanish,cards' && ann.recent[0]?.result === 'win' && ann.recent[0].opponent === 'Ben')
const dee = (await get<Profile>('/api/players/dee000000001')).body
check('Battle Royale games count in a profile', dee.recent[0]?.kind === 'royale' && dee.recent[0].result === 'loss' && dee.season.rank === null)
check('an unknown player is a 404', (await get('/api/players/nobody000001')).status === 404)
const profileText = JSON.stringify((await get<Record<string, unknown>>('/api/players/ann000000001')).body)
check('profiles never expose an email or a Google id', !profileText.includes('email') && !profileText.includes('googleSub'))

// Ids in every list, so names can open profiles.
const season = (await get<{ table: Array<{ id: string }> }>('/api/season')).body
const modes = (await get<{ tables: Record<string, Array<{ id: string }>> }>('/api/modes')).body
const board = (await get<{ players: Array<{ id: string }> }>('/api/leaderboard')).body
const clan = (await get<{ members: Array<{ id: string }> }>('/api/clans/clan1')).body
check('the season table, mode tables, leaderboard and clan members carry player ids', season.table[0]?.id === 'ann000000001' && modes.tables.cards?.[0]?.id === 'cy0000000001' && board.players[0]?.id === 'ann000000001' && clan.members.every((m) => typeof m.id === 'string'))
const tour = (await get<{ standings: Array<{ player: { id: string } }> }>('/api/tournament')).body
check('the tournament comes with its standings', Array.isArray(tour.standings))

// Crash reports from browsers are logged (and refused when empty).
const report = (body: unknown) => fetch(`${base}/api/client-error`, { method: 'POST', headers: { origin: 'http://localhost:5175', 'content-type': 'application/json' }, body: JSON.stringify(body) })
check('a browser crash report is accepted', (await report({ message: 'TypeError: x is undefined', where: 'boundary:Legends', url: '/' })).status === 204)
check('an empty report is refused', (await report({})).status === 400)

await app.close()
store.close()
if (failures > 0) {
  console.error(`\n${failures} community check(s) failed.`)
  process.exit(1)
}
console.log('\nAll community checks passed.')
