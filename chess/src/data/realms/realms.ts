// Fantasy realms of Chronos Chess. Realms reuse the epoch model (board theme,
// piece set, soundtrack) but carry no calendar year.
import type { Epoch } from '../../types/legend'

export const FANTASY_REALMS: ReadonlyArray<Epoch> = [
  {
    id: 'elven-kingdom',
    campaign: 'fantasy',
    name: 'Elven Kingdom',
    span: 'The Age of Starlight',
    year: null,
    tagline: 'Silverwood · beneath the eternal canopy',
    themeId: 'elven-crystal',
    pieceSetId: 'moonsilver',
  },
  {
    id: 'shadow-realm',
    campaign: 'fantasy',
    name: 'Realm of Shadows',
    span: 'The Endless Night',
    year: null,
    tagline: 'The Obsidian Spire · where the lava rivers run',
    themeId: 'obsidian-lava',
    pieceSetId: 'hellfire',
  },
]
