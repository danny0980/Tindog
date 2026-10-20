// Matchmaking: players wait in a queue per time control and are paired by
// rating. The window starts tight (±100) and widens the longer someone waits,
// so nobody waits forever and close games come first.

export interface Seeker {
  userId: string
  rating: number
  pool: string
  since: number
}

export const BASE_WINDOW = 100
export const WIDEN_PER_5S = 50
export const MAX_WINDOW = 800

/** How far from their rating a seeker accepts an opponent, after waiting until `now`. */
export const windowFor = (s: Seeker, now: number): number => Math.min(MAX_WINDOW, BASE_WINDOW + Math.floor((now - s.since) / 5000) * WIDEN_PER_5S)

export class Matchmaker {
  private readonly queue = new Map<string, Seeker>()

  /** Joins (or re-joins, keeping the wait so far) the queue for a pool. */
  join(userId: string, rating: number, pool: string, now: number): void {
    const prev = this.queue.get(userId)
    this.queue.set(userId, { userId, rating, pool, since: prev && prev.pool === pool ? prev.since : now })
  }

  leave(userId: string): boolean {
    return this.queue.delete(userId)
  }

  isQueued(userId: string): boolean {
    return this.queue.has(userId)
  }

  waiting(pool: string): number {
    let n = 0
    for (const s of this.queue.values()) if (s.pool === pool) n += 1
    return n
  }

  /**
   * Pairs everyone who can be paired now: longest-waiting first, each with
   * the closest-rated opponent both sides' windows accept.
   */
  pair(now: number): Array<[Seeker, Seeker]> {
    const pairs: Array<[Seeker, Seeker]> = []
    const order = [...this.queue.values()].sort((a, b) => a.since - b.since)
    const taken = new Set<string>()
    for (const a of order) {
      if (taken.has(a.userId)) continue
      let best: Seeker | null = null
      for (const b of order) {
        if (b.userId === a.userId || taken.has(b.userId) || b.pool !== a.pool) continue
        const gap = Math.abs(a.rating - b.rating)
        if (gap > windowFor(a, now) || gap > windowFor(b, now)) continue
        if (!best || gap < Math.abs(a.rating - best.rating)) best = b
      }
      if (best) {
        taken.add(a.userId)
        taken.add(best.userId)
        pairs.push([a, best])
      }
    }
    for (const id of taken) this.queue.delete(id)
    return pairs
  }
}
