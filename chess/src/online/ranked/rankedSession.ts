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
import { accountStore, patchUser, sessionEnded } from './account'
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
    } else if (e.kind === 'missed-result') {
      showToast('info', 'While you were away', e.text, 8000)
      void api.me().then((user) => user && patchUser(user)).catch(() => {})
    } else if (e.kind === 'auth-check') {
      // The connection keeps being refused: if the server no longer knows us, the sign-in has expired.
      void api
        .me()
        .then((user) => {
          if (!user) sessionEnded()
        })
        .catch(() => {})
    } else if (e.kind === 'mode-found') {
      sfx.pickup()
      if (!onlineScreen.visible) showToast('success', e.mode === 'cards' ? 'Card Chess opponent found' : 'Battle Royale table ready', 'Your game is waiting for you in Online.')
    } else if (e.kind === 'mode-move') {
      // Your own moves already sounded when you made them.
      if (!e.byMe || e.capture) {
        const s = settingsStore.get()
        sfx.place(resolveMaterial(s.soundMaterial, getBoardTheme(s.boardTheme)))
      }
    } else if (e.kind === 'mode-over') {
      const r = e.result
      if (r.rating) {
        if (e.won) sfx.victory()
        else if (r.mode === 'cards' && r.winner === null) sfx.draw()
        else sfx.defeat()
        applyFeat((p) => recordOnlineResult(p, e.won))
      }
      if (!onlineScreen.visible) showToast('info', r.mode === 'cards' ? 'Card Chess game over' : 'Battle Royale over', e.won ? 'You won!' : r.reason === 'aborted' ? 'The game was aborted.' : 'The game has ended.')
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
