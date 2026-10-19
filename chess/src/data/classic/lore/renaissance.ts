import type { EraLore } from './types'

/** Renaissance. */
export const RENAISSANCE_LORE: EraLore = {
  copernicus: {
    lived: '1473 – 1543',
    bio: 'Polish astronomer and church administrator who proposed a model of the universe with the Sun, not Earth, near its centre. His work began what is often called the Copernican Revolution in science.',
    facts: [
      'His major work, On the Revolutions of the Heavenly Spheres (De revolutionibus), was published in 1543, the year he died.',
      'He was born in Toruń and studied at universities in Kraków and in Italy, including Bologna and Padua.',
      'Besides astronomy, he worked as a physician and administrator, and wrote on money and currency reform.',
    ],
    victory: 'You assumed your king was the centre of everything. Time to revise your model.',
    defeat: 'A model is only as good as its observations. Yours were better today.',
  },
  isabella: {
    lived: '1451 – 1504',
    bio: 'Queen of Castile whose marriage to Ferdinand II of Aragon joined the crowns that became the basis of Spain. Her reign saw the conquest of Granada, the sponsorship of Columbus, the founding of the Spanish Inquisition and the expulsion of Jews who would not convert.',
    facts: [
      'She married Ferdinand of Aragon in 1469, and Pope Alexander VI later gave the couple the title "the Catholic Monarchs".',
      'In 1492 Granada, the last Muslim-ruled state on the Iberian Peninsula, surrendered to Castile and Aragon.',
      'Also in 1492, she and Ferdinand issued the Alhambra Decree, ordering Jews who would not convert to leave their kingdoms.',
    ],
    victory: 'Alliance, patience, then the final siege. That is how kingdoms fall.',
    defeat: 'You held your ground well. Castile will remember a worthy rival.',
  },
  'lorenzo-medici': {
    lived: '1449 – 1492',
    bio: 'Florentine banker and statesman who was the unofficial ruler of the Florentine Republic. A generous patron of artists, poets and scholars, he helped make Florence a leading centre of the Italian Renaissance.',
    facts: [
      'He survived the Pazzi conspiracy of 1478, an attack in Florence Cathedral in which his brother Giuliano was killed.',
      'He supported artists such as Botticelli, and the teenage Michelangelo lived and studied in the Medici household.',
      'He was also a poet who wrote in the Tuscan form of Italian rather than in Latin.',
    ],
    victory: 'A favour here, a florin there, and suddenly the whole board owes me.',
    defeat: 'Splendid! Florence always has room for talent. Do visit the palace.',
  },
  michelangelo: {
    lived: '1475 – 1564',
    bio: "Florentine sculptor, painter, architect and poet, one of the greatest artists of the High Renaissance. His works include the statue of David, the Sistine Chapel ceiling and the design of the dome of St. Peter's Basilica.",
    facts: [
      'He carved David (1501–1504) from a huge block of marble that earlier sculptors had started on and abandoned.',
      'He painted the ceiling of the Sistine Chapel for Pope Julius II between 1508 and 1512.',
      "His Pietà in St. Peter's Basilica, made in his early twenties, is the only work he is known to have signed.",
    ],
    victory: 'The checkmate was in the position all along. I only removed what was not needed.',
    defeat: 'Unfinished work. I will come back to it, as I always do.',
  },
  suleiman: {
    lived: '1494 – 1566',
    bio: 'The longest-reigning sultan of the Ottoman Empire, ruling from 1520 to 1566. His armies expanded the empire into Hungary, the Middle East and North Africa, and his legal reforms earned him the name Kanuni, "the Lawgiver".',
    facts: [
      'His army won the Battle of Mohács in 1526, which led to the collapse of the medieval Kingdom of Hungary.',
      'He besieged Vienna in 1529 but failed to capture the city.',
      'He wrote poetry under the pen name Muhibbi, and his architect Mimar Sinan built the Süleymaniye Mosque in Istanbul for him.',
    ],
    victory: 'Law and strategy are both about order. Yours fell apart.',
    defeat: 'Vienna held against me too. I know how to respect a strong defence.',
  },
  machiavelli: {
    lived: '1469 – 1527',
    bio: 'Florentine diplomat, political thinker and writer. His book The Prince gave blunt advice to rulers on gaining and keeping power, and it is often seen as a founding work of modern political thought.',
    facts: [
      'He served the Florentine Republic as a secretary and diplomat from 1498 until the Medici returned to power in 1512.',
      'In 1513 he was imprisoned and tortured on suspicion of plotting against the Medici, then released and retired to his farm to write.',
      'The Prince was written around 1513 but was not published until 1532, five years after his death.',
    ],
    victory: 'A wise player prepares for fortune to turn against him. You did not.',
    defeat: 'Fortune favoured you today. I will study how you seized her.',
  },
  mehmed: {
    lived: '1432 – 1481',
    bio: 'Ottoman sultan, also called Mehmed II, who captured Constantinople in 1453 at the age of 21, ending the Byzantine Empire. He made the city his capital and expanded Ottoman rule across the Balkans and Anatolia.',
    facts: [
      'During the siege, his ships were dragged overland into the Golden Horn to get past a great chain that blocked the harbour.',
      "His army used huge cannons, including guns built by a cannon-maker named Orban, to batter the city's ancient walls.",
      "He invited the Venetian painter Gentile Bellini to his court, and Bellini's portrait of him is now in London's National Gallery.",
    ],
    victory: 'They said the walls could never be broken. They said the same about your king.',
    defeat: 'Even great walls hold sometimes. I will return with a better plan.',
  },
  'elizabeth-i': {
    lived: '1533 – 1603',
    bio: 'Queen of England and Ireland from 1558 to 1603 and the last Tudor monarch. Her reign saw the defeat of the Spanish Armada, a lasting Protestant church settlement, and a golden age of English drama that included Shakespeare.',
    facts: [
      'She was the daughter of Henry VIII and Anne Boleyn, who was executed when Elizabeth was two years old.',
      'She never married, and her image as the "Virgin Queen" became part of her political identity.',
      'She was highly educated and could read or speak several languages, including Latin, French and Italian.',
    ],
    victory: 'I may wear a crown, but I command this board like a general.',
    defeat: 'Well fought. England rewards boldness, and today so do I.',
  },
  galileo: {
    lived: '1564 – 1642',
    bio: 'Italian astronomer, physicist and engineer whose telescope observations supported the idea that Earth orbits the Sun. His trial by the Roman Inquisition made him a lasting symbol of the clash between scientific evidence and authority.',
    facts: [
      'In 1610 he discovered the four largest moons of Jupiter, now known as the Galilean moons.',
      'In 1633 the Inquisition found him "vehemently suspect of heresy", and he spent the rest of his life under house arrest.',
      'The words "And yet it moves" are traditionally said to be his, but there is no reliable evidence that he ever said them.',
    ],
    victory: 'Observe carefully and the board reveals everything. I saw your mistake long ago.',
    defeat: 'Your evidence was stronger. I accept the result, whatever the authorities say.',
  },
  leonardo: {
    lived: '1452 – 1519',
    bio: 'Italian painter, engineer, scientist and inventor, often seen as the model "Renaissance man". He painted the Mona Lisa and The Last Supper, and filled thousands of notebook pages with studies of anatomy, flight, water and machines.',
    facts: [
      'He often wrote his notebooks in mirror writing, running from right to left.',
      'He dissected human bodies and made detailed anatomical drawings of bones, muscles and the heart.',
      'He spent his last years in France at the invitation of King Francis I and died near Amboise in 1519.',
    ],
    victory: 'I sketched this ending in my notebook before we began. Backwards, of course.',
    defeat: 'Fascinating! Hold still while I draw that position before I forget it.',
  },
}
