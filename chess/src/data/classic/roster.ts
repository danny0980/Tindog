// Classic Chess: 100 historical opponents who play pure chess — no spells,
// tactics, weather or arena rules, just their own style at the board. Ten eras
// of ten form one rating ladder (≈600 → 2760 Elo), from the cradles of
// civilisation to the world champions. Portraits come from the art pack by
// name (the same names as the campaign where a character appears in both).
import type { ArchetypeId, BookId } from '../../types/campaign'
import type { PortraitIcon, PortraitSpec } from '../../types/persona'
import type { BoardThemeId, PieceSetId } from '../../types/theme'

export type ClassicEraId = 'ancient' | 'classical' | 'medieval' | 'east' | 'renaissance' | 'sail' | 'enlightenment' | 'nineteenth' | 'science' | 'masters'

export interface ClassicEra {
  id: ClassicEraId
  name: string
  caption: string
  from: string
  to: string
  themeId: BoardThemeId
  pieceSetId: PieceSetId
}

export interface ClassicCharacter {
  id: string
  name: string
  title: string
  era: ClassicEraId
  archetype: ArchetypeId
  book: BookId
  icon: PortraitIcon
  /** What they say as the game begins. */
  line: string
  elo: number
  /** 0–99 along the ladder. */
  rank: number
}

export const CLASSIC_ERAS: readonly ClassicEra[] = [
  { id: 'ancient', name: 'Cradles of Civilisation', caption: 'c. 2300 – 30 BCE', from: '#d4a24c', to: '#1e3a8a', themeId: 'papyrus-gold', pieceSetId: 'lapis' },
  { id: 'classical', name: 'Greece & Rome', caption: '480 BCE – AD 14', from: '#fde68a', to: '#7c2d12', themeId: 'royal-gold', pieceSetId: 'gilded' },
  { id: 'medieval', name: 'Kings & Crusaders', caption: 'AD 60 – 1431', from: '#8b5a2b', to: '#3f2a14', themeId: 'rune-oak', pieceSetId: 'runestone' },
  { id: 'east', name: 'Empires of the East', caption: '268 BCE – AD 1645', from: '#475569', to: '#0f172a', themeId: 'bamboo-gold', pieceSetId: 'lacquer' },
  { id: 'renaissance', name: 'Renaissance', caption: 'AD 1452 – 1642', from: '#38bdf8', to: '#1e3a8a', themeId: 'blueprint', pieceSetId: 'ink' },
  { id: 'sail', name: 'Age of Sail', caption: 'AD 1271 – 1718', from: '#2dd4bf', to: '#134e4a', themeId: 'storm-sea', pieceSetId: 'brass' },
  { id: 'enlightenment', name: 'Enlightenment & Revolution', caption: 'AD 1643 – 1821', from: '#93c5fd', to: '#991b1b', themeId: 'imperial-velvet', pieceSetId: 'imperial' },
  { id: 'nineteenth', name: 'The Long 19th Century', caption: 'AD 1769 – 1922', from: '#94a3b8', to: '#334155', themeId: 'chalkboard', pieceSetId: 'chalk' },
  { id: 'science', name: 'Minds of Science', caption: 'AD 1822 – 1958', from: '#22d3ee', to: '#0f172a', themeId: 'oled-black', pieceSetId: 'moonsilver' },
  { id: 'masters', name: 'Masters of the Board', caption: 'World champions & legends of chess', from: '#fbbf24', to: '#78350f', themeId: 'classic-wood', pieceSetId: 'standard' },
]

type Row = readonly [id: string, name: string, title: string, archetype: ArchetypeId, book: BookId, icon: PortraitIcon, line: string]

/** Ten per era, weakest first. */
const ROWS: Readonly<Record<ClassicEraId, readonly Row[]>> = {
  ancient: [
    ['sargon', 'Sargon of Akkad', 'First Emperor of Mesopotamia', 'warlord', 'old-masters', 'crown', 'From the Gulf to the Cedar Forest, every board bows to Akkad.'],
    ['hatshepsut', 'Hatshepsut', 'Pharaoh of the Two Lands', 'fortifier', 'old-masters', 'pyramid', 'I ruled as king. Today I rule this board.'],
    ['hammurabi', 'Hammurabi', 'Lawgiver of Babylon', 'calculator', 'old-masters', 'scale', 'An eye for an eye, a pawn for a pawn.'],
    ['tutankhamun', 'Tutankhamun', 'The Boy King', 'maverick', 'old-masters', 'sun', 'Young, yes. Careless? Never.'],
    ['nebuchadnezzar', 'Nebuchadnezzar II', 'Builder of Babylon', 'fortifier', 'fortress', 'mountain', 'My walls stood for ages. Try to breach these.'],
    ['ramesses-ii', 'Ramesses II', 'Ramesses the Great', 'warlord', 'classical', 'pyramid', 'At Kadesh I held the line. Your pieces will not move me.'],
    ['cyrus', 'Cyrus the Great', 'King of Kings of Persia', 'calculator', 'classical', 'crown', 'I conquer with patience.'],
    ['darius', 'Darius the Great', 'Shahanshah of Persia', 'sniper', 'classical', 'target', 'Roads, satraps, order — and every file under my command.'],
    ['sun-tzu', 'Sun Tzu', 'Author of The Art of War', 'fortifier', 'hypermodern', 'scroll', 'Every battle is won before it is fought.'],
    ['cleopatra', 'Cleopatra VII', 'Last Pharaoh of Egypt', 'trickster', 'sicilian', 'eye', 'Rome fell for my charm. You will fall for my traps.'],
  ],
  classical: [
    ['pericles', 'Pericles', 'First Citizen of Athens', 'fortifier', 'classical', 'church', 'Athens builds. It does not panic.'],
    ['socrates', 'Socrates', 'Philosopher of Athens', 'maverick', 'irregular', 'book', 'I know that I know nothing — except this opening.'],
    ['leonidas', 'Leonidas', 'King of Sparta', 'fortifier', 'fortress', 'shield', 'Come and take them.'],
    ['aristotle', 'Aristotle', 'Teacher of Alexander', 'calculator', 'classical', 'book', 'Excellence is a habit — and so is good development.'],
    ['archimedes', 'Archimedes', 'Geometer of Syracuse', 'calculator', 'engine', 'atom', 'Give me a lever and an open file, and I will move the world.'],
    ['spartacus', 'Spartacus', 'Gladiator in Revolt', 'berserker', 'gambit', 'swords', 'Chains are for those who stop fighting.'],
    ['hannibal', 'Hannibal Barca', 'General of Carthage', 'trickster', 'romantic', 'mountain', 'I will find a way — or make one.'],
    ['julius-caesar', 'Julius Caesar', 'Dictator of Rome', 'warlord', 'classical', 'crown', 'I came, I saw — now watch me conquer.'],
    ['augustus', 'Augustus', 'First Emperor of Rome', 'calculator', 'classical', 'scale', 'Make haste slowly.'],
    ['alexander', 'Alexander the Great', 'King of Macedon', 'warlord', 'romantic', 'crown', 'No more worlds to conquer — only this board.'],
  ],
  medieval: [
    ['boudica', 'Boudica', 'Queen of the Iceni', 'berserker', 'gambit', 'flame', 'Rome burned for less than this.'],
    ['attila', 'Attila the Hun', 'Scourge of God', 'berserker', 'gambit', 'axe', 'Where my horse treads, nothing grows back.'],
    ['charlemagne', 'Charlemagne', 'Father of Europe', 'warlord', 'classical', 'church', 'One empire, one plan, one board.'],
    ['ragnar', 'Ragnar Lothbrok', 'Viking Raider', 'berserker', 'gambit', 'axe', 'Odin is watching. Make it worth his while.'],
    ['william-conqueror', 'William the Conqueror', 'Duke of Normandy, King of England', 'warlord', 'classical', 'flag', 'I crossed the sea for a crown. A board is nothing.'],
    ['eleanor-aquitaine', 'Eleanor of Aquitaine', 'Queen of France and of England', 'trickster', 'sicilian', 'crown', 'I married two kings. I can outplay one more.'],
    ['el-cid', 'El Cid', 'Champion of Castile', 'warlord', 'classical', 'sword', 'Even in death I won a battle.'],
    ['saladin', 'Saladin', 'Sultan of Egypt and Syria', 'sniper', 'hypermodern', 'moon', 'Mercy is strength. So is a well-placed bishop.'],
    ['lionheart', 'Richard the Lionheart', 'Crusader King', 'berserker', 'romantic', 'crown', 'Lions do not count the odds.'],
    ['joan-of-arc', 'Joan of Arc', 'The Maid of Orléans', 'gambiteer', 'romantic', 'shield', 'I am not afraid. I was born to do this.'],
  ],
  east: [
    ['ashoka', 'Ashoka the Great', 'Emperor of the Maurya', 'fortifier', 'fortress', 'flower', 'I renounced conquest. Defence I never renounced.'],
    ['qin-shi-huang', 'Qin Shi Huang', 'First Emperor of China', 'calculator', 'engine', 'crown', 'One script, one measure, one victor.'],
    ['wu-zetian', 'Wu Zetian', 'Empress of the Zhou', 'trickster', 'sicilian', 'eye', 'Patience made me the only empress of China.'],
    ['kublai-khan', 'Kublai Khan', 'Emperor of the Yuan', 'warlord', 'classical', 'crown', 'My grandfather took the world. I learned to keep it.'],
    ['genghis-khan', 'Genghis Khan', 'Great Khan of the Mongols', 'berserker', 'gambit', 'wind', 'The greatest joy is to scatter your enemies.'],
    ['zheng-he', 'Zheng He', 'Admiral of the Treasure Fleet', 'warlord', 'classical', 'waves', 'Three hundred ships, and every one in formation.'],
    ['oda-nobunaga', 'Oda Nobunaga', 'The Great Unifier', 'gambiteer', 'gambit', 'flame', 'If the bird will not sing, make it sing.'],
    ['hattori-hanzo', 'Hattori Hanzō', 'The Demon Hanzō', 'trickster', 'sicilian', 'eclipse', 'You will not see the move until it lands.'],
    ['tokugawa-ieyasu', 'Tokugawa Ieyasu', 'First Shogun of Edo', 'fortifier', 'fortress', 'shield', 'If the bird will not sing, wait for it.'],
    ['musashi', 'Miyamoto Musashi', 'The Sword Saint', 'sniper', 'hypermodern', 'swords', 'Perceive that which cannot be seen.'],
  ],
  renaissance: [
    ['copernicus', 'Nicolaus Copernicus', 'Astronomer of Toruń', 'calculator', 'classical', 'orbit', 'Everything revolves around the centre. Remember that.'],
    ['isabella', 'Isabella I of Castile', 'Queen of Castile', 'warlord', 'classical', 'crown', 'Unite the kingdoms, then the files.'],
    ['lorenzo-medici', 'Lorenzo de’ Medici', 'Lorenzo the Magnificent', 'trickster', 'irregular', 'gem', 'Florence was won with florins and favours.'],
    ['michelangelo', 'Michelangelo', 'Sculptor of David', 'maverick', 'irregular', 'hammer', 'I saw the mate in the marble and carved until it was free.'],
    ['suleiman', 'Suleiman the Magnificent', 'Sultan of the Ottomans', 'warlord', 'classical', 'moon', 'Lawgiver at home, conqueror abroad.'],
    ['machiavelli', 'Niccolò Machiavelli', 'Author of The Prince', 'trickster', 'gambit', 'drama', 'It is safer to be feared than loved.'],
    ['mehmed', 'Mehmed the Conqueror', 'Taker of Constantinople', 'berserker', 'gambit', 'flag', 'I dragged my fleet over the hills. Your king is next.'],
    ['elizabeth-i', 'Queen Elizabeth I', 'The Virgin Queen', 'fortifier', 'fortress', 'crown', 'I have the heart and stomach of a king.'],
    ['galileo', 'Galileo Galilei', 'Father of Observational Astronomy', 'sniper', 'hypermodern', 'telescope', 'And yet it moves.'],
    ['leonardo', 'Leonardo da Vinci', 'Renaissance Polymath', 'maverick', 'irregular', 'palette', 'Simplicity is the ultimate sophistication.'],
  ],
  sail: [
    ['marco-polo', 'Marco Polo', 'Merchant of the Silk Road', 'sniper', 'hypermodern', 'map', 'I did not tell half of what I saw — or half of my plan.'],
    ['ibn-battuta', 'Ibn Battuta', 'Traveller of the Known World', 'maverick', 'irregular', 'globe', 'Travelling leaves you speechless, then turns you into a storyteller.'],
    ['columbus', 'Christopher Columbus', 'Admiral of the Ocean Sea', 'gambiteer', 'gambit', 'sailboat', 'You cannot cross the sea by staring at the water.'],
    ['vasco-da-gama', 'Vasco da Gama', 'Navigator to India', 'calculator', 'classical', 'compass', 'Around the Cape — the long way, and the sure one.'],
    ['magellan', 'Ferdinand Magellan', 'Circumnavigator', 'calculator', 'engine', 'telescope', 'I have seen the shadow of the Earth on the Moon.'],
    ['grace-omalley', 'Grace O’Malley', 'Pirate Queen of Connacht', 'warlord', 'classical', 'ship', 'I met a queen as an equal. Do not expect a curtsy.'],
    ['anne-bonny', 'Anne Bonny', 'Terror of the Caribbean', 'berserker', 'gambit', 'anchor', 'Fight like it matters — because it does.'],
    ['drake', 'Sir Francis Drake', 'Circumnavigator and Privateer', 'gambiteer', 'romantic', 'ship', 'There is time enough to finish the game, and beat you too.'],
    ['henry-morgan', 'Captain Henry Morgan', 'Admiral of the Brethren', 'calculator', 'engine', 'compass', 'Plunder is planning.'],
    ['blackbeard', 'Blackbeard', 'Scourge of the Seven Seas', 'gambiteer', 'gambit', 'skull', 'Light the fuses. Let them see the smoke.'],
  ],
  enlightenment: [
    ['voltaire', 'Voltaire', 'Philosopher of the Enlightenment', 'trickster', 'irregular', 'feather', 'Judge a player by his questions rather than his answers.'],
    ['mozart', 'Wolfgang Amadeus Mozart', 'Prodigy of Salzburg', 'maverick', 'romantic', 'music', 'Every move in its place, like notes in a sonata.'],
    ['franklin', 'Benjamin Franklin', 'Inventor and Statesman', 'calculator', 'classical', 'zap', 'Chess teaches foresight, circumspection and caution.'],
    ['jefferson', 'Thomas Jefferson', 'Author of the Declaration', 'fortifier', 'classical', 'scroll', 'All pieces are created equal. Let us see which of them you can keep.'],
    ['peter-the-great', 'Peter the Great', 'Tsar of All Russia', 'warlord', 'classical', 'anchor', 'I built a city on a swamp. I can build an attack from nothing.'],
    ['frederick-the-great', 'Frederick the Great', 'King of Prussia', 'sniper', 'hypermodern', 'flag', 'He who defends everything defends nothing.'],
    ['catherine-the-great', 'Catherine the Great', 'Empress of Russia', 'warlord', 'classical', 'crown', 'I shall be an autocrat: that is my trade.'],
    ['washington', 'George Washington', 'First President of the United States', 'fortifier', 'fortress', 'flag', 'Perseverance and spirit have done wonders in all ages.'],
    ['newton', 'Sir Isaac Newton', 'Father of Classical Mechanics', 'calculator', 'engine', 'apple', 'Every action has an equal and opposite reaction.'],
    ['napoleon', 'Napoleon Bonaparte', 'Emperor of the French', 'warlord', 'classical', 'crown', 'Never interrupt your enemy when he is making a mistake.'],
  ],
  nineteenth: [
    ['florence-nightingale', 'Florence Nightingale', 'The Lady with the Lamp', 'fortifier', 'fortress', 'sunrise', 'I never gave or took an excuse.'],
    ['harriet-tubman', 'Harriet Tubman', 'Conductor of the Underground Railroad', 'sniper', 'hypermodern', 'compass', 'I never ran my train off the track.'],
    ['darwin', 'Charles Darwin', 'Naturalist of the Beagle', 'calculator', 'classical', 'leaf', 'I spent twenty years on one book. I can spare a few minutes for one position.'],
    ['wellington', 'The Duke of Wellington', 'Victor of Waterloo', 'fortifier', 'fortress', 'shield', 'Hard pounding. Let us see who pounds longest.'],
    ['bolivar', 'Simón Bolívar', 'The Liberator', 'gambiteer', 'romantic', 'sword', 'Freedom is won by daring.'],
    ['queen-victoria', 'Queen Victoria', 'Empress of India', 'fortifier', 'fortress', 'crown', 'We are not interested in the possibilities of defeat.'],
    ['abraham-lincoln', 'Abraham Lincoln', 'Sixteenth President of the United States', 'calculator', 'classical', 'scale', 'Give me six hours and I will spend four sharpening my plan.'],
    ['bismarck', 'Otto von Bismarck', 'The Iron Chancellor', 'sniper', 'hypermodern', 'hammer', 'Politics is the art of the possible. So is the endgame.'],
    ['ada-lovelace', 'Ada Lovelace', 'First Computer Programmer', 'calculator', 'engine', 'binary', 'The engine weaves algebraic patterns — and so do I.'],
    ['shackleton', 'Ernest Shackleton', 'Endurance of the Antarctic', 'fortifier', 'fortress', 'snowflake', 'By endurance we conquer.'],
  ],
  science: [
    ['pasteur', 'Louis Pasteur', 'Father of Microbiology', 'calculator', 'classical', 'dna', 'Chance favours the prepared mind.'],
    ['edison', 'Thomas Edison', 'The Wizard of Menlo Park', 'gambiteer', 'gambit', 'zap', 'I have not failed. I have found ten thousand lines that lose.'],
    ['bell', 'Alexander Graham Bell', 'Inventor of the Telephone', 'maverick', 'irregular', 'wifi', 'When one door closes, another opens — usually a file.'],
    ['marie-curie', 'Marie Curie', 'Pioneer of Radioactivity', 'fortifier', 'fortress', 'radiation', 'Nothing in life is to be feared, only understood.'],
    ['planck', 'Max Planck', 'Father of Quantum Theory', 'calculator', 'engine', 'atom', 'The quantum of action decides — and so does one tempo.'],
    ['tesla', 'Nikola Tesla', 'Master of Lightning', 'sniper', 'hypermodern', 'zap', 'The present is yours; the future is mine.'],
    ['rosalind-franklin', 'Rosalind Franklin', 'Unveiler of the Double Helix', 'sniper', 'hypermodern', 'dna', 'Look closely. The structure is all there.'],
    ['bohr', 'Niels Bohr', 'Architect of the Atom', 'trickster', 'irregular', 'atom', 'Prediction is very difficult, especially about the future.'],
    ['turing', 'Alan Turing', 'Father of Computer Science', 'calculator', 'engine', 'cpu', 'We can only see a short distance ahead — but enough to win.'],
    ['einstein', 'Albert Einstein', 'Theorist of Relativity', 'maverick', 'hypermodern', 'atom', 'Imagination is more important than knowledge.'],
  ],
  masters: [
    ['philidor', 'François-André Philidor', 'The Pawn Philosopher', 'fortifier', 'old-masters', 'music', 'Pawns are the soul of chess.'],
    ['staunton', 'Howard Staunton', 'Champion of England', 'calculator', 'classical', 'book', 'Mind the pieces — they bear my name.'],
    ['anderssen', 'Adolf Anderssen', 'Author of the Immortal Game', 'gambiteer', 'romantic', 'flame', 'Sacrifice the rooks, then the queen — and mate with the minors.'],
    ['morphy', 'Paul Morphy', 'The Pride and Sorrow of Chess', 'gambiteer', 'romantic', 'star', 'Help your pieces, so they can help you.'],
    ['steinitz', 'Wilhelm Steinitz', 'First World Champion', 'fortifier', 'classical', 'shield', 'The king is a strong piece. Use it.'],
    ['lasker', 'Emanuel Lasker', 'World Champion for 27 Years', 'trickster', 'classical', 'scale', 'When you see a good move, look for a better one.'],
    ['capablanca', 'José Raúl Capablanca', 'The Chess Machine', 'calculator', 'classical', 'gem', 'You learn more from a game you lose than from a game you win.'],
    ['alekhine', 'Alexander Alekhine', 'Fourth World Champion', 'warlord', 'romantic', 'crown', 'Chess is not merely a game. It is a struggle.'],
    ['tal', 'Mikhail Tal', 'The Magician from Riga', 'berserker', 'sicilian', 'sparkles', 'Take your opponent into a deep, dark forest.'],
    ['fischer', 'Bobby Fischer', 'Eleventh World Champion', 'sniper', 'sicilian', 'target', 'I do not believe in psychology. I believe in good moves.'],
  ],
}

/** Ladder Elo: eras climb 200 points each (600 → 2380), the Masters of the Board 2400 → 2760. */
const eloFor = (era: number, k: number): number => (era < 9 ? 600 + era * 200 + k * 20 : 2400 + k * 40)

export const CLASSIC_ROSTER: readonly ClassicCharacter[] = CLASSIC_ERAS.flatMap((era, e) =>
  ROWS[era.id].map(([id, name, title, archetype, book, icon, line], k) => ({ id, name, title, era: era.id, archetype, book, icon, line, elo: eloFor(e, k), rank: e * 10 + k })),
)

const BY_ID = new Map(CLASSIC_ROSTER.map((c) => [c.id, c]))
export const getClassic = (id: string): ClassicCharacter | null => BY_ID.get(id) ?? null
export const isClassicId = (v: unknown): v is string => typeof v === 'string' && BY_ID.has(v)
export const getClassicEra = (id: ClassicEraId): ClassicEra => CLASSIC_ERAS.find((e) => e.id === id) ?? (CLASSIC_ERAS[0] as ClassicEra)

/** A Classic character's emblem: their icon on their era's colours, with a monogram. */
export function classicPortrait(c: ClassicCharacter): PortraitSpec {
  const era = getClassicEra(c.era)
  return { icon: c.icon, from: era.from, to: era.to, monogram: (c.name.replace(/^(The|Sir|Queen|Captain) /, '')[0] ?? '?').toUpperCase() }
}
