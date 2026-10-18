// Realm II — Mythology & Fantasy (Elo 1150 → 1750).
import type { RosterEntry } from '../../../types/campaign'
import { buildRealmRoster } from '../build'

const ENTRIES: RosterEntry[] = [
  // ── Halls of the Gods ──
  {
    slug: 'hermes', name: 'Hermes', title: 'Messenger of Olympus', archetype: 'trickster', book: 'irregular', icon: 'feather',
    bio: 'God of travellers and thieves: quick hands, winged sandals and a fork around every corner.',
    lines: { intro: 'Winged sandals, quick hands. Did you see that move? No? Good.', win: 'Delivered: one checkmate, express.', lose: 'Even messengers get caught sometimes.' },
  },
  {
    slug: 'athena', name: 'Athena', title: 'Goddess of Wisdom and War', archetype: 'calculator', book: 'classical', icon: 'bird',
    bio: 'Strategy over strength, always. Her owl sees every variation.',
    lines: { intro: 'Strategy over strength. Always.', win: 'Wisdom wins wars.', lose: 'A wise move. I approve, mortal.' },
  },
  {
    slug: 'thor', name: 'Thor', title: 'God of Thunder', archetype: 'berserker', book: 'romantic', icon: 'hammer',
    bio: 'Swings first, thinks later. His pawns arrive like thunderclaps.',
    lines: { intro: 'Thunder first, questions later!', win: 'HA! Mjölnir never misses!', lose: 'By Odin’s beard… a worthy foe!' },
  },
  {
    slug: 'anubis', name: 'Anubis', title: 'Guardian of the Underworld', archetype: 'fortifier', book: 'fortress', icon: 'pyramid',
    bio: 'Weighs every heart against a feather and guards his king like the gates of the Duat.',
    lines: { intro: 'I weigh every heart. Yours trembles.', win: 'Your heart was heavier than the feather.', lose: 'Your heart is light. Pass, traveller.' },
  },
  {
    slug: 'zeus', name: 'Zeus', title: 'King of the Gods', archetype: 'warlord', book: 'classical', icon: 'cloud-lightning',
    bio: 'Rules Olympus from the centre of the board and expects tribute in pawns.',
    lines: { intro: 'Olympus is watching. Do not bore it.', win: 'As the Fates decreed.', lose: 'Even Olympus kneels to a worthy mortal.' },
  },
  // ── The Silverwood ──
  { slug: 'aerith', legend: 'aerith', archetype: 'fortifier' },
  {
    slug: 'thalion', name: 'Thalion the Ranger', title: 'Warden of the Silverwood', archetype: 'sniper', book: 'hypermodern', icon: 'tree',
    bio: 'An elven archer who never misses a long diagonal.',
    lines: { intro: 'My arrows fly across the whole board.', win: 'Right through the gap in your armour.', lose: 'You moved like the wind. I missed.' },
  },
  {
    slug: 'sylvaris', name: 'Lady Sylvaris', title: 'Enchantress of the Moonwell', archetype: 'trickster', book: 'gambit', icon: 'moon',
    bio: 'Her board shimmers with illusions; half of her gifts are curses.',
    lines: { intro: 'Come closer, little piece. The water is lovely.', win: 'Enchanted, and outplayed.', lose: 'The spell broke. How rude.' },
  },
  {
    slug: 'elandor', name: 'Elandor the Archmage', title: 'Keeper of the Star Library', archetype: 'calculator', book: 'engine', icon: 'book',
    bio: 'Has read every game ever recorded and quotes them while he beats you.',
    lines: { intro: 'I have read every game ever played. Let me read yours.', win: 'Exactly as written.', lose: 'A page I had not read. Fascinating.' },
  },
  {
    slug: 'oberon', name: 'High King Oberon', title: 'Lord of the Fae Court', archetype: 'maverick', book: 'irregular', icon: 'sparkles',
    bio: 'The fae play by dream logic. Expect the impossible, then expect worse.',
    lines: { intro: 'My court plays by dream logic. Try to keep up.', win: 'Wake up, mortal. You lost.', lose: 'A midsummer defeat. How very poetic.' },
  },
  // ── The Barrow Crypts ──
  {
    slug: 'pale-knight', name: 'The Pale Knight', title: 'Revenant of the Barrow', archetype: 'fortifier', book: 'fortress', icon: 'ghost',
    bio: 'Does not tire, does not bleed and does not hurry. It simply waits.',
    lines: { intro: 'I do not tire. I do not bleed. I simply wait.', win: 'Rest now. Forever.', lose: 'Back to the barrow… for a while.' },
  },
  {
    slug: 'morgana', name: 'Morgana the Bone Witch', title: 'Mistress of the Ossuary', archetype: 'gambiteer', book: 'gambit', icon: 'bone',
    bio: 'Sacrifice is the oldest magic, and she casts it every few moves.',
    lines: { intro: 'Sacrifice is the oldest magic. Let me show you.', win: 'Your bones will make fine pawns.', lose: 'Rattled. Thoroughly rattled.' },
  },
  {
    slug: 'vorthax', name: 'Lich King Vorthax', title: 'Sovereign of the Frozen Crypt', archetype: 'calculator', book: 'classical', icon: 'snowflake',
    bio: 'Centuries of undeath spent studying chess. Cold, exact and patient.',
    lines: { intro: 'Centuries of study. Your move will not surprise me.', win: 'Predictable, like all the living.', lose: 'Impossible… my phylactery…' },
  },
  { slug: 'malakor', legend: 'malakor', archetype: 'gambiteer' },
  {
    slug: 'banshee-queen', name: 'The Banshee Queen', title: 'Voice of the Last Wail', archetype: 'berserker', book: 'gambit', icon: 'wind',
    bio: 'You will hear her attack coming — it does not help.',
    lines: { intro: 'You will hear me coming. Everyone does.', win: 'Let the wail carry your defeat.', lose: 'Silence… at last.' },
  },
  // ── Dragonspine Caldera ──
  {
    slug: 'ignaros', name: 'Ignaros the Ember Wyrm', title: 'Hatchling of the Caldera', archetype: 'berserker', book: 'romantic', icon: 'flame',
    bio: 'A young dragon with more fire than sense. His pawns charge your king from move one.',
    lines: { intro: 'Small dragon, big fire!', win: 'Toasted!', lose: 'I’ll be bigger next time…' },
  },
  {
    slug: 'glacivar', name: 'Glacivar the Frost Drake', title: 'Wing of the Northern Wastes', archetype: 'fortifier', book: 'fortress', icon: 'mountain',
    bio: 'Ice holds, ice waits, ice wins. Breaking through takes real patience.',
    lines: { intro: 'Ice holds. Ice waits. Ice wins.', win: 'Frozen solid.', lose: 'Thawed… by a mortal?' },
  },
  {
    slug: 'sylphira', name: 'Sylphira the Storm Serpent', title: 'Coil of the Tempest', archetype: 'maverick', book: 'irregular', icon: 'tornado',
    bio: 'Storms do not follow rules and neither does she.',
    lines: { intro: 'Storms don’t follow rules. Neither do I.', win: 'Swept away.', lose: 'The storm passes.' },
  },
  {
    slug: 'vexmora', name: 'Vexmora the Hoard Queen', title: 'Sleeper on the Golden Mound', archetype: 'trickster', book: 'gambit', icon: 'gem',
    bio: 'Baits you with glittering pawns, then closes her jaws.',
    lines: { intro: 'You came for my gold? Everyone does. None leave.', win: 'Another trinket for the hoard.', lose: 'Take a coin. You have earned exactly one.' },
  },
  {
    slug: 'aurelion', name: 'Aurelion the Elder Dragon', title: 'Oldest Fire in the World', archetype: 'warlord', book: 'classical', icon: 'sun',
    bio: 'Watched the mountains rise and the empires fall. The final guardian of the mythic realm.',
    lines: { intro: 'I watched the mountains rise. Your game is but a candle.', win: 'Ash to ash.', lose: 'After ten thousand years… a worthy challenger.' },
  },
]

export default buildRealmRoster('mythic', ENTRIES)
