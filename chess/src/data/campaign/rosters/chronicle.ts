// Realm I — Historical Legends (Elo 800 → 1450). Six Chronos legends make
// cameo appearances; dialogue is original, in-character writing.
import type { RosterEntry } from '../../../types/campaign'
import { buildRealmRoster } from '../build'

const ENTRIES: RosterEntry[] = [
  // ── Ancient World ──
  {
    slug: 'hammurabi', name: 'Hammurabi', title: 'Lawgiver of Babylon', archetype: 'calculator', book: 'old-masters', icon: 'scale',
    bio: 'Carved his laws in black stone and expects every move to follow them to the letter.',
    lines: { intro: 'An eye for an eye, a pawn for a pawn. The law is the law.', win: 'Judgement is passed. Read the stele next time.', lose: 'Even the law bends to a better argument.' },
  },
  {
    slug: 'sun-tzu', name: 'Sun Tzu', title: 'Author of The Art of War', archetype: 'fortifier', book: 'old-masters', icon: 'scroll',
    bio: 'Believes the battle is won before it begins — so he builds walls and waits for you to make the first mistake.',
    lines: { intro: 'Every battle is won before it is fought. This one was decided at move zero.', win: 'Know yourself, know your enemy. You knew neither.', lose: 'You broke my resistance with patience. That is the highest art.' },
  },
  {
    slug: 'alexander', name: 'Alexander the Great', title: 'King of Macedon', archetype: 'warlord', book: 'classical', icon: 'crown',
    bio: 'Never lost a battle and never stood still — he grabs the centre and marches on.',
    lines: { intro: 'I have conquered the known world. Your board is a little smaller.', win: 'Another kingdom for my map.', lose: 'So there is a land I cannot take. Remarkable.' },
  },
  {
    slug: 'hannibal', name: 'Hannibal Barca', title: 'General of Carthage', archetype: 'trickster', book: 'romantic', icon: 'mountain',
    bio: 'Marched elephants over the Alps and loves an encirclement — watch your flanks.',
    lines: { intro: 'I will find a way, or I will make one.', win: 'Cannae, all over again.', lose: 'Rome had its Scipio. It seems I have you.' },
  },
  { slug: 'cleopatra', legend: 'cleopatra', archetype: 'trickster' },
  // ── Middle Ages ──
  {
    slug: 'charlemagne', name: 'Charlemagne', title: 'Father of Europe', archetype: 'warlord', book: 'classical', icon: 'church',
    bio: 'United half a continent under one banner and plays every game like a coronation.',
    lines: { intro: 'I unite kingdoms. Let me unite your pieces — under my banner.', win: 'Another province for the empire.', lose: 'The empire bows to you, this once.' },
  },
  { slug: 'ragnar', legend: 'ragnar', archetype: 'berserker' },
  {
    slug: 'saladin', name: 'Saladin', title: 'Sultan of Egypt and Syria', archetype: 'sniper', book: 'hypermodern', icon: 'moon',
    bio: 'Chivalrous and far-sighted, he strikes from range like his horse archers.',
    lines: { intro: 'Let us fight with honour, and may the better strategist prevail.', win: 'Well fought. Go in peace.', lose: 'Honour to the victor. You fought like a lion.' },
  },
  {
    slug: 'genghis-khan', name: 'Genghis Khan', title: 'Great Khan of the Mongols', archetype: 'berserker', book: 'gambit', icon: 'wind',
    bio: 'The steppe has no walls and neither does his style: relentless, fast and merciless.',
    lines: { intro: 'The steppe has no walls. Neither will your king.', win: 'The horde rides on.', lose: 'You stopped the horde. Few can say that.' },
  },
  {
    slug: 'joan-of-arc', name: 'Joan of Arc', title: 'The Maid of Orléans', archetype: 'gambiteer', book: 'romantic', icon: 'shield',
    bio: 'Fearless, inspired and always first through the breach — she gives material to seize the initiative.',
    lines: { intro: 'I am not afraid. I was born to do this.', win: 'Orléans is free again.', lose: 'Then let my courage be your lesson.' },
  },
  // ── Renaissance & Enlightenment ──
  {
    slug: 'leonardo', name: 'Leonardo da Vinci', title: 'Renaissance Polymath', archetype: 'maverick', book: 'irregular', icon: 'palette',
    bio: 'Sketched flying machines centuries early, and plays openings nobody has named yet.',
    lines: { intro: 'I have drawn flying machines. Let me sketch your defeat.', win: 'A masterpiece, if I say so myself.', lose: 'Every failure teaches. I shall redraw the plan.' },
  },
  {
    slug: 'machiavelli', name: 'Niccolò Machiavelli', title: 'Author of The Prince', archetype: 'trickster', book: 'gambit', icon: 'drama',
    bio: 'Every courtesy is a trap and every gift has a price. Count your pieces twice.',
    lines: { intro: 'It is better to be feared than loved. Shall we find out which you are?', win: 'The ends justified the means.', lose: 'Fortune is a fickle mistress.' },
  },
  {
    slug: 'elizabeth-i', name: 'Queen Elizabeth I', title: 'The Virgin Queen', archetype: 'fortifier', book: 'fortress', icon: 'crown',
    bio: 'Outlasted armadas and assassins with patience, intelligence and an unbreakable defence.',
    lines: { intro: 'I have the heart and stomach of a king. Come and test them.', win: 'England prevails.', lose: 'A rare defeat for the Crown. Mark it well.' },
  },
  { slug: 'musashi', legend: 'musashi', archetype: 'calculator' },
  { slug: 'newton', legend: 'newton', archetype: 'fortifier' },
  // ── Modern Era ──
  { slug: 'napoleon', legend: 'napoleon', archetype: 'gambiteer' },
  {
    slug: 'ada-lovelace', name: 'Ada Lovelace', title: 'First Computer Programmer', archetype: 'calculator', book: 'classical', icon: 'binary',
    bio: 'Wrote the first algorithm for a machine that did not exist yet — and computes her moves just as carefully.',
    lines: { intro: 'Every move is an operation. Let me run the program.', win: 'The engine computed correctly.', lose: 'An unexpected output. I shall debug it.' },
  },
  {
    slug: 'tesla', name: 'Nikola Tesla', title: 'Master of Lightning', archetype: 'sniper', book: 'hypermodern', icon: 'zap',
    bio: 'Sent power through the air; sends bishops across the board.',
    lines: { intro: 'I can send power through the air. Watch what my bishops do.', win: 'Current wins over resistance.', lose: 'Alternating fortunes. I shall recharge.' },
  },
  {
    slug: 'marie-curie', name: 'Marie Curie', title: 'Pioneer of Radioactivity', archetype: 'fortifier', book: 'fortress', icon: 'radiation',
    bio: 'Two Nobel prizes earned through patience and persistence. She will outlast you.',
    lines: { intro: 'Nothing in life is to be feared, only understood. Let me understand your position.', win: 'The results are conclusive.', lose: 'A surprising half-life. I underestimated you.' },
  },
  { slug: 'einstein', legend: 'einstein', archetype: 'maverick' },
]

export default buildRealmRoster('chronicle', ENTRIES)
