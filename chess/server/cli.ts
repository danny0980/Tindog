// Database maintenance from the command line:
//
//   npm run db -- backup [file]     a consistent copy of the live database (safe while the server runs)
//   npm run db -- import <db.json>  import an old JSON data file into a fresh database
//   npm run db -- stats             counts of what is stored
//   npm run db -- doctor [--smtp]   checks a deployment: settings, database, built app (and the mail server)
//
// In the production image: node dist-server/cli.mjs <command>.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { backupName } from './backup'
import { configWarnings, loadConfig } from './config'
import { Store } from './store'

loadDotenv({ path: 'server/.env', quiet: true })
const config = loadConfig()
const [command, arg] = process.argv.slice(2).filter((a) => a !== '--production' && a !== '--smtp')
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
    case 'doctor': {
      // Everything a deployment needs, in one look. Problems make the exit code non-zero.
      let problems = 0
      const line = (ok: boolean | 'warn', text: string) => {
        if (ok === false) problems += 1
        console.log(`${ok === true ? '✓' : ok === 'warn' ? '⚠' : '✗'} ${text}`)
      }
      line(true, `mode: ${config.production ? 'production' : 'development'} · public address ${config.publicUrl || '(none)'}`)
      line(store.healthy(), `database: ${config.dataFile} (schema ${(store.db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() as { value: string } | undefined)?.value ?? '?'})`)
      line(config.smtpUrl !== null || config.googleClientId !== null || !config.production, `sign-in: ${[config.smtpUrl ? 'email' : null, config.googleClientId ? 'Google' : null].filter(Boolean).join(' + ') || 'none'}`)
      const client = config.serveClient ?? 'dist'
      line(existsSync(`${client}/index.html`) ? true : config.production ? false : 'warn', `built app: ${client}/index.html ${existsSync(`${client}/index.html`) ? 'found' : 'missing (run npm run build:all)'}`)
      line(config.backupDir ? true : 'warn', `backups: ${config.backupDir ?? 'off'}`)
      for (const w of configWarnings(config)) line('warn', w)
      if (process.argv.includes('--smtp') && config.smtpUrl) {
        const nodemailer = await import('nodemailer')
        try {
          await nodemailer.createTransport(config.smtpUrl).verify()
          line(true, 'mail server: accepted the login')
        } catch (err) {
          line(false, `mail server: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      console.log(problems === 0 ? '\nReady.' : `\n${problems} problem(s) to fix.`)
      process.exitCode = problems === 0 ? 0 : 1
      break
    }
    default:
      console.log('Commands: backup [file] · import <db.json> · stats · doctor [--smtp]')
      process.exitCode = command ? 1 : 0
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
} finally {
  store.close()
}
