// The app's one online session. It lives outside React, so a game keeps going
// (clocks, heartbeats, the opponent's moves and their sounds) while you look
// at another tab; the Online view just shows it.
import { useSyncExternalStore } from 'react'
import { resolveMaterial, sfx } from '../audio'
import { getBoardTheme } from '../constants/themes'
import { profileStore } from '../stores/profileStore'
import { settingsStore } from '../stores/settingsStore'
import { applyFeat } from '../stores/featActions'
import { showToast } from '../stores/toastStore'
import { recordOnlineResult } from '../utils/feats'
import { replay, resultText } from './match'
import { peerNetwork } from './peerNetwork'
import { OnlineSession, type SessionView } from './session'

let session: OnlineSession | null = null
/** Whether the Online screen is on show (otherwise news arrives as a toast). */
export const onlineScreen = { visible: false }

const storage = {
  get: (key: string): string | null => {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key: string, value: string): void => {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // Private mode: the seat just won't survive a reload.
    }
  },
}

/** The name others see: your chosen online name, or a friendly default. */
export const onlineName = (): string => settingsStore.get().onlineName || 'Chess player'

export function getOnlineSession(): OnlineSession {
  if (session) return session
  const s = new OnlineSession({
    network: peerNetwork(),
    now: () => Date.now(),
    storage,
    me: () => ({ name: onlineName(), elo: Math.round(profileStore.get().elo) }),
  })
  s.onEvent((e) => {
    const settings = settingsStore.get()
    if (e.kind === 'move') {
      const chess = replay(e.match.moves)
      const last = chess?.history({ verbose: true }).at(-1)
      if (chess && last) sfx.move(resolveMaterial(settings.soundMaterial, getBoardTheme(settings.boardTheme)), last, chess.inCheck())
    } else if (e.kind === 'result') {
      const r = e.match.result
      if (!r) return
      if (r.winner === null) sfx.draw()
      else if (r.winner === e.match.myColor) sfx.victory()
      else sfx.defeat()
      applyFeat((p) => recordOnlineResult(p, r.winner === e.match.myColor))
      if (document.hidden || !onlineScreen.visible) showToast('info', 'Online game over', resultText(r, e.match.myColor))
    } else if (e.kind === 'opponent-joined' && !onlineScreen.visible) {
      showToast('success', 'Your friend joined', 'The game is on!')
    } else if (e.kind === 'draw-offered' && !onlineScreen.visible) {
      showToast('info', 'Draw offered', 'Your opponent offers a draw.')
    }
  })
  // One heartbeat for clocks, pings and reconnects, whatever screen is showing.
  window.setInterval(() => s.tick(), 250)
  session = s
  return s
}

/** The session's state, re-rendering on every change. */
export function useOnlineSession(): SessionView {
  const s = getOnlineSession()
  return useSyncExternalStore(
    (fn) => s.subscribe(fn),
    () => s.state,
  )
}
