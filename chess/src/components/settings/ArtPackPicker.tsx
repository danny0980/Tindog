import { Check, ImageOff, Palette } from 'lucide-react'
import { type ArtBoard, type ArtPieceSet, artStore, assetUrl, humanize } from '../../assets/artManifest'
import { useStore } from '../../hooks/useStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import { ArtPiece } from '../board/ArtPiece'

/**
 * Picks art-pack piece sets and boards (from public/assets). "Theme default"
 * lets each theme / character battle use its own set — and its art, when the
 * pack has a set or board with the same name.
 */
export function ArtPackPicker({ compact = false }: { compact?: boolean }) {
  const manifest = useStore(artStore, (m) => m)
  const artPack = useStore(settingsStore, (s) => s.artPack)
  const artPieces = useStore(settingsStore, (s) => s.artPieces)
  const artBoard = useStore(settingsStore, (s) => s.artBoard)
  const sets = Object.entries(manifest.pieceSets)
  const boards = Object.entries(manifest.boards)
  const portraits = Object.keys(manifest.portraits).length
  const avatars = Object.entries(manifest.avatars)
  const backgrounds = Object.keys(manifest.backgrounds).length
  const playerAvatar = useStore(settingsStore, (s) => s.playerAvatar)

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

      {artPack && avatars.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Your avatar</div>
          <div className={`grid gap-2 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-7'}`}>
            <Choice label="Default" active={playerAvatar === null} onClick={() => updateSettings({ playerAvatar: null })} id="avatar-default">
              <span className="flex size-12 items-center justify-center rounded-xl bg-slate-200 text-xl text-slate-800">♙</span>
            </Choice>
            {avatars.map(([id, path]) => (
              <Choice key={id} label={humanize(id)} active={playerAvatar === id} onClick={() => updateSettings({ playerAvatar: id })} id={`avatar-${id}`}>
                <img src={assetUrl(path)} alt="" loading="lazy" className="size-12 rounded-xl object-cover" />
              </Choice>
            ))}
          </div>
        </div>
      )}

      {artPack && sets.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Art piece sets</div>
          <div className={`grid gap-2 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-7'}`}>
            <Choice label="Theme default" active={artPieces === null} onClick={() => updateSettings({ artPieces: null })} id="default">
              <span className="text-2xl text-slate-300">♞</span>
            </Choice>
            {sets.map(([id, set]) => (
              <Choice key={id} label={humanize(id)} active={artPieces === id} onClick={() => updateSettings({ artPieces: id })} id={id}>
                <PiecePair set={set} />
              </Choice>
            ))}
          </div>
        </div>
      )}

      {artPack && boards.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Art boards</div>
          <div className={`grid gap-2 ${compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-7'}`}>
            <Choice label="Theme default" active={artBoard === null} onClick={() => updateSettings({ artBoard: null })} id="default-board">
              <span className="grid size-10 grid-cols-2 overflow-hidden rounded-md">
                <span className="bg-amber-100/80" />
                <span className="bg-amber-800/80" />
                <span className="bg-amber-800/80" />
                <span className="bg-amber-100/80" />
              </span>
            </Choice>
            {boards.map(([id, board]) => (
              <Choice key={id} label={humanize(id)} active={artBoard === id} onClick={() => updateSettings({ artBoard: id })} id={`board-${id}`}>
                <BoardThumb board={board} />
              </Choice>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Choice({ label, active, onClick, id, children }: { label: string; active: boolean; onClick: () => void; id: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-art-choice={id}
      className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${active ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'}`}
    >
      <span className="flex h-12 items-center justify-center">{children}</span>
      <span className="w-full truncate text-[11px] font-semibold text-slate-200">{label}</span>
      {active && <Check className="absolute top-1 right-1 size-3.5 text-accent" />}
    </button>
  )
}

function PiecePair({ set }: { set: ArtPieceSet }) {
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

function BoardThumb({ board }: { board: ArtBoard }) {
  if (board.board) return <img src={assetUrl(board.board)} alt="" loading="lazy" className="size-12 rounded-md object-cover" />
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
