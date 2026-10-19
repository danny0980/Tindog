import { Chess } from 'chess.js'
import { useEffect, useRef } from 'react'
import { chooseMove, repertoireMove } from '../engine/personalities'
import { scoreToCp } from '../engine/scoring'
import type { SpecialMove } from '../engine/variant'
import type { Move, MoveInput } from '../types/chess'
import type { OpponentProfile, SearchOptions, SearchResult } from '../types/engine'
import { parseUciMove } from '../utils/chess'
import type { EngineHandle } from './useEngine'

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

interface AiOpponentOptions {
  engine: EngineHandle
  fen: string
  active: boolean
  profile: OpponentProfile
  gameId: number
  getFen: () => string
  getHistory: () => Move[]
  onMove: (move: MoveInput) => void
  /** Called when the opponent starts thinking about a new position. */
  onThink?: () => void
  /** Rule-bending moves the opponent may consider in this position (spells). */
  getSpecials?: () => SpecialMove[]
  onSpecial?: (special: SpecialMove) => void
  /** The opponent's evaluation of the position before it moves (its POV, centipawns). */
  onEval?: (cp: number) => void
  /** Evaluation of the move it is about to play (null for book moves). */
  onChosen?: (cp: number | null) => void
  /** Arena rules: the UCI moves the opponent may play here (null = all legal moves). */
  getAllowedMoves?: () => readonly string[] | null
}

/** How many spell moves are verified with an extra (shallow) search per turn. */
const MAX_SPECIAL_CANDIDATES = 3

/** Cheap pre-ranking: captures, checks and advances toward promotion first. */
function specialHeuristic(s: SpecialMove): number {
  const rank = Number(s.to[1])
  const progress = s.color === 'w' ? rank : 9 - rank
  return (s.captured ? 10 : 0) + (s.san.includes('+') ? 6 : 0) + (s.promotion ? 20 : 0) + progress * 0.5
}

/**
 * Picks a spell move only when the engine agrees it is about as good as the
 * best normal move (within the opponent's style tolerance) — so spells add
 * menace without turning bosses into blunderers.
 */
async function pickSpecial(
  search: (fen: string, options: SearchOptions) => Promise<SearchResult>,
  specials: readonly SpecialMove[],
  bestCp: number,
  p: OpponentProfile,
): Promise<{ special: SpecialMove; cp: number } | null> {
  const ranked = [...specials].sort((a, b) => specialHeuristic(b) - specialHeuristic(a)).slice(0, MAX_SPECIAL_CANDIDATES)
  let best: { special: SpecialMove; cp: number } | null = null
  for (const special of ranked) {
    const reply = await search(special.move.after, { depth: Math.min(p.depth, 10), moveTimeMs: Math.min(p.moveTimeMs, 400), multiPv: 1, skillLevel: p.skillLevel })
    const line = reply.lines[0]
    // The reply is from the other side's point of view.
    const cp = line ? -scoreToCp(line.score) : Number.NEGATIVE_INFINITY
    if (!best || cp > best.cp) best = { special, cp }
  }
  return best && best.cp >= bestCp - Math.min(80, p.toleranceCp) ? best : null
}

/**
 * Requests and plays the engine's move whenever it is the AI's turn: first
 * from the opponent's opening repertoire, then from a (style-filtered) search.
 */
export function useAiOpponent({ engine, fen, active, profile, gameId, getFen, getHistory, onMove, onThink, getSpecials, onSpecial, onEval, onChosen, getAllowedMoves }: AiOpponentOptions): void {
  const onMoveRef = useRef(onMove)
  const onThinkRef = useRef(onThink)
  const profileRef = useRef(profile)
  const getSpecialsRef = useRef(getSpecials)
  const onSpecialRef = useRef(onSpecial)
  const onEvalRef = useRef(onEval)
  const onChosenRef = useRef(onChosen)
  const getAllowedRef = useRef(getAllowedMoves)
  useEffect(() => {
    onMoveRef.current = onMove
    onThinkRef.current = onThink
    profileRef.current = profile
    getSpecialsRef.current = getSpecials
    onSpecialRef.current = onSpecial
    onEvalRef.current = onEval
    onChosenRef.current = onChosen
    getAllowedRef.current = getAllowedMoves
  }, [getAllowedMoves, getSpecials, onChosen, onEval, onMove, onSpecial, onThink, profile])

  const { search, stop, status } = engine

  useEffect(() => {
    if (!active || status !== 'ready') return
    let cancelled = false
    const p = profileRef.current
    onThinkRef.current?.()

    // Opening repertoire: play the book move after a human-like pause.
    const side = fen.split(' ')[1] === 'b' ? 'b' : 'w'
    const allowed = getAllowedRef.current?.() ?? null
    const isAllowed = (m: MoveInput) => !allowed || allowed.includes(`${m.from}${m.to}${m.promotion ?? ''}`)
    const book = sanToInput(fen, repertoireMove(getHistory().map((m) => m.san), p.repertoire?.[side]))
    if (book && isAllowed(book)) {
      void delay(p.minThinkMs).then(() => {
        if (cancelled || getFen() !== fen) return
        onChosenRef.current?.(null)
        onMoveRef.current(book)
      })
      return () => {
        cancelled = true
      }
    }

    // A weakened engine needs alternatives on the table so the blunder guard can compare its pick.
    const lines = p.skillLevel < 20 ? Math.max(p.multiPv, 4) : p.multiPv
    Promise.all([
      search(fen, { depth: p.depth, moveTimeMs: p.moveTimeMs, multiPv: allowed ? Math.min(lines, allowed.length) : lines, skillLevel: p.skillLevel, ...(allowed ? { searchMoves: allowed } : {}) }),
      delay(p.minThinkMs),
    ])
      .then(async ([result]) => {
        // Ignore replies for positions that are no longer on the board (undo, new game…).
        if (cancelled || getFen() !== fen) return
        const top = result.lines[0]
        const bestCp = top ? scoreToCp(top.score) : 0
        if (top) onEvalRef.current?.(bestCp)
        const specials = getSpecialsRef.current?.() ?? []
        if (specials.length > 0 && onSpecialRef.current) {
          const picked = await pickSpecial(search, specials, bestCp, p)
          if (cancelled || getFen() !== fen) return
          if (picked) {
            onChosenRef.current?.(picked.cp)
            onSpecialRef.current(picked.special)
            return
          }
        }
        let uci = chooseMove(fen, result, p)
        // Safety net: never play a move the arena forbids, even if the engine ignored searchmoves.
        if (allowed && !allowed.includes(uci)) uci = allowed.find((m) => result.lines.some((l) => l.pv[0] === m)) ?? allowed[0] ?? uci
        const parsed = parseUciMove(uci)
        if (!parsed) return
        const line = result.lines.find((l) => l.pv[0] === uci)
        onChosenRef.current?.(line ? scoreToCp(line.score) : bestCp)
        onMoveRef.current(parsed)
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error('[stockfish]', err)
      })
    return () => {
      cancelled = true
      stop()
    }
  }, [active, fen, gameId, getFen, getHistory, search, status, stop])
}

/** Resolves a SAN book move to squares; null if absent or illegal (then the engine searches instead). */
function sanToInput(fen: string, san: string | null): MoveInput | null {
  if (!san) return null
  try {
    const move = new Chess(fen).move(san)
    return { from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) }
  } catch {
    return null
  }
}
