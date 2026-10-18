// Dynamic, board-aware lines. Templates are filled with what actually
// happened ({piece}, {square}, {spell}, {seconds}) so reactions are specific.
import type { ArchetypeId } from '../types/campaign'
import type { LegendId } from '../types/legend'
import type { TauntKind, TauntTone } from '../types/taunts'

export const TAUNTS: Readonly<Record<TauntTone, Readonly<Record<TauntKind, readonly string[]>>>> = {
  fierce: {
    'queen-sacrifice': ['Your queen on {square}? A reckless sacrifice — I accept!', 'You throw your queen at me? Bold. Foolish, but bold.'],
    'queen-won': ['Your queen is mine! Now the slaughter begins.', 'Ha! The queen falls. Your army is headless!'],
    'queen-lost': ['MY QUEEN?! You will pay for that in blood.', 'You took my queen… now I am truly angry.'],
    blunder: ['That move was a gift. I never refuse gifts.', 'You blinked. I saw it. Now you fall.'],
    brilliance: ['What?! Where did that come from?', 'Hah… a real warrior after all. Again!'],
    'big-capture': ['My {piece}! You will regret that.', 'Taking my {piece} only makes me hungrier.'],
    'lost-major': ['Your {piece} is gone. Feel the pressure yet?', 'One {piece} down. Who is next?'],
    'player-promotes': ['A new queen on {square}?! Cheap trick!', 'Promotion? I will cut it down too!'],
    'boss-promotes': ['Rise, my new queen! Crush them!', 'From pawn to queen — that is how warriors grow!'],
    'check-given': ['Check! Run, little king!', 'Your king bleeds — check!'],
    'in-check': ['A scratch! I barely felt it.', 'You dare touch my king?!'],
    'king-walk': ['Your king out for a stroll on {square}? Wonderful.', 'A king in the open is a dead king.'],
    'early-castle': ['Hiding behind your walls already? Coward!', 'Castle all you like — I will tear the walls down.'],
    'long-think': ['Stop hiding and fight! {seconds} seconds of thinking won’t save you.', 'Tick, tock. I am getting bored!'],
    'time-trouble': ['Your clock is bleeding out!', 'Hurry! Your time is nearly gone!'],
    'spell-cast': ['Feel the power of {spell}!', '{spell}! Try to stop THIS.'],
    'spell-blocked': ['A ward?! Cheat!', 'You blocked my {spell}? Grr!'],
    'tactic-used': ['What sorcery is that?!', 'A trick move? Fine — I fight dirty too.'],
  },
  cold: {
    'queen-sacrifice': ['Your queen on {square} is unprotected. Is that a sacrifice, or an error?', 'An unsound queen sacrifice. I will verify… yes, unsound.'],
    'queen-won': ['Queen captured. Evaluation: decisive.', 'Material advantage: nine points. Proceeding.'],
    'queen-lost': ['…My queen. Recalculating.', 'An unexpected loss. My models did not predict that.'],
    blunder: ['Inaccuracy detected. Exploiting.', 'That move loses material. I will demonstrate.'],
    brilliance: ['Impressive. That move was not in my top candidates.', 'Excellent precision. Recalibrating my estimate of you.'],
    'big-capture': ['You took my {piece}. Noted. Adjusting.', 'The {piece} was a calculated risk. Apparently miscalculated.'],
    'lost-major': ['Your {piece} is removed from the equation.', 'The {piece} on {square} was overextended.'],
    'player-promotes': ['Promotion on {square}. A competent conversion.', 'A new queen. I must account for that.'],
    'boss-promotes': ['Promotion complete. The endgame is resolved.', 'A pawn becomes a queen, as projected.'],
    'check-given': ['Check. The line is forcing.', 'Check — your options narrow.'],
    'in-check': ['Check acknowledged. It changes nothing.', 'A check. Predictable.'],
    'king-walk': ['Your king on {square} violates basic safety principles.', 'King activity before the endgame is premature.'],
    'early-castle': ['Castling early. A sound, conventional choice.', 'Prudent. Your king is now harder to reach.'],
    'long-think': ['{seconds} seconds of deliberation. Your clock is also a variable.', 'Indecision costs time. Time is finite.'],
    'time-trouble': ['Your remaining time is insufficient for this position.', 'Time trouble. Errors become likely now.'],
    'spell-cast': ['{spell} engaged.', 'Initiating {spell}.'],
    'spell-blocked': ['Interference detected. {spell} nullified.', 'A countermeasure. Efficient.'],
    'tactic-used': ['A non-standard move. Logged.', 'An irregular manoeuvre. Interesting.'],
  },
  sly: {
    'queen-sacrifice': ['Ooh, your queen on {square}… is that bait, or a gift for me?', 'A queen sacrifice! Either genius or madness. Let’s find out!'],
    'queen-won': ['Your queen? Don’t mind if I do!', 'Snip! There goes your favourite piece.'],
    'queen-lost': ['Hey! That was my favourite queen!', 'Rude. Very rude. And clever. Mostly rude.'],
    blunder: ['Oops! Did you mean to do that? I hope so — I like it.', 'Thank you! That was very generous.'],
    brilliance: ['Oh, you’re good. I hate that you’re good.', 'Didn’t see that coming. Nicely played, you sneak.'],
    'big-capture': ['My {piece}! You’ll want to give that back.', 'Fine, keep the {piece}. It was a trap anyway. Probably.'],
    'lost-major': ['Your {piece} looked lonely on {square}, so I took it.', 'Bye-bye, {piece}!'],
    'player-promotes': ['A shiny new queen? Show-off.', 'Promotion on {square}? I was just about to stop that. Honestly.'],
    'boss-promotes': ['Surprise! A brand-new queen!', 'Look who grew up into a queen!'],
    'check-given': ['Check! Boo!', 'Knock knock — it’s check.'],
    'in-check': ['Ooh, a check. Tickles.', 'Sneaky! Two can play that game.'],
    'king-walk': ['Your king on {square}? Taking a little walk, are we?', 'Brave little king. Very brave. Very exposed.'],
    'early-castle': ['Hiding already? I haven’t even started!', 'Tucked in nice and cosy, are we?'],
    'long-think': ['{seconds} seconds? Looking for my trap? Keep looking.', 'Take your time… I’ll just set up a few more tricks.'],
    'time-trouble': ['Tick-tock! Your clock is almost out!', 'Ooh, time trouble. My favourite kind of trouble.'],
    'spell-cast': ['Abracadabra — {spell}!', 'Surprise! {spell}!'],
    'spell-blocked': ['Hey, no fair! You blocked my {spell}!', 'A ward? Who told you about my {spell}?'],
    'tactic-used': ['That’s not how that piece moves! …Is it?', 'Ooh, a trick of your own! I respect that.'],
  },
}

export const ARCHETYPE_TONE: Readonly<Record<ArchetypeId, TauntTone>> = {
  berserker: 'fierce',
  warlord: 'fierce',
  gambiteer: 'fierce',
  calculator: 'cold',
  fortifier: 'cold',
  sniper: 'cold',
  trickster: 'sly',
  maverick: 'sly',
}

export const LEGEND_TONE: Readonly<Record<LegendId, TauntTone>> = {
  cleopatra: 'sly',
  newton: 'cold',
  napoleon: 'fierce',
  einstein: 'sly',
  ragnar: 'fierce',
  musashi: 'cold',
  aerith: 'cold',
  malakor: 'sly',
}

/** Fills {placeholders}; unknown ones are left out cleanly. */
export function fillTemplate(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '').replace(/\s{2,}/g, ' ').trim()
}
