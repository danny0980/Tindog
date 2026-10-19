import type { EraLore } from './types'

/** Greece & Rome. */
export const CLASSICAL_LORE: EraLore = {
  pericles: {
    lived: 'c. 495 – 429 BCE',
    bio: 'Pericles was the leading statesman of Athens during its golden age in the mid-5th century BCE. He strengthened Athenian democracy, led its navy-based empire and sponsored the building programme on the Acropolis.',
    facts: [
      'Work on the Parthenon began in 447 BCE as part of the building programme he championed.',
      'The historian Thucydides records his Funeral Oration, a famous speech praising Athenian democracy.',
      'He died in 429 BCE during a plague that struck Athens in the early years of the Peloponnesian War.',
    ],
    victory: 'Athens builds with care, and so did I. My structure held; yours did not.',
    defeat: 'Well done. In Athens we honour excellence, even when it beats us.',
  },
  socrates: {
    lived: 'c. 470 – 399 BCE',
    bio: 'Socrates was an Athenian philosopher who questioned people about justice, virtue and knowledge. He is regarded as a founder of Western philosophy, and his method of asking probing questions is still used in teaching today.',
    facts: [
      'He wrote nothing himself. We know him mainly through the works of his students Plato and Xenophon, and the comic playwright Aristophanes.',
      'In 399 BCE an Athenian jury convicted him of impiety and corrupting the youth, and he was sentenced to death by drinking hemlock.',
      'According to Plato, he served as a foot soldier in several battles of the Peloponnesian War.',
    ],
    victory: 'Tell me, friend: why did you think that move was good? Let us examine it together.',
    defeat: 'You have taught me something. That is the best result a philosopher can ask for.',
  },
  leonidas: {
    lived: 'died 480 BCE (reigned c. 489 – 480 BCE)',
    bio: 'Leonidas I was a king of Sparta who led the Greek force that held the pass of Thermopylae against the invading Persian army of Xerxes in 480 BCE. His last stand became a lasting symbol of courage against the odds.',
    facts: [
      'Herodotus says he led 300 Spartans, together with several thousand soldiers from other Greek cities, to Thermopylae.',
      'The reply "Come and take them," given when the Persians demanded the Greeks lay down their arms, is reported by the later writer Plutarch.',
      'He was married to Gorgo, daughter of King Cleomenes I, whom ancient writers describe as unusually wise.',
    ],
    victory: 'A narrow pass, held by a few. That was all I ever needed.',
    defeat: 'You broke through. Few ever have. Go, and tell Sparta it was a fair fight.',
  },
  aristotle: {
    lived: '384 – 322 BCE',
    bio: 'Aristotle was a Greek philosopher and scientist whose work shaped Western thought for nearly two thousand years. He wrote on logic, biology, physics, ethics, politics and poetry.',
    facts: [
      'Born in Stagira in northern Greece, he studied at Plato\'s Academy in Athens for about twenty years.',
      'King Philip II of Macedon hired him to tutor his son, the future Alexander the Great.',
      'He founded his own school in Athens, the Lyceum. His followers were called Peripatetics, perhaps from the covered walkway where they met.',
    ],
    victory: 'First principles, sound development, logical conclusion. Checkmate follows.',
    defeat: 'A good argument wins, whoever makes it. I accept the conclusion.',
  },
  archimedes: {
    lived: 'c. 287 – 212 BCE',
    bio: 'Archimedes of Syracuse was the greatest mathematician of antiquity and a brilliant engineer. He worked on geometry, levers, buoyancy and the value of pi, and his methods anticipated parts of modern calculus.',
    facts: [
      'He proved that a sphere has two-thirds the volume of the cylinder around it. Cicero says he found the tomb marked with this figure.',
      'The Roman architect Vitruvius tells the story of him shouting "Eureka!" after solving a problem while in the bath.',
      'A medieval prayer book, the Archimedes Palimpsest, was found to hide copies of his works beneath its text, including some known nowhere else.',
    ],
    victory: 'A long lever, a well-placed fulcrum, and your king is lifted off the board.',
    defeat: 'Eureka, you have found the answer before me. Please, do not disturb my circles.',
  },
  spartacus: {
    lived: 'birth unknown – 71 BCE',
    bio: 'Spartacus was a Thracian gladiator who escaped from a training school near Capua in 73 BCE and led a great slave uprising against Rome. His army defeated several Roman forces before it was crushed.',
    facts: [
      'Ancient sources say the revolt began when around seventy gladiators broke out, armed with kitchen knives and tools.',
      'His forces grew to tens of thousands of people and roamed across Italy for about two years.',
      'He was killed in battle in 71 BCE against a Roman army commanded by Marcus Licinius Crassus. His birth year is not known.',
    ],
    victory: 'They called us property. Today a gladiator walks away the winner.',
    defeat: 'You fought well. Remember that every piece on this board deserves to be free.',
  },
  hannibal: {
    lived: '247 – c. 183 BCE',
    bio: 'Hannibal Barca was a Carthaginian general in the Second Punic War against Rome. He is ranked among the greatest military commanders in history for his daring march into Italy and his victories there.',
    facts: [
      'In 218 BCE he led his army, including war elephants, over the Alps into Italy.',
      'At Cannae in 216 BCE he encircled and destroyed a much larger Roman army, a battle still studied at military academies.',
      'He was finally defeated by the Roman general Scipio Africanus at the Battle of Zama in 202 BCE.',
    ],
    victory: 'You guarded the obvious roads. I came over the mountains.',
    defeat: 'Like Scipio, you learned my tricks and used them better. Well played.',
  },
  'julius-caesar': {
    lived: '100 – 44 BCE',
    bio: 'Gaius Julius Caesar was a Roman general and statesman who conquered Gaul, won a civil war and became dictator of Rome. His rise and assassination helped bring about the end of the Roman Republic.',
    facts: [
      'In 49 BCE he led his army across the Rubicon river into Italy, starting a civil war. "Crossing the Rubicon" now means a point of no return.',
      'He introduced the Julian calendar, with 365 days and a leap year every fourth year. The month of July is named after him.',
      'He was stabbed to death by a group of senators on the Ides of March, 15 March 44 BCE.',
    ],
    victory: 'I came, I saw, and once again, I conquered.',
    defeat: 'Even Caesar must yield sometimes. Enjoy your triumph, citizen. I am already planning my return.',
  },
  augustus: {
    lived: '63 BCE – 14 CE',
    bio: 'Augustus, born Gaius Octavius, was the great-nephew and adopted heir of Julius Caesar. After defeating his rivals he became the first Roman emperor, beginning a long period of relative peace known as the Pax Romana.',
    facts: [
      'Julius Caesar adopted him in his will, and he took the name Gaius Julius Caesar Octavianus.',
      'The Senate gave him the name Augustus in 27 BCE. The month of August is named after him.',
      'The historian Suetonius says one of his favourite sayings was "festina lente", meaning "make haste slowly".',
    ],
    victory: 'Make haste slowly. You hurried; I did not.',
    defeat: 'Have I played my part well? Then applaud the winner, as I do.',
  },
  alexander: {
    lived: '356 – 323 BCE',
    bio: 'Alexander III of Macedon became king at twenty and built one of the largest empires of the ancient world, stretching from Greece to northwest India. His conquests spread Greek culture across the Near East.',
    facts: [
      'As a teenager he was taught by the philosopher Aristotle.',
      'He defeated the Persian king Darius III at the battles of Issus in 333 BCE and Gaugamela in 331 BCE.',
      'He founded many cities, the most famous being Alexandria in Egypt. He died in Babylon in 323 BCE, aged 32.',
    ],
    victory: 'Another kingdom added to my map. Who is next?',
    defeat: 'You have done what Persia could not. My tutor would want me to study this game.',
  },
}
