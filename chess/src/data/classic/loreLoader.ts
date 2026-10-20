// The Classic characters' history (about 100 kB of text) loads on its own,
// after the app has started, instead of with the first screen. Code on the
// first screen reads it through `loadedLore()` and copes with "not yet";
// the Legends screens import the lore directly (they load later anyway).
type LoreModule = typeof import('./lore')

let mod: LoreModule | null = null
let pending: Promise<LoreModule> | null = null

/** Loads the lore (once); resolves with the module. */
export const loadLore = (): Promise<LoreModule> =>
  (pending ??= import('./lore').then((m) => {
    mod = m
    return m
  }))

/** The lore if it has loaded, else null. */
export const loadedLore = (): LoreModule | null => mod
