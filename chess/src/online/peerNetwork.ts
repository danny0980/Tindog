// The real network: WebRTC data channels between the two browsers, brokered by
// PeerJS's free public server (which also provides STUN/TURN for awkward
// networks). Moves travel directly between the players; no game server.
// PeerJS is loaded on demand, only when someone opens or joins a room.
import type { DataConnection, Peer as PeerType, PeerError } from 'peerjs'
import { peerIdFor, parseMessage, type OnlineMessage } from './protocol'
import type { Channel, Endpoint, NetError, Network } from './network'

type PeerCtor = typeof PeerType

let peerModule: Promise<PeerCtor> | null = null
const loadPeer = (): Promise<PeerCtor> => (peerModule ??= import('peerjs').then((m) => m.Peer))

function netError(err: PeerError<string>): NetError {
  switch (err.type) {
    case 'unavailable-id':
      return 'code-taken'
    case 'peer-unavailable':
      return 'no-room'
    case 'browser-incompatible':
      return 'unsupported'
    default:
      return 'network'
  }
}

function channelOf(conn: DataConnection): Channel {
  return {
    send: (msg: OnlineMessage) => {
      if (conn.open) void conn.send(msg)
    },
    close: () => conn.close(),
  }
}

/** Wires a data connection's events to the handlers, validating every message. */
function wire(conn: DataConnection, ch: Channel, onMessage: (ch: Channel, msg: OnlineMessage) => void, onClose: (ch: Channel) => void): void {
  conn.on('data', (raw) => {
    const msg = parseMessage(raw)
    if (msg) onMessage(ch, msg)
  })
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    onClose(ch)
  }
  conn.on('close', close)
  conn.on('error', close)
}

export function peerNetwork(): Network {
  return {
    host(code, ev) {
      let peer: PeerType | null = null
      let destroyed = false
      void loadPeer()
        .then((Peer) => {
          if (destroyed) return
          peer = new Peer(peerIdFor(code), { debug: 0 })
          peer.on('open', () => ev.onReady())
          peer.on('connection', (conn) => {
            const ch = channelOf(conn)
            conn.on('open', () => ev.onChannel(ch))
            wire(conn, ch, ev.onMessage, ev.onClose)
          })
          // Lost the broker (not the opponent): keep the room by reconnecting.
          peer.on('disconnected', () => {
            if (!destroyed && peer && !peer.destroyed) window.setTimeout(() => peer && !peer.destroyed && peer.reconnect(), 1500)
          })
          peer.on('error', (err) => ev.onError(netError(err)))
        })
        .catch(() => ev.onError('network'))
      return {
        destroy() {
          destroyed = true
          peer?.destroy()
        },
      }
    },
    join(code, ev) {
      let peer: PeerType | null = null
      let destroyed = false
      void loadPeer()
        .then((Peer) => {
          if (destroyed) return
          peer = new Peer({ debug: 0 })
          peer.on('open', () => {
            if (!peer || destroyed) return
            const conn = peer.connect(peerIdFor(code), { reliable: true, serialization: 'json' })
            const ch = channelOf(conn)
            conn.on('open', () => ev.onOpen(ch))
            wire(conn, ch, ev.onMessage, ev.onClose)
          })
          peer.on('error', (err) => ev.onError(netError(err)))
        })
        .catch(() => ev.onError('network'))
      const endpoint: Endpoint = {
        destroy() {
          destroyed = true
          peer?.destroy()
        },
      }
      return endpoint
    },
  }
}
