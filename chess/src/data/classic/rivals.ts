// Historical rivals: when your Classic avatar faces their rival (Napoleon
// against Wellington, Capablanca against Alekhine…), the opponent greets and
// sends you off with lines written for that meeting. `history` is true and
// checkable; the lines are in-game dialogue, not quotations.

export interface RivalLines {
  intro: string
  /** When the speaker wins. */
  victory: string
  /** When the speaker loses. */
  defeat: string
}

export interface Rivalry {
  a: string
  b: string
  history: string
  /** Keyed by the speaker's Classic id. */
  lines: Readonly<Record<string, RivalLines>>
}

export const RIVALRIES: readonly Rivalry[] = [
  {
    a: 'napoleon',
    b: 'wellington',
    history: 'Wellington’s Allied army, with Blücher’s Prussians, defeated Napoleon at Waterloo on 18 June 1815. It was the only time the two commanded against each other.',
    lines: {
      napoleon: { intro: 'Wellington. I have waited a long time for this rematch.', victory: 'There. Waterloo is avenged.', defeat: 'Again you. Again a ridge I could not take.' },
      wellington: { intro: 'Bonaparte. You never did learn to leave a good position alone.', victory: 'Same result as last time, I think.', defeat: 'Well. That one really was a near-run thing.' },
    },
  },
  {
    a: 'saladin',
    b: 'lionheart',
    history: 'Saladin and Richard I led the opposing sides of the Third Crusade (1189–1192) and ended it with the Treaty of Jaffa. They never met face to face.',
    lines: {
      saladin: { intro: 'Malik Ric. We traded letters and gifts, never a game. Sit.', victory: 'Jerusalem stays where it is. Go in peace.', defeat: 'A worthy enemy is a gift. Today you are mine.' },
      lionheart: { intro: 'Saladin, at last across a table instead of a battlefield.', victory: 'Ha! If only Jaffa had gone this smoothly.', defeat: 'You were always the better strategist. I can admit it here.' },
    },
  },
  {
    a: 'cleopatra',
    b: 'augustus',
    history: 'Octavian, later Augustus, defeated the fleet of Antony and Cleopatra at Actium in 31 BCE and annexed Egypt the next year.',
    lines: {
      cleopatra: { intro: 'Octavian. This time there is no fleet to hide behind.', victory: 'Egypt is mine again, if only on this board.', defeat: 'Actium all over again. You were always patient.' },
      augustus: { intro: 'The Queen of Egypt. Shall we settle Actium a second time?', victory: 'Rome wins, as Rome does.', defeat: 'Hm. Write this one down nowhere.' },
    },
  },
  {
    a: 'kublai-khan',
    b: 'marco-polo',
    history: 'According to his own account, Marco Polo spent about seventeen years in China, much of it in the service of Kublai Khan, before returning to Venice in 1295.',
    lines: {
      'kublai-khan': { intro: 'My Venetian storyteller! Let us see if you play as well as you talk.', victory: 'Put this game in your book too.', defeat: 'You learned more at my court than I knew.' },
      'marco-polo': { intro: 'Great Khan. No one in Venice will believe I played you.', victory: 'Seventeen years at your court, and finally I win something!', defeat: 'As always, the Khan has the last word.' },
    },
  },
  {
    a: 'capablanca',
    b: 'alekhine',
    history: 'Alekhine took the world championship from Capablanca in Buenos Aires in 1927. Despite years of negotiation, they never played a rematch.',
    lines: {
      capablanca: { intro: 'Alekhine. So we have our rematch after all.', victory: 'Simple, as chess should be.', defeat: 'Buenos Aires again. You always worked harder.' },
      alekhine: { intro: 'Capablanca. I prepared for this one too.', victory: 'Preparation beats talent, once more.', defeat: 'You make it look effortless. It never is.' },
    },
  },
  {
    a: 'lasker',
    b: 'capablanca',
    history: 'Capablanca won the world championship from Emanuel Lasker in Havana in 1921, ending Lasker’s 27-year reign.',
    lines: {
      lasker: { intro: 'Capablanca. Havana was hot. Here it is cooler.', victory: 'Twenty-seven years did not make me easy to beat.', defeat: 'You were the future in 1921. You still are.' },
      capablanca: { intro: 'Doctor Lasker. It is an honour, again.', victory: 'Havana remembers.', defeat: 'The old champion still knows every trick.' },
    },
  },
  {
    a: 'steinitz',
    b: 'lasker',
    history: 'Emanuel Lasker took the world championship from Wilhelm Steinitz in 1894 and beat him again in a return match in 1896–97.',
    lines: {
      steinitz: { intro: 'Young Lasker. My principles against your fighting spirit, once more.', victory: 'The principles hold.', defeat: 'Twice was not enough for you?' },
      lasker: { intro: 'Herr Steinitz. Everything I know started with your ideas.', victory: 'The student wins again.', defeat: 'Your theory was right all along.' },
    },
  },
  {
    a: 'morphy',
    b: 'anderssen',
    history: 'Paul Morphy beat Adolf Anderssen, then considered Europe’s strongest player, in a match in Paris in December 1858.',
    lines: {
      morphy: { intro: 'Herr Anderssen. Paris, once again?', victory: 'Development first, then the attack.', defeat: 'Your combinations were always beautiful.' },
      anderssen: { intro: 'The young American. I have studied your games since Paris.', victory: 'At last! The old master strikes back.', defeat: 'Paris all over again. You are simply better.' },
    },
  },
  {
    a: 'staunton',
    b: 'morphy',
    history: 'In 1858 Morphy travelled to England hoping to play Howard Staunton, then England’s leading player. The match never took place.',
    lines: {
      staunton: { intro: 'Mr Morphy. Very well, here is the match you wanted.', victory: 'And that is why England waited.', defeat: 'Perhaps it is as well we never played in 1858.' },
      morphy: { intro: 'Mr Staunton. You were busy in 1858. Are you free now?', victory: 'Worth the wait.', defeat: 'Well played. You should have accepted sooner.' },
    },
  },
  {
    a: 'tesla',
    b: 'edison',
    history: 'Tesla worked for Edison’s company in 1884 and left after about six months. Later, Tesla’s alternating-current patents, licensed to Westinghouse, competed with Edison’s direct current in the “war of the currents”.',
    lines: {
      tesla: { intro: 'Mr Edison. Shall we see whose current runs this board?', victory: 'Alternating, as it should be.', defeat: 'You always were good at winning in public.' },
      edison: { intro: 'Tesla. Still dreaming, I see. Let us test it.', victory: 'Hard work beats theory, as I always said.', defeat: 'All right. That one was genius.' },
    },
  },
  {
    a: 'tal',
    b: 'fischer',
    history: 'At the 1959 Candidates Tournament in Yugoslavia, Mikhail Tal beat the sixteen-year-old Bobby Fischer in all four of their games.',
    lines: {
      tal: { intro: 'Bobby! Still angry about 1959?', victory: 'Four–nil, and now five.', defeat: 'Ah, you grew up. Bravo.' },
      fischer: { intro: 'Tal. I have studied every one of those four games.', victory: 'Finally. That is how it should go.', defeat: 'You and your sacrifices. Unsound, and still winning.' },
    },
  },
]

/** The rivalry between two Classic characters, if history gave them one. */
export function rivalryOf(x: string, y: string): Rivalry | null {
  return RIVALRIES.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x)) ?? null
}

/** What `speaker` says when facing `facing`, if they are rivals. */
export function rivalLines(speaker: string, facing: string | null): RivalLines | null {
  if (!facing) return null
  return rivalryOf(speaker, facing)?.lines[speaker] ?? null
}

export const rivalsOf = (id: string): string[] => RIVALRIES.flatMap((r) => (r.a === id ? [r.b] : r.b === id ? [r.a] : []))
