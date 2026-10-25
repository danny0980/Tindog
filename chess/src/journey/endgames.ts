// Endgame lessons, taught by the masters: the basic mates, the opposition,
// the Lucena "bridge" and the Philidor defence. Each lesson is a position,
// a goal (win within a move limit, or hold out) and the teacher's advice.
// You play it out against Stockfish. The tips are written for the game.
import type { Color } from '../types/chess'
import type { BattleRules } from '../variants/rules'

export interface EndgameLesson {
  id: string
  name: string
  /** Classic character who teaches it. */
  teacher: string
  fen: string
  side: Color
  goal: 'win' | 'hold'
  /** Moves to win in, or to hold out for. */
  moves: number
  summary: string
  tips: readonly string[]
}

export const ENDGAMES: readonly EndgameLesson[] = [
  {
    id: 'queen-mate',
    name: 'Mate with the Queen',
    teacher: 'capablanca',
    fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    side: 'w',
    goal: 'win',
    moves: 20,
    summary: 'King and queen against a lone king: the first mate every player must know.',
    tips: [
      'Use the queen like a fence: put it a knight’s move away from the enemy king to shrink its box.',
      'Keep shrinking the box, but never take away its last square — that is stalemate.',
      'When the king is on the edge, bring your own king up. Then the queen mates.',
    ],
  },
  {
    id: 'rook-mate',
    name: 'Mate with the Rook',
    teacher: 'lasker',
    fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
    side: 'w',
    goal: 'win',
    moves: 32,
    summary: 'King and rook against king: slower than the queen, and a lesson in teamwork.',
    tips: [
      'The rook cuts the board: the enemy king may not cross its file or rank.',
      'March your king up so that it faces the enemy king — the opposition.',
      'When the kings face each other, a rook check drives the king back one row. Repeat until the edge.',
    ],
  },
  {
    id: 'opposition',
    name: 'The King Leads the Pawn',
    teacher: 'steinitz',
    fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
    side: 'w',
    goal: 'win',
    moves: 40,
    summary: 'King and pawn against king. With your king on the sixth rank in front of the pawn, you always win.',
    tips: [
      'The king goes first; the pawn follows. A pawn that runs ahead alone is caught.',
      'Take the opposition: kings face each other with one square between, and the side NOT to move gains ground.',
      'Promote, then mate with the queen — remember the fence.',
    ],
  },
  {
    id: 'lucena',
    name: 'Building a Bridge (Lucena)',
    teacher: 'capablanca',
    fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    side: 'w',
    goal: 'win',
    moves: 40,
    summary: 'Rook and pawn against rook, the pawn on the seventh: the most important winning position in rook endings.',
    tips: [
      'First, check the enemy king away from your pawn with your rook (Rd1+).',
      'Bring the rook to the fourth rank. This is the bridge: it will block the checks later.',
      'Walk your king out; when the checks come, put the rook in between. Then promote.',
    ],
  },
  {
    id: 'philidor',
    name: 'The Philidor Defence',
    teacher: 'philidor',
    fen: '4k3/8/r7/4P3/5K2/8/8/1R6 b - - 0 1',
    side: 'b',
    goal: 'hold',
    moves: 40,
    summary: 'A rook down a pawn: hold the draw. The defence Philidor wrote down in 1749 still works today.',
    tips: [
      'Keep your rook on your third rank (here the 6th) so the white king can’t come forward.',
      'Only when the pawn steps up to the sixth, swing your rook to the back of the board.',
      'Then check the white king from behind. It has nowhere to hide from the checks.',
    ],
  },
]

export const getEndgame = (id: string): EndgameLesson | undefined => ENDGAMES.find((e) => e.id === id)

export function lessonRules(l: EndgameLesson): BattleRules {
  const moveNo = Number(l.fen.split(' ')[5] ?? 1)
  return {
    fen: l.fen,
    objective: l.goal === 'win' ? { kind: 'win-by', side: l.side, by: moveNo + l.moves - 1 } : { kind: 'survive', side: l.side, until: moveNo + l.moves - 1 },
    events: [],
  }
}
