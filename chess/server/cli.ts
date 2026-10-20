// Database maintenance from the command line:
//
//   npm run db -- backup [file]     a consistent copy of the live database (safe while the server runs)
//   npm run db -- import <db.json>  import an old JSON data file into a fresh database
//   npm run db -- stats             counts of what is stored
//
// In the production image: node dist-server/cli.mjs <command>.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { backupName } from './backup'
import { loadConfig } from './config'
import { Store } from './store'

loadDotenv({ path: 'server/.env', quiet: true })
const config = loadConfig()
const [command, arg] = process.argv.slice(2).filter((a) => a !== '--production')
if (!config.dataFile) {
  console.error('DATABASE_FILE is :memory: — nothing to do.')
  process.exit(1)
}
const store = new Store(config.dataFile)
try {
  switch (command) {
    case 'backup': {
      const to = arg ?? join(config.backupDir ?? join(config.dataFile, '..', 'backups'), backupName(Date.now()))
      await store.backup(to)
      console.log(`Backed up ${config.dataFile} to ${to}`)
      break
    }
    case 'import': {
      if (!arg) throw new Error('Usage: npm run db -- import <path to db.json>')
      if (!store.isEmpty()) throw new Error(`${config.dataFile} already has data; import only into a fresh database.`)
      const out = store.importLegacy(JSON.parse(readFileSync(arg, 'utf8')))
      console.log(`Imported ${out.users} users, ${out.games} games and ${out.clans} clans into ${config.dataFile}`)
      break
    }
    case 'stats': {
      const count = (table: string): number => (store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
      for (const t of ['users', 'sessions', 'saves', 'games', 'royale_games', 'mode_ratings', 'clans', 'tournaments']) console.log(`${t.padEnd(14)} ${count(t)}`)
      break
    }
    default:
      console.log('Commands: backup [file] · import <db.json> · stats')
      process.exitCode = command ? 1 : 0
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
} finally {
  store.close()
}
