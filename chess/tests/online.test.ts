// Tests for online play: the wire protocol's validation, and whole two-player
// games between two sessions over an in-memory network with a fake clock —
// legality, clocks, draws, rematches, a third player, drops and reconnects.
// Run with `npm run test:online`.
import { replay } from '../src/online/match'
import { memoryNetwork } from '../src/online/network'
import { CODE_ALPHABET, CODE_LENGTH, cleanName, newRoomCode, parseMessage, parseRoomCode } from '../src/online/protocol'
import { OnlineSession, RECONNECT_MS, SILENCE_MS } from '../src/online/session'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}
/** Lets queued network deliveries run. */
const flush = async (rounds = 8) => {
  for (let i = 0; i < rounds; i++) await Promise.resolve()
}

// ── Protocol ────────────────────────────────────────────────────────────────
check('junk is rejected', [null, 42, 'not json', '{"t":"nope"}', { t: 'move', gameId: 'abcd', ply: 0, uci: 'e2e9', clockMs: 0 }, { t: 'move', gameId: 'abcd', ply: -1, uci: 'e2e4', clockMs: 0 }].every((m) => parseMessage(m) === null))
check('oversized messages are rejected', parseMessage(`{"t":"ping","at":1,"x":"${'a'.repeat(70_000)}"}`) === null)
check('a valid move parses', parseMessage('{"t":"move","gameId":"game-1","ply":0,"uci":"e7e8q","clockMs":1000}')?.t === 'move')
check('names are cleaned of control characters and trimmed', cleanName('  Ma\u0000gnus‮  ') === 'Magnus' && cleanName('x'.repeat(50)).length === 20 && cleanName(7) === 'Opponent')
check('a sync with an illegal move list is rejected', parseMessage({ t: 'sync', game: { gameId: 'game-1', white: 'host', tc: { minutes: 0, increment: 0 } }, moves: ['e2e4', 'zz'], clocks: { w: 0, b: 0 }, result: null }) === null)
const code = newRoomCode()
check('room codes use the readable alphabet', code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)))
check('codes are read from typing or an invite link', parseRoomCode(' k7qm-2d ') === 'K7QM2D' && parseRoomCode('https://x.app/?room=K7QM2D&a=1') === 'K7QM2D' && parseRoomCode('K7QM2') === null && parseRoomCode('K7QM0D') === null)

// ── Two players ─────────────────────────────────────────────────────────────
let clock = 1_000_000
const now = () => clock
const store = new Map<string, string>()
const storage = { get: (k: string) => store.get(k) ?? null, set: (k: string, v: string) => void store.set(k, v) }

async function pair(tc = { minutes: 0, increment: 0 }, color: 'w' | 'b' = 'w') {
  const net = memoryNetwork()
  const host = new OnlineSession({ network: net, now, me: () => ({ name: 'Hosta', elo: 1500 }) })
  const guest = new OnlineSession({ network: net, now, storage, me: () => ({ name: 'Guesto', elo: 1300 }) })
  host.host(tc, color)
  await flush()
  guest.join(host.state.code ?? '')
  await flush()
  return { net, host, guest }
}
/** Lets real time pass: every session ticks once a second, as the app does, while the clock runs. */
const advance = async (ms: number, ...sessions: OnlineSession[]) => {
  for (let t = 0; t < ms; t += 1000) {
    clock += Math.min(1000, ms - t)
    for (const s of sessions) s.tick()
    await flush()
  }
}
const play = async (s: OnlineSession, uci: string) => {
  const ok = s.move({ from: uci.slice(0, 2) as never, to: uci.slice(2, 4) as never, ...(uci[4] ? { promotion: uci[4] as never } : {}) })
  await flush()
  return ok
}

{
  const { host, guest } = await pair()
  check('the host gets a code and the guest joins', host.state.phase === 'playing' && guest.state.phase === 'playing')
  check('names and ratings are exchanged', host.state.opponent?.name === 'Guesto' && guest.state.opponent?.elo === 1500)
  check('colours are opposite as the host chose', host.state.match?.myColor === 'w' && guest.state.match?.myColor === 'b')
  check('you cannot move out of turn', !(await play(guest, 'e7e5')))
  check('illegal moves are refused', !(await play(host, 'e2e5')))
  for (const [s, m] of [[host, 'f2f3'], [guest, 'e7e5'], [host, 'g2g4'], [guest, 'd8h4']] as const) await play(s, m)
  check("fool's mate ends the game on both boards", host.state.match?.result?.winner === 'b' && host.state.match.result.reason === 'checkmate' && guest.state.match?.result?.winner === 'b')
  check('both boards agree on the position', host.state.match?.fen === guest.state.match?.fen && replay(host.state.match?.moves ?? [])?.fen() === host.state.match?.fen)
  check('no moves after the game ends', !(await play(host, 'e2e4')))

  // Rematch: colours swap.
  host.rematch()
  await flush()
  check('a rematch needs both players', host.state.match?.result !== null && host.state.match?.rematch.me === true)
  guest.rematch()
  await flush()
  check('rematch starts a fresh game with colours swapped', host.state.match?.moves.length === 0 && host.state.match.myColor === 'b' && guest.state.match?.myColor === 'w' && host.state.match.result === null)
  check('both boards share the new game id', host.state.match?.game.gameId === guest.state.match?.game.gameId)

  // Draw offer → decline → accept.
  await play(guest, 'e2e4')
  await play(host, 'e7e5')
  guest.offerDraw()
  await flush()
  check('a draw offer reaches the opponent', host.state.match?.drawOffer?.from === 'w')
  host.answerDraw(false)
  await flush()
  check('a declined offer clears on both sides', host.state.match?.drawOffer === null && guest.state.match?.drawOffer === null)
  guest.offerDraw()
  await flush()
  host.answerDraw(true)
  await flush()
  check('an accepted offer draws the game', host.state.match?.result?.reason === 'agreement' && guest.state.match?.result?.winner === null)
}

{
  const { host, guest } = await pair()
  // A forged message from a cheating opponent: a move for the wrong side and an illegal one.
  const before = guest.state.match?.fen
  host['send']({ t: 'move', gameId: host.state.match?.game.gameId ?? '', ply: 0, uci: 'e2e5', clockMs: 0 })
  await flush()
  check('an illegal move from the other side never reaches the board', guest.state.match?.fen === before)
  await play(host, 'e2e4')
  check('the game carries on normally after a resync', guest.state.match?.moves.join() === 'e2e4')
  guest.resign()
  await flush()
  check('resignation ends the game for both', host.state.match?.result?.reason === 'resign' && host.state.match.result.winner === 'w')
}

{
  // Clocks: 1+2 — increment, then a flag.
  const { host, guest } = await pair({ minutes: 1, increment: 2 })
  await play(host, 'e2e4')
  check('the clock waits for the first move', host.state.match?.clocks.w === 62_000)
  clock += 10_000
  await play(guest, 'e7e5')
  check('time spent is charged and the increment added', guest.state.match?.clocks.b === 52_000 && host.state.match?.clocks.b === 52_000)
  await advance(70_000, host, guest)
  check('running out of time loses on both boards', host.state.match?.result?.reason === 'timeout' && host.state.match.result.winner === 'b' && guest.state.match?.result?.reason === 'timeout')
}

{
  const { host } = await pair()
  const intruder = new OnlineSession({ network: (host as unknown as { deps: { network: ReturnType<typeof memoryNetwork> } }).deps.network, now, me: () => ({ name: 'Intruder', elo: 1000 }) })
  intruder.join(host.state.code ?? '')
  await flush()
  await new Promise((r) => setTimeout(r, 500))
  await flush()
  check('a third player is turned away', intruder.state.phase === 'error' && /two players/.test(intruder.state.error ?? ''))
}

{
  // Drop and reconnect mid-game.
  const { net, host, guest } = await pair()
  await play(host, 'e2e4')
  await play(guest, 'e7e5')
  net.drop()
  await flush()
  check('both sides notice the drop', host.state.link === 'reconnecting' && guest.state.link === 'reconnecting')
  await play(host, 'g1f3')
  check('the host can still move while the guest is away', host.state.match?.moves.length === 3)
  clock += 3500
  guest.tick()
  await flush(20)
  check('the guest reconnects into its own seat', guest.state.link === 'connected' && host.state.link === 'connected')
  check('the missed move arrives with the resync', guest.state.match?.moves.join() === 'e2e4,e7e5,g1f3' && guest.state.match.fen === host.state.match?.fen)
  await play(guest, 'b8c6')
  check('play continues after reconnecting', host.state.match?.moves.at(-1) === 'b8c6')

  // A silent link is detected by the heartbeat.
  clock += SILENCE_MS + 1000
  host.tick()
  await flush()
  check('a silent link is dropped by the heartbeat', host.state.link === 'reconnecting')
  clock += RECONNECT_MS + 1000
  host.tick()
  await flush()
  check('an opponent gone for good loses by abandonment', host.state.match?.result?.reason === 'abandon' && host.state.match.result.winner === host.state.match.myColor)
}

{
  const net = memoryNetwork()
  const lost = new OnlineSession({ network: net, now, me: () => ({ name: 'Lost', elo: 900 }) })
  lost.join('ZZZZZZ')
  await flush()
  check('joining a code nobody hosts explains why', lost.state.phase === 'error' && /No room/.test(lost.state.error ?? ''))
}

console.log(failures === 0 ? '\nAll online checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
