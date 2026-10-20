// "Play the Real Battle": famous battles as chess positions. The position
// echoes the terrain and the armies, the objective echoes how the battle was
// won, and reinforcements arrive when history says they did. You can command
// either side; where the opposing commander is a Classic Chess character
// (Leonidas, Hannibal, Napoleon, Wellington) you face them in person.
import type { Color } from '../types/chess'
import type { BattleRules } from '../variants/rules'

export interface BattleSide {
  name: string
  /** Classic character id commanding this side, if they are in the game. */
  commander: string | null
  /** Your goal when you command this side. */
  goal: string
}

export interface BattleLines {
  intro: string
  victory: string
  defeat: string
}

export interface Battle {
  id: string
  name: string
  date: string
  /** What happened (true history, checkable). */
  history: string
  /** How the position and rules echo it. */
  rules: readonly string[]
  sides: Record<Color, BattleSide>
  /** What the opposing commander says, keyed by the side they command. */
  lines: Record<Color, BattleLines>
  setup: BattleRules
}

export const BATTLES: readonly Battle[] = [
  {
    id: 'thermopylae',
    name: 'Thermopylae',
    date: '480 BCE',
    history:
      'A small Greek force led by King Leonidas of Sparta held the narrow pass of Thermopylae against the vast army of the Persian king Xerxes. According to Herodotus, they held for days until a local man, Ephialtes, showed the Persians a mountain path around the Greek position.',
    rules: [
      'Locked pawns on both wings are the mountain and the sea: the fight is in the narrow pass between them.',
      'At the Persians’ 10th move, the Immortals arrive behind the Greek lines (on b1 and g1, if those squares are empty).',
      'The Greeks win by holding out to the end of move 20. The Persians must checkmate before then.',
    ],
    sides: {
      w: { name: 'The Greeks', commander: 'leonidas', goal: 'Hold the pass until the end of move 20.' },
      b: { name: 'The Persian army', commander: null, goal: 'Break the pass and checkmate before move 20 ends.' },
    },
    lines: {
      w: { intro: 'Come and take them, if you can.', victory: 'The pass is still ours. Go home and tell them what you saw.', defeat: 'The pass has fallen, but the stand will be remembered.' },
      b: { intro: 'Our numbers will darken the sky. Stand aside.', victory: 'The pass is open. The road south is ours.', defeat: 'So few, and still they held. Remarkable.' },
    },
    setup: {
      fen: 'rnbqkbnr/2pppp2/8/1p4p1/pP4Pp/P2PP2P/8/2RKRB2 w - - 0 1',
      objective: { kind: 'survive', side: 'w', until: 20 },
      events: [
        {
          id: 'immortals',
          move: 10,
          color: 'b',
          pieces: [
            { square: 'b1', type: 'n' },
            { square: 'g1', type: 'n' },
          ],
          text: 'Ephialtes has shown the Persians the mountain path: the Immortals appear behind the Greek lines!',
        },
      ],
    },
  },
  {
    id: 'cannae',
    name: 'Cannae',
    date: '216 BCE',
    history:
      'Hannibal’s outnumbered army let the Roman legions push into its centre, then closed both wings around them while his cavalry struck from behind. Cannae became one of the most studied encirclements in military history.',
    rules: [
      'Rome masses its infantry (pawns) in the centre; Hannibal is stronger on the wings.',
      'At Hannibal’s 12th move, his cavalry returns behind the Roman lines (knights on b8 and g8, if those squares are empty).',
      'Hannibal must win by the end of move 35. If the Romans are still standing, they win.',
    ],
    sides: {
      w: { name: 'Hannibal’s army', commander: 'hannibal', goal: 'Encircle the Romans and checkmate by the end of move 35.' },
      b: { name: 'The Roman legions', commander: null, goal: 'Survive Hannibal’s trap until the end of move 35.' },
    },
    lines: {
      w: { intro: 'Your legions are many. My plan is better.', victory: 'Closed on every side. That is how it is done.', defeat: 'You slipped the trap. Rome breeds stubborn soldiers.' },
      b: { intro: 'Rome sends its greatest army. You will not trick us twice.', victory: 'The line held. Carthage goes home empty-handed.', defeat: 'Surrounded. We marched straight into it.' },
    },
    setup: {
      fen: 'r1bqkb1r/8/1pppppp1/3pp3/3PP3/N1P2P1N/8/R1BQKB1R w - - 0 1',
      objective: { kind: 'win-by', side: 'w', by: 35 },
      events: [
        {
          id: 'cavalry',
          move: 12,
          color: 'w',
          pieces: [
            { square: 'b8', type: 'n' },
            { square: 'g8', type: 'n' },
          ],
          text: 'Hannibal’s cavalry returns and strikes the Romans from behind!',
        },
      ],
    },
  },
  {
    id: 'waterloo',
    name: 'Waterloo',
    date: '18 June 1815',
    history:
      'Wellington’s army held the ridge of Mont-Saint-Jean against Napoleon’s attacks through the afternoon, until Blücher’s Prussians arrived on the French flank and decided the battle. Marshal Grouchy’s corps, sent after the Prussians, never reached the field.',
    rules: [
      'Napoleon is missing a bishop: Grouchy’s corps never arrived. The farms of Hougoumont and La Haye Sainte are the pawns on c4 and e4.',
      'At the Allies’ 14th move, the Prussians arrive on the French flank (a knight on h5 and a bishop on g4, if those squares are empty).',
      'Checkmate wins at any time. Otherwise, after move 30 the side ahead in material holds the field.',
    ],
    sides: {
      w: { name: 'Wellington’s Allies', commander: 'wellington', goal: 'Hold the ridge until the Prussians arrive, then be ahead after move 30.' },
      b: { name: 'The French army', commander: 'napoleon', goal: 'Break the ridge before the Prussians arrive; be ahead after move 30.' },
    },
    lines: {
      w: { intro: 'Hard pounding, this. Let us see who pounds longest.', victory: 'The ridge held, and the Prussians came. As planned.', defeat: 'A near-run thing, and this time it ran your way.' },
      b: { intro: 'Before nightfall, this ridge will be mine.', victory: 'The Guard advances, and the day is France’s!', defeat: 'Waterloo again. Some battles never let you go.' },
    },
    setup: {
      fen: 'rn1qkbnr/pp3ppp/2ppp3/8/2P1P3/PP1P1PPP/8/RNBQK2R w - - 0 1',
      objective: { kind: 'material', at: 30 },
      events: [
        {
          id: 'prussians',
          move: 14,
          color: 'w',
          pieces: [
            { square: 'h5', type: 'n' },
            { square: 'g4', type: 'b' },
          ],
          text: 'Blücher’s Prussians have arrived on the French flank!',
        },
      ],
    },
  },
]

export const getBattle = (id: string): Battle | undefined => BATTLES.find((b) => b.id === id)
