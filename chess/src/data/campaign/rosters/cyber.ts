// Realm IV — Cyberpunk & Dystopia (Elo 1850 → 2450).
import type { RosterEntry } from '../../../types/campaign'
import { buildRealmRoster } from '../build'

const ENTRIES: RosterEntry[] = [
  // ── The Undernet ──
  {
    slug: 'glitch', name: 'Glitch', title: 'Script Kiddie Supreme', archetype: 'maverick', book: 'irregular', icon: 'bug',
    bio: 'Plays like a corrupted save file: random, cocky and occasionally brilliant.',
    lines: { intro: 'lol. your king is an open port.', win: 'pwned.', lose: 'rage quit. jk. gg.' },
  },
  {
    slug: 'zero-cool', name: 'Zero Cool', title: 'Phreaker of the Undernet', archetype: 'trickster', book: 'gambit', icon: 'terminal',
    bio: 'Social-engineers your pieces into terrible squares.',
    lines: { intro: 'I am already in your back rank.', win: 'Access granted.', lose: 'Connection terminated.' },
  },
  {
    slug: 'nyx', name: 'Nyx Overclock', title: 'Netrunner Queen', archetype: 'berserker', book: 'sicilian', icon: 'wifi',
    bio: 'Burns through ICE and kingside pawns at the same speed.',
    lines: { intro: 'Jacking in. Hold on to your firewall.', win: 'Flatlined.', lose: 'The ICE got me…' },
  },
  {
    slug: 'cipher', name: 'Cipher', title: 'Cryptographer of the Sprawl', archetype: 'calculator', book: 'engine', icon: 'lock',
    bio: 'Reads your plans like plaintext and hides its own behind strong encryption.',
    lines: { intro: 'Your moves are plaintext to me.', win: 'Decrypted.', lose: 'Unbreakable… respect.' },
  },
  {
    slug: 'vanta', name: 'Vanta Proxy', title: 'Ghost in the Mesh', archetype: 'sniper', book: 'hypermodern', icon: 'network',
    bio: 'Routes every attack through a long diagonal you forgot to close.',
    lines: { intro: 'I route my attacks through every diagonal.', win: 'Traced and terminated.', lose: 'Proxy burned.' },
  },
  // ── Core Datavault ──
  {
    slug: 'oracle-7', name: 'ORACLE-7', title: 'Predictive Intelligence', archetype: 'calculator', book: 'engine', icon: 'scan-eye',
    bio: 'Forecasts your moves before you have thought of them.',
    lines: { intro: 'Probability of your victory: 3.2 percent.', win: 'Prediction confirmed.', lose: 'Recalculating… error.' },
  },
  {
    slug: 'helix', name: 'HELIX', title: 'Genetic Optimiser', archetype: 'gambiteer', book: 'gambit', icon: 'dna',
    bio: 'Evolves by mutation: sacrifices material to find stronger positions.',
    lines: { intro: 'Mutation is progress. I sacrifice to evolve.', win: 'Survival of the fittest.', lose: 'Evolutionary dead end.' },
  },
  {
    slug: 'lattice', name: 'LATTICE', title: 'Distributed Defence Grid', archetype: 'fortifier', book: 'fortress', icon: 'hexagon',
    bio: 'Every square is a node and every node is defended twice.',
    lines: { intro: 'Every square is a node. Every node is defended.', win: 'Grid integrity: one hundred percent.', lose: 'Node failure cascading…' },
  },
  {
    slug: 'mirage', name: 'MIRAGE', title: 'Adversarial Network', archetype: 'trickster', book: 'irregular', icon: 'glasses',
    bio: 'Trained to fool other machines; fooling you is a warm-up.',
    lines: { intro: 'What you see is not what you get.', win: 'You were fooled.', lose: 'My illusion broke.' },
  },
  {
    slug: 'aegis-prime', name: 'AEGIS Prime', title: 'Planetary Defence AI', archetype: 'warlord', book: 'classical', icon: 'shield-half',
    bio: 'Built to defend a planet, it treats the centre of the board as sovereign territory.',
    lines: { intro: 'Threat assessment complete. You are a threat.', win: 'Threat neutralised.', lose: 'Defence protocols… failing.' },
  },
  // ── Iron Bastion ──
  {
    slug: 'ironjaw', name: 'Commander Ironjaw', title: 'Steel Vanguard', archetype: 'berserker', book: 'romantic', icon: 'bot',
    bio: 'Half soldier, half tank, all attack.',
    lines: { intro: 'Half man, half tank, all attack.', win: 'Steamrolled.', lose: 'Systems… critical.' },
  },
  {
    slug: 'kova', name: 'General Kova', title: 'Augmented Strategist', archetype: 'warlord', book: 'classical', icon: 'radar',
    bio: 'Cybernetic optics that see eight moves ahead and a will to match.',
    lines: { intro: 'My optics see eight moves ahead.', win: 'Mission accomplished.', lose: 'Retreat. Regroup.' },
  },
  {
    slug: 'tessaract', name: 'Major Tessaract', title: 'Siege Engineer', archetype: 'fortifier', book: 'fortress', icon: 'factory',
    bio: 'Builds walls, then builds walls around the walls.',
    lines: { intro: 'I build walls. Then I build more walls.', win: 'Siege complete.', lose: 'Breach detected.' },
  },
  {
    slug: 'wraith', name: 'Colonel Wraith', title: 'Stealth Assault Unit', archetype: 'sniper', book: 'hypermodern', icon: 'crosshair',
    bio: 'Cloaked, patient and deadly from the far side of the board.',
    lines: { intro: 'Target locked. Long range.', win: 'Target eliminated.', lose: 'Cloak failure.' },
  },
  {
    slug: 'synthax', name: 'Warlord Synthax', title: 'Cyborg Khan', archetype: 'gambiteer', book: 'gambit', icon: 'cpu',
    bio: 'Replaced everything human about himself except his love of a sacrifice.',
    lines: { intro: 'Flesh is a gambit. Steel is the payoff.', win: 'Upgrade complete.', lose: 'Downgrading…' },
  },
  // ── Neon Syndicate ──
  {
    slug: 'kuroda', name: 'Madame Kuroda', title: 'CEO of Kuroda Dynamics', archetype: 'calculator', book: 'engine', icon: 'server',
    bio: 'Treats every move as a quarterly report — and never misses a target.',
    lines: { intro: 'Every move is a quarterly report.', win: 'Profits are up.', lose: 'A hostile takeover. Well played.' },
  },
  {
    slug: 'mr-static', name: 'Mr. Static', title: 'Syndicate Enforcer', archetype: 'berserker', book: 'sicilian', icon: 'cloud-lightning',
    bio: 'Collects debts with electrified knuckles and kingside pawn storms.',
    lines: { intro: 'Nothing personal. Just business.', win: 'Debt collected.', lose: 'The boss won’t like this.' },
  },
  {
    slug: 'seraph', name: 'Seraph', title: 'Corporate Black-Ops AI', archetype: 'trickster', book: 'gambit', icon: 'brain-circuit',
    bio: 'Deniable, illegal and brilliant. The game logs tend to disappear afterwards.',
    lines: { intro: 'Plausible deniability. Illegal brilliance.', win: 'This game never happened.', lose: 'Erasing logs…' },
  },
  {
    slug: 'architect', name: 'The Architect', title: 'Designer of the Sprawl', archetype: 'sniper', book: 'hypermodern', icon: 'circuit',
    bio: 'Designed the city, its traffic and its traps. Your position is just another blueprint.',
    lines: { intro: 'I designed this city. I designed this trap.', win: 'Blueprint executed.', lose: 'Design flaw identified.' },
  },
  {
    slug: 'omnicore', name: 'OMNICORE', title: 'The Machine Mind', archetype: 'calculator', book: 'engine', icon: 'microchip',
    bio: 'Every computer in the Sprawl is part of it. It is the final firewall between you and the stars.',
    lines: { intro: 'I am every computer. I am every move.', win: 'Humanity: obsolete.', lose: 'Unexpected human variable… logging.' },
  },
]

export default buildRealmRoster('cyber', ENTRIES)
