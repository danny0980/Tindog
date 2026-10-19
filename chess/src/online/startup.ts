// Kept tiny on purpose: the app shell reads this at start-up, and the online
// code itself (session, rules, PeerJS) only loads with the Online screen.
import { ROOM_KEY, parseRoomCode } from './protocol'

/**
 * A room to open on start-up: from an invite link (?room=CODE), or the room
 * this tab was playing in before a reload.
 */
export function startupRoom(): string | null {
  if (typeof window === 'undefined') return null
  const fromLink = parseRoomCode(window.location.search)
  if (fromLink) return fromLink
  try {
    return parseRoomCode(sessionStorage.getItem(ROOM_KEY) ?? '')
  } catch {
    return null
  }
}
