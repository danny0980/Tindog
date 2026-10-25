// Tests for friends, referrals and emotes on the game server. Run with
// `npm run test:social`.
import type { AddressInfo } from 'node:net'
import { createApp } from '../server/app'
import { loadConfig } from '../server/config'
import { Store } from '../server/store'
import { parseClientMessage, parseServerMessage } from '../src/online/ranked/protocol'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

const now = Date.UTC(2026, 9, 20, 12)
const store = new Store(null)
const mk = (id: string, name: string, createdAt = now) => store.putUser({ id, email: null, googleSub: null, name, createdAt, rating: 1500, games: 0, wins: 0, losses: 0, draws: 0 })
mk('ann000000001', 'Ann')
mk('ben000000001', 'Ben')
mk('cy0000000001', 'Cy', now - 60 * 86_400_000)

const app = createApp({ config: { ...loadConfig({ PORT: '0', DATA_FILE: ':memory:' }, []), publicUrl: 'http://localhost:5175' }, store, mailer: async () => {}, google: null, now: () => now, log: () => {}, hub: { pairEveryMs: 0 } })
await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', () => r()))
const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
const token = (id: string) => app.auth.startSession(id).token
const tok = { ann: token('ann000000001'), ben: token('ben000000001'), cy: token('cy0000000001') }
const call = async (who: keyof typeof tok, path: string, method = 'GET', body?: unknown) => {
  const r = await fetch(`${base}/api${path}`, { method, headers: { authorization: `Bearer ${tok[who]}`, origin: 'http://localhost:5175', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  return { status: r.status, body: (await r.json()) as Record<string, unknown> }
}

try {
  // ── Friends ───────────────────────────────────────────────────────────────
  const empty = await call('ann', '/friends')
  check('your friend code is your player id; no friends yet', empty.body.code === 'ann000000001' && Array.isArray(empty.body.friends) && (empty.body.friends as unknown[]).length === 0)
  const bad = await call('ann', '/friends', 'POST', { code: 'nobody' })
  check('an unknown code is refused', bad.status === 404)
  const self = await call('ann', '/friends', 'POST', { code: 'ann000000001' })
  check('you can’t add yourself', self.status === 404)
  const req = await call('ann', '/friends', 'POST', { code: 'BEN000000001 ' })
  check('a request is sent (codes are trimmed and case-insensitive)', req.status === 200 && req.body.result === 'requested')
  const benSees = (await call('ben', '/friends')).body.friends as Array<{ id: string; status: string; name: string }>
  check('they see an incoming request', benSees.length === 1 && benSees[0]?.status === 'incoming' && benSees[0]?.name === 'Ann')
  const annSees = (await call('ann', '/friends')).body.friends as Array<{ status: string }>
  check('you see it as outgoing', annSees[0]?.status === 'outgoing')
  const accept = await call('ben', '/friends/ann000000001/accept', 'POST', {})
  check('accepting makes you friends on both sides', accept.status === 200 && ((await call('ann', '/friends')).body.friends as Array<{ status: string }>)[0]?.status === 'friend' && ((await call('ben', '/friends')).body.friends as Array<{ status: string }>)[0]?.status === 'friend')
  check('accepting a request that doesn’t exist fails', (await call('cy', '/friends/ann000000001/accept', 'POST', {})).status === 404)
  // Asking someone who already asked you: friends at once.
  await call('cy', '/friends', 'POST', { code: 'ann000000001' })
  const mutual = await call('ann', '/friends', 'POST', { code: 'cy0000000001' })
  check('asking back someone who asked you makes you friends', mutual.body.result === 'friends')
  await call('ann', '/friends/ben000000001', 'DELETE', {})
  check('removing a friend removes both sides', !((await call('ben', '/friends')).body.friends as Array<{ id: string }>).some((f) => f.id === 'ann000000001'))
  check('signed out: friends need an account', (await fetch(`${base}/api/friends`)).status === 401)

  // ── Referrals ─────────────────────────────────────────────────────────────
  const ref = await call('ben', '/referral', 'POST', { code: 'ann000000001' })
  check('a new account can use a referral code', ref.status === 200 && ref.body.referredBy === 'Ann')
  check('…only once', (await call('ben', '/referral', 'POST', { code: 'cy0000000001' })).status === 409)
  check('referrals are counted for the referrer', (await call('ann', '/referral')).body.referred === 1 && (await call('ben', '/referral')).body.referredBy === 'Ann')
  check('an old account can’t be referred', (await call('cy', '/referral', 'POST', { code: 'ann000000001' })).status === 400)
  check('you can’t refer yourself', (await call('ann', '/referral', 'POST', { code: 'ann000000001' })).status === 404)
} finally {
  await app.close()
}

// ── Emotes (protocol) ───────────────────────────────────────────────────────
check('a client emote parses', parseClientMessage(JSON.stringify({ type: 'EMOTE', gameId: 'abc12345', emote: 'gg' }))?.type === 'EMOTE')
check('an unknown emote is dropped', parseClientMessage(JSON.stringify({ type: 'EMOTE', gameId: 'abc12345', emote: 'insult' })) === null)
check('a server emote names the sender', (parseServerMessage(JSON.stringify({ type: 'EMOTE', gameId: 'abc12345', emote: 'wow', by: 'b' })) as { by?: string } | null)?.by === 'b')

if (failures > 0) {
  console.error(`\n${failures} social test(s) failed`)
  process.exit(1)
}
console.log('\nAll social tests passed.')
