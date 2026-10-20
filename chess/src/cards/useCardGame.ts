// Card Chess against the computer: the draft, then the game. Stockfish plays
// the ordinary moves (only ones the wards allow); a card move is played when
// a quick search says it beats the best ordinary move, and a ward is raised
// over a queen or rook that is about to fall.
import { useCallback, useEffect, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { resolveMaterial, sfx } from '../audio'
import { playPieceSound } from '../audio/pieceSounds'
import { getBoardTheme } from '../constants/themes'
import { settingsStore } from '../stores/settingsStore'
import { playCheck } from '../audio/fanfares'
import { isHanging } from '../coach/patterns'
import { scoreToCp } from '../engine/scoring'
import { useEngine } from '../hooks/useEngine'
import { applyFeat } from '../stores/featActions'
import type { Color } from '../types/chess'
import { recordModeResult } from '../utils/feats'
import { LEVELS, type VariantLevel } from '../variants/useVariantGame'
import { type CardId, type CardMove, CardGame, aiDraft, offer } from './cardGame'

export type CardPhase = 'setup' | 'draft' | 'playing'

export function useCardGame(active: boolean) {
  const [phase, setPhase] = useState<CardPhase>('setup')
  const [offered, setOffered] = useState<CardId[]>([])
  const [game, setGame] = useState<CardGame | null>(null)
  const [version, setVersion] = useState(0)
  const [myColor, setMyColor] = useState<Color>('w')
  const [level, setLevel] = useState<VariantLevel>('club')
  const engine = useEngine('variant', active && game !== null)
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  const finish = useCallback((g: CardGame, me: Color) => {
    const r = g.result
    if (!r) return
    if (r.winner === null) sfx.draw()
    else if (r.winner === me) sfx.victory()
    else sfx.defeat()
    applyFeat((p) => recordModeResult(p, 'cards', r.winner === me))
  }, [])

  const after = useCallback(
    (g: CardGame, capture: boolean) => {
      const s = settingsStore.get()
      playPieceSound(resolveMaterial(s.soundMaterial, getBoardTheme(s.boardTheme)), capture ? 'capture' : 'move')
      if (g.inCheck) playCheck()
      finish(g, myColor)
      bump()
    },
    [bump, finish, myColor],
  )

  /** Deal the five cards to draft from. */
  const deal = useCallback((color: Color | 'random', lvl: VariantLevel) => {
    setMyColor(color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color)
    setLevel(lvl)
    setOffered(offer())
    setPhase('draft')
  }, [])

  /** You picked your three: the computer drafts from the same five, and the game begins. */
  const begin = useCallback(
    (hand: CardId[]) => {
      const ai = aiDraft(offered)
      const hands = myColor === 'w' ? { w: hand, b: ai } : { w: ai, b: hand }
      setGame(new CardGame(hands))
      setPhase('playing')
      engine.newGame()
      bump()
    },
    [bump, engine, myColor, offered],
  )

  const move = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!game || game.result || game.turn !== myColor) return false
      const capture = Boolean(new Chess(game.fen).get(to as Square))
      if (!game.play({ from, to, ...(promotion ? { promotion } : {}) })) return false
      after(game, capture)
      return true
    },
    [after, game, myColor],
  )

  const playCard = useCallback(
    (m: CardMove): boolean => {
      if (!game || game.turn !== myColor || !game.playCard(m)) return false
      sfx.spellCast()
      after(game, m.label.includes('x'))
      return true
    },
    [after, game, myColor],
  )

  const ward = useCallback(
    (card: 'stone-wall' | 'aegis', square: Square): boolean => {
      if (!game || game.turn !== myColor || !game.ward(card, square)) return false
      sfx.spellCast()
      bump()
      return true
    },
    [bump, game, myColor],
  )

  const resign = useCallback(() => {
    if (!game || game.result) return
    game.resign(myColor)
    finish(game, myColor)
    bump()
  }, [bump, finish, game, myColor])

  const leave = useCallback(() => {
    setGame(null)
    setPhase('setup')
  }, [])

  // The computer's turn.
  const aiToMove = Boolean(active && game && !game.result && game.turn !== myColor && engine.status === 'ready')
  useEffect(() => {
    if (!aiToMove || !game) return
    let cancelled = false
    const cfg = LEVELS[level]
    const me = game.turn
    const run = async () => {
      // A ward over a queen or rook that is about to be taken.
      const chess = new Chess(game.fen)
      for (const card of ['aegis', 'stone-wall'] as const) {
        const target = game.wardTargets(card).find((s) => isHanging(chess, s, me))
        if (target) game.ward(card, target)
      }
      const legal = game.legalMoves()
      const allowed = legal.map((m) => `${m.from}${m.to}${m.promotion ?? ''}`)
      let best: { uci: string; cp: number } | null = null
      try {
        const r = await engine.search(game.fen, { depth: cfg.depth, multiPv: 3, skillLevel: cfg.skill, moveTimeMs: 2000, searchMoves: allowed })
        const lines = r.lines.filter((l) => l.pv[0] && allowed.includes(l.pv[0]))
        const top = lines[0] ? scoreToCp(lines[0].score) : 0
        const near = lines.filter((l) => scoreToCp(l.score) >= top - cfg.tolerance)
        const pick = near[Math.floor(Math.random() * near.length)] ?? lines[0]
        if (pick?.pv[0]) best = { uci: pick.pv[0], cp: scoreToCp(pick.score) }
      } catch {
        best = null
      }
      // Would a card do better? Quick searches of the most forcing card moves.
      const cardMoves = game
        .cardMoves()
        .sort((a, b) => Number(b.label.includes('x')) - Number(a.label.includes('x')))
        .slice(0, 5)
      let card: CardMove | null = null
      for (const m of cardMoves) {
        if (cancelled) return
        const fen = game.fenAfter(m)
        if (!fen) continue
        try {
          const r = await engine.search(fen, { depth: Math.min(cfg.depth, 8), multiPv: 1, skillLevel: cfg.skill, moveTimeMs: 600 })
          const reply = r.lines[0]
          const cp = reply ? -scoreToCp(reply.score) : 0
          if (cp > (best?.cp ?? -Infinity) + 40 && (!card || cp > 0)) {
            card = m
            best = { uci: '', cp }
          }
        } catch {
          break
        }
      }
      await new Promise((r) => window.setTimeout(r, 350))
      if (cancelled || game.result || game.turn !== me) return
      if (card && game.playCard(card)) {
        sfx.spellCast()
        after(game, card.label.includes('x'))
        return
      }
      const uci = best?.uci || allowed[0]
      if (!uci) return
      const capture = Boolean(new Chess(game.fen).get(uci.slice(2, 4) as Square))
      if (game.play({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) })) after(game, capture)
    }
    void run()
    return () => {
      cancelled = true
    }
    // version: re-run after every move.
  }, [after, aiToMove, engine, game, level, version])

  // The computer's turn, but its engine isn't running (starting, restarting or failed).
  const waitingForEngine = Boolean(active && game && !game.result && game.turn !== myColor && engine.status !== 'ready')
  return { phase, offered, game, version, myColor, level, thinking: aiToMove, waitingForEngine, engineStatus: engine.status, engineError: engine.error, retryEngine: engine.retry, deal, begin, move, playCard, ward, resign, leave }
}
