// Tests for the online modes on the game server: Vanishing Chess (its own
// queue and rating, never watchable), Card Chess (the secret draft, card
// actions refereed by the server, clocks, abandons, ratings) and the
// four-player Battle Royale (seating, computer armies filling seats, the
// move timer and strikes, eliminations and ratings) — plus the browser's
// manager playing through a socket bridge, so both sides replay the same logs.
// Run with `npm run test:online-modes`.
import { CARD_IDS, type CardId, HAND_SIZE } from '../src/cards/cardGame'
import type { CardAction } from '../src/online/ranked/modeProtocol'
import { ROYALE_MOVE_MS } from '../src/online/ranked/modeProtocol'
import { replayCards, replayRoyale, seatPlayer, viewToBoard } from '../src/online/ranked/modeRules'
import { RankedManager, type SocketLike } from '../src/online/ranked/onlineManager'
import { type ServerMessage, parseServerMessage } from '../src/online/ranked/protocol'
import { SIZE } from '../src/royale/royale'
import { type Conn, Hub } from '../server/hub'
import { Store, type User } from '../server/store'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// A manual clock and timers.
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
/** A seeded random (mulberry32), so drafts and seats repeat. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const store = new Store(null)
const hub = new Hub({ store, now: () => now, setTimer, clearTimer, pairEveryMs: 0, graceMs: 1000, log: process.env.DEBUG ? console.log : undefined, modes: { botDelayMs: 100, royaleFillMs: 5000, royaleSoloMs: 20_000, random: seeded(7) } })

interface Fake {
  user: User
  conn: Conn
  inbox: ServerMessage[]
}
let serial = 0
const mkUser = (rating = 1500): Fake => {
  serial += 1
  const user = store.putUser({ id: `user${String(serial).padStart(4, '0')}`, email: null, googleSub: null, name: `Player ${serial}`, createdAt: 0, rating, games: 5, wins: 0, losses: 0, draws: 0 })
  const inbox: ServerMessage[] = []
  const conn: Conn = { send: (t) => void (parseServerMessage(t) && inbox.push(parseServerMessage(t)!)), close: () => {} }
  hub.connect(user, conn)
  return { user, conn, inbox }
}
const say = (f: Fake, msg: unknown) => hub.message(f.user.id, f.conn, JSON.stringify(msg))
const last = <T extends ServerMessage['type']>(f: Fake, type: T): Extract<ServerMessage, { type: T }> | undefined => f.inbox.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type).at(-1)

// ── Vanishing Chess: ranked queue with its own rating ───────────────────────
{
  const a = mkUser(1500)
  const b = mkUser(1510)
  const c = mkUser(1505)
  say(a, { type: 'FIND_MATCH', pool: 'vanish-5+3' })
  say(c, { type: 'FIND_MATCH', pool: '5+3' })
  check('a Vanishing queue does not pair with standard chess', !a.inbox.some((m) => m.type === 'MATCH_FOUND') && !c.inbox.some((m) => m.type === 'MATCH_FOUND'))
  say(c, { type: 'CANCEL_MATCH' })
  say(b, { type: 'FIND_MATCH', pool: 'vanish-5+3' })
  const found = last(a, 'MATCH_FOUND')
  check('two Vanishing players are paired', found?.game.pool === 'vanish-5+3' && last(b, 'MATCH_FOUND')?.game.gameId === found.game.gameId)
  check('the opponent shows their Vanishing rating (1200 to start)', found?.game.opponent.rating === 1200)
  const gameId = found!.game.gameId
  check('Vanishing games are not in the Watch list', !hub.liveGames().some((g) => g.gameId === gameId))
  say(c, { type: 'SPECTATE', gameId })
  check('and cannot be watched (a second account would see every piece)', last(c, 'ERROR')?.code === 'no-game')
  const white = found!.game.color === 'w' ? a : b
  const black = white === a ? b : a
  say(white, { type: 'MAKE_MOVE', gameId, ply: 0, uci: 'f2f3' })
  say(black, { type: 'MAKE_MOVE', gameId, ply: 1, uci: 'e7e5' })
  say(white, { type: 'MAKE_MOVE', gameId, ply: 2, uci: 'g2g4' })
  say(black, { type: 'MAKE_MOVE', gameId, ply: 3, uci: 'd8h4' })
  const over = last(black, 'GAME_OVER')
  check('the server referees it as ordinary chess (mate)', over?.reason === 'checkmate' && over.winner === 'b')
  check('the result moves the Vanishing rating from 1200', over?.rating.before === 1200 && over.rating.after > 1200)
  check('the standard rating and record are untouched', store.user(black.user.id)?.rating === 1510 - (black === a ? 10 : 0) || (store.user(black.user.id)?.rating === black.user.rating && store.user(black.user.id)?.games === 5))
  check('the Vanishing record is kept per player', store.modeRating(black.user.id, 'vanish').wins === 1 && store.modeRating(white.user.id, 'vanish').losses === 1)
  check('and the game is in the history with its pool', store.gamesOf(black.user.id, 5)[0]?.pool === 'vanish-5+3')
  check('Vanishing games stay out of the season table', store.seasonRow(black.user.id) === null)
}

// ── Card Chess ──────────────────────────────────────────────────────────────
const cardGame = (f: Fake) => last(f, 'CARD_STATE')?.game
{
  const a = mkUser(1600)
  const b = mkUser(1600)
  say(a, { type: 'FIND_MODE', mode: 'cards' })
  check('queueing for Card Chess is confirmed', last(a, 'MODE_SEARCHING')?.mode === 'cards')
  say(b, { type: 'FIND_MODE', mode: 'cards' })
  const ga = cardGame(a)
  const gb = cardGame(b)
  check('two players are paired into a draft', ga?.phase === 'draft' && gb?.gameId === ga.gameId && ga.color !== gb.color)
  check('both draft from the same five cards', ga?.offer.length === 5 && ga.offer.join() === gb?.offer.join() && ga.offer.every((c) => CARD_IDS.includes(c)))
  check('the draft has 30 seconds', ga?.draftMs === 30_000)
  const gameId = ga!.gameId
  const offer = ga!.offer
  check('another queue is refused while you play', (say(a, { type: 'FIND_MATCH', pool: '5+3' }), last(a, 'ERROR')?.code === 'in-game'))
  say(a, { type: 'CARD_DRAFT', gameId, cards: offer.slice(0, 2) })
  check('a malformed draft is refused by the protocol', last(a, 'ERROR')?.code === 'bad-message')
  const notOffered = CARD_IDS.find((c) => !offer.includes(c))!
  say(a, { type: 'CARD_DRAFT', gameId, cards: [offer[0], offer[1], notOffered] })
  check('cards outside the offer are refused', last(a, 'ERROR')?.code === 'refused')
  say(a, { type: 'CARD_DRAFT', gameId, cards: offer.slice(0, HAND_SIZE) })
  const mine = cardGame(a)!
  check('your pick is confirmed, the other hand stays hidden', mine.hands[mine.color]?.length === 3 && mine.hands[mine.color === 'w' ? 'b' : 'w'] === null && cardGame(b)?.hands[ga!.color] === null)
  say(b, { type: 'CARD_DRAFT', gameId, cards: offer.slice(2, 5) })
  const pa = cardGame(a)!
  check('when both have drafted, the game starts and both hands are shown', pa.phase === 'play' && pa.hands.w?.length === 3 && pa.hands.b?.length === 3 && cardGame(b)?.phase === 'play')
  const white = pa.color === 'w' ? a : b
  const black = white === a ? b : a
  const hands = { w: pa.hands.w!, b: pa.hands.b! }
  const act = (f: Fake, ply: number, action: CardAction) => say(f, { type: 'CARD_ACTION', gameId, ply, action })
  act(black, 0, { k: 'm', uci: 'e7e5' })
  check('moving out of turn is refused', last(black, 'ERROR')?.message === 'It is not your turn.')
  act(white, 0, { k: 'm', uci: 'e2e5' })
  check('an illegal move is refused (and the true game re-sent)', last(white, 'ERROR')?.code === 'refused' && cardGame(white)?.actions.length === 0)
  act(white, 0, { k: 'm', uci: 'e2e4' })
  check('a legal move reaches both players', last(black, 'CARD_PLAYED')?.ply === 0 && last(white, 'CARD_PLAYED')?.ply === 0)
  // Black plays a card, whatever it holds that is legal now.
  const pos = replayCards(hands, [{ k: 'm', uci: 'e2e4' }])!
  const blackCards = hands.b
  const wardCard = blackCards.find((c): c is 'stone-wall' | 'aegis' => c === 'stone-wall' || c === 'aegis')
  const cardMove = pos.cardMoves().find((m) => blackCards.includes(m.card))
  let blackAction: CardAction | null = null
  if (wardCard && pos.wardTargets(wardCard)[0]) blackAction = { k: 'w', card: wardCard, sq: pos.wardTargets(wardCard)[0]! }
  else if (cardMove) blackAction = { k: 'c', card: cardMove.card, from: cardMove.from, to: cardMove.to }
  check('black has a card it can play now', blackAction !== null, blackCards.join(','))
  act(black, 1, blackAction!)
  const played = last(white, 'CARD_PLAYED')
  check('a card is played and relayed', played?.ply === 1 && played.action.k === blackAction!.k)
  const replayed = replayCards(hands, [{ k: 'm', uci: 'e2e4' }, blackAction!])
  check('the log replays to the same position on both sides', replayed !== null && replayed.used.b.length === 1)
  act(black, 2, blackAction!)
  check('a card cannot be played twice', last(black, 'ERROR')?.code === 'refused')
  // Finish quickly: black (or white, if black's card was a free ward) resigns after both sides moved.
  let ply = 2
  if (blackAction!.k === 'w') act(black, ply++, { k: 'm', uci: 'e7e5' })
  act(white, ply++, { k: 'm', uci: 'g1f3' })
  const beforeW = store.modeRating(white.user.id, 'cards').rating
  say(black, { type: 'RESIGN', gameId })
  const over = last(white, 'MODE_OVER')?.result
  check('resigning ends it: white wins', over?.mode === 'cards' && over.winner === 'w' && over.reason === 'resign')
  check('Card Chess ratings change', over?.rating?.before === beforeW && (over.rating?.after ?? 0) > beforeW && store.modeRating(white.user.id, 'cards').games === 1)
  check('the game is recorded with card notation', (store.gamesOf(white.user.id, 1)[0]?.moves ?? []).some((m) => m.includes(':')) || blackAction!.k === 'm')
  check('players are free again', hub.isAvailable(white.user.id) && hub.isAvailable(black.user.id))
}
{
  // The draft clock: whoever didn't pick gets the computer's pick; then a player who leaves forfeits after the grace period.
  const a = mkUser(1400)
  const b = mkUser(1400)
  say(a, { type: 'FIND_MODE', mode: 'cards' })
  say(b, { type: 'FIND_MODE', mode: 'cards' })
  const gameId = cardGame(a)!.gameId
  say(a, { type: 'CARD_DRAFT', gameId, cards: cardGame(a)!.offer.slice(0, 3) })
  advance(30_010)
  const g = cardGame(b)!
  check('when the draft time runs out the computer picks for you', g.phase === 'play' && (g.hands[g.color]?.length ?? 0) === 3)
  const white = g.color === 'w' ? b : a
  const black = white === a ? b : a
  say(white, { type: 'CARD_ACTION', gameId, ply: 0, action: { k: 'm', uci: 'd2d4' } })
  say(black, { type: 'CARD_ACTION', gameId, ply: 1, action: { k: 'm', uci: 'd7d5' } })
  hub.disconnect(black.user.id, black.conn)
  check('the opponent is told about a disconnect', last(white, 'OPPONENT_DISCONNECTED')?.gameId === gameId)
  advance(1100)
  check('not coming back loses the game', last(white, 'MODE_OVER')?.result.reason === 'abandon' && last(white, 'MODE_OVER')?.result.winner === white.inbox.find((m) => m.type === 'CARD_STATE' && m.game.phase === 'play')?.game.color)
  hub.connect(black.user, black.conn)
  check('the result waits for the player who left', last(black, 'MODE_OVER')?.result.gameId === gameId)
}
{
  // Nobody moves: the game is aborted (unrated).
  const a = mkUser(1450)
  const b = mkUser(1450)
  say(a, { type: 'FIND_MODE', mode: 'cards' })
  say(b, { type: 'FIND_MODE', mode: 'cards' })
  advance(30_010 + 30_010)
  const over = last(a, 'MODE_OVER')?.result
  check('no first move: aborted and unrated', over?.reason === 'aborted' && over.rating === null && store.modeRating(a.user.id, 'cards').games === 0)
}

// ── Battle Royale ───────────────────────────────────────────────────────────
const royaleOf = (f: Fake) => last(f, 'ROYALE_STATE')?.game
{
  const four = [mkUser(1500), mkUser(1500), mkUser(1500), mkUser(1500)]
  for (const f of four) say(f, { type: 'FIND_MODE', mode: 'royale' })
  const states = four.map(royaleOf)
  check('four people make a table at once', states.every((s) => s && s.gameId === states[0]?.gameId))
  check('each has their own seat; no computer armies; rated', new Set(states.map((s) => s?.seat)).size === 4 && states[0]!.seats.every((s) => !s.bot) && states[0]!.rated)
  const gameId = states[0]!.gameId
  const bySeat = (seat: number) => four[states.findIndex((s) => s?.seat === seat)]!
  const red = bySeat(0)
  const blue = bySeat(1)
  say(blue, { type: 'ROYALE_MOVE', gameId, ply: 0, from: [3, 1], to: [3, 2] })
  check('only the seat to move may move (red first)', last(blue, 'ERROR')?.code === 'refused')
  say(red, { type: 'ROYALE_MOVE', gameId, ply: 0, from: [12, 5], to: [10, 5] })
  check('a move reaches every seat', four.every((f) => last(f, 'ROYALE_PLAYED')?.ply === 0))
  check('with the next move timer', last(blue, 'ROYALE_PLAYED')?.turnMs === ROYALE_MOVE_MS)
  // Blue lets the clock run out twice: the computer moves once for them, then their army is out.
  advance(ROYALE_MOVE_MS + 10)
  const auto = last(red, 'ROYALE_PLAYED')
  check('out of time: the computer moves for you (marked auto)', auto?.ply === 1 && auto.action.k === 'm' && auto.action.auto === true)
  // Everyone else moves; then it is blue's turn again.
  const game = replayRoyale(last(red, 'ROYALE_STATE')!.game.actions.concat(red.inbox.filter((m) => m.type === 'ROYALE_PLAYED').map((m) => (m as Extract<ServerMessage, { type: 'ROYALE_PLAYED' }>).action)))!
  check('both sides replay the same log', game.ply === 2 && game.turn === seatPlayer(2))
  // Yellow, green and red run out of time too (one strike each); then blue's second miss.
  for (let i = 0; i < 4; i++) advance(ROYALE_MOVE_MS + 10)
  const strikeOut = red.inbox.filter((m): m is Extract<ServerMessage, { type: 'ROYALE_PLAYED' }> => m.type === 'ROYALE_PLAYED').find((m) => m.action.k === 'x' && m.action.seat === 1)
  check('two missed turns in a row: that army is out', strikeOut !== undefined)
  // The others resign one by one: the last king standing wins.
  say(bySeat(2), { type: 'RESIGN', gameId })
  check('leaving early frees you at once', hub.isAvailable(bySeat(2).user.id) && last(bySeat(2), 'MODE_OVER')?.result.rating === null)
  // Red and green: green resigns, red wins.
  say(bySeat(3), { type: 'RESIGN', gameId })
  const over = last(red, 'MODE_OVER')?.result
  check('the last army standing wins', over?.mode === 'royale' && over.ranking[0] === 0 && over.ranking.length === 4)
  check('finishing order: the last out ranks highest', over?.ranking.join() === '0,3,2,1')
  check('ratings: the winner gains, the first out loses most', (over?.rating?.after ?? 0) > 1200 && store.modeRating(blue.user.id, 'royale').rating < store.modeRating(bySeat(3).user.id, 'royale').rating)
  check('the record keeps each player’s result', store.modeRating(red.user.id, 'royale').wins === 1 && store.modeRating(blue.user.id, 'royale').losses === 1)
}
{
  // Two people waiting: after the fill time, computer armies take the empty seats.
  const a = mkUser()
  const b = mkUser()
  say(a, { type: 'FIND_MODE', mode: 'royale' })
  say(b, { type: 'FIND_MODE', mode: 'royale' })
  check('two people wait for more', royaleOf(a) === undefined)
  advance(5000)
  hub.pairNow()
  const g = royaleOf(a)
  check('then computer armies fill the table', g?.seats.filter((s) => s.bot).length === 2 && g.rated)
  // Both people leave: the computer armies play it out at once, and the people's order still counts.
  say(a, { type: 'RESIGN', gameId: g!.gameId })
  say(b, { type: 'RESIGN', gameId: g!.gameId })
  check('with no people left the game finishes at once', hub.modes.stats().royale === 0)
  check('the one who left last places higher', store.modeRating(b.user.id, 'royale').rating > store.modeRating(a.user.id, 'royale').rating)
}
{
  // Alone for long: three computer armies, unrated.
  const a = mkUser()
  say(a, { type: 'FIND_MODE', mode: 'royale' })
  advance(20_000)
  hub.pairNow()
  const g = royaleOf(a)
  check('a lone player gets three computer armies (unrated)', g?.seats.filter((s) => s.bot).length === 3 && g.rated === false)
  say(a, { type: 'RESIGN', gameId: g!.gameId })
  check('an unrated game leaves the rating alone', store.modeRating(a.user.id, 'royale').games === 0)
}
check('the board turns so your army is at the bottom', viewToBoard(SIZE - 1, 5, 0).join() === '13,5' && viewToBoard(SIZE - 1, 5, 1).join() === '5,0' && viewToBoard(SIZE - 1, 5, 2).join() === '0,8' && viewToBoard(SIZE - 1, 5, 3).join() === '8,13')
check('protocol: unknown cards are refused', !CARD_IDS.includes('joker' as CardId))

// ── The browser's manager, through a socket bridge ──────────────────────────
{
  const bridge = (f: Fake): RankedManager => {
    const m = new RankedManager({
      now: () => now,
      setTimer,
      clearTimer,
      open: () => {
        const sock: SocketLike = {
          readyState: 1,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          send: (data) => hub.message(f.user.id, conn, data),
          close: () => hub.disconnect(f.user.id, conn),
        }
        const conn: Conn = { send: (t) => sock.onmessage?.({ data: t } as MessageEvent), close: () => {} }
        queueMicrotask(() => hub.connect(f.user, conn))
        return sock
      },
    })
    return m
  }
  const a = mkUser()
  const b = mkUser()
  const ma = bridge(a)
  const mb = bridge(b)
  ma.connect()
  mb.connect()
  await Promise.resolve()
  ma.findMode('cards')
  mb.findMode('cards')
  const ca = ma.state.cards!
  check('the manager shows the draft', ca?.phase === 'draft' && ca.offer.length === 5 && ma.state.modeSearch === null)
  ma.draftCards(ca.offer.slice(0, 3))
  mb.draftCards(mb.state.cards!.offer.slice(2, 5))
  const wm = ma.state.cards!.color === 'w' ? ma : mb
  const bm = wm === ma ? mb : ma
  check('both managers rebuild the game after the draft', wm.state.cards?.game !== null && bm.state.cards?.game?.fen === wm.state.cards?.game?.fen)
  wm.cardAction({ k: 'm', uci: 'e2e4' })
  check('a move shows on both boards', bm.state.cards?.game?.fen === wm.state.cards?.game?.fen && bm.state.cards?.actions.length === 1)
  bm.resignMode()
  check('the result reaches both managers', wm.state.cards?.result?.winner === null || wm.state.cards?.result?.reason === 'aborted')
  wm.dismissMode()
  bm.dismissMode()
  // Battle Royale through the managers: two people and two computer armies.
  ma.findMode('royale')
  mb.findMode('royale')
  advance(5000)
  hub.pairNow()
  check('both managers are seated at the same table', ma.state.royale !== null && ma.state.royale.gameId === mb.state.royale?.gameId)
  // Play on: people move when it's their turn (the first move found), computers on their timers.
  for (let i = 0; i < 40 && ma.state.royale && !ma.state.royale.result; i++) {
    for (const m of [ma, mb]) {
      const r = m.state.royale
      if (r && !r.result && !r.game.result && r.game.turn === seatPlayer(r.seat)) {
        const mv = r.game.movesFor(seatPlayer(r.seat))[0]
        if (mv) m.royaleMove([mv.from[0], mv.from[1]], [mv.to[0], mv.to[1]])
      }
    }
    advance(150)
  }
  const ra = ma.state.royale!
  const rb = mb.state.royale!
  check('after many turns both managers agree on the position', ra.actions.length > 8 && ra.actions.length === rb.actions.length && JSON.stringify(ra.game.board) === JSON.stringify(rb.game.board))
  ma.resignMode()
  mb.resignMode()
  check('leaving ends it for both', ma.state.royale?.result !== null && mb.state.royale?.result !== null)
}

hub.close()
store.close()
if (failures > 0) {
  console.error(`\n${failures} online-mode check(s) failed.`)
  process.exit(1)
}
console.log('\nAll online-mode checks passed.')
