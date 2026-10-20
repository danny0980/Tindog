// Character Interviews: after you beat a Classic character, ask them questions.
// Answers are built from their lore, so everything factual is the checked
// history; the framing around it is in character, and the app says so.
import type { ArchetypeId } from '../../types/campaign'
import { loreFor } from './lore'
import { RIVALRIES, rivalsOf } from './rivals'
import { CLASSIC_ROSTER, type ClassicCharacter, type ClassicEraId, getClassic } from './roster'

export type QuestionId = 'who' | 'when' | 'secret' | 'game' | 'advice' | 'rival' | 'today'

export const QUESTIONS: ReadonlyArray<{ id: QuestionId; text: string }> = [
  { id: 'who', text: 'Who are you, really?' },
  { id: 'when', text: 'When did you live?' },
  { id: 'secret', text: 'Tell me something most people don’t know about you.' },
  { id: 'game', text: 'How did you feel about our game?' },
  { id: 'advice', text: 'What advice would you give a chess player?' },
  { id: 'rival', text: 'Who would you most like to face across the board?' },
  { id: 'today', text: 'What do you make of the world today?' },
]

/** Chess advice in the voice of each playing style. */
const ADVICE: Record<ArchetypeId, string> = {
  berserker: 'Attack. A king who is always defending has already half lost.',
  fortifier: 'Build your walls first. An attack on a solid position breaks itself.',
  trickster: 'Set a trap your opponent wants to walk into. Greed is the oldest weakness.',
  calculator: 'Count everything twice: every capture, every check. Then count again.',
  gambiteer: 'Give a pawn for time. Time, used well, is worth more than material.',
  sniper: 'Find the long diagonal and the open file. Strike from far away.',
  warlord: 'Command the centre and every piece obeys you.',
  maverick: 'Do what they do not expect. A surprised opponent makes mistakes.',
}

/** In character, about the modern world: imagined, by era. */
const TODAY: Record<ClassicEraId, string> = {
  ancient: 'Machines that carry voices across the sea? In my day a message took a season. And still you play this game of kings.',
  classical: 'Your cities are larger than Rome, and your arguments are just as loud. Some things never change.',
  medieval: 'No castles, no siege engines, and yet you still fight over land. I would have thought you had learned.',
  east: 'An empire of the whole world, linked by light. Even the greatest dynasties never dreamed so large.',
  renaissance: 'You map the stars and the atoms. I only hope you still take time to look at a painting.',
  sail: 'You cross the oceans in hours. I needed months, and a great deal of luck.',
  enlightenment: 'Reason, science and free argument everywhere. Now, are you using them wisely?',
  nineteenth: 'Railways, then aeroplanes, then this. The century of progress never really ended.',
  science: 'Every pocket holds a computer stronger than anything we imagined. Use it to ask better questions.',
  masters: 'Engines stronger than any champion, and still people sit down to play each other. That is the beauty of it.',
}

export interface InterviewAnswer {
  text: string
  /** True when the answer is checked history; false when it is in-character fiction. */
  factual: boolean
}

/** One character's answer to one question. `seed` varies the fact and the rival suggestion. */
export function interviewAnswer(c: ClassicCharacter, q: QuestionId, seed = 0): InterviewAnswer {
  const lore = loreFor(c.id)
  const pick = <T,>(xs: readonly T[]): T | undefined => xs[Math.abs(Math.floor(seed)) % Math.max(1, xs.length)]
  switch (q) {
    case 'who':
      return lore ? { text: `The chroniclers put it this way. ${lore.bio}`, factual: true } : { text: `I am ${c.name}, ${c.title}.`, factual: true }
    case 'when':
      return { text: lore ? `The records give my years as ${lore.lived.replace(/ – /g, ' to ').replace(/\bc\. /g, 'about ')}.` : 'Long ago. Longer than you think.', factual: lore !== null }
    case 'secret': {
      const fact = lore ? pick(lore.facts) : undefined
      return fact ? { text: `Here is something true. ${fact}`, factual: true } : { text: 'Some things I keep to myself.', factual: false }
    }
    case 'game':
      return { text: lore ? lore.defeat : 'You played well. I will remember it.', factual: false }
    case 'advice':
      return { text: ADVICE[c.archetype], factual: false }
    case 'rival': {
      const rival = getClassic(pick(rivalsOf(c.id)) ?? '')
      if (rival) {
        const r = RIVALRIES.find((x) => (x.a === c.id && x.b === rival.id) || (x.b === c.id && x.a === rival.id))
        return { text: `${rival.name}, of course. ${r?.history ?? ''}`.trim(), factual: true }
      }
      const peers = CLASSIC_ROSTER.filter((o) => o.era === c.era && o.id !== c.id)
      const peer = pick(peers)
      return peer ? { text: `${peer.name}. We belong to the same chapter of history; I would like to see how they think.`, factual: false } : { text: 'Anyone brave enough to sit down.', factual: false }
    }
    case 'today':
      return { text: TODAY[c.era], factual: false }
  }
}
