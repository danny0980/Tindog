// Invite links: a ?ref=<code> in the address waits here until you sign in,
// then it is used once (see the Friends tab).

/** Coins for each friend who joins with your code (and for joining with one). */
export const REFERRAL_COINS = 300
const PENDING_REF = 'chess-arena:pending-ref'

/** Remembers a ?ref= code from the link the app was opened with. */
export function rememberReferralFromUrl(): void {
  try {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code && /^[a-z0-9]{8,40}$/i.test(code)) window.localStorage.setItem(PENDING_REF, code.toLowerCase())
  } catch {
    // No storage: the code is simply forgotten.
  }
}

/** The remembered code, removed as it is read (it is used once). */
export function takePendingReferral(): string | null {
  try {
    const code = window.localStorage.getItem(PENDING_REF)
    window.localStorage.removeItem(PENDING_REF)
    return code
  } catch {
    return null
  }
}
