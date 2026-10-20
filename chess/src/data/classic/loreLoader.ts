// The Classic characters' history (about 100 kB of text) loads on its own,
// after the app has started, instead of with the first screen. Code on the
// first screen reads it through `loadedLore()` and copes with "not yet";
// the Legends screens import the lore directly (they load later anyway).
import { importWithRetry } from '../../utils/retry'

type LoreModule = typeof import('./lore')

let mod: LoreModule | null = null
let pending: Promise<LoreModule> | null = null

/**
 * Loads the lore (once; the download is retried on a flaky network). If it
 * still fails, the next call tries again; until then everything that reads it
 * falls back (a Classic opponent uses the general lines, no fact is shown).
 */
export const loadLore = (): Promise<LoreModule> =>
  (pending ??= importWithRetry(() => import('./lore')).then(
    (m) => {
      mod = m
      return m
    },
    (err: unknown) => {
      pending = null
      throw err
    },
  ))

/** The lore if it has loaded, else null. */
export const loadedLore = (): LoreModule | null => mod
