// Server settings, from environment variables (see server/.env.example).
import { resolve } from 'node:path'

export interface Config {
  port: number
  /** The interface to listen on ('0.0.0.0' = every interface). */
  host: string
  /** The address players open (used to build magic links and to check Origin). */
  publicUrl: string
  production: boolean
  /** The SQLite database file; null = in memory (tests). */
  dataFile: string | null
  /** A JSON data file from an older version, imported into a fresh database on first start. */
  legacyDataFile: string | null
  /** Google Sign-In client id; null = Google sign-in switched off. */
  googleClientId: string | null
  /** SMTP connection URL (smtp://user:pass@host:587); null = magic links are printed to the console (dev only). */
  smtpUrl: string | null
  mailFrom: string
  sessionDays: number
  /** Serve the built client (dist/) from this server. */
  serveClient: string | null
  /** How many reverse proxies sit in front (for the client IP in rate limits); 0 = none. */
  trustProxy: number
  /** Where automatic backups go; null = no automatic backups. */
  backupDir: string | null
  /** Hours between automatic backups. */
  backupHours: number
  /** Automatic backups kept (the oldest are deleted). */
  backupKeep: number
}

const str = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null)
const int = (v: string | undefined, fallback: number, min: number, max: number): number => {
  const n = Number(v)
  return v !== undefined && v.trim() !== '' && Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, argv: readonly string[] = process.argv): Config {
  const production = env.NODE_ENV === 'production' || argv.includes('--production')
  const publicUrl = (str(env.PUBLIC_URL) ?? (production ? '' : 'http://localhost:5175')).replace(/\/$/, '')
  if (production && !publicUrl) throw new Error('PUBLIC_URL must be set in production (e.g. https://chess.example.com).')
  if (production && !/^https?:\/\/[^/]+$/.test(publicUrl)) throw new Error('PUBLIC_URL must be an origin like https://chess.example.com (no path).')
  const smtpUrl = str(env.SMTP_URL)
  if (production && !smtpUrl && !str(env.GOOGLE_CLIENT_ID)) throw new Error('Set SMTP_URL (email sign-in) and/or GOOGLE_CLIENT_ID (Google sign-in) in production.')
  // DATA_FILE named the JSON file before 6.15: a .json value still works (it is imported into SQLite next to it).
  const dataEnv = str(env.DATABASE_FILE) ?? str(env.DATA_FILE)
  const memory = dataEnv === ':memory:'
  const legacyFromEnv = dataEnv?.endsWith('.json') ? dataEnv : null
  const dataFile = memory ? null : resolve(legacyFromEnv ? legacyFromEnv.replace(/\.json$/, '.db') : (dataEnv ?? 'server-data/chess.db'))
  const backups = str(env.BACKUP_DIR)
  return {
    port: int(env.PORT, 8787, 0, 65_535),
    host: str(env.HOST) ?? '0.0.0.0',
    publicUrl,
    production,
    dataFile,
    legacyDataFile: memory ? null : resolve(str(env.LEGACY_DATA_FILE) ?? legacyFromEnv ?? 'server-data/db.json'),
    googleClientId: str(env.GOOGLE_CLIENT_ID),
    smtpUrl,
    mailFrom: str(env.MAIL_FROM) ?? 'Chronos Chess <no-reply@localhost>',
    sessionDays: int(env.SESSION_DAYS, 30, 1, 365),
    serveClient: production ? resolve(str(env.CLIENT_DIR) ?? 'dist') : null,
    trustProxy: int(env.TRUST_PROXY, production ? 1 : 0, 0, 10),
    backupDir: memory || backups === 'off' ? null : backups ? resolve(backups) : production && dataFile ? resolve(dataFile, '..', 'backups') : null,
    backupHours: int(env.BACKUP_HOURS, 24, 1, 24 * 30),
    backupKeep: int(env.BACKUP_KEEP, 7, 1, 365),
  }
}
