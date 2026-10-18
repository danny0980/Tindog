import { Check, Search } from 'lucide-react'
import { type ReactNode, useDeferredValue, useState } from 'react'
import { type ArtBoard, type ArtPieceSet, assetUrl } from '../../assets/artManifest'
import { ArtPiece } from '../board/ArtPiece'

export interface ChoiceItem {
  id: string
  label: string
  active: boolean
  onSelect: () => void
  /** Built lazily: only items that are shown (after the search filter) render a preview. */
  preview: () => ReactNode
}

interface ChoiceGridProps {
  title: string
  items: readonly ChoiceItem[]
  compact?: boolean
  /** Shown before the items; never filtered out (e.g. "Theme default"). */
  pinned?: ChoiceItem
  /** data-* hook for tests. */
  testId?: string
}

/** Above this many options the grid gets a search box. */
const SEARCH_FROM = 9

/**
 * A selectable grid of looks (piece sets, boards, avatars, backdrops) that
 * stays fast with dozens of art packs: a search box narrows it, previews are
 * built only for visible items, and off-screen cells skip layout and paint
 * (content-visibility). Selecting applies instantly.
 */
export function ChoiceGrid({ title, items, compact = false, pinned, testId }: ChoiceGridProps) {
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)
  const q = deferred.trim().toLowerCase()
  const shown = q ? items.filter((i) => i.label.toLowerCase().includes(q) || i.id.includes(q)) : items
  return (
    <div data-choice-grid={testId}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          {title} <span className="font-mono normal-case tracking-normal text-slate-600">· {items.length}</span>
        </span>
        {items.length > SEARCH_FROM && (
          <label className="ml-auto flex min-w-0 items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 focus-within:ring-1 focus-within:ring-accent">
            <Search className="size-3.5 shrink-0 text-slate-500" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label={`Search ${title.toLowerCase()}`}
              className="w-24 min-w-0 bg-transparent outline-none placeholder:text-slate-600 sm:w-32"
            />
          </label>
        )}
      </div>
      <div className={`grid gap-2 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-7'}`}>
        {pinned && <Choice item={pinned} />}
        {shown.map((item) => (
          <Choice key={item.id} item={item} />
        ))}
      </div>
      {shown.length === 0 && <p className="mt-1 text-xs text-slate-500">Nothing matches “{deferred}”.</p>}
    </div>
  )
}

function Choice({ item }: { item: ChoiceItem }) {
  return (
    <button
      type="button"
      onClick={item.onSelect}
      aria-pressed={item.active}
      data-art-choice={item.id}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 84px' }}
      className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${item.active ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'}`}
    >
      <span className="flex h-12 items-center justify-center">{item.preview()}</span>
      <span className="w-full truncate text-[11px] font-semibold text-slate-200">{item.label}</span>
      {item.active && <Check className="absolute top-1 right-1 size-3.5 text-accent" />}
    </button>
  )
}

export function PiecePair({ set }: { set: ArtPieceSet }) {
  return (
    <span className="flex gap-0.5">
      <span className="size-10">
        <ArtPiece code="wK" art={set} fallback={<span className="text-2xl">♔</span>} />
      </span>
      <span className="size-10">
        <ArtPiece code="bK" art={set} fallback={<span className="text-2xl">♚</span>} />
      </span>
    </span>
  )
}

export function BoardThumb({ board }: { board: ArtBoard }) {
  if (board.board) return <img src={assetUrl(board.board)} alt="" loading="lazy" decoding="async" className="size-12 rounded-md object-cover" />
  const tile = (path: string | undefined) => (path ? { backgroundImage: `url("${assetUrl(path)}")`, backgroundSize: 'cover' } : {})
  return (
    <span className="grid size-12 grid-cols-2 overflow-hidden rounded-md">
      <span style={tile(board.light)} />
      <span style={tile(board.dark)} />
      <span style={tile(board.dark)} />
      <span style={tile(board.light)} />
    </span>
  )
}

/** A 2×2 swatch of a built-in board theme. */
export function ThemeThumb({ light, dark }: { light: React.CSSProperties; dark: React.CSSProperties }) {
  return (
    <span className="grid size-10 grid-cols-2 overflow-hidden rounded-md ring-1 ring-white/15">
      <span style={light} />
      <span style={dark} />
      <span style={dark} />
      <span style={light} />
    </span>
  )
}
