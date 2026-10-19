// Running a lesson, as pure state: the student tries moves (a wrong one gets
// the hint; a second wrong one reveals the answer), and the reply is played
// with its explanation.
import { Chess } from 'chess.js'
import type { Color, MoveInput, Square } from '../types/chess'
import type { Lesson } from './lessons'

export type LessonMessage =
  | { kind: 'intro'; text: string }
  | { kind: 'your-move'; text: string }
  | { kind: 'why'; san: string; text: string; byStudent: boolean }
  | { kind: 'wrong'; text: string }
  | { kind: 'done'; text: string }

export interface LessonState {
  lesson: Lesson
  /** Plies played so far. */
  ply: number
  fen: string
  last: { from: Square; to: Square } | null
  /** Wrong tries on the current move. */
  mistakes: number
  /** Wrong tries over the whole lesson. */
  totalMistakes: number
  message: LessonMessage
}

/** After this many wrong tries, the answer is shown on the board. */
export const REVEAL_AFTER = 2

const sideOf = (ply: number): Color => (ply % 2 === 0 ? 'w' : 'b')

export function startLesson(lesson: Lesson): LessonState {
  return { lesson, ply: 0, fen: new Chess().fen(), last: null, mistakes: 0, totalMistakes: 0, message: { kind: 'intro', text: lesson.intro } }
}

export const isDone = (s: LessonState): boolean => s.ply >= s.lesson.line.length
export const studentToMove = (s: LessonState): boolean => !isDone(s) && sideOf(s.ply) === s.lesson.student
/** The opponent's scripted reply is due. */
export const replyDue = (s: LessonState): boolean => !isDone(s) && sideOf(s.ply) !== s.lesson.student

/** The expected move's squares (to draw an arrow once it's revealed). */
export function answer(s: LessonState): { from: Square; to: Square } | null {
  const ply = s.lesson.line[s.ply]
  if (!ply) return null
  try {
    const m = new Chess(s.fen).move(ply.san)
    return { from: m.from, to: m.to }
  } catch {
    return null
  }
}

export const revealed = (s: LessonState): boolean => studentToMove(s) && s.mistakes >= REVEAL_AFTER

function advance(s: LessonState, san: string, byStudent: boolean): LessonState {
  const chess = new Chess(s.fen)
  const m = chess.move(san)
  const ply = s.ply + 1
  const why = s.lesson.line[s.ply]?.why ?? ''
  const next: LessonState = { ...s, ply, fen: chess.fen(), last: { from: m.from, to: m.to }, mistakes: 0, message: { kind: 'why', san: m.san, text: why, byStudent } }
  if (ply >= s.lesson.line.length) return { ...next, message: { kind: 'done', text: why } }
  return next
}

/** The student's move: right (applied and explained), wrong-but-legal (hint), or illegal (ignored). */
export function tryMove(s: LessonState, input: MoveInput): { state: LessonState; result: 'correct' | 'wrong' | 'illegal' } {
  if (!studentToMove(s)) return { state: s, result: 'illegal' }
  const expected = s.lesson.line[s.ply]
  if (!expected) return { state: s, result: 'illegal' }
  let san: string
  try {
    san = new Chess(s.fen).move({ from: input.from, to: input.to, ...(input.promotion ? { promotion: input.promotion } : {}) }).san
  } catch {
    return { state: s, result: 'illegal' }
  }
  if (san === expected.san) return { state: advance(s, san, true), result: 'correct' }
  const mistakes = s.mistakes + 1
  const text = mistakes >= REVEAL_AFTER ? `Not quite. Play ${expected.san}: follow the arrow.` : `Not quite. ${expected.hint ?? 'Try another move.'}`
  return { state: { ...s, mistakes, totalMistakes: s.totalMistakes + 1, message: { kind: 'wrong', text } }, result: 'wrong' }
}

/** Plays the opponent's scripted reply. */
export function playReply(s: LessonState): LessonState {
  if (!replyDue(s)) return s
  const ply = s.lesson.line[s.ply]
  return ply ? advance(s, ply.san, false) : s
}

/** The prompt for the student's next move. */
export function prompt(s: LessonState): string {
  const ply = s.lesson.line[s.ply]
  return ply?.hint ? `Your move. ${ply.hint}` : 'Your move.'
}
