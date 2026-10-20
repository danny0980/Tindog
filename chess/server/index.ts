// Starts the Chronos Chess game server.
//
//   npm run server           (development: API + WebSocket on :8787; run `npm run dev` for the app)
//   npm run server:prod      (production: also serves the built app from dist/)
//
// Settings come from environment variables or server/.env (see server/.env.example).
import { config as loadDotenv } from 'dotenv'
import { type GoogleVerifier, googleVerifier } from './auth'
import { createApp } from './app'
import { loadConfig } from './config'
import { createMailer } from './mailer'
import { Store } from './store'

loadDotenv({ path: 'server/.env', quiet: true })
const config = loadConfig()
const store = new Store(config.dataFile)
const mailer = await createMailer(config.smtpUrl, config.mailFrom)
const google: GoogleVerifier | null = config.googleClientId ? await googleVerifier(config.googleClientId) : null
const running = createApp({ config, store, mailer, google })

running.server.listen(config.port, () => {
  console.log(`♞ Chronos Chess server on http://localhost:${config.port}  (${config.production ? 'production' : 'development'})`)
  const email = config.smtpUrl ? 'email' : config.production ? 'email off (set SMTP_URL)' : 'email (links printed here — set SMTP_URL to send real email)'
  console.log(`  sign-in: ${email}${google ? ' + Google' : ' · Google off (set GOOGLE_CLIENT_ID)'}`)
  console.log(`  data:    ${config.dataFile ?? 'in memory'}`)
})

const shutdown = (): void => {
  console.log('\nShutting down…')
  void running.close().then(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
