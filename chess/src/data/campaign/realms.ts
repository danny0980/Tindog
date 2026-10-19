// Eager, lightweight index of the Grand Campaign: realms, zones and relic
// milestones. Boss rosters live in ./rosters/* and are code-split — they are
// only downloaded when a realm's map is opened (see ./loader.ts).
import type { BossId, GrandRealmDef, GrandRealmId } from '../../types/campaign'

export const BOSSES_PER_REALM = 20
export const BOSSES_PER_ZONE = 5
/** Index (0-based) of the mid-realm milestone boss; the overlord is the last. */
export const MILESTONE_INDEX = 9
export const OVERLORD_INDEX = BOSSES_PER_REALM - 1

export const GRAND_REALMS: ReadonlyArray<GrandRealmDef> = [
  {
    id: 'chronicle',
    shortName: 'History',
    order: 0,
    name: 'Historical Legends',
    tagline: 'From Babylon to Princeton',
    description: 'Twenty rulers, generals and geniuses across four ages of history.',
    icon: 'scroll',
    eloRange: [650, 1400],
    colors: { from: '#f59e0b', via: '#b45309', to: '#1e3a8a' },
    zones: [
      { id: 'ancient', name: 'Ancient World', caption: '1750 BCE – 30 BCE', themeId: 'papyrus-gold', pieceSetId: 'lapis', from: '#d4a24c', to: '#1e3a8a' },
      { id: 'medieval', name: 'Middle Ages', caption: 'AD 800 – 1429', themeId: 'rune-oak', pieceSetId: 'runestone', from: '#8b5a2b', to: '#3f2a14' },
      { id: 'renaissance', name: 'Renaissance & Enlightenment', caption: 'AD 1500 – 1687', themeId: 'blueprint', pieceSetId: 'ink', from: '#38bdf8', to: '#1e3a8a' },
      { id: 'modern', name: 'Modern Era', caption: 'AD 1805 – 1905', themeId: 'chalkboard', pieceSetId: 'chalk', from: '#94a3b8', to: '#334155' },
    ],
    relics: ['shield-of-kings', 'hourglass-of-time'],
    completionAchievement: 'keeper-of-history',
  },
  {
    id: 'mythic',
    shortName: 'Myth',
    order: 1,
    name: 'Mythology & Fantasy',
    tagline: 'Gods, elves, the undead and dragons',
    description: 'Climb Olympus, cross the Silverwood, survive the crypts and face the eldest dragon.',
    icon: 'sparkles',
    eloRange: [1150, 1750],
    colors: { from: '#a78bfa', via: '#7c3aed', to: '#14532d' },
    zones: [
      { id: 'gods', name: 'Halls of the Gods', caption: 'Olympus · Asgard · Duat', themeId: 'royal-gold', pieceSetId: 'gilded', from: '#fde68a', to: '#b45309' },
      { id: 'elves', name: 'The Silverwood', caption: 'Elven Kingdom', themeId: 'elven-crystal', pieceSetId: 'moonsilver', from: '#6ee7b7', to: '#0f766e' },
      { id: 'undead', name: 'The Barrow Crypts', caption: 'Realm of the Undead', themeId: 'obsidian-marble', pieceSetId: 'obsidian', from: '#a3a3a3', to: '#1f2937' },
      { id: 'dragons', name: 'Dragonspine Caldera', caption: 'Lair of the Wyrms', themeId: 'obsidian-lava', pieceSetId: 'hellfire', from: '#f97316', to: '#7f1d1d' },
    ],
    relics: ['fae-gold', 'dragonheart-ember'],
    completionAchievement: 'mythbreaker',
  },
  {
    id: 'discovery',
    shortName: 'Discovery',
    order: 2,
    name: 'Age of Discovery & Blades',
    tagline: 'Pirates, knights, explorers and ninja',
    description: 'Sail with pirate queens, joust with legends, chart the world and duel in the shadows of Iga.',
    icon: 'compass',
    eloRange: [1500, 2100],
    colors: { from: '#22d3ee', via: '#0e7490', to: '#7c2d12' },
    zones: [
      { id: 'pirates', name: 'The Spanish Main', caption: 'Golden Age of Piracy', themeId: 'storm-sea', pieceSetId: 'brass', from: '#2dd4bf', to: '#134e4a' },
      { id: 'knights', name: 'The Tourney Fields', caption: 'Age of Chivalry', themeId: 'imperial-velvet', pieceSetId: 'imperial', from: '#93c5fd', to: '#991b1b' },
      { id: 'explorers', name: 'Uncharted Horizons', caption: 'Age of Exploration', themeId: 'storm-sea', pieceSetId: 'ink', from: '#fcd34d', to: '#0c4a6e' },
      { id: 'ninja', name: 'Shadows of Iga', caption: 'Sengoku Japan', themeId: 'bamboo-gold', pieceSetId: 'lacquer', from: '#475569', to: '#0f172a' },
    ],
    relics: ['black-prince-banner', 'smoke-veil'],
    completionAchievement: 'admiral-of-blades',
  },
  {
    id: 'cyber',
    shortName: 'Cyberpunk',
    order: 3,
    name: 'Cyberpunk & Dystopia',
    tagline: 'Hackers, AI cores and cyborg warlords',
    description: 'Jack into the Sprawl and fight your way up to the machine mind that runs it.',
    icon: 'cpu',
    eloRange: [1850, 2450],
    colors: { from: '#f0abfc', via: '#db2777', to: '#0e7490' },
    zones: [
      { id: 'hackers', name: 'The Undernet', caption: 'Hacker Underground', themeId: 'cyberpunk-neon', pieceSetId: 'neon', from: '#f472b6', to: '#4c1d95' },
      { id: 'ai-cores', name: 'Core Datavault', caption: 'Rogue Intelligences', themeId: 'oled-black', pieceSetId: 'neon', from: '#22d3ee', to: '#0f172a' },
      { id: 'cyborgs', name: 'Iron Bastion', caption: 'Cyborg Commanders', themeId: 'obsidian-marble', pieceSetId: 'obsidian', from: '#cbd5e1', to: '#7f1d1d' },
      { id: 'syndicate', name: 'Neon Syndicate', caption: 'Megacorp Spire', themeId: 'cyberpunk-neon', pieceSetId: 'gilded', from: '#facc15', to: '#831843' },
    ],
    relics: ['emp-spike', 'firewall-core'],
    completionAchievement: 'system-override',
  },
  {
    id: 'cosmic',
    shortName: 'Cosmos',
    order: 4,
    name: 'Cosmic Pantheon',
    tagline: 'The endgame beyond the stars',
    description: 'Time Lords, void wardens, the Entity of Chaos and the Star Gods — and the Infinite waiting at the end.',
    icon: 'orbit',
    eloRange: [2200, 2800],
    colors: { from: '#818cf8', via: '#6d28d9', to: '#020617' },
    zones: [
      { id: 'time-lords', name: 'Citadel of Hours', caption: 'The Time Lords', themeId: 'royal-gold', pieceSetId: 'gilded', from: '#fbbf24', to: '#78350f' },
      { id: 'void', name: 'The Hollow Between', caption: 'Void Wardens', themeId: 'oled-black', pieceSetId: 'obsidian', from: '#64748b', to: '#020617' },
      { id: 'chaos', name: 'Maw of Entropy', caption: 'The Entity of Chaos', themeId: 'obsidian-lava', pieceSetId: 'hellfire', from: '#ef4444', to: '#3b0764' },
      { id: 'star-gods', name: 'Throne of Stars', caption: 'The Star Gods', themeId: 'nebula', pieceSetId: 'stardust', from: '#c4b5fd', to: '#1e1b4b' },
    ],
    relics: ['starforged-crown', 'singularity-core'],
    completionAchievement: 'lord-of-the-cosmos',
  },
]

export const GRAND_REALM_IDS: readonly GrandRealmId[] = GRAND_REALMS.map((r) => r.id)
export const TOTAL_BOSSES = GRAND_REALMS.length * BOSSES_PER_REALM

export const getGrandRealm = (id: GrandRealmId): GrandRealmDef => GRAND_REALMS.find((r) => r.id === id) ?? (GRAND_REALMS[0] as GrandRealmDef)

const BOSS_ID = new RegExp(`^(${GRAND_REALM_IDS.join('|')})\\.[a-z0-9-]+$`)
export const isBossId = (v: unknown): v is BossId => typeof v === 'string' && BOSS_ID.test(v)
export const realmOfBoss = (id: BossId): GrandRealmId => id.slice(0, id.indexOf('.')) as GrandRealmId

/** Boss Elo from its position on the realm ramp, rounded to 25. */
export function bossElo(realm: GrandRealmDef, index: number): number {
  const [lo, hi] = realm.eloRange
  return Math.round((lo + ((hi - lo) * index) / (BOSSES_PER_REALM - 1)) / 25) * 25
}
