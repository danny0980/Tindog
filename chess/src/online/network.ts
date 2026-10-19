// How two browsers reach each other. The game only sees this small interface;
// the real implementation (peerNetwork.ts) uses WebRTC data channels brokered
// by PeerJS's free public server, and memoryNetwork() links two sessions in
// the same page for tests.
import { type OnlineMessage, parseMessage } from './protocol'

/** One open link to the other player. */
export interface Channel {
  send: (msg: OnlineMessage) => void
  close: () => void
}

export type NetError =
  /** Someone already hosts a room with this code. */
  | 'code-taken'
  /** No room with this code (or its host has gone). */
  | 'no-room'
  /** Can't reach the connection broker (offline, firewall). */
  | 'network'
  /** This browser can't do WebRTC. */
  | 'unsupported'

export interface HostEvents {
  /** The room is open and can be joined. */
  onReady: () => void
  onChannel: (ch: Channel) => void
  onMessage: (ch: Channel, msg: OnlineMessage) => void
  onClose: (ch: Channel) => void
  onError: (err: NetError) => void
}

export interface GuestEvents {
  onOpen: (ch: Channel) => void
  onMessage: (ch: Channel, msg: OnlineMessage) => void
  onClose: (ch: Channel) => void
  onError: (err: NetError) => void
}

export interface Endpoint {
  /** Leaves the room and frees the code. */
  destroy: () => void
}

export interface Network {
  host: (code: string, ev: HostEvents) => Endpoint
  join: (code: string, ev: GuestEvents) => Endpoint
}

/** Two sessions in one page, wired back to back (tests and offline previews). */
export function memoryNetwork(): Network & { drop: () => void } {
  const rooms = new Map<string, HostEvents>()
  const live = new Set<() => void>()
  return {
    host(code, ev) {
      if (rooms.has(code)) {
        queueMicrotask(() => ev.onError('code-taken'))
        return { destroy() {} }
      }
      rooms.set(code, ev)
      queueMicrotask(ev.onReady)
      return { destroy: () => rooms.delete(code) }
    },
    join(code, ev) {
      const host = rooms.get(code)
      if (!host) {
        queueMicrotask(() => ev.onError('no-room'))
        return { destroy() {} }
      }
      let open = true
      // Messages go through JSON and the validator, exactly like the real wire.
      const wire = (deliver: (msg: OnlineMessage) => void) => (msg: OnlineMessage) => {
        if (!open) return
        const text = JSON.stringify(msg)
        queueMicrotask(() => {
          const parsed = open ? parseMessage(text) : null
          if (parsed) deliver(parsed)
        })
      }
      const shut = () => {
        if (!open) return
        open = false
        live.delete(shut)
        queueMicrotask(() => {
          host.onClose(hostSide)
          ev.onClose(guestSide)
        })
      }
      const hostSide: Channel = { send: wire((m) => ev.onMessage(guestSide, m)), close: shut }
      const guestSide: Channel = { send: wire((m) => host.onMessage(hostSide, m)), close: shut }
      live.add(shut)
      queueMicrotask(() => {
        host.onChannel(hostSide)
        ev.onOpen(guestSide)
      })
      return { destroy: shut }
    },
    /** Cuts every open link (a network drop). */
    drop() {
      for (const shut of [...live]) shut()
    },
  }
}
