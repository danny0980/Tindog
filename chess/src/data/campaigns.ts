import type { Campaign, CampaignId } from '../types/legend'

/** The two campaign paths. Chapters must be beaten in order within a campaign. */
export const CAMPAIGNS: ReadonlyArray<Campaign> = [
  {
    id: 'historical',
    name: 'Historical Timeline',
    tagline: 'From the Nile to Ganryū-jima',
    description: 'Travel through six eras and duel the legends of history — from Cleopatra’s cunning traps to the blade-sharp precision of Miyamoto Musashi.',
    chapters: ['cleopatra', 'newton', 'napoleon', 'einstein', 'ragnar', 'musashi'],
    completionAchievement: 'master-of-time',
  },
  {
    id: 'fantasy',
    name: 'Fantasy Realm',
    tagline: 'Elves, sorcery and shadow',
    description: 'Cross into a realm of myth: earn the trust of the elven Queen Aerith, then storm the Obsidian Spire of Malakor the Dark Sorcerer.',
    chapters: ['aerith', 'malakor'],
    completionAchievement: 'hero-of-the-realm',
  },
]

export const getCampaign = (id: CampaignId): Campaign => CAMPAIGNS.find((c) => c.id === id) ?? (CAMPAIGNS[0] as Campaign)
