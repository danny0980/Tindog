// The app's one ranked-play connection (outside React, so a game keeps going
// while you look at another tab), with sounds, achievements and the rating
// refresh wired to its events.
import { Chess } from 'chess.js'
import { useSyncExternalStore } from 'react'
import { resolveMaterial, sfx } from '../../audio'
import { getBoardTheme } from '../../constants/themes'
import { applyFeat } from '../../stores/featActions'
import { settingsStore } from '../../stores/settingsStore'
import { showToast } from '../../stores/toastStore'
import { recordOnlineResult } from '../../utils/feats'
import { onlineScreen } from '../onlineSession'
import { accountStore, patchUser } from './account'
import { api } from './api'
import { RankedManager, type RankedView, rankedResultText } from './onlineManager'

let manager: RankedManager | null = null

const socketUrl = (): string => `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

export function getRanked(): RankedManager {
  if (manager) return manager
  const m = new RankedManager({ open: () => new WebSocket(socketUrl()) })
  m.onEvent((e) => {
    if (e.kind === 'move') {
      const chess = new Chess()
      let last = null
      for (const uci of e.game.moves) last = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci[4] } : {}) })
      const s = settingsStore.get()
      if (last) sfx.move(resolveMaterial(s.soundMaterial, getBoardTheme(s.boardTheme)), last, chess.inCheck())
    } else if (e.kind === 'found') {
      sfx.pickup()
      if (!onlineScreen.visible) showToast('success', 'Opponent found', `${e.game.opponent.name} (${e.game.opponent.rating}) is waiting for you in Online.`)
    } else if (e.kind === 'over') {
      const r = e.game.result
      if (!r) return
      if (r.reason !== 'aborted') {
        if (r.winner === null) sfx.draw()
        else if (r.winner === e.game.color) sfx.victory()
        else sfx.defeat()
        applyFeat((p) => recordOnlineResult(p, r.winner === e.game.color))
      }
      if (!onlineScreen.visible) showToast('info', 'Ranked game over', rankedResultText(e.game))
      // The server has the new rating and record.
      void api.me().then((user) => user && patchUser(user)).catch(() => {})
    } else if (e.kind === 'draw-offered' && !onlineScreen.visible) {
      showToast('info', 'Draw offered', 'Your ranked opponent offers a draw.')
    }
  })
  // Signing out closes the connection.
  accountStore.subscribe(() => {
    if (accountStore.get().status !== 'signed-in') m.disconnect()
  })
  manager = m
  return m
}

/** The ranked-play state, re-rendering on every change. */
export function useRanked(): RankedView {
  const m = getRanked()
  return useSyncExternalStore(
    (fn) => m.subscribe(fn),
    () => m.state,
  )
}
