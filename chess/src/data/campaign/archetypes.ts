// The Archetype Engine. Instead of 100 hand-tuned AIs, every boss inherits a
// combat archetype (style weights + temperament + generic dialogue) and an
// Elo, and `buildProfile` turns that pair into a Stockfish OpponentProfile.
import type { ArchetypeDef, ArchetypeId } from '../../types/campaign'
import type { OpponentProfile, StyleWeights } from '../../types/engine'
import type { QuoteTrigger } from '../../types/legend'

/** Triggers voiced by the archetype; intro / win / lose come from each boss. */
export type ArchetypeTrigger = Exclude<QuoteTrigger, 'intro' | 'legendWins' | 'legendLoses'>

interface ArchetypeSpec extends ArchetypeDef {
  weights: StyleWeights
  multiPv: number
  /** Extra centipawn window for stylish (sub-optimal) choices, halved at 2800. */
  styleSlackCp: number
  /** Extra scoring noise on top of the strength's own. */
  noise: number
  /** Multiplier on the human-like minimum think time. */
  tempo: number
  lines: Record<ArchetypeTrigger, readonly string[]>
}

const BASE: StyleWeights = {
  evaluation: 1.2, check: 0, capture: 0.05, forcing: 0, kingPressure: 0, advance: 0,
  castle: 0.4, kingShelter: 0, trade: 0, center: 0.2, development: 0.3, quiet: 0, earlyQueen: -0.3,
}

export const ARCHETYPES: Readonly<Record<ArchetypeId, ArchetypeSpec>> = {
  berserker: {
    id: 'berserker',
    name: 'The Berserker',
    summary: 'All-out king hunts, pawn storms and reckless sacrifices. Never trades if it can attack.',
    counterTip: 'Keep your king sheltered and trade off the attackers — the storm burns out.',
    icon: 'axe',
    weights: { ...BASE, evaluation: 0.9, check: 1, forcing: 0.35, kingPressure: 1.5, advance: 0.3, castle: -0.2, kingShelter: -0.2, trade: -0.5, quiet: -0.3, sacrifice: 0.8, pawnStorm: 1.2 },
    multiPv: 5,
    styleSlackCp: 90,
    noise: 0.3,
    tempo: 0.8,
    lines: {
      thinking: ['Which piece do I throw at you next…', 'Attack. Attack. Then attack.'],
      playerSlow: ['Stop hiding and fight!', 'My blood is boiling. Move!'],
      legendCapture: ['Smashed!', 'Another one falls!'],
      playerCapture: ['A scratch! Keep coming!', 'Take it — I have more.'],
      checkGiven: ['Your king bleeds!', 'Check! Run, little king!'],
      inCheck: ['Bah, a pinprick.', 'You dare strike back?'],
      advantage: ['I smell victory!', 'Your walls are crumbling!'],
      disadvantage: ['Pain only makes me stronger!', 'I am not finished yet!'],
      draw: ['A draw? I wanted blood.'],
    },
  },
  fortifier: {
    id: 'fortifier',
    name: 'The Fortifier',
    summary: 'Castles early, builds pawn chains and trades down. Waits for you to overreach.',
    counterTip: 'Open lines slowly and strike the pawn chain at its base.',
    icon: 'shield',
    weights: { ...BASE, evaluation: 1.3, forcing: -0.3, kingPressure: -0.1, advance: -0.2, castle: 1.4, kingShelter: 1, trade: 0.8, quiet: 0.4, earlyQueen: -0.6, pawnStructure: 1 },
    multiPv: 4,
    styleSlackCp: 50,
    noise: 0.15,
    tempo: 1.3,
    lines: {
      thinking: ['Reinforce. Then reinforce again.', 'Patience is a wall.'],
      playerSlow: ['Take your time. My walls are not going anywhere.', 'I can wait longer than you.'],
      legendCapture: ['One less attacker.', 'Simplify. Consolidate.'],
      playerCapture: ['Acceptable losses.', 'The wall still stands.'],
      checkGiven: ['A measured check.', 'Your king should seek shelter, as mine has.'],
      inCheck: ['A breach? Sealing it now.', 'Noted. Fortifying.'],
      advantage: ['Slowly, the vice tightens.', 'Solid ground beneath me.'],
      disadvantage: ['Hold the line.', 'Walls crack. Foundations do not.'],
      draw: ['A fortress cannot be stormed. A draw is fair.'],
    },
  },
  trickster: {
    id: 'trickster',
    name: 'The Trickster',
    summary: 'Sets traps, hunts forks and picks the sneaky second-best move to bait you.',
    counterTip: 'Check every fork and discovered attack before you move — and refuse free gifts.',
    icon: 'drama',
    weights: { ...BASE, evaluation: 1.1, check: 0.5, forcing: 0.4, earlyQueen: 0.3, fork: 1.4, creativity: 0.6 },
    multiPv: 5,
    styleSlackCp: 110,
    noise: 0.45,
    tempo: 0.9,
    lines: {
      thinking: ['Hmm, which trap is prettiest…', 'Let me hide something here.'],
      playerSlow: ['Sensing a trap? Clever. Or are you?', 'Go on, the bait is delicious.'],
      legendCapture: ['Took the bait, didn’t you?', 'Snip!'],
      playerCapture: ['Oh, you can have that one…', 'Exactly as I planned. Probably.'],
      checkGiven: ['Surprise!', 'Didn’t see that coming, did you?'],
      inCheck: ['Ooh, sneaky. I like it.', 'Two can play at tricks.'],
      advantage: ['The net is closing.', 'Every piece exactly where I want it.'],
      disadvantage: ['Time for my best trick yet.', 'A cornered fox still bites.'],
      draw: ['A draw — the joke is on both of us.'],
    },
  },
  calculator: {
    id: 'calculator',
    name: 'The Calculator',
    summary: 'Near-objective engine play: tight tolerance, little noise, few illusions.',
    counterTip: 'It rarely blunders — steer into long, closed positions and use your clock.',
    icon: 'brain-circuit',
    weights: { ...BASE, evaluation: 2.4, forcing: 0.2, quiet: 0.1 },
    multiPv: 3,
    styleSlackCp: 15,
    noise: 0.04,
    tempo: 0.7,
    lines: {
      thinking: ['Computing variations.', 'Depth increasing.'],
      playerSlow: ['Your clock is also a variable.', 'Indecision detected.'],
      legendCapture: ['Material gained, as projected.', 'Capture: optimal.'],
      playerCapture: ['A calculated loss.', 'Within tolerance.'],
      checkGiven: ['Check. Forced continuation.', 'The line is forcing.'],
      inCheck: ['Unexpected branch. Re-evaluating.', 'Check acknowledged.'],
      advantage: ['Evaluation trending in my favour.', 'Conversion phase begins.'],
      disadvantage: ['Anomalous evaluation.', 'Error margin exceeded.'],
      draw: ['Equal evaluation. A draw is the correct result.'],
    },
  },
  gambiteer: {
    id: 'gambiteer',
    name: 'The Gambiteer',
    summary: 'Gives pawns and pieces for development and initiative. Loves open lines.',
    counterTip: 'Take the gift, then hand material back to finish your development safely.',
    icon: 'flame',
    weights: { ...BASE, evaluation: 1, check: 0.4, forcing: 0.3, kingPressure: 0.5, advance: 0.3, castle: 0.2, trade: -0.3, development: 0.8, sacrifice: 1.3 },
    multiPv: 5,
    styleSlackCp: 130,
    noise: 0.35,
    tempo: 0.85,
    lines: {
      thinking: ['What shall I give away today…', 'Initiative is worth more than pawns.'],
      playerSlow: ['Counting my sacrifices? Don’t bother.', 'Accept the gift. I insist.'],
      legendCapture: ['Interest on my investment.', 'And now I collect.'],
      playerCapture: ['A gift, freely given.', 'Take it. It is poisoned.'],
      checkGiven: ['The sacrifice pays!', 'Check — the attack has begun.'],
      inCheck: ['A counter-gambit? Delightful.', 'Bold. I respect bold.'],
      advantage: ['The initiative is everything.', 'My investments are paying off.'],
      disadvantage: ['One more sacrifice should fix this.', 'Fortune favours the bold — eventually.'],
      draw: ['A draw. My gambits deserved better.'],
    },
  },
  sniper: {
    id: 'sniper',
    name: 'The Sniper',
    summary: 'Fianchettoed bishops, open files and long-range pressure from across the board.',
    counterTip: 'Close the long diagonals with pawns and fight for the open files early.',
    icon: 'crosshair',
    weights: { ...BASE, evaluation: 1.3, center: 0.6, development: 0.6, quiet: 0.2, fork: 0.4, longRange: 1.2 },
    multiPv: 4,
    styleSlackCp: 60,
    noise: 0.2,
    tempo: 1,
    lines: {
      thinking: ['Lining up the shot.', 'Checking the long diagonal.'],
      playerSlow: ['Steady. I am patient with a target.', 'Holding my aim.'],
      legendCapture: ['Clean shot.', 'From across the board.'],
      playerCapture: ['You found my blind spot.', 'A lucky counter-shot.'],
      checkGiven: ['Check — from afar.', 'In my sights.'],
      inCheck: ['Close range. Not my preference.', 'You closed the distance.'],
      advantage: ['Every line is mine.', 'The board opens up for me.'],
      disadvantage: ['My lines are blocked.', 'I need a clearer shot.'],
      draw: ['No clear shot for either of us. A draw.'],
    },
  },
  warlord: {
    id: 'warlord',
    name: 'The Warlord',
    summary: 'Grabs the centre and space, develops fast and squeezes you off the board.',
    counterTip: 'Challenge its centre early with pawn breaks before the space advantage suffocates you.',
    icon: 'swords',
    weights: { ...BASE, evaluation: 1.4, kingPressure: 0.5, advance: 0.5, trade: -0.2, center: 1, development: 0.8 },
    multiPv: 4,
    styleSlackCp: 45,
    noise: 0.12,
    tempo: 1,
    lines: {
      thinking: ['Advance the front.', 'Space is power.'],
      playerSlow: ['My armies grow while you dither.', 'Every second you wait, I advance.'],
      legendCapture: ['Territory taken.', 'The line advances.'],
      playerCapture: ['A skirmish lost. The war continues.', 'Regroup and push.'],
      checkGiven: ['Check! The siege begins.', 'Your king is surrounded.'],
      inCheck: ['A raid on my king? Bold.', 'Guards! To the king!'],
      advantage: ['The centre is mine.', 'Your lands are shrinking.'],
      disadvantage: ['Pull back the flanks.', 'A setback, not a defeat.'],
      draw: ['A truce, then. For now.'],
    },
  },
  maverick: {
    id: 'maverick',
    name: 'The Maverick',
    summary: 'Unorthodox and unpredictable: reaches for lower-ranked lines and weird plans.',
    counterTip: 'Stay calm, keep it simple and punish the odd moves with sound development.',
    icon: 'sparkles',
    weights: { ...BASE, evaluation: 1, check: 0.6, advance: 0.2, castle: 0.1, creativity: 1, sacrifice: 0.6, pawnStorm: 0.4 },
    multiPv: 5,
    styleSlackCp: 150,
    noise: 0.6,
    tempo: 0.9,
    lines: {
      thinking: ['What if… no. What if… yes!', 'Let’s do something nobody has done before.'],
      playerSlow: ['Thinking inside the box again?', 'Boring! Surprise me.'],
      legendCapture: ['Wheee!', 'Bet you didn’t expect that one.'],
      playerCapture: ['Interesting choice! Mine was more interesting.', 'Fine, keep it.'],
      checkGiven: ['Check! Unconventional, isn’t it?', 'Rules are suggestions. Check!'],
      inCheck: ['Ooh, that’s creative!', 'Now THAT is interesting.'],
      advantage: ['Chaos is going my way!', 'Madness, but with method.'],
      disadvantage: ['Time to get weirder.', 'The plan was bad. Good thing I didn’t have one.'],
      draw: ['A draw! How unexpectedly normal.'],
    },
  },
}

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[]

// ── Strength scaling ─────────────────────────────────────────────────────────

export interface StrengthProfile {
  skillLevel: number
  depth: number
  moveTimeMs: number
  toleranceCp: number
  noise: number
}

/** Calibration anchors (shared with the Quick Play difficulties, extended to 2800). */
const ANCHORS: ReadonlyArray<readonly [number, StrengthProfile]> = [
  [800, { skillLevel: 0, depth: 3, moveTimeMs: 200, toleranceCp: 220, noise: 0.9 }],
  [1400, { skillLevel: 6, depth: 7, moveTimeMs: 450, toleranceCp: 110, noise: 0.4 }],
  [2000, { skillLevel: 13, depth: 12, moveTimeMs: 900, toleranceCp: 55, noise: 0.15 }],
  [2600, { skillLevel: 20, depth: 18, moveTimeMs: 1500, toleranceCp: 25, noise: 0.04 }],
  [2800, { skillLevel: 20, depth: 20, moveTimeMs: 1800, toleranceCp: 12, noise: 0.02 }],
]

/** Piecewise-linear Stockfish strength for a target Elo (clamped to 800–2800). */
export function strengthForElo(elo: number): StrengthProfile {
  const first = ANCHORS[0] as (typeof ANCHORS)[number]
  const last = ANCHORS[ANCHORS.length - 1] as (typeof ANCHORS)[number]
  if (elo <= first[0]) return first[1]
  if (elo >= last[0]) return last[1]
  for (let i = 1; i < ANCHORS.length; i++) {
    const [hiElo, hi] = ANCHORS[i] as (typeof ANCHORS)[number]
    const [loElo, lo] = ANCHORS[i - 1] as (typeof ANCHORS)[number]
    if (elo > hiElo) continue
    const t = (elo - loElo) / (hiElo - loElo)
    const lerp = (a: number, b: number) => a + (b - a) * t
    return {
      skillLevel: Math.round(lerp(lo.skillLevel, hi.skillLevel)),
      depth: Math.round(lerp(lo.depth, hi.depth)),
      moveTimeMs: Math.round(lerp(lo.moveTimeMs, hi.moveTimeMs)),
      toleranceCp: Math.round(lerp(lo.toleranceCp, hi.toleranceCp)),
      noise: Number(lerp(lo.noise, hi.noise).toFixed(3)),
    }
  }
  return last[1]
}

/** Style slack shrinks as bosses get stronger, so a 2800 Berserker still plays near-best chess. */
const slackFactor = (elo: number): number => 1 - 0.5 * Math.min(1, Math.max(0, (elo - 800) / 2000))

/** Archetype × Elo × opening book → a complete engine profile. */
export function buildProfile(archetype: ArchetypeId, elo: number, repertoire: OpponentProfile['repertoire']): OpponentProfile {
  const spec = ARCHETYPES[archetype]
  const strength = strengthForElo(elo)
  return {
    skillLevel: strength.skillLevel,
    depth: strength.depth,
    moveTimeMs: strength.moveTimeMs,
    minThinkMs: Math.round(650 * spec.tempo),
    multiPv: spec.multiPv,
    toleranceCp: Math.round(strength.toleranceCp + spec.styleSlackCp * slackFactor(elo)),
    noise: Number((strength.noise + spec.noise * slackFactor(elo)).toFixed(3)),
    weights: spec.weights,
    ...(repertoire ? { repertoire } : {}),
  }
}

/**
 * Re-scales a hand-crafted legend profile to a campaign Elo: strength comes
 * from the Elo curve, while the legend's weights, book and temperament stay.
 */
export function rescaleProfile(profile: OpponentProfile, elo: number): OpponentProfile {
  const strength = strengthForElo(elo)
  return {
    ...profile,
    skillLevel: strength.skillLevel,
    depth: strength.depth,
    moveTimeMs: strength.moveTimeMs,
    toleranceCp: Math.round(strength.toleranceCp + profile.toleranceCp * 0.5 * slackFactor(elo)),
    noise: Number((strength.noise + profile.noise * 0.5).toFixed(3)),
  }
}
