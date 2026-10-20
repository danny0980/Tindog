// The history quiz. Two honest kinds of question:
//   "Who is this?"  — a true fact from the lore, asked only when it doesn't
//                     give the name away;
//   "When did they live?" — the lore's own dates.
// Plus one clearly framed game question: "Who greets you with this line in
// Chronos Chess?", which is about the game, not a real quotation.
import { loreFor } from './lore'
import { CLASSIC_ROSTER, type ClassicCharacter } from './roster'

export type QuizKind = 'fact' | 'lived' | 'line'

export interface QuizQuestion {
  kind: QuizKind
  /** The character the question is about. */
  about: string
  prompt: string
  /** The clue (a fact, a line) or the character's name for "when". */
  clue: string
  options: string[]
  answer: number
}

const GENERIC = new Set(['the', 'of', 'and', 'great', 'king', 'queen', 'sir', 'captain', 'duke', 'first', 'emperor', 'ii', 'vii', 'i'])

/** Name parts that would give the answer away ("Napoleon", "Bonaparte", "Wellington"). */
export function nameTokens(c: ClassicCharacter): string[] {
  const words = `${c.name} ${c.id.replace(/-/g, ' ')}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
  return [...new Set(words.filter((w) => w.length >= 4 && !GENERIC.has(w)))]
}

export function revealsName(text: string, c: ClassicCharacter): boolean {
  const plain = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return nameTokens(c).some((t) => new RegExp(`\\b${t}`).test(plain))
}

/** A small seeded generator, so a quiz can be replayed and tested. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

function shuffle<T>(xs: readonly T[], r: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    const t = a[i]!
    a[i] = a[j]!
    a[j] = t
  }
  return a
}

/** Three wrong answers: people from the same era first (harder), then anyone. */
function distractors(c: ClassicCharacter, r: () => number): ClassicCharacter[] {
  const same = shuffle(CLASSIC_ROSTER.filter((o) => o.era === c.era && o.id !== c.id), r)
  const rest = shuffle(CLASSIC_ROSTER.filter((o) => o.era !== c.era), r)
  return [...same.slice(0, 2), ...rest].slice(0, 3)
}

function withOptions(kind: QuizKind, c: ClassicCharacter, prompt: string, clue: string, right: string, wrong: readonly string[], r: () => number): QuizQuestion {
  const options = shuffle([right, ...wrong], r)
  return { kind, about: c.id, prompt, clue, options, answer: options.indexOf(right) }
}

/** One question about `c`, or null if their lore can't make a fair one of this kind. */
export function questionFor(c: ClassicCharacter, kind: QuizKind, r: () => number): QuizQuestion | null {
  const lore = loreFor(c.id)
  if (kind === 'fact') {
    const facts = lore ? lore.facts.filter((f) => !revealsName(f, c)) : []
    const fact = facts[Math.floor(r() * facts.length)]
    if (!fact) return null
    return withOptions('fact', c, 'Who is this?', fact, c.name, distractors(c, r).map((d) => d.name), r)
  }
  if (kind === 'lived') {
    if (!lore) return null
    // Wrong dates come from other eras, so the question is fair.
    const wrong = shuffle(CLASSIC_ROSTER.filter((o) => o.era !== c.era), r)
      .map((o) => loreFor(o.id)?.lived)
      .filter((l): l is string => typeof l === 'string' && l !== lore.lived)
    return withOptions('lived', c, `When did ${c.name} live?`, c.name, lore.lived, [...new Set(wrong)].slice(0, 3), r)
  }
  if (revealsName(c.line, c)) return null
  return withOptions('line', c, 'In Chronos Chess, who greets you with this line?', c.line, c.name, distractors(c, r).map((d) => d.name), r)
}

/**
 * A quiz of `count` questions about the given characters (e.g. the ones you have
 * beaten), mostly facts, with dates and one game line mixed in.
 */
export function buildQuiz(pool: readonly ClassicCharacter[], count: number, seed: number): QuizQuestion[] {
  const r = rng(seed)
  const people = shuffle(pool.length >= 4 ? pool : CLASSIC_ROSTER, r)
  const kinds: QuizKind[] = ['fact', 'fact', 'lived', 'fact', 'line']
  const out: QuizQuestion[] = []
  for (const c of people) {
    if (out.length >= count) break
    const kind = kinds[out.length % kinds.length]!
    const q = questionFor(c, kind, r) ?? questionFor(c, 'fact', r) ?? questionFor(c, 'lived', r)
    if (q) out.push(q)
  }
  return out
}

/** Coins for a finished quiz: 5 a correct answer. */
export const quizReward = (correct: number): number => correct * 5

/** After beating `c`: one question about them, then two about the others you have beaten. */
export function postGameQuiz(c: ClassicCharacter, beaten: readonly ClassicCharacter[], seed: number): QuizQuestion[] {
  const r = rng(seed)
  const first = questionFor(c, 'fact', r) ?? questionFor(c, 'lived', r)
  const rest = buildQuiz(beaten.filter((o) => o.id !== c.id), 3, seed + 1).filter((q) => q.about !== c.id)
  return [...(first ? [first] : []), ...rest].slice(0, 3)
}
