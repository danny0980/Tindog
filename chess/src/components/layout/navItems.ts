import { Hourglass, Puzzle, Rocket, ScrollText, ShoppingBag, Swords, UserRound } from 'lucide-react'
import type { AppView } from '../../types/ui'

export interface NavItem {
  id: AppView
  label: string
  icon: typeof Swords
  /** Shown in the phone tab bar (the shop is reached via the coin chip). */
  mobile: boolean
}

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: 'play', label: 'Play', icon: Swords, mobile: true },
  { id: 'legends', label: 'Legends', icon: Hourglass, mobile: true },
  { id: 'rush', label: 'Rush', icon: Rocket, mobile: true },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle, mobile: true },
  { id: 'quests', label: 'Quests', icon: ScrollText, mobile: true },
  { id: 'profile', label: 'Profile', icon: UserRound, mobile: true },
  { id: 'shop', label: 'Shop', icon: ShoppingBag, mobile: false },
]
