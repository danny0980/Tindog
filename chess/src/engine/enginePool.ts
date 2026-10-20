import { STOCKFISH_WORKER_PATH } from '../constants/game'
import type { EngineRole } from '../types/engine'
import { StockfishEngine } from './StockfishEngine'

interface Slot {
  promise: Promise<StockfishEngine>
  refs: number
  idleTimer: number | undefined
}

/**
 * Reference-counted Web Worker pool. Each role (play / analysis) gets its own
 * engine so evaluation never blocks the opponent. Workers are terminated after
 * a grace period once nobody holds them, freeing memory and CPU on mobile.
 */
class EnginePool {
  private slots = new Map<EngineRole, Slot>()
  idleTimeoutMs = 45_000

  acquire(role: EngineRole): Promise<StockfishEngine> {
    let slot = this.slots.get(role)
    if (!slot) {
      const promise = StockfishEngine.create(STOCKFISH_WORKER_PATH)
      slot = { promise, refs: 0, idleTimer: undefined }
      this.slots.set(role, slot)
      const drop = () => {
        if (this.slots.get(role)?.promise === promise) this.slots.delete(role)
      }
      // A worker that fails to start, or crashes later, leaves the pool: the next acquire starts a fresh one.
      promise.then((engine) => engine.onCrash(drop), drop)
    }
    window.clearTimeout(slot.idleTimer)
    slot.refs += 1
    return slot.promise
  }

  /** Lets go of `role`. Pass the promise `acquire` returned, so a release after a crash never touches its replacement. */
  release(role: EngineRole, acquired?: Promise<StockfishEngine>): void {
    const slot = this.slots.get(role)
    if (!slot || (acquired && slot.promise !== acquired)) return
    slot.refs = Math.max(0, slot.refs - 1)
    if (slot.refs > 0) return
    window.clearTimeout(slot.idleTimer)
    slot.idleTimer = window.setTimeout(() => {
      if (this.slots.get(role) !== slot || slot.refs > 0) return
      this.slots.delete(role)
      void slot.promise.then((engine) => engine.terminate()).catch(() => undefined)
    }, this.idleTimeoutMs)
  }

  /** Stops searches on every live engine (e.g. when the app is backgrounded). */
  stopAll(): void {
    this.slots.forEach((slot) => void slot.promise.then((engine) => engine.stop()).catch(() => undefined))
  }
}

export const enginePool = new EnginePool()
