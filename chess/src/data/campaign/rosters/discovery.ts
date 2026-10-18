// Realm III — Age of Discovery & Blades (Elo 1500 → 2100).
import type { RosterEntry } from '../../../types/campaign'
import { buildRealmRoster } from '../build'

const ENTRIES: RosterEntry[] = [
  // ── The Spanish Main ──
  {
    slug: 'anne-bonny', name: 'Anne Bonny', title: 'Terror of the Caribbean', archetype: 'berserker', book: 'gambit', icon: 'anchor',
    bio: 'Boarded ships with a cutlass in each hand. Boards your king the same way.',
    lines: { intro: 'Strike your colours, or I strike your king!', win: 'The plunder’s mine.', lose: 'Hang it… outsailed.' },
  },
  {
    slug: 'calico-jack', name: 'Calico Jack', title: 'Captain of the Revenge', archetype: 'trickster', book: 'irregular', icon: 'sailboat',
    bio: 'A flag, a grin and a hold full of dirty tricks.',
    lines: { intro: 'A flag, a grin and a few dirty tricks.', win: 'Ha! Never trust a pirate.', lose: 'Well, that was a mutiny of a game.' },
  },
  {
    slug: 'blackbeard', name: 'Blackbeard', title: 'Scourge of the Seven Seas', archetype: 'gambiteer', book: 'gambit', icon: 'skull',
    bio: 'Lit fuses in his beard to terrify crews. Lights gambits on the board to terrify you.',
    lines: { intro: 'Lit fuses in my beard and a gambit on my board.', win: 'Davy Jones sends his regards.', lose: 'Blast and barnacles!' },
  },
  {
    slug: 'grace-omalley', name: 'Grace O’Malley', title: 'Pirate Queen of Connacht', archetype: 'warlord', book: 'classical', icon: 'ship',
    bio: 'Met a queen as an equal and ruled the western seas. She takes space and keeps it.',
    lines: { intro: 'I bowed to no queen. I will not bow to you.', win: 'The sea answers to me.', lose: 'A fair wind for you today.' },
  },
  {
    slug: 'henry-morgan', name: 'Captain Henry Morgan', title: 'Admiral of the Brethren', archetype: 'calculator', book: 'engine', icon: 'compass',
    bio: 'Planned every raid down to the last cannonball.',
    lines: { intro: 'Every raid is planned to the last cannonball.', win: 'Right on schedule.', lose: 'My charts were wrong. Rare.' },
  },
  // ── The Tourney Fields ──
  {
    slug: 'gawain', name: 'Sir Gawain', title: 'Knight of the Green Chapel', archetype: 'fortifier', book: 'fortress', icon: 'shield',
    bio: 'Keeps his word and his king’s shelter, whatever the cost.',
    lines: { intro: 'I keep my word, and I keep my king safe.', win: 'Honour is satisfied.', lose: 'I yield, with honour.' },
  },
  {
    slug: 'el-cid', name: 'El Cid', title: 'Champion of Castile', archetype: 'warlord', book: 'classical', icon: 'sword',
    bio: 'Legend says he won a battle after his death. Alive, he is worse.',
    lines: { intro: 'Even dead, I won battles. Alive, I am worse.', win: 'For Castile!', lose: 'A champion’s defeat is no shame.' },
  },
  {
    slug: 'lancelot', name: 'Sir Lancelot', title: 'First Knight of the Round Table', archetype: 'gambiteer', book: 'romantic', icon: 'swords',
    bio: 'The finest lance of Camelot, and a romantic who sacrifices for glory.',
    lines: { intro: 'For love and glory — and a beautiful sacrifice.', win: 'Chivalry triumphs.', lose: 'Bested… Guinevere must never hear of this.' },
  },
  {
    slug: 'lionheart', name: 'Richard the Lionheart', title: 'Crusader King', archetype: 'berserker', book: 'romantic', icon: 'crown',
    bio: 'Leads every charge from the front, crown and all.',
    lines: { intro: 'The lion leads from the front!', win: 'Hear me roar!', lose: 'Even lions must rest.' },
  },
  {
    slug: 'black-prince', name: 'The Black Prince', title: 'Victor of Crécy', archetype: 'sniper', book: 'hypermodern', icon: 'target',
    bio: 'His longbowmen won battles from extreme range; his bishops do the same.',
    lines: { intro: 'My archers have the range. Your pieces have nowhere to hide.', win: 'Crécy, all over again.', lose: 'The longbows fall silent.' },
  },
  // ── Uncharted Horizons ──
  {
    slug: 'marco-polo', name: 'Marco Polo', title: 'Merchant of the Silk Road', archetype: 'sniper', book: 'hypermodern', icon: 'map',
    bio: 'Travelled for twenty-four years. He can wait twenty-four moves for the right shot.',
    lines: { intro: 'I travelled for twenty-four years. I can wait twenty-four moves.', win: 'Another tale for my book.', lose: 'Not even Kublai Khan beat me so cleanly.' },
  },
  {
    slug: 'ibn-battuta', name: 'Ibn Battuta', title: 'Traveller of the Known World', archetype: 'maverick', book: 'irregular', icon: 'globe',
    bio: 'Crossed three continents on a whim. Never plays the same opening twice.',
    lines: { intro: 'Travel leaves you speechless, then turns you into a storyteller.', win: 'A story worth telling.', lose: 'The road humbles every traveller.' },
  },
  {
    slug: 'zheng-he', name: 'Zheng He', title: 'Admiral of the Treasure Fleet', archetype: 'warlord', book: 'classical', icon: 'waves',
    bio: 'Commanded hundreds of ships across the Indian Ocean. Out-numbers you everywhere.',
    lines: { intro: 'Three hundred ships. Count your pawns.', win: 'The fleet sails on.', lose: 'The treasure is yours.' },
  },
  {
    slug: 'magellan', name: 'Ferdinand Magellan', title: 'Circumnavigator', archetype: 'calculator', book: 'engine', icon: 'telescope',
    bio: 'Plotted a route around the whole world. His plans always come full circle.',
    lines: { intro: 'The world is round. So is my plan — it always comes back.', win: 'Full circle.', lose: 'Lost at sea…' },
  },
  {
    slug: 'shackleton', name: 'Ernest Shackleton', title: 'Endurance of the Antarctic', archetype: 'fortifier', book: 'fortress', icon: 'snowflake',
    bio: 'Brought his whole crew home through the ice. Defends hopeless positions for fun.',
    lines: { intro: 'By endurance we conquer.', win: 'Endurance won.', lose: 'We will be back. We always come back.' },
  },
  // ── Shadows of Iga ──
  {
    slug: 'fuma-kotaro', name: 'Fūma Kotarō', title: 'Shadow of the Hōjō', archetype: 'trickster', book: 'irregular', icon: 'eclipse',
    bio: 'A night raider who strikes from nowhere. You will not see the fork until it lands.',
    lines: { intro: 'You will not see the knight until it forks you.', win: 'Gone like smoke.', lose: 'Seen… how?' },
  },
  {
    slug: 'mochizuki-chiyome', name: 'Mochizuki Chiyome', title: 'Mistress of the Kunoichi', archetype: 'gambiteer', book: 'gambit', icon: 'flower',
    bio: 'Ran a network of spies across Japan. Every pawn she gives you is an agent.',
    lines: { intro: 'Every pawn I give is a spy in your camp.', win: 'My agents report: checkmate.', lose: 'My network failed me.' },
  },
  {
    slug: 'ishikawa-goemon', name: 'Ishikawa Goemon', title: 'Thief of Kyoto', archetype: 'maverick', book: 'irregular', icon: 'key',
    bio: 'A legendary outlaw who robbed the powerful. Your queen looks valuable.',
    lines: { intro: 'Your queen looks valuable. I will take it.', win: 'Stolen, fair and square.', lose: 'Caught red-handed.' },
  },
  {
    slug: 'momochi-sandayu', name: 'Momochi Sandayū', title: 'Master of Iga', archetype: 'calculator', book: 'engine', icon: 'scan-eye',
    bio: 'Trained a generation of shinobi in patience and precision.',
    lines: { intro: 'Iga trains patience. Iga trains precision.', win: 'Precisely.', lose: 'Iga will remember this.' },
  },
  {
    slug: 'hattori-hanzo', name: 'Hattori Hanzō', title: 'The Demon Hanzō', archetype: 'trickster', book: 'sicilian', icon: 'swords',
    bio: 'The most feared shinobi of the Sengoku era guards the end of the realm.',
    lines: { intro: 'Iga and Kōga bow to me. Now you will.', win: 'The demon strikes unseen.', lose: 'A shadow… undone by light.' },
  },
]

export default buildRealmRoster('discovery', ENTRIES)
