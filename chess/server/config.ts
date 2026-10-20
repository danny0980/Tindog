// Server settings, from environment variables (see server/.env.example).
import { resolve } from 'node:path'

export interface Config {
  port: number
  /** The address players open (used to build magic links and to check Origin). */
  publicUrl: string
  production: boolean
  /** JSON data file; null = in memory (tests). */
  dataFile: string | null
  /** Google Sign-In client id; null = Google sign-in switched off. */
  googleClientId: string | null
  /** SMTP connection URL (smtp://user:pass@host:587); null = magic links are printed to the console (dev only). */
  smtpUrl: string | null
  mailFrom: string
  sessionDays: number
  /** Serve the built client (dist/) from this server. */
  serveClient: string | null
}

const str = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null)

export function loadConfig(env: NodeJS.ProcessEnv = process.env, argv: readonly string[] = process.argv): Config {
  const production = env.NODE_ENV === 'production' || argv.includes('--production')
  const port = Number(env.PORT ?? 8787)
  const publicUrl = (str(env.PUBLIC_URL) ?? (production ? '' : 'http://localhost:5175')).replace(/\/$/, '')
  if (production && !publicUrl) throw new Error('PUBLIC_URL must be set in production (e.g. https://chess.example.com).')
  const smtpUrl = str(env.SMTP_URL)
  if (production && !smtpUrl && !str(env.GOOGLE_CLIENT_ID)) throw new Error('Set SMTP_URL (email sign-in) and/or GOOGLE_CLIENT_ID (Google sign-in) in production.')
  return {
    port: Number.isInteger(port) && port > 0 ? port : 8787,
    publicUrl,
    production,
    dataFile: env.DATA_FILE === ':memory:' ? null : resolve(str(env.DATA_FILE) ?? 'server-data/db.json'),
    googleClientId: str(env.GOOGLE_CLIENT_ID),
    smtpUrl,
    mailFrom: str(env.MAIL_FROM) ?? 'Chronos Chess <no-reply@localhost>',
    sessionDays: Math.max(1, Math.min(365, Number(env.SESSION_DAYS ?? 30) || 30)),
    serveClient: production ? resolve(str(env.CLIENT_DIR) ?? 'dist') : null,
  }
}
