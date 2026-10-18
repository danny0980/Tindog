// Reliability tests: retrying downloads, the roster loader's error/retry
// states, profile migrations, and persistence backups / corruption recovery.
// Run with `npm run test:resilience`.
import { createRosterLoader, type RosterImporter } from '../src/data/campaign/loader'
import chronicle from '../src/data/campaign/rosters/chronicle'
import { PROFILE_VERSION, migrateProfile, runMigrations } from '../src/stores/migrations'
import { createDefaultProfile, loadProfile } from '../src/stores/profileStore'
import type { Boss, GrandRealmId } from '../src/types/campaign'
import { failedModuleUrl, isChunkLoadError, withRetry } from '../src/utils/retry'
import { type KeyValueStorage, createPersistentStore } from '../src/utils/store'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── withRetry ────────────────────────────────────────────────────────────────
let calls = 0
const flaky = async () => {
  calls += 1
  if (calls < 3) throw new Error('Failed to fetch dynamically imported module: /assets/x.js')
  return 'ok'
}
check('retries twice then succeeds', (await withRetry(flaky, [0, 0])) === 'ok' && calls === 3)
calls = 0
let lastError: unknown = null
await withRetry(async () => {
  calls += 1
  throw new Error(`attempt ${calls}`)
}, [0, 0]).catch((e: unknown) => (lastError = e))
check('gives up after 3 attempts with the last error', calls === 3 && lastError instanceof Error && lastError.message === 'attempt 3')
check('chunk errors are recognised', isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: x')) && isChunkLoadError(new TypeError('Importing a module script failed.')) && !isChunkLoadError(new Error('x is undefined')))

check('failed chunk URL is extracted for a cache-busted retry', failedModuleUrl(new TypeError('Failed to fetch dynamically imported module: https://app.example/assets/mythic-Ab12.js')) === 'https://app.example/assets/mythic-Ab12.js' && failedModuleUrl(new TypeError('Importing a module script failed.')) === null)

// ── Roster loader ────────────────────────────────────────────────────────────
const ok = async () => ({ default: chronicle as readonly Boss[] })
let attempts = 0
let online = false
const importers = (fn: RosterImporter): Record<GrandRealmId, RosterImporter> => ({ chronicle: fn, mythic: fn, discovery: fn, cyber: fn, cosmic: fn })
const offlineThenOnline: RosterImporter = async () => {
  attempts += 1
  if (!online) throw new TypeError('Failed to fetch dynamically imported module')
  return ok()
}
const loader = createRosterLoader(importers(offlineThenOnline), [0, 0])
const failed = await loader.load('chronicle').then(() => false, () => true)
const status = loader.statusStore.get().chronicle
check('a failed download is recorded, never stuck on loading', failed && status?.status === 'error' && attempts === 3)
online = true
const [a, b] = await Promise.all([loader.load('chronicle'), loader.load('chronicle')])
check('retry after reconnecting succeeds (one shared request)', a === b && a.length === 20 && attempts === 4 && loader.statusStore.get().chronicle === undefined)
check('cached afterwards', loader.getCachedBoss('chronicle.hammurabi')?.name === 'Hammurabi')
attempts = 0
online = false
let blips = 0
const blip: RosterImporter = async () => {
  blips += 1
  if (blips === 1) throw new TypeError('Failed to fetch dynamically imported module')
  return ok()
}
const blipLoader = createRosterLoader(importers(blip), [0, 0])
check('transient failure is absorbed by the retry', (await blipLoader.load('mythic')).length === 20 && blipLoader.statusStore.get().mythic === undefined && blips === 2)

// ── Migrations ───────────────────────────────────────────────────────────────
const v1 = {
  version: 1,
  name: 'Ada',
  elo: 1612,
  coins: 4321,
  achievements: { 'first-blood': '2026-01-01T00:00:00.000Z' },
  matches: [{ id: 'm1', pgn: '1. e4 *', result: { kind: 'draw', reason: 'stalemate' }, legendId: 'newton' }],
  legends: { defeated: { cleopatra: '2026-01-02T00:00:00.000Z' }, wins: { cleopatra: 2 }, losses: {}, draws: {}, epochsVisited: ['ancient'] },
}
const migrated = migrateProfile(v1)
check('v1 → v2 migration runs', migrated.migrated && migrated.fromVersion === 1 && migrated.data?.version === PROFILE_VERSION)
const restored = loadProfile(JSON.parse(JSON.stringify(v1)))
check('v1 progress survives the upgrade', restored.name === 'Ada' && restored.elo === 1612 && restored.coins === 4321 && Boolean(restored.achievements['first-blood']) && restored.legends.wins.cleopatra === 2)
check('v1 matches gain bossId: null; campaign block added', restored.matches[0]?.bossId === null && restored.matches[0]?.legendId === 'newton' && restored.campaign.relics.length === 0 && restored.version === PROFILE_VERSION)
check('unversioned saves are treated as v1', migrateProfile({ name: 'Old' }).fromVersion === 1 && loadProfile({ name: 'Old', coins: 9 }).coins === 9)
const future = migrateProfile({ ...v1, version: 99 })
check('newer-version saves are read best-effort, not wiped', future.future && !future.migrated && loadProfile({ ...v1, version: 99 }).coins === 4321)
check('non-objects yield defaults', migrateProfile('garbage').data === null && loadProfile(42).coins === createDefaultProfile().coins)
const chain = runMigrations({ version: 1, n: 0 }, 4, {
  1: (d) => ({ ...d, n: 1 }),
  2: (d) => ({ ...d, n: Number(d.n) + 1 }),
  3: (d) => ({ ...d, n: Number(d.n) + 1 }),
})
check('steps chain v1 → v2 → v3 → v4', chain.data?.n === 3 && chain.data.version === 4)
const gap = runMigrations({ version: 1, keep: true }, 3, { 1: (d) => ({ ...d, step: 1 }) })
check('a missing step stops safely without discarding data', gap.data?.version === 2 && gap.data.keep === true)

// ── Persistence: backups & corruption recovery ───────────────────────────────
class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, string>()
  failWrites = false
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('QuotaExceededError')
    this.map.set(key, value)
  }
}
type Doc = { coins: number }
const sanitizeDoc = (raw: unknown): Doc => ({ coins: typeof raw === 'object' && raw !== null && 'coins' in raw && typeof raw.coins === 'number' ? raw.coins : 0 })
const opts = (storage: MemoryStorage) => ({ backupKey: 'k:backup', storage, debounceMs: 0 })

let mem = new MemoryStorage()
let store = createPersistentStore('k', sanitizeDoc, opts(mem))
check('first launch is empty', store.loadSource === 'empty' && store.get().coins === 0)

mem = new MemoryStorage()
mem.map.set('k', JSON.stringify({ coins: 10 }))
store = createPersistentStore('k', sanitizeDoc, opts(mem))
store.set({ coins: 11 })
store.set({ coins: 12 })
check('launch snapshot is backed up before the first write', mem.map.get('k:backup') === JSON.stringify({ coins: 10 }) && mem.map.get('k') === JSON.stringify({ coins: 12 }))

mem = new MemoryStorage()
mem.map.set('k', '{"coins": 50, oops')
mem.map.set('k:backup', JSON.stringify({ coins: 40 }))
store = createPersistentStore('k', sanitizeDoc, opts(mem))
check('corrupt save falls back to the backup', store.loadSource === 'backup' && store.get().coins === 40)
check('corrupt text is quarantined, not deleted', mem.map.get('k:corrupt') === '{"coins": 50, oops')
store.set({ coins: 41 })
check('corrupt text never overwrites a good backup', mem.map.get('k:backup') === JSON.stringify({ coins: 40 }) && mem.map.get('k') === JSON.stringify({ coins: 41 }))

mem = new MemoryStorage()
mem.map.set('k', 'not json at all')
store = createPersistentStore('k', sanitizeDoc, opts(mem))
check('corrupt save without backup resets but keeps the raw data', store.loadSource === 'reset' && store.get().coins === 0 && mem.map.get('k:corrupt') === 'not json at all')

mem = new MemoryStorage()
mem.map.set('k:backup', JSON.stringify({ coins: 7 }))
store = createPersistentStore('k', sanitizeDoc, opts(mem))
check('a deleted primary is restored from the backup', store.loadSource === 'backup' && store.get().coins === 7)

mem = new MemoryStorage()
store = createPersistentStore('k', sanitizeDoc, opts(mem))
mem.failWrites = true
let threw = false
try {
  store.set({ coins: 5 })
} catch {
  threw = true
}
check('full / blocked storage never crashes the app', !threw && store.get().coins === 5)

mem = new MemoryStorage()
mem.map.set('k', JSON.stringify({ coins: 3 }))
store = createPersistentStore('k', sanitizeDoc, opts(mem))
store.ensureBackup()
check('explicit pre-migration backup', mem.map.get('k:backup') === JSON.stringify({ coins: 3 }))

process.exit(failures ? 1 : 0)
