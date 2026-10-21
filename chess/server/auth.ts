// Accounts and sign-in: Google Sign-In (ID tokens verified with Google's
// library) and email magic links (single-use, 15 minutes). Sessions are
// random 256-bit tokens in an httpOnly cookie; only their SHA-256 is stored.
import { createHash, randomBytes, randomInt } from 'node:crypto'
import type { Store, User } from './store'

export const SESSION_COOKIE = 'cc_session'
export const MAGIC_TTL_MS = 15 * 60_000
export const START_RATING = 1200

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')
export const token = (): string => randomBytes(32).toString('base64url')
export const newId = (): string => randomBytes(12).toString('hex')

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i

/** Lower-cased, trimmed email, or null if it doesn't look like one. */
export function normaliseEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const e = input.trim().toLowerCase()
  return e.length <= 254 && EMAIL.test(e) ? e : null
}

/** A display name: printable, no markup characters, 2–20 characters. */
export function cleanDisplayName(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback
  // oxlint-disable-next-line no-control-regex -- stripping control characters is the point
  const n = input.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20)
  return n.length >= 2 ? n : fallback
}

/** Verifies a Google ID token and returns who it belongs to (injected so tests need no network). */
export type GoogleVerifier = (idToken: string) => Promise<{ sub: string; email: string | null; emailVerified: boolean; name: string | null } | null>

export async function googleVerifier(clientId: string): Promise<GoogleVerifier> {
  const { OAuth2Client } = await import('google-auth-library')
  const client = new OAuth2Client(clientId)
  return async (idToken) => {
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId })
      const p = ticket.getPayload()
      if (!p?.sub) return null
      return { sub: p.sub, email: p.email ?? null, emailVerified: p.email_verified === true, name: p.name ?? p.given_name ?? null }
    } catch {
      return null
    }
  }
}

export class Auth {
  private readonly store: Store
  private readonly sessionMs: number
  private readonly now: () => number

  constructor(store: Store, sessionDays: number, now: () => number = Date.now) {
    this.store = store
    this.sessionMs = sessionDays * 86_400_000
    this.now = now
  }

  /** Starts a session for a user; returns the raw token for the cookie. */
  startSession(userId: string): { token: string; expiresAt: number } {
    const t = token()
    const expiresAt = this.now() + this.sessionMs
    this.store.putSession(sha256(t), { userId, expiresAt })
    return { token: t, expiresAt }
  }

  /** The signed-in user for a raw session token, if valid. */
  userFor(rawToken: string | null | undefined): User | null {
    if (!rawToken || rawToken.length > 100) return null
    const row = this.store.session(sha256(rawToken))
    if (!row || row.expiresAt <= this.now()) return null
    return this.store.user(row.userId)
  }

  /**
   * Sliding sessions: a session used in the second half of its life is
   * extended to a full term again, so active players are never signed out.
   * Returns the new expiry when it was extended (the cookie must be renewed too).
   */
  touch(rawToken: string | null | undefined): number | null {
    if (!rawToken || rawToken.length > 100) return null
    const hash = sha256(rawToken)
    const row = this.store.session(hash)
    const now = this.now()
    if (!row || row.expiresAt <= now || row.expiresAt - now > this.sessionMs / 2) return null
    const expiresAt = now + this.sessionMs
    this.store.putSession(hash, { userId: row.userId, expiresAt })
    return expiresAt
  }

  /** Ends every session of a user (account deletion). */
  endAllSessions(userId: string): void {
    this.store.dropSessionsOf(userId)
  }

  endSession(rawToken: string | null | undefined): void {
    if (rawToken) this.store.dropSession(sha256(rawToken))
  }

  /** Creates a single-use magic-link token for an email address. */
  createMagicLink(email: string): string {
    const t = token()
    this.store.putMagic(sha256(t), { email, expiresAt: this.now() + MAGIC_TTL_MS })
    return t
  }

  /** Redeems a magic-link token: finds or creates the account. Single use (it also cancels the email's code). */
  redeemMagicLink(rawToken: unknown): User | null {
    if (typeof rawToken !== 'string' || rawToken.length < 20 || rawToken.length > 100) return null
    const row = this.store.takeMagic(sha256(rawToken))
    if (!row || row.expiresAt <= this.now()) return null
    return this.signInByEmail(row.email)
  }

  /**
   * A 6-digit code for the same email, for the mobile apps (a link in the
   * email would open the browser, not the app). Same 15 minutes, single use;
   * guessing is held off by a per-email attempt limit in the route.
   */
  createSignInCode(email: string): string {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    this.store.putMagic(sha256(`code:${email}:${code}`), { email, expiresAt: this.now() + MAGIC_TTL_MS })
    return code
  }

  /** Redeems an emailed code: finds or creates the account. Single use (it also cancels the email's link). */
  redeemSignInCode(email: string, code: unknown): User | null {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) return null
    const row = this.store.takeMagic(sha256(`code:${email}:${code.trim()}`))
    if (!row || row.expiresAt <= this.now() || row.email !== email) return null
    return this.signInByEmail(email)
  }

  private signInByEmail(email: string): User {
    // Whichever way was used, the other one (and any older email) stops working.
    this.store.dropMagicFor(email)
    return this.store.userByEmail(email) ?? this.createUser({ email, googleSub: null, name: email.split('@')[0] ?? 'Player' })
  }

  /** Signs in with a verified Google identity: by Google id, else links to an account with the same verified email. */
  googleUser(identity: { sub: string; email: string | null; emailVerified: boolean; name: string | null }): User {
    const bySub = this.store.userByGoogle(identity.sub)
    if (bySub) return bySub
    const email = identity.emailVerified ? normaliseEmail(identity.email) : null
    const byEmail = email ? this.store.userByEmail(email) : null
    if (byEmail) return this.store.putUser({ ...byEmail, googleSub: identity.sub })
    return this.createUser({ email, googleSub: identity.sub, name: identity.name ?? email?.split('@')[0] ?? 'Player' })
  }

  private createUser(fields: { email: string | null; googleSub: string | null; name: string }): User {
    return this.store.putUser({
      id: newId(),
      email: fields.email,
      googleSub: fields.googleSub,
      name: cleanDisplayName(fields.name, 'Player'),
      createdAt: this.now(),
      rating: START_RATING,
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    })
  }
}

/** Fixed-window rate limiter (per key), e.g. magic-link requests per email and per IP. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>()
  private readonly limit: number
  private readonly windowMs: number
  private readonly now: () => number

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
  }

  /** True if allowed (and counts the hit). */
  take(key: string): boolean {
    const t = this.now()
    const h = this.hits.get(key)
    if (!h || h.resetAt <= t) {
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs })
      if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k)
      return true
    }
    if (h.count >= this.limit) return false
    h.count += 1
    return true
  }
}
