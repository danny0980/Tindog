// Clans and the weekly clan war: players band together (up to 30), and every
// rated game a member wins against another clan earns their clan points for
// the week. Pure helpers; the Store keeps the data.

export interface Clan {
  id: string
  name: string
  /** 2–5 letters or digits, shown in brackets: [CHRN]. */
  tag: string
  ownerId: string
  members: string[]
  createdAt: number
}

export const MAX_MEMBERS = 30

export function cleanClanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/\s+/g, ' ').trim()
  return name.length >= 3 && name.length <= 24 && /^[\p{L}\p{N} '’.-]+$/u.test(name) ? name : null
}

export function cleanTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const tag = raw.trim().toUpperCase()
  return /^[A-Z0-9]{2,5}$/.test(tag) ? tag : null
}

/** The ISO week a moment belongs to: "2026-W43". */
export function weekOf(ms: number): string {
  const src = new Date(ms)
  const d = new Date(Date.UTC(src.getUTCFullYear(), src.getUTCMonth(), src.getUTCDate()))
  // The Thursday of this week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const week = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * War points for one player's result: a win over another clan 3, a draw 1,
 * a win over a clanless player 1. Games inside a clan earn nothing.
 */
export function warPoints(myClan: string | null, theirClan: string | null, score: 0 | 0.5 | 1): number {
  if (!myClan || myClan === theirClan) return 0
  if (theirClan) return score === 1 ? 3 : score === 0.5 ? 1 : 0
  return score === 1 ? 1 : 0
}
