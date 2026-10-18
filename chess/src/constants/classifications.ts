import { ArrowRight, BookOpen, Check, Sparkles, Star, ThumbsUp } from 'lucide-react'
import type { MoveClassification } from '../types/analysis'

export const CLASSIFICATION_META: Record<
  MoveClassification,
  { label: string; color: string; symbol: string | null; icon: typeof Star | null }
> = {
  brilliant: { label: 'Brilliant', color: '#22d3c5', symbol: '!!', icon: Sparkles },
  best: { label: 'Best', color: '#84cc16', symbol: null, icon: Star },
  excellent: { label: 'Excellent', color: '#4ade80', symbol: null, icon: ThumbsUp },
  good: { label: 'Good', color: '#94a3b8', symbol: null, icon: Check },
  book: { label: 'Book', color: '#c8a27a', symbol: null, icon: BookOpen },
  forced: { label: 'Forced', color: '#94a3b8', symbol: null, icon: ArrowRight },
  inaccuracy: { label: 'Inaccuracy', color: '#facc15', symbol: '?!', icon: null },
  mistake: { label: 'Mistake', color: '#fb923c', symbol: '?', icon: null },
  blunder: { label: 'Blunder', color: '#ef4444', symbol: '??', icon: null },
}
