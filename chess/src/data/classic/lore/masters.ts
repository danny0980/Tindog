import type { EraLore } from './types'

/** Masters of the Board. */
export const MASTERS_LORE: EraLore = {
  philidor: {
    lived: '1726 – 1795',
    bio: 'François-André Danican Philidor was a French composer and the strongest chess player of his age. His 1749 book showed that pawn structure shapes the whole game, an idea that still guides players today.',
    facts: [
      'His book Analyse du jeu des échecs (1749) contains the famous idea that pawns are the soul of chess.',
      'He was also a successful opera composer, and his works were performed in Paris for decades.',
      'The Philidor Defence (1.e4 e5 2.Nf3 d6) and a key rook endgame, the Philidor position, bear his name.',
    ],
    victory: 'A well-placed pawn sings louder than any piece. Bravo to my little soldiers.',
    defeat: 'A fine composition, my friend. Your moves were in perfect harmony.',
  },
  staunton: {
    lived: '1810 – 1874',
    bio: 'Howard Staunton was an English chess master widely seen as the world\'s leading player in the 1840s. He organised the first international chess tournament, in London in 1851, and wrote influential chess books.',
    facts: [
      'In 1843 he defeated the French champion Pierre Charles Fournié de Saint-Amant in a match in Paris.',
      'The standard design of chess pieces, introduced in 1849, is called the Staunton pattern after him.',
      'He was also a Shakespeare scholar who published an edition of Shakespeare\'s plays.',
    ],
    victory: 'Solid, correct and thoroughly English. That is how chess is played.',
    defeat: 'A worthy victory. I shall write about this game — favourably, I promise.',
  },
  anderssen: {
    lived: '1818 – 1879',
    bio: 'Adolf Anderssen was a German mathematics teacher and the greatest attacking player of the Romantic era. He won the first international tournament in London in 1851 and played two of the most famous games ever.',
    facts: [
      'His "Immortal Game" against Lionel Kieseritzky (London, 1851) sacrificed both rooks and the queen.',
      'His "Evergreen Game" against Jean Dufresne was played in Berlin in 1852.',
      'He lost a match to Paul Morphy in 1858 and to Wilhelm Steinitz in 1866.',
    ],
    victory: 'Why keep your pieces when you can give them away for mate?',
    defeat: 'You refused my sacrifices with courage. A beautiful game all the same.',
  },
  morphy: {
    lived: '1837 – 1884',
    bio: 'Paul Morphy of New Orleans was the finest player of his time. In a brief career he beat the best players in America and Europe, showing how quick development and open lines win games.',
    facts: [
      'He won the First American Chess Congress in New York in 1857.',
      'On his European tour in 1858 he decisively beat Adolf Anderssen in a match in Paris.',
      'His "Opera Game" was played at the Paris Opera in 1858 against the Duke of Brunswick and Count Isouard.',
    ],
    victory: 'Develop quickly, open the lines, and the attack plays itself.',
    defeat: 'Splendid. You developed your pieces better than I did today.',
  },
  steinitz: {
    lived: '1836 – 1900',
    bio: 'Wilhelm Steinitz, born in Prague, became the first official world chess champion in 1886. He turned chess from a game of wild attacks into a science of positional principles.',
    facts: [
      'He won the first official World Championship match against Johannes Zukertort in 1886.',
      'He held the title until 1894, when he lost it to Emanuel Lasker; he also lost the 1896–97 rematch.',
      'His theories taught that an attack only succeeds when the position justifies it.',
    ],
    victory: 'Accumulate small advantages and the win arrives by itself.',
    defeat: 'You followed the principles better than I did. Correct play is rewarded.',
  },
  lasker: {
    lived: '1868 – 1941',
    bio: 'Emanuel Lasker was a German chess player, mathematician and philosopher. He was world champion for 27 years, from 1894 to 1921, longer than anyone else in history.',
    facts: [
      'He beat Wilhelm Steinitz in 1894 to become the second official world champion.',
      'He earned a doctorate in mathematics, and the Lasker–Noether theorem in algebra is partly named after him.',
      'He lost the title in 1921 in Havana to José Raúl Capablanca without winning a game (four losses, ten draws).',
    ],
    victory: 'Chess is a fight. You played the board — I played the fight.',
    defeat: 'A well-deserved win. You fought harder than I did today.',
  },
  capablanca: {
    lived: '1888 – 1942',
    bio: 'José Raúl Capablanca was a Cuban prodigy and world champion from 1921 to 1927. His simple, flawless style and brilliant endgame technique made him seem almost unbeatable.',
    facts: [
      'He learned chess as a small child, reportedly at age four, by watching his father play.',
      'He won the world title from Emanuel Lasker in Havana in 1921, and lost it to Alexander Alekhine in 1927.',
      'He lost no games at all between 1916 and 1924, an extraordinary unbeaten run.',
    ],
    victory: 'Simple, clear, and over. Chess need not be complicated.',
    defeat: 'Clean and precise. I could not have played it better myself — almost.',
  },
  alekhine: {
    lived: '1892 – 1946',
    bio: 'Alexander Alekhine, born in Moscow and later a French citizen, was the fourth world champion. Known for deep preparation and ferocious attacks, he held the title twice.',
    facts: [
      'He took the title from José Raúl Capablanca in Buenos Aires in 1927.',
      'He lost the crown to Max Euwe in 1935, then won it back in a rematch in 1937.',
      'He is the only world champion to die while still holding the title, in 1946.',
    ],
    victory: 'I prepared for this battle for weeks. You prepared for minutes.',
    defeat: 'You struggled harder than I did. Today the title of winner is yours.',
  },
  tal: {
    lived: '1936 – 1992',
    bio: 'Mikhail Tal of Riga, Latvia, was the eighth world champion and the most daring attacker of his era. His dazzling sacrifices earned him the nickname "the Magician from Riga".',
    facts: [
      'In 1960, aged 23, he beat Mikhail Botvinnik to become the youngest world champion up to that time.',
      'Botvinnik won the title back from him in a rematch in 1961.',
      'He won the Soviet Championship six times, in one of the strongest national championships ever.',
    ],
    victory: 'You followed me into the forest. Sadly, only one of us knew the way out.',
    defeat: 'What a game! You found the path through the forest. I salute you.',
  },
  fischer: {
    lived: '1943 – 2008',
    bio: 'Bobby Fischer was an American prodigy who became the eleventh world champion. His 1972 victory over Boris Spassky in Reykjavik, at the height of the Cold War, made chess front-page news around the world.',
    facts: [
      'In 1958, aged 15, he became the youngest grandmaster in history up to that time.',
      'He won the 1963–64 US Championship with a perfect score of 11 wins from 11 games.',
      'He beat Boris Spassky 12½–8½ in Reykjavik, Iceland, in 1972 to become world champion.',
    ],
    victory: 'Good moves. That is all there is to it — and I made them.',
    defeat: 'You played the better moves today. That is the only thing that counts.',
  },
}
