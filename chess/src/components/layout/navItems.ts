import { Puzzle, ShoppingBag, Swords, UserRound } from 'lucide-react'
import type { AppView } from '../../types/ui'

export const NAV_ITEMS: ReadonlyArray<{ id: AppView; label: string; icon: typeof Swords }> = [
  { id: 'play', label: 'Play', icon: Swords },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'shop', label: 'Shop', icon: ShoppingBag },
]
