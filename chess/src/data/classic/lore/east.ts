import type { EraLore } from './types'

/** Empires of the East. */
export const EAST_LORE: EraLore = {
  ashoka: {
    lived: 'reigned c. 268 – 232 BCE',
    bio: 'Ashoka was the third emperor of the Maurya dynasty, ruling most of the Indian subcontinent. After a bloody war against Kalinga he turned to Buddhism and promoted non-violence and moral rule.',
    facts: [
      'In one of his own edicts he expressed deep remorse for the suffering caused by his conquest of Kalinga.',
      'His edicts, carved on rocks and pillars, were deciphered in 1837 by the scholar James Prinsep.',
      'His Lion Capital at Sarnath is the national emblem of India, and the wheel on the Indian flag comes from his pillars.',
    ],
    victory: 'A strong defence needs no cruelty. It simply holds.',
    defeat: 'You won fairly. There is no shame in learning from a loss.',
  },
  'qin-shi-huang': {
    lived: '259 – 210 BCE',
    bio: 'Ying Zheng, king of Qin, conquered the rival Warring States and in 221 BCE became the first emperor of a unified China. His centralised state set patterns Chinese empires followed for two thousand years.',
    facts: [
      'He standardised writing, weights and measures, coins and even the width of cart axles across his empire.',
      'The Terracotta Army, thousands of life-size clay soldiers guarding his tomb, was discovered near Xi\'an in 1974.',
      'The historian Sima Qian says he sought an elixir of immortality and ordered the burning of many books.',
    ],
    victory: 'One standard, one order, one result. Mine.',
    defeat: 'You found a flaw in my system. I will correct it.',
  },
  'wu-zetian': {
    lived: '624 – 705',
    bio: 'Wu Zetian rose from imperial concubine to empress consort and then ruled China herself. She is the only woman in Chinese history to reign as emperor in her own right, founding her own Zhou dynasty.',
    facts: [
      'She reigned as emperor from 690 to 705, proclaiming the Zhou dynasty in place of the Tang.',
      'She expanded the imperial examinations to bring talented officials into government.',
      'She introduced a set of new Chinese characters, including one used for her own name.',
    ],
    victory: 'Many underestimated me. Every one of them was wrong.',
    defeat: 'Well played. I always rewarded real talent.',
  },
  'kublai-khan': {
    lived: '1215 – 1294',
    bio: 'Kublai Khan, grandson of Genghis Khan, founded the Yuan dynasty and became the first non-Han emperor to rule all of China. His court at Dadu, today\'s Beijing, drew travellers from across Eurasia.',
    facts: [
      'He proclaimed the Yuan dynasty in 1271 and completed the conquest of the Song dynasty in 1279.',
      'His invasions of Japan in 1274 and 1281 both failed, partly because storms wrecked his fleets.',
      'The Venetian Marco Polo described his court, including its use of paper money.',
    ],
    victory: 'Conquest is quick. Governing takes patience, and so did this.',
    defeat: 'Even the Yuan fleet met storms. Your play was one of them.',
  },
  'genghis-khan': {
    lived: 'c. 1162 – 1227',
    bio: 'Born Temüjin, Genghis Khan united the Mongol tribes and founded the Mongol Empire. After his death it grew into the largest contiguous land empire in history.',
    facts: [
      'A great assembly of Mongol leaders proclaimed him Genghis Khan in 1206.',
      'He had the Uyghur script adapted for writing the Mongolian language.',
      'The location of his grave is still unknown.',
    ],
    victory: 'Speed, discipline and loyalty. You lacked one of the three.',
    defeat: 'You rode faster than I did today. Remember this steppe.',
  },
  'zheng-he': {
    lived: 'c. 1371 – c. 1433',
    bio: 'Zheng He was a Muslim-born court eunuch from Yunnan who became admiral of the Ming dynasty\'s treasure fleets. His voyages carried Chinese diplomacy and trade across the Indian Ocean.',
    facts: [
      'He led seven great voyages between 1405 and 1433, reaching Southeast Asia, India, Arabia and East Africa.',
      'A giraffe brought back to the Ming court in 1414 was celebrated as a qilin, a mythical creature of good omen.',
      'His birth name was Ma He; the Yongle Emperor gave him the surname Zheng.',
    ],
    victory: 'A fleet in good order reaches every shore. Mine did.',
    defeat: 'The sea taught me humility. So have you.',
  },
  'oda-nobunaga': {
    lived: '1534 – 1582',
    bio: 'Oda Nobunaga was a warlord of Japan\'s Sengoku period who began the country\'s reunification. He was known for bold tactics and an openness to new ideas, from firearms to foreign visitors.',
    facts: [
      'In 1560 he defeated the much larger army of Imagawa Yoshimoto at the Battle of Okehazama.',
      'At the Battle of Nagashino in 1575 his allied army made famous use of massed arquebus (musket) fire.',
      'He died in 1582 at the Honnō-ji temple in Kyoto after a surprise attack by his own general Akechi Mitsuhide.',
    ],
    victory: 'New weapons, new ideas. Your old plan never stood a chance.',
    defeat: 'Unexpected. I admire anyone who dares to change the game.',
  },
  'hattori-hanzo': {
    lived: '1542 – 1596',
    bio: 'Hattori Masanari, known as Hanzō, was a samurai commander who served Tokugawa Ieyasu. His family came from Iga, and modern popular culture made him a legendary ninja master.',
    facts: [
      'He was nicknamed "Oni no Hanzō", the Demon Hanzō, for his boldness in battle.',
      'In 1582 he helped guide Ieyasu to safety through Iga province after the death of Oda Nobunaga.',
      'The Hanzōmon gate of Edo Castle, now the Imperial Palace in Tokyo, is named after him.',
    ],
    victory: 'You looked for me on the left. I was never there.',
    defeat: 'You saw through me. Few ever do.',
  },
  'tokugawa-ieyasu': {
    lived: '1543 – 1616',
    bio: 'Tokugawa Ieyasu completed the unification of Japan and founded the Tokugawa shogunate. His dynasty ruled from Edo, today\'s Tokyo, for over 250 years of relative peace.',
    facts: [
      'He spent part of his childhood as a hostage of rival clans.',
      'His victory at the Battle of Sekigahara in 1600 led to his appointment as shogun in 1603.',
      'The shogunate he founded lasted until 1868, when imperial rule was restored in the Meiji Restoration.',
    ],
    victory: 'I waited, and the moment came. It always does.',
    defeat: 'Patience lost this time. It will not lose the next.',
  },
  musashi: {
    lived: 'c. 1584 – 1645',
    bio: 'Miyamoto Musashi was a Japanese swordsman, strategist and artist. His Book of Five Rings, written near the end of his life, is still read today as a guide to strategy.',
    facts: [
      'In The Book of Five Rings he wrote that he fought more than sixty duels and never lost.',
      'He founded the Niten Ichi-ryū school, known for fighting with two swords at once.',
      'He was also a skilled ink painter and calligrapher whose works are held in Japanese museums.',
    ],
    victory: 'Study the whole board, not just the piece in front of you.',
    defeat: 'Today you were the teacher. I will practise.',
  },
}
