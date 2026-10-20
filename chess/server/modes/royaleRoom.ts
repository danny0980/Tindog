// One online Battle Royale, refereed by the server: four seats (people, or
// computer armies filling empty ones), one move at a time around the table.
// Each move has 30 seconds; when time runs out the computer moves for that
// player, and an army whose player misses two turns in a row (or leaves) is
// out. Time is passed in; the manager runs the timers.
import { type PlayerId, type RoyaleLevel, RoyaleGame, chooseRoyaleMove } from '../../src/royale/royale'
import { ROYALE_MAX_STRIKES, ROYALE_MOVE_MS, type RoyaleAction, type RoyaleSeat, type RoyaleSnapshot } from '../../src/online/ranked/modeProtocol'
import { applyRoyaleAction, playerSeat, seatPlayer } from '../../src/online/ranked/modeRules'

export const BOT_LEVEL: RoyaleLevel = 'normal'

export class RoyaleRoom {
  readonly id: string
  /** User id per seat (red, blue, yellow, green); null = a computer army. */
  readonly seats: ReadonlyArray<string | null>
  readonly game = new RoyaleGame()
  readonly actions: RoyaleAction[] = []
  private turnStartedAt: number
  private readonly strikes = [0, 0, 0, 0]
  private readonly random: () => number

  constructor(id: string, seats: ReadonlyArray<string | null>, now: number, random: () => number = Math.random) {
    this.id = id
    this.seats = seats
    this.turnStartedAt = now
    this.random = random
  }

  /** At least two people: results change ratings. */
  get rated(): boolean {
    return this.seats.filter((s) => s !== null).length >= 2
  }
  get over(): boolean {
    return this.game.result !== null
  }
  get turnSeat(): number {
    return playerSeat(this.game.turn)
  }
  seatOf(userId: string): number | null {
    const i = this.seats.indexOf(userId)
    return i >= 0 ? i : null
  }
  isBot(seat: number): boolean {
    return this.seats[seat] === null
  }
  alive(seat: number): boolean {
    return this.game.alive(seatPlayer(seat))
  }
  /** Is any person still in the game? */
  get humansAlive(): boolean {
    return this.seats.some((s, i) => s !== null && this.alive(i))
  }

  turnMsAt(now: number): number | null {
    return this.over ? null : Math.max(0, this.turnStartedAt + ROYALE_MOVE_MS - now)
  }

  private push(action: RoyaleAction, now: number): RoyaleAction {
    this.actions.push(action)
    this.turnStartedAt = now
    return action
  }

  /** A person's move. Returns an error, or the action played. */
  move(seat: number, ply: number, from: [number, number], to: [number, number], now: number): string | RoyaleAction {
    if (this.over) return 'The game is over.'
    if (seat !== this.turnSeat) return 'It is not your turn.'
    if (ply !== this.actions.length) return 'Out of sync.'
    const action: RoyaleAction = { k: 'm', from, to }
    if (!applyRoyaleAction(this.game, action)) return 'That move is not allowed.'
    this.strikes[seat] = 0
    return this.push(action, now)
  }

  /**
   * The computer moves for the seat to move: a computer army's turn, or a
   * person out of time (a strike; too many and their army is out instead).
   */
  autoMove(now: number): RoyaleAction | null {
    if (this.over) return null
    const seat = this.turnSeat
    if (!this.isBot(seat)) {
      this.strikes[seat] = (this.strikes[seat] ?? 0) + 1
      if ((this.strikes[seat] ?? 0) >= ROYALE_MAX_STRIKES) return this.leave(seat, now)
    }
    const m = chooseRoyaleMove(this.game, seatPlayer(seat), BOT_LEVEL, this.random)
    if (!m) return this.leave(seat, now)
    const action: RoyaleAction = this.isBot(seat) ? { k: 'm', from: [m.from[0], m.from[1]], to: [m.to[0], m.to[1]] } : { k: 'm', from: [m.from[0], m.from[1]], to: [m.to[0], m.to[1]], auto: true }
    applyRoyaleAction(this.game, action)
    return this.push(action, now)
  }

  /** A seat's army leaves (resigned, or its player left): its pieces turn to rubble. */
  leave(seat: number, now: number): RoyaleAction | null {
    if (this.over || !this.alive(seat)) return null
    const action: RoyaleAction = { k: 'x', seat }
    applyRoyaleAction(this.game, action)
    return this.push(action, now)
  }

  /** Finishing order, as seats. */
  ranking(): number[] {
    return (this.game.result?.ranking ?? []).map((p: PlayerId) => playerSeat(p))
  }

  snapshot(seat: number, seats: RoyaleSeat[], now: number): RoyaleSnapshot {
    return { gameId: this.id, seat, seats, actions: [...this.actions], turnMs: this.turnMsAt(now), rated: this.rated }
  }
}
