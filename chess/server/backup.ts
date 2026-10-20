// Automatic database backups: a consistent SQLite copy every few hours
// (taken while the server runs), keeping the newest few.
import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Store } from './store'

const NAME = /^chess-\d{8}-\d{6}\.db$/

/** The backup file name for a moment: chess-20261020-180000.db (UTC). */
export function backupName(ms: number): string {
  const iso = new Date(ms).toISOString()
  return `chess-${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 19).replace(/:/g, '')}.db`
}

/** Takes one backup now and deletes the oldest beyond `keep`. Returns the new file. */
export async function backupNow(store: Store, dir: string, keep: number, now = Date.now()): Promise<string> {
  const file = join(dir, backupName(now))
  await store.backup(file)
  const old = readdirSync(dir)
    .filter((f) => NAME.test(f))
    .sort()
    .reverse()
    .slice(keep)
  for (const f of old) rmSync(join(dir, f), { force: true })
  return file
}

/** Backs up every `hours` (the first one a minute after start). Returns a stop function. */
export function scheduleBackups(store: Store, dir: string, hours: number, keep: number, log: (line: string) => void): () => void {
  const run = (): void => {
    backupNow(store, dir, keep).then(
      (f) => log(`backup: ${f}`),
      (err: unknown) => log(`backup failed: ${err instanceof Error ? err.message : String(err)}`),
    )
  }
  const first = setTimeout(run, 60_000)
  const every = setInterval(run, hours * 3_600_000)
  first.unref()
  every.unref()
  return () => {
    clearTimeout(first)
    clearInterval(every)
  }
}
