// Pre-battle parleys: a short choice-driven exchange before a campaign battle.
// Each choice changes the boss's answer, the reward and the battle itself.
import type { Parley } from '../types/rpg'
import type { TauntTone } from '../types/taunts'
import { hashSeed, seededRandom } from './spells'

const PARLEYS: Readonly<Record<TauntTone, readonly Parley[]>> = {
  fierce: [
    {
      id: 'fierce-wager',
      prompt: '“You dare stand before me? Name your terms, or kneel now.”',
      choices: [
        { id: 'challenge', label: 'Taunt them back', effect: 'The boss fights at full fury (+strength) · rewards ×1.5', reply: 'Then you will bleed for every word.', mood: 'angry', rewardFactor: 1.5, bossBoost: 1 },
        { id: 'respect', label: 'Offer an honourable duel', effect: 'A fair fight · you gain a Spell Ward', reply: 'Honour? Fine. I will crush you honourably.', mood: 'calm', rewardFactor: 1, bossBoost: 0, grant: 'spell-ward' },
        { id: 'feint', label: 'Feign fear', effect: 'The boss grows careless (−strength) · rewards ×0.75', reply: 'Ha! Trembling already. This will be quick.', mood: 'smug', rewardFactor: 0.75, bossBoost: -1 },
      ],
    },
    {
      id: 'fierce-blood',
      prompt: '“My warriors hunger. Will you feed them pawns or pride?”',
      choices: [
        { id: 'pride', label: '“Neither. I came for your crown.”', effect: 'Boss empowered · rewards ×1.5', reply: 'Bold. I will wear your crown beside mine.', mood: 'angry', rewardFactor: 1.5, bossBoost: 1 },
        { id: 'pawns', label: 'Toss them a pawn’s worth of gold', effect: 'You gain Vanguard Charge', reply: 'Gold buys you one charge. Use it well.', mood: 'smug', rewardFactor: 1, bossBoost: 0, grant: 'vanguard-charge' },
        { id: 'retreat', label: 'Ask for mercy', effect: 'Boss weakened · rewards ×0.75', reply: 'Mercy? I will spare… a little.', mood: 'smug', rewardFactor: 0.75, bossBoost: -1 },
      ],
    },
    {
      id: 'fierce-oath',
      prompt: '“Swear on your king that you will not flee this field.”',
      choices: [
        { id: 'swear', label: 'Swear the blood oath', effect: 'Boss empowered · rewards ×1.5', reply: 'Then neither of us leaves unscarred.', mood: 'angry', rewardFactor: 1.5, bossBoost: 1 },
        { id: 'blade', label: 'Draw your blade instead', effect: 'You gain the Katana Blade', reply: 'Steel speaks louder than oaths. So be it.', mood: 'tense', rewardFactor: 1, bossBoost: 0, grant: 'katana-blade' },
        { id: 'evade', label: 'Refuse and laugh', effect: 'Boss off-balance · rewards ×0.75', reply: 'You laugh? You will stop soon enough.', mood: 'shocked', rewardFactor: 0.75, bossBoost: -1 },
      ],
    },
  ],
  cold: [
    {
      id: 'cold-proof',
      prompt: '“State your purpose. I have calculated every reason you could give.”',
      choices: [
        { id: 'perfection', label: '“To beat you at your best.”', effect: 'Boss plays sharper · rewards ×1.5', reply: 'Then I will not hold back a single ply.', mood: 'tense', rewardFactor: 1.5, bossBoost: 1 },
        { id: 'learn', label: '“To learn.”', effect: 'You gain the Knight’s Boot', reply: 'An honest answer. Observe, then.', mood: 'calm', rewardFactor: 1, bossBoost: 0, grant: 'knights-boot' },
        { id: 'distract', label: 'Pose an unsolvable riddle', effect: 'Boss distracted · rewards ×0.75', reply: 'Interesting… I will think on it — later.', mood: 'shocked', rewardFactor: 0.75, bossBoost: -1 },
      ],
    },
    {
      id: 'cold-time',
      prompt: '“Time is the only currency. How much of mine will you waste?”',
      choices: [
        { id: 'none', label: '“None — this ends quickly.”', effect: 'Boss empowered · rewards ×1.5', reply: 'Efficient. Let us be efficient.', mood: 'calm', rewardFactor: 1.5, bossBoost: 1 },
        { id: 'trade', label: 'Trade a secret for an hourglass', effect: 'You gain the Chronos Hourglass', reply: 'A fair exchange. Time favours the prepared.', mood: 'calm', rewardFactor: 1, bossBoost: 0, grant: 'chronos-hourglass' },
        { id: 'stall', label: 'Ramble endlessly', effect: 'Boss irritated and sloppier · rewards ×0.75', reply: 'Enough. Enough! Play.', mood: 'angry', rewardFactor: 0.75, bossBoost: -1 },
      ],
    },
    {
      id: 'cold-axiom',
      prompt: '“Every position has a truth. Do you seek it, or fear it?”',
      choices: [
        { id: 'seek', label: '“I seek it — at any depth.”', effect: 'Boss empowered · rewards ×1.5', reply: 'Then we descend together.', mood: 'tense', rewardFactor: 1.5, bossBoost: 1 },
        { id: 'guard', label: 'Ask for a shield of logic', effect: 'You gain a Spell Ward', reply: 'Logic shields the worthy. Granted.', mood: 'calm', rewardFactor: 1, bossBoost: 0, grant: 'spell-ward' },
        { id: 'fear', label: '“I fear it.”', effect: 'Boss complacent · rewards ×0.75', reply: 'Fear is rational. Your defeat will be too.', mood: 'smug', rewardFactor: 0.75, bossBoost: -1 },
      ],
    },
  ],
  sly: [
    {
      id: 'sly-deal',
      prompt: '“Psst. A little deal before we play? Everyone loves a deal.”',
      choices: [
        { id: 'raise', label: '“Double or nothing.”', effect: 'Boss empowered · rewards ×1.5', reply: 'Ooh, a gambler! I adore gamblers.', mood: 'smug', rewardFactor: 1.5, bossBoost: 1 },
        { id: 'accept', label: 'Accept a “gift”', effect: 'You gain Second Wind', reply: 'Consider it… an investment. Hehe.', mood: 'smug', rewardFactor: 1, bossBoost: 0, grant: 'second-wind' },
        { id: 'expose', label: 'Expose the trick', effect: 'Boss rattled · rewards ×0.75', reply: 'Wha— how did you… never mind!', mood: 'shocked', rewardFactor: 0.75, bossBoost: -1 },
      ],
    },
    {
      id: 'sly-mask',
      prompt: '“Which face shall I wear for you today, friend?”',
      choices: [
        { id: 'true', label: '“Your true one.”', effect: 'Boss empowered · rewards ×1.5', reply: 'Careful what you wish for…', mood: 'tense', rewardFactor: 1.5, bossBoost: 1 },
        { id: 'mirror', label: 'Hand them a mirror', effect: 'You gain the Katana Blade', reply: 'Clever. A blade behind a mirror. I like it.', mood: 'shocked', rewardFactor: 1, bossBoost: 0, grant: 'katana-blade' },
        { id: 'flatter', label: 'Flatter them shamelessly', effect: 'Boss over-confident · rewards ×0.75', reply: 'Oh, stop. No, go on. Actually — let us play.', mood: 'smug', rewardFactor: 0.75, bossBoost: -1 },
      ],
    },
    {
      id: 'sly-cards',
      prompt: '“Pick a card, any card. I promise it isn’t marked.”',
      choices: [
        { id: 'deck', label: 'Take the whole deck', effect: 'Boss empowered · rewards ×1.5', reply: 'Greedy! Then I play with my own deck too.', mood: 'angry', rewardFactor: 1.5, bossBoost: 1 },
        { id: 'card', label: 'Pick one card', effect: 'You gain the Knight’s Boot', reply: 'The knight! A fine choice… for now.', mood: 'smug', rewardFactor: 1, bossBoost: 0, grant: 'knights-boot' },
        { id: 'swap', label: 'Swap the cards when they blink', effect: 'Boss confused · rewards ×0.75', reply: 'Did you just… you did. Annoying.', mood: 'shocked', rewardFactor: 0.75, bossBoost: -1 },
      ],
    },
  ],
}

/** The parley a boss opens with on this attempt (stable per seed, varies between attempts). */
export function parleyFor(tone: TauntTone, seed: string): Parley {
  const pool = PARLEYS[tone]
  const index = Math.floor(seededRandom(hashSeed(seed))() * pool.length)
  const fallback = PARLEYS.fierce[0]
  const parley = pool[index] ?? pool[0] ?? fallback
  if (!parley) throw new Error('Parley catalogue is empty')
  return parley
}

export const ALL_PARLEYS: readonly Parley[] = [...PARLEYS.fierce, ...PARLEYS.cold, ...PARLEYS.sly]
