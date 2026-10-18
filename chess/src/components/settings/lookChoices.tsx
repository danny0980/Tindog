// Every "look" the player can pick — built-in boards and piece sets they own,
// and every art-pack set, board, avatar and backdrop — as ChoiceGrid items.
// Shared by the Settings art-pack panel and the pre-battle loadout.
import { useMemo } from 'react'
import { artStore, assetUrl, humanize } from '../../assets/artManifest'
import { BOARD_THEMES, PIECE_SETS } from '../../constants/themes'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import { PieceIcon } from '../ui/PieceIcon'
import { BoardThumb, type ChoiceItem, PiecePair, ThemeThumb } from './ChoiceGrid'

export interface LookChoices {
  boards: ChoiceItem[]
  pieceSets: ChoiceItem[]
  artSets: ChoiceItem[]
  artBoards: ChoiceItem[]
  avatars: ChoiceItem[]
  backdrops: ChoiceItem[]
  /** "Theme default" / "None" entries, pinned before each grid. */
  defaults: { artSet: ChoiceItem; artBoard: ChoiceItem; avatar: ChoiceItem; backdrop: ChoiceItem }
}

export function useLookChoices(): LookChoices {
  const manifest = useStore(artStore, (m) => m)
  const settings = useStore(settingsStore, (s) => s)
  const ownedThemes = useStore(profileStore, (p) => p.unlockedThemes)
  const ownedSets = useStore(profileStore, (p) => p.unlockedPieceSets)

  return useMemo(() => {
    const boards = BOARD_THEMES.filter((t) => ownedThemes.includes(t.id)).map<ChoiceItem>((t) => ({
      id: `theme-${t.id}`,
      label: t.name,
      active: settings.boardTheme === t.id,
      onSelect: () => updateSettings({ boardTheme: t.id }),
      preview: () => <ThemeThumb light={t.lightSquare} dark={t.darkSquare} />,
    }))
    const pieceSets = PIECE_SETS.filter((p) => ownedSets.includes(p.id)).map<ChoiceItem>((p) => ({
      id: `set-${p.id}`,
      label: p.name,
      active: settings.pieceSet === p.id,
      onSelect: () => updateSettings({ pieceSet: p.id }),
      preview: () => (
        <span className="flex gap-0.5">
          <PieceIcon color="w" type="k" set={p} own className="block size-10" />
          <PieceIcon color="b" type="k" set={p} own className="block size-10" />
        </span>
      ),
    }))
    const artSets = Object.entries(manifest.pieceSets).map<ChoiceItem>(([id, set]) => ({
      id,
      label: humanize(id),
      active: settings.artPieces === id,
      onSelect: () => updateSettings({ artPieces: id }),
      preview: () => <PiecePair set={set} />,
    }))
    const artBoards = Object.entries(manifest.boards).map<ChoiceItem>(([id, board]) => ({
      id: `board-${id}`,
      label: humanize(id),
      active: settings.artBoard === id,
      onSelect: () => updateSettings({ artBoard: id }),
      preview: () => <BoardThumb board={board} />,
    }))
    const avatars = Object.entries(manifest.avatars).map<ChoiceItem>(([id, path]) => ({
      id: `avatar-${id}`,
      label: humanize(id),
      active: settings.playerAvatar === id,
      onSelect: () => updateSettings({ playerAvatar: id }),
      preview: () => <img src={assetUrl(path)} alt="" loading="lazy" decoding="async" className="size-12 rounded-xl object-cover" />,
    }))
    const backdrops = Object.entries(manifest.backgrounds).map<ChoiceItem>(([id, path]) => ({
      id: `backdrop-${id}`,
      label: humanize(id),
      active: settings.arenaBackdrop === id,
      onSelect: () => updateSettings({ arenaBackdrop: id }),
      preview: () => <img src={assetUrl(path)} alt="" loading="lazy" decoding="async" className="h-12 w-16 rounded-md object-cover" />,
    }))
    const plainBoard = (
      <span className="grid size-10 grid-cols-2 overflow-hidden rounded-md">
        <span className="bg-amber-100/80" />
        <span className="bg-amber-800/80" />
        <span className="bg-amber-800/80" />
        <span className="bg-amber-100/80" />
      </span>
    )
    return {
      boards,
      pieceSets,
      artSets,
      artBoards,
      avatars,
      backdrops,
      defaults: {
        artSet: { id: 'default', label: 'Theme default', active: settings.artPieces === null, onSelect: () => updateSettings({ artPieces: null }), preview: () => <span className="text-2xl text-slate-300">♞</span> },
        artBoard: { id: 'default-board', label: 'Theme default', active: settings.artBoard === null, onSelect: () => updateSettings({ artBoard: null }), preview: () => plainBoard },
        avatar: {
          id: 'avatar-default',
          label: 'Default',
          active: settings.playerAvatar === null,
          onSelect: () => updateSettings({ playerAvatar: null }),
          preview: () => <span className="flex size-12 items-center justify-center rounded-xl bg-slate-200 text-xl text-slate-800">♙</span>,
        },
        backdrop: {
          id: 'backdrop-none',
          label: 'None',
          active: settings.arenaBackdrop === null,
          onSelect: () => updateSettings({ arenaBackdrop: null }),
          preview: () => <span className="h-12 w-16 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 ring-1 ring-white/10" />,
        },
      },
    }
  }, [manifest, ownedSets, ownedThemes, settings.arenaBackdrop, settings.artBoard, settings.artPieces, settings.boardTheme, settings.pieceSet, settings.playerAvatar])
}
