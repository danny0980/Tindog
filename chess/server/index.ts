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
import { loadConfig } from './config'
import { createMailer } from './mailer'
import { Store } from './store'

loadDotenv({ path: 'server/.env', quiet: true })
const config = loadConfig()
const store = new Store(config.dataFile)
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
const shutdown = (): void => {
  if (stopping) return
  stopping = true
  console.log('\nShutting down…')
  stopBackups()
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref()
  void running.close().then(() => {
    store.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
