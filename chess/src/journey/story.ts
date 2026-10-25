// Story mode: "The Keeper of Time". The Hourglass of Chronos has shattered
// and its eleven shards have fallen through history. Each is guarded by one
// of history's great minds, who will only give it up over a game of chess.
// Every chapter opens with a short scene, then the game, then a closing scene.
// The dialogue is written for the game (not historical quotations).

export type Speaker = 'keeper' | 'narrator' | 'ghost' | { classic: string }

export interface Panel {
  speaker: Speaker
  text: string
}

export interface Chapter {
  index: number
  title: string
  era: string
  /** Who guards the shard: a Classic character id, or your own ghost. */
  opponent: { classic: string } | 'ghost'
  backdrop: string
  intro: readonly Panel[]
  outro: readonly Panel[]
}

/** Opponent strength in story battles (Elo), chosen before each chapter. */
export const STORY_STRENGTHS = [
  { id: 'gentle', name: 'Gentle', elo: 800 },
  { id: 'fair', name: 'Fair', elo: 1200 },
  { id: 'fierce', name: 'Fierce', elo: 1600 },
  { id: 'authentic', name: 'Authentic', elo: 0 },
] as const
export type StoryStrength = (typeof STORY_STRENGTHS)[number]['id']

const c = (classic: string): Speaker => ({ classic })

export const CHAPTERS: readonly Chapter[] = [
  {
    index: 0,
    title: 'The Shattered Hourglass',
    era: 'Egypt, c. 500 BCE',
    opponent: { classic: 'sun-tzu' },
    backdrop: 'backgrounds/arena-egyptian-pyramid.webp',
    intro: [
      { speaker: 'narrator', text: 'Somewhere outside of time, a great hourglass cracks. Eleven shards of golden sand scatter across the centuries.' },
      { speaker: 'keeper', text: 'You hear me? Good. I am Chronos, Keeper of Time — or I was, until the Hourglass broke. Without it, history is starting to unravel.' },
      { speaker: 'keeper', text: 'Each shard fell into the hands of a great mind. They will not give it up for gold or threats. Only for a game of chess, well played.' },
      { speaker: c('sun-tzu'), text: 'A stranger arrives with no army and asks for my treasure. Interesting. Sit. Every battle is won before it is fought — let us see if yours was.' },
    ],
    outro: [
      { speaker: c('sun-tzu'), text: 'You read the board the way a general reads the land. Take the shard. You will need more than one victory.' },
      { speaker: 'keeper', text: 'One shard home. I can feel the sand moving again. The next one burns somewhere in Rome’s long shadow.' },
    ],
  },
  {
    index: 1,
    title: 'Over the Alps',
    era: 'Carthage & Rome, 218 BCE',
    opponent: { classic: 'hannibal' },
    backdrop: 'backgrounds/arena-roman-colosseum.webp',
    intro: [
      { speaker: 'keeper', text: 'Hannibal Barca marched elephants over the Alps. A shard of time fell into his camp the night before he crossed.' },
      { speaker: c('hannibal'), text: 'You want this glowing stone? Everyone who wants something from me must first get past me. Rome is still trying.' },
      { speaker: 'keeper', text: 'He loves surprise attacks and traps. Watch your flanks.' },
    ],
    outro: [
      { speaker: c('hannibal'), text: 'You found a way. I respect that more than you know. Go — before I change my mind.' },
      { speaker: 'keeper', text: 'Two shards. The cracks in the timeline are closing. Next: France, and a young woman who heard voices.' },
    ],
  },
  {
    index: 2,
    title: 'The Maid of Orléans',
    era: 'France, 1429',
    opponent: { classic: 'joan-of-arc' },
    backdrop: 'backgrounds/arena-viking-longhall.webp',
    intro: [
      { speaker: 'narrator', text: 'Smoke over Orléans. Banners in the wind. A shard glows inside a soldier’s helmet.' },
      { speaker: c('joan-of-arc'), text: 'They told me I would lift a siege. They did not tell me a traveller from nowhere would ask for a piece of the sky.' },
      { speaker: c('joan-of-arc'), text: 'Very well. I do not fear a battle. Do you?' },
    ],
    outro: [
      { speaker: c('joan-of-arc'), text: 'You fought with courage. Take it, and carry it well.' },
      { speaker: 'keeper', text: 'Three. The next shard fell far to the east, into the hands of a swordsman who never lost a duel.' },
    ],
  },
  {
    index: 3,
    title: 'The Way of Two Swords',
    era: 'Japan, 1612',
    opponent: { classic: 'musashi' },
    backdrop: 'backgrounds/arena-samurai-dojo.webp',
    intro: [
      { speaker: c('musashi'), text: 'Sixty duels, and I am still alive. You are not the first to come for something of mine.' },
      { speaker: 'keeper', text: 'Musashi wins with timing. He waits for one mistake, then strikes with everything.' },
      { speaker: c('musashi'), text: 'Bow, then. And do not blink.' },
    ],
    outro: [
      { speaker: c('musashi'), text: 'Your timing was true. Today the student was the master.' },
      { speaker: 'keeper', text: 'Four shards. The next one fell into a workshop full of flying machines and unfinished paintings.' },
    ],
  },
  {
    index: 4,
    title: 'The Workshop of Wonders',
    era: 'Florence, c. 1500',
    opponent: { classic: 'leonardo' },
    backdrop: 'backgrounds/world-map.webp',
    intro: [
      { speaker: c('leonardo'), text: 'Ah, a visitor! Careful of the wings, they are drying. You want the glowing sand? I have been sketching it for weeks.' },
      { speaker: c('leonardo'), text: 'I will trade it for an interesting game. Bore me and it stays in my notebook.' },
    ],
    outro: [
      { speaker: c('leonardo'), text: 'Magnificent! I must draw that final position. Take the shard — I have my sketch.' },
      { speaker: 'keeper', text: 'Five. Halfway. The next shard sank into the Caribbean, aboard a ship flying a black flag.' },
    ],
  },
  {
    index: 5,
    title: 'The Black Flag',
    era: 'The Caribbean, 1718',
    opponent: { classic: 'blackbeard' },
    backdrop: 'backgrounds/arena-pirate-cove.webp',
    intro: [
      { speaker: 'narrator', text: 'Cannon smoke and burning fuses. The deck of the Queen Anne’s Revenge rolls under your feet.' },
      { speaker: c('blackbeard'), text: 'A shiny bit of treasure washed up in my hold, and you want it? Pirates don’t share. Pirates gamble.' },
      { speaker: c('blackbeard'), text: 'Win, and it’s yours. Lose, and you swab the deck until the next century.' },
    ],
    outro: [
      { speaker: c('blackbeard'), text: 'Blast it! Fair and square. Take your sand and get off my ship.' },
      { speaker: 'keeper', text: 'Six. The next shard landed on a battlefield in Europe — in the pocket of an emperor.' },
    ],
  },
  {
    index: 6,
    title: 'The Emperor’s Pocket',
    era: 'Austerlitz, 1805',
    opponent: { classic: 'napoleon' },
    backdrop: 'backgrounds/chrono-realm.webp',
    intro: [
      { speaker: c('napoleon'), text: 'This? It fell from the sky the morning of my greatest battle. Clearly destiny meant it for me.' },
      { speaker: 'keeper', text: 'He will throw everything at the centre of the board. Hold it, and he loses his patience.' },
      { speaker: c('napoleon'), text: 'If you want my destiny, take it from me. On the board.' },
    ],
    outro: [
      { speaker: c('napoleon'), text: 'Impossible… No. Well played. History will not record this.' },
      { speaker: 'keeper', text: 'Seven. The next shard is in London, beside the first machine ever to run a program.' },
    ],
  },
  {
    index: 7,
    title: 'The Analytical Engine',
    era: 'London, 1843',
    opponent: { classic: 'ada-lovelace' },
    backdrop: 'backgrounds/loading-screen.webp',
    intro: [
      { speaker: c('ada-lovelace'), text: 'You know what this is, don’t you? Sand that remembers. I have been trying to write down its pattern.' },
      { speaker: c('ada-lovelace'), text: 'A machine could play chess one day, I am quite sure. Today, let us see if you can out-think one who thinks like a machine.' },
    ],
    outro: [
      { speaker: c('ada-lovelace'), text: 'Elegant. Your moves had a poetry the engine would never have found. It is yours.' },
      { speaker: 'keeper', text: 'Eight. The next shard bends space around it. Of course it found its way to Einstein.' },
    ],
  },
  {
    index: 8,
    title: 'Relativity',
    era: 'Bern, 1905',
    opponent: { classic: 'einstein' },
    backdrop: 'backgrounds/arena-cosmic-observatory.webp',
    intro: [
      { speaker: c('einstein'), text: 'Time runs slower near this little stone. Very curious. I could study it for years.' },
      { speaker: 'keeper', text: 'Then he will not part with it easily. Expect the unexpected.' },
      { speaker: c('einstein'), text: 'A game, then. Imagination against imagination.' },
    ],
    outro: [
      { speaker: c('einstein'), text: 'Wonderful! For you, that game passed in minutes; for me, it felt like an hour. Take it.' },
      { speaker: 'keeper', text: 'Nine. One more great mind, and then… then I will tell you where the last shard is.' },
    ],
  },
  {
    index: 9,
    title: 'The Chess Machine',
    era: 'Havana, 1921',
    opponent: { classic: 'capablanca' },
    backdrop: 'backgrounds/victory-screen.webp',
    intro: [
      { speaker: c('capablanca'), text: 'They call me the Chess Machine. I rarely make mistakes — and you have come for something I hold.' },
      { speaker: c('capablanca'), text: 'Simplicity is the hardest thing. Play simply, and play well.' },
    ],
    outro: [
      { speaker: c('capablanca'), text: 'Clean, clear chess. You have earned this — and whatever comes next.' },
      { speaker: 'keeper', text: 'Ten shards. The last one… I have searched every century. It is not in the past at all.' },
    ],
  },
  {
    index: 10,
    title: 'The Last Guardian',
    era: 'Outside of time',
    opponent: 'ghost',
    backdrop: 'backgrounds/chrono-realm.webp',
    intro: [
      { speaker: 'keeper', text: 'The last shard is guarded by the one opponent who knows every move you have ever made.' },
      { speaker: 'ghost', text: 'Hello. I am you — every opening you favour, every habit, every mistake. To win, you must beat yourself.' },
      { speaker: 'keeper', text: 'Play better than you ever have. That is the only way.' },
    ],
    outro: [
      { speaker: 'ghost', text: 'Then you have grown past me. Take the last shard. I will be waiting, a little stronger, next time.' },
      { speaker: 'narrator', text: 'Eleven shards fall into place. The Hourglass glows, and every era breathes again.' },
      { speaker: 'keeper', text: 'You did it, Keeper. Yes — Keeper. The Hourglass is yours to guard now. Wear this ring, and come back whenever history needs you.' },
    ],
  },
]

/** The first chapter not yet completed (null when the story is finished). */
export const nextChapter = (done: readonly number[]): Chapter | null => CHAPTERS.find((ch) => !done.includes(ch.index)) ?? null

/** A chapter can be played once the one before it is done. */
export const chapterOpen = (index: number, done: readonly number[]): boolean => index === 0 || done.includes(index - 1)

/** Coins for a first completion; the finale also gives the Keeper’s Ring and a title. */
export function chapterReward(index: number): Array<{ kind: 'coins'; amount: number } | { kind: 'frame'; id: string } | { kind: 'title'; id: string; name: string }> {
  const coins = { kind: 'coins' as const, amount: 150 + index * 50 }
  return index === CHAPTERS.length - 1 ? [coins, { kind: 'frame', id: 'story-ring' }, { kind: 'title', id: 'keeper-of-time', name: 'Keeper of Time' }] : [coins]
}
