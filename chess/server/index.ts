// Starts the Chronos Chess game server.
//
//   npm run server           (development: API + WebSocket on :8787; run `npm run dev` for the app)
//   npm run server:prod      (production from source: also serves the built app from dist/)
//   npm start                (production from the bundle: `npm run build:all` first)
//
// Settings come from environment variables or server/.env (see server/.env.example).
import { config as loadDotenv } from 'dotenv'
import { type GoogleVerifier, googleVerifier } from './auth'
import { createApp } from './app'
import { scheduleBackups } from './backup'
import { configWarnings, loadConfig } from './config'
import { createMailer } from './mailer'
import { Store } from './store'
import { startWatchdog } from './watchdog'

loadDotenv({ path: 'server/.env', quiet: true })
const config = loadConfig()
for (const w of configWarnings(config)) console.warn(`  ⚠ ${w}`)
let store: Store
try {
  store = new Store(config.dataFile)
} catch (err) {
  // Usually the volume isn't mounted, or isn't writable by this user.
  console.error(`Could not open the database ${config.dataFile ?? '(memory)'}: ${err instanceof Error ? err.message : String(err)}`)
  console.error('Check that its folder exists and is writable by the server (in Docker: the /data volume).')
  process.exit(1)
}
if (config.legacyDataFile) {
  const imported = store.importLegacyFile(config.legacyDataFile)
  if (imported) console.log(`  imported ${config.legacyDataFile} into SQLite: ${imported.users} users, ${imported.games} games, ${imported.clans} clans (the old file is now ${config.legacyDataFile}.imported)`)
}
const mailer = await createMailer(config.smtpUrl, config.mailFrom)
const google: GoogleVerifier | null = config.googleClientId ? await googleVerifier(config.googleClientId) : null
const running = createApp({ config, store, mailer, google })
const stopBackups = config.backupDir ? scheduleBackups(store, config.backupDir, config.backupHours, config.backupKeep, console.log) : () => {}

running.server.listen(config.port, config.host, () => {
  console.log(`♞ Chronos Chess server on http://localhost:${config.port}  (${config.production ? 'production' : 'development'})`)
  const email = config.smtpUrl ? 'email' : config.production ? 'email off (set SMTP_URL)' : 'email (links printed here — set SMTP_URL to send real email)'
  console.log(`  sign-in: ${email}${google ? ' + Google' : ' · Google off (set GOOGLE_CLIENT_ID)'}`)
  console.log(`  data:    ${config.dataFile ?? 'in memory'} (SQLite)`)
  console.log(`  backups: ${config.backupDir ? `${config.backupDir}, every ${config.backupHours} h, keeping ${config.backupKeep}` : 'off'}`)
})

let stopping = false
/** Closes cleanly (sockets, the database), then exits with `code`; the supervisor restarts a non-zero exit. */
const shutdown = (code = 0): void => {
  if (stopping) return
  stopping = true
  console.log(code === 0 ? '\nShutting down…' : 'Restarting after a fatal error…')
  stopBackups()
  stopWatchdog()
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(code || 1), 10_000).unref()
  void running.close().then(() => {
    try {
      store.close()
    } catch {
      // The database may be what failed; exiting is what matters now.
    }
    process.exit(code)
  })
}
// The database stopped answering: exit, so Docker / systemd starts a fresh process.
const stopWatchdog = config.production ? startWatchdog({ healthy: () => store.healthy(), onDead: (why) => (console.error(`watchdog: ${why}`), shutdown(1)), log: console.warn }) : () => {}
// A bug that escapes every handler leaves the process in an unknown state: log it and restart.
process.on('uncaughtException', (err) => {
  console.error('fatal: uncaught exception', err)
  shutdown(1)
})
process.on('unhandledRejection', (reason) => {
  console.error('fatal: unhandled promise rejection', reason)
  shutdown(1)
})
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
