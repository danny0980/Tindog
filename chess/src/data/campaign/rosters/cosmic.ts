// Realm V — Cosmic Pantheon, the endgame (Elo 2200 → 2800).
import type { RosterEntry } from '../../../types/campaign'
import { buildRealmRoster } from '../build'

const ENTRIES: RosterEntry[] = [
  // ── Citadel of Hours ──
  {
    slug: 'chronarch-vell', name: 'Chronarch Vell', title: 'Keeper of the First Second', archetype: 'fortifier', book: 'fortress', icon: 'clock',
    bio: 'Has all the time in the universe and is happy to spend it on one position.',
    lines: { intro: 'I have all the time in the universe.', win: 'Time’s up.', lose: 'A paradox… you.' },
  },
  {
    slug: 'clockwork-oracle', name: 'The Clockwork Oracle', title: 'Gears of Fate', archetype: 'calculator', book: 'engine', icon: 'nut',
    bio: 'Fate, wound up like a watch spring and released one exact move at a time.',
    lines: { intro: 'Tick. Tock. Your fate is wound.', win: 'Exactly on time.', lose: 'A gear slipped.' },
  },
  {
    slug: 'paradoxia', name: 'Paradoxia', title: 'Weaver of Loops', archetype: 'maverick', book: 'irregular', icon: 'infinity',
    bio: 'Has played this game before. And after. And instead.',
    lines: { intro: 'I have already won this game. And lost it. And won it.', win: 'As it always was.', lose: 'Timeline altered…' },
  },
  {
    slug: 'aeon', name: 'Aeon', title: 'Lord of the Long Now', archetype: 'warlord', book: 'classical', icon: 'sunrise',
    bio: 'Empires bloom and wither in the blink of his eye; his space advantage lasts longer.',
    lines: { intro: 'Empires bloom and wither in my blink.', win: 'Another age ends.', lose: 'This age is yours.' },
  },
  {
    slug: 'epoch-zero', name: 'Epoch Zero', title: 'The End of Time', archetype: 'berserker', book: 'sicilian', icon: 'hourglass',
    bio: 'The last tick of the last clock, in a hurry to finish everything.',
    lines: { intro: 'I am the last tick of the last clock.', win: 'Time ends here.', lose: 'Time… continues.' },
  },
  // ── The Hollow Between ──
  {
    slug: 'nihil', name: 'Nihil', title: 'Herald of the Empty', archetype: 'fortifier', book: 'fortress', icon: 'eclipse',
    bio: 'Nothing gets through its defence. Literally nothing.',
    lines: { intro: 'Nothing gets through. Literally nothing.', win: 'The void absorbs all.', lose: 'Something… where there was nothing.' },
  },
  {
    slug: 'umbra', name: 'Umbra', title: 'Shadow Between Stars', archetype: 'trickster', book: 'gambit', icon: 'moon',
    bio: 'In the dark between galaxies, every square hides a trap.',
    lines: { intro: 'In the dark, every move is a trap.', win: 'Lost in shadow.', lose: 'The light breaks through.' },
  },
  {
    slug: 'silent-choir', name: 'The Silent Choir', title: 'Song of the Abyss', archetype: 'sniper', book: 'hypermodern', icon: 'music',
    bio: 'A chorus that sings across the void in long notes and longer diagonals.',
    lines: { intro: 'We sing across the void. Long notes, long diagonals.', win: 'Harmony of the void.', lose: 'Our song falters.' },
  },
  {
    slug: 'gravemind', name: 'Gravemind Abyss', title: 'Devourer of Light', archetype: 'gambiteer', book: 'gambit', icon: 'orbit',
    bio: 'A black hole with an appetite. Sacrifice, to it, is just eating.',
    lines: { intro: 'I consume. Sacrifice is just eating.', win: 'Consumed.', lose: 'Indigestion.' },
  },
  {
    slug: 'warden-xal', name: 'Warden Xal', title: 'Gatekeeper of the Void', archetype: 'calculator', book: 'engine', icon: 'lock',
    bio: 'None pass the gate to the inner cosmos without beating its exact, tireless play.',
    lines: { intro: 'None pass the gate without my leave.', win: 'The gate holds.', lose: 'The gate… opens.' },
  },
  // ── Maw of Entropy ──
  {
    slug: 'kaoskin', name: 'Kaoskin the Many', title: 'Swarm of a Thousand Wills', archetype: 'maverick', book: 'irregular', icon: 'network',
    bio: 'A thousand minds voting on every move. The result is beautifully random.',
    lines: { intro: 'We are many. We are random. We are coming.', win: 'Entropy wins.', lose: 'Order… disgusting.' },
  },
  {
    slug: 'entropia', name: 'Entropia', title: 'Undoing of All Things', archetype: 'gambiteer', book: 'gambit', icon: 'flame',
    bio: 'Everything falls apart eventually. She starts with your pawn structure.',
    lines: { intro: 'Everything falls apart. Your position first.', win: 'Heat death.', lose: 'Temporary order.' },
  },
  {
    slug: 'laughing-void', name: 'The Laughing Void', title: 'Jester of the Abyss', archetype: 'trickster', book: 'irregular', icon: 'drama',
    bio: 'A cosmic joke with perfect comic timing — and perfect forks.',
    lines: { intro: 'Let’s play a game. The game is chess. The joke is you.', win: 'Punchline!', lose: 'Tough crowd.' },
  },
  {
    slug: 'maelstrom', name: 'Maelstrom', title: 'Storm at the Edge of Reality', archetype: 'berserker', book: 'romantic', icon: 'tornado',
    bio: 'A hurricane the size of a galaxy, aimed squarely at your king.',
    lines: { intro: 'Rage across the board!', win: 'Torn apart.', lose: 'The storm calms.' },
  },
  {
    slug: 'azathon', name: 'Azathon', title: 'The Entity of Chaos', archetype: 'maverick', book: 'sicilian', icon: 'radiation',
    bio: 'The universe is its dream. Wake it, and anything can happen on the board.',
    lines: { intro: 'I dream the universe. Wake me, and it ends.', win: 'Dream on.', lose: 'Awake… at last.' },
  },
  // ── Throne of Stars ──
  {
    slug: 'solara', name: 'Solara', title: 'Goddess of the Burning Sun', archetype: 'sniper', book: 'hypermodern', icon: 'sun',
    bio: 'Her light reaches every square — so do her bishops.',
    lines: { intro: 'My light reaches every square.', win: 'Scorched.', lose: 'Eclipsed.' },
  },
  {
    slug: 'nebulon', name: 'Nebulon', title: 'Shepherd of Nebulae', archetype: 'fortifier', book: 'fortress', icon: 'sparkles',
    bio: 'Stars are born slowly. So are his attacks, and they are just as unstoppable.',
    lines: { intro: 'Stars are born slowly. So are my attacks.', win: 'A new star rises.', lose: 'Scattered to stardust.' },
  },
  {
    slug: 'astraeus', name: 'Astraeus', title: 'Father of the Stars', archetype: 'warlord', book: 'celestial', icon: 'star',
    bio: 'Placed every star you can see and claims the centre of the board by divine right.',
    lines: { intro: 'I placed every star you can see.', win: 'Written in the stars.', lose: 'A new constellation: you.' },
  },
  {
    slug: 'celestia-prime', name: 'Celestia Prime', title: 'Architect of Galaxies', archetype: 'calculator', book: 'celestial', icon: 'orbit',
    bio: 'Spins galaxies with exact gravity. Spinning your king is trivial.',
    lines: { intro: 'I spin galaxies. Spinning your king is trivial.', win: 'Order restored.', lose: 'Gravity bends to you.' },
  },
  {
    slug: 'the-infinite', name: 'The Infinite', title: 'Sovereign of the Cosmic Pantheon', archetype: 'calculator', book: 'celestial', icon: 'infinity',
    bio: 'Before the first star it was; after the last it will be. The hundredth and final challenge.',
    lines: {
      intro: 'Before the first star, I was. After the last, I will be. Play.',
      win: 'Infinity, unchallenged.',
      lose: 'So even the infinite can be surpassed. Go, champion. The cosmos is yours.',
    },
  },
]

export default buildRealmRoster('cosmic', ENTRIES)
