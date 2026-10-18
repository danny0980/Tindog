import { ImageOff, Palette } from 'lucide-react'
import { artStore } from '../../assets/artManifest'
import { useStore } from '../../hooks/useStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import { ChoiceGrid } from './ChoiceGrid'
import { useLookChoices } from './lookChoices'

/**
 * Picks art-pack piece sets and boards (from public/assets). "Theme default"
 * lets each theme / character battle use its own set — and its art, when the
 * pack has a set or board with the same name.
 */
export function ArtPackPicker({ compact = false }: { compact?: boolean }) {
  const manifest = useStore(artStore, (m) => m)
  const artPack = useStore(settingsStore, (s) => s.artPack)
  const artPieceScale = useStore(settingsStore, (s) => s.artPieceScale)
  const sets = Object.entries(manifest.pieceSets)
  const boards = Object.entries(manifest.boards)
  const portraits = Object.keys(manifest.portraits).length
  const avatars = Object.entries(manifest.avatars)
  const backgrounds = Object.keys(manifest.backgrounds).length
  const looks = useLookChoices()

  if (sets.length === 0 && boards.length === 0 && portraits === 0 && avatars.length === 0 && backgrounds === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3 text-xs text-slate-400" data-art-empty>
        <ImageOff className="mt-0.5 size-4 shrink-0" />
        <span>
          No art pack installed. Put your images in a folder and run <code className="text-slate-200">npm run assets:import -- "path\to\folder"</code> inside the <b>chess</b> folder, then restart <code className="text-slate-200">npm run dev</code>.
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-3" data-art-pack>
      <label className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
        <Palette className="size-4 text-accent" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white">Use the art pack</span>
          <span className="block text-xs text-slate-500">
            {sets.length} piece sets · {boards.length} boards · {portraits} portraits · {avatars.length} avatars · {backgrounds} backgrounds
          </span>
        </span>
        <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={artPack} onChange={(e) => updateSettings({ artPack: e.target.checked })} data-art-toggle />
      </label>

      {artPack && avatars.length > 0 && <ChoiceGrid title="Your avatar" items={looks.avatars} pinned={looks.defaults.avatar} compact={compact} testId="avatars" />}

      {artPack && sets.length > 0 && <ChoiceGrid title="Art piece sets" items={looks.artSets} pinned={looks.defaults.artSet} compact={compact} testId="art-sets" />}

      {artPack && sets.length > 0 && (
        <label className="block rounded-xl bg-white/[0.03] px-3 py-2">
          <span className="flex items-center justify-between text-sm font-medium text-white">
            Piece size on the board <span className="tabular-nums text-slate-400">{Math.round(artPieceScale * 100)}%</span>
          </span>
          <span className="block text-xs text-slate-500">Bigger pieces are easier to see; above 100% they stand taller than their square.</span>
          <input
            type="range"
            min={0.8}
            max={1.5}
            step={0.05}
            value={artPieceScale}
            onChange={(e) => updateSettings({ artPieceScale: Number(e.target.value) })}
            className="mt-1 w-full accent-[var(--accent)]"
            data-art-scale
          />
        </label>
      )}

      {artPack && boards.length > 0 && <ChoiceGrid title="Art boards" items={looks.artBoards} pinned={looks.defaults.artBoard} compact={compact} testId="art-boards" />}

      {artPack && backgrounds > 0 && (
        <ChoiceGrid title="Arena backdrop (behind the board)" items={looks.backdrops} pinned={looks.defaults.backdrop} compact={compact} testId="backdrops" />
      )}
    </div>
  )
}
