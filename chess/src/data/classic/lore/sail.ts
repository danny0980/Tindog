import type { EraLore } from './types'

/** Age of Sail. */
export const SAIL_LORE: EraLore = {
  'marco-polo': {
    lived: '1254 – 1324',
    bio: 'Venetian merchant who travelled across Asia and spent years in China during the reign of Kublai Khan. The book of his travels gave many Europeans their first detailed picture of Asia and inspired later explorers.',
    facts: [
      'He set out in 1271 with his father Niccolò and uncle Maffeo, and did not return to Venice until 1295.',
      'He told his story to the writer Rustichello da Pisa while both were prisoners in Genoa, around 1298.',
      'Some historians question parts of his account, which never mentions the Great Wall, but most accept that he did reach China.',
    ],
    victory: 'I crossed deserts and mountains for years. Your defence was a short trip.',
    defeat: 'Remarkable. Nobody in Venice will believe me when I describe this game.',
  },
  'ibn-battuta': {
    lived: '1304 – c. 1369',
    bio: 'Moroccan scholar and judge who travelled for nearly 30 years across North and East Africa, the Middle East, Central and South Asia and China. His travel book, the Rihla, is a key source on the 14th-century Islamic world.',
    facts: [
      'He left Tangier in 1325, aged about 21, to make the pilgrimage to Mecca, and then kept travelling for decades.',
      'He worked as a qadi (judge) in Delhi under Sultan Muhammad bin Tughluq, and later in the Maldives.',
      'Back in Morocco, he dictated his travels to the scholar Ibn Juzayy at the request of the sultan.',
    ],
    victory: 'I have crossed three continents. Your board is just one more road I know well.',
    defeat: 'A fine game! I shall add it to my travels, with full credit to you.',
  },
  columbus: {
    lived: '1451 – 1506',
    bio: "Genoese navigator whose 1492 voyage for Spain's Catholic Monarchs reached the Caribbean and began lasting contact between Europe and the Americas. The colonisation that followed brought violence, forced labour and deadly disease to Indigenous peoples such as the Taíno.",
    facts: [
      'He made four voyages across the Atlantic between 1492 and 1504.',
      'He believed he had reached Asia, and he kept insisting on this for the rest of his life.',
      'In 1500 he was arrested and sent back to Spain in chains after complaints about his harsh rule as governor of Hispaniola.',
    ],
    victory: 'I bet everything on a westward course. This time the bet paid off.',
    defeat: 'My charts were wrong again. The world is bigger than I calculated.',
  },
  'vasco-da-gama': {
    lived: 'c. 1460 – 1524',
    bio: "Portuguese navigator who led the first voyage from Europe to India around Africa, reaching Calicut in 1498. His route opened a sea trade with Asia for Portugal, which was often enforced by violence against Indian Ocean rulers and traders.",
    facts: [
      'On his 1497–1499 voyage he rounded the Cape of Good Hope and reached Calicut, on the southwest coast of India, in May 1498.',
      'At Malindi in East Africa he took on an experienced local pilot who guided his fleet across the Indian Ocean.',
      'He was sent back to India as viceroy in 1524 and died in Cochin later that same year.',
    ],
    victory: 'The long way around was the sure way. Patience brought me to India, and to your king.',
    defeat: 'Not every ship survives the voyage. Today mine did not.',
  },
  magellan: {
    lived: 'c. 1480 – 1521',
    bio: 'Portuguese navigator who led a Spanish expedition that became the first to sail around the world. He did not finish it: he was killed in the Philippines at the Battle of Mactan, fighting warriors led by the local chief Lapulapu.',
    facts: [
      'The expedition left Spain in 1519 with five ships; only the Victoria, captained by Juan Sebastián Elcano, returned in 1522.',
      'He found a passage near the southern tip of South America, now called the Strait of Magellan.',
      'He gave the Pacific Ocean its name, meaning "peaceful", after finding its waters calm.',
    ],
    victory: 'I found a strait no one believed in. Finding your weakness was easier.',
    defeat: 'The voyage goes on without me. Someone else will complete the circle.',
  },
  'grace-omalley': {
    lived: 'c. 1530 – c. 1603',
    bio: "Irish chieftain and sea captain of the O'Malley clan of Connacht who commanded ships along Ireland's west coast. She resisted English control of her lands and became a celebrated figure in Irish history and folklore.",
    facts: [
      'In Irish she is known as Gráinne Mhaol.',
      'In 1593 she met Queen Elizabeth I at Greenwich to ask for the release of her son and her half-brother, who were held by the English.',
      'Many popular stories about her, such as fighting pirates the day after giving birth at sea, are legends rather than recorded history.',
    ],
    victory: 'I command my own fleet and my own board. You were outsailed.',
    defeat: 'Fair winds to you. I bow to no queen, but I will nod to a fine player.',
  },
  'anne-bonny': {
    lived: 'c. 1697 – unknown',
    bio: 'Irish-born pirate who sailed the Caribbean with John "Calico Jack" Rackham. She is one of the few women known to have been pirates during the Golden Age of Piracy, though much of her life story comes from a single 1724 book.',
    facts: [
      "She and Mary Read were part of Rackham's crew when their ship was captured off Jamaica in 1720.",
      'Both women were sentenced to death, but their executions were postponed because they were pregnant.',
      'What happened to her after the trial is unknown; there is no record of her execution or her release.',
    ],
    victory: 'Ha! You played like a landlubber. The prize is mine.',
    defeat: 'Fair enough, you earned it. Next time I bring a sharper crew.',
  },
  drake: {
    lived: 'c. 1540 – 1596',
    bio: 'English sea captain and privateer who completed the second voyage around the world, from 1577 to 1580. A hero in England and a pirate in the eyes of Spain, he also took part in early English slave-trading voyages.',
    facts: [
      'Queen Elizabeth I knighted him aboard his ship, the Golden Hind, in 1581.',
      'He was second-in-command of the English fleet that fought the Spanish Armada in 1588.',
      'The story that he finished a game of bowls before sailing out to face the Armada is a legend with no contemporary evidence.',
    ],
    victory: 'There was time enough to finish the game, and win it too.',
    defeat: 'You raided my position well. Spain would have loved to see that.',
  },
  'henry-morgan': {
    lived: 'c. 1635 – 1688',
    bio: 'Welsh privateer who led English raids on Spanish towns in the Caribbean and Central America, including the sack of Panama City in 1671. He later became lieutenant governor of Jamaica and a wealthy planter whose estates used enslaved labour.',
    facts: [
      'Before Panama, he led raids on Portobelo in 1668 and Maracaibo in 1669.',
      'The Panama raid came after England and Spain had made peace, so he was arrested and sent to London, yet he was later knighted.',
      'He was buried at Port Royal, Jamaica; the cemetery was lost when much of the town sank in an earthquake in 1692.',
    ],
    victory: 'Every good raid is planned twice and carried out once. Yours was not planned at all.',
    defeat: 'A clean operation, friend. I will be studying your plans.',
  },
  blackbeard: {
    lived: 'c. 1680 – 1718',
    bio: 'English pirate Edward Teach (or Thatch), known as Blackbeard, who operated in the Caribbean and off the coast of the American colonies. He used a fearsome image to frighten crews into surrendering, and was killed in a fight with a Royal Navy party off North Carolina in 1718.',
    facts: [
      "His flagship, Queen Anne's Revenge, was a captured French slave ship; its wreck was found off North Carolina in 1996.",
      'In 1718 he blockaded the port of Charleston, South Carolina, holding hostages until the town handed over a chest of medicine.',
      'He is said to have put slow-burning fuses under his hat to look terrifying, a detail from a 1724 book that is not fully reliable.',
    ],
    victory: 'All that smoke, and you never saw the attack coming.',
    defeat: 'Arr, you kept your nerve. Few crews ever manage that against me.',
  },
}
