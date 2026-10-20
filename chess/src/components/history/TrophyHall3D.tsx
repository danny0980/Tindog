import { useEffect, useMemo, useRef } from 'react'
import { artStore, assetUrl, portraitFor } from '../../assets/artManifest'
import { loreFor } from '../../data/classic/lore'
import type { ClassicCharacter } from '../../data/classic/roster'
import { classicPersona } from '../../data/personas'
import { useStore } from '../../hooks/useStore'
import { type HallStatue, createHall } from '../../museum/hallScene'
import { profileStore } from '../../stores/profileStore'
import { settingsStore } from '../../stores/settingsStore'

interface TrophyHall3DProps {
  beaten: readonly ClassicCharacter[]
  onPick: (c: ClassicCharacter) => void
  /** WebGL failed to start: the page shows the gallery instead. */
  onFail: () => void
}

/** The walkable 3D Trophy Hall (its own lazy chunk, with three.js). */
export default function TrophyHall3D({ beaten, onPick, onFail }: TrophyHall3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const memory = useStore(profileStore, (p) => p.memory)
  const manifest = useStore(artStore, (m) => m)
  const artPack = useStore(settingsStore, (s) => s.artPack)
  const statues = useMemo<HallStatue[]>(
    () =>
      beaten.map((c) => {
        const p = classicPersona(c)
        const path = artPack ? portraitFor(manifest, c.name) : null
        return {
          id: c.id,
          name: c.name,
          lived: loreFor(c.id)?.lived ?? '',
          title: c.title,
          wins: Math.max(1, memory[`classic:${c.id}`]?.wins ?? 1),
          from: p.portrait.from,
          to: p.portrait.to,
          monogram: p.portrait.monogram,
          art: path ? assetUrl(path) : null,
        }
      }),
    [artPack, beaten, manifest, memory],
  )
  const pickRef = useRef(onPick)
  const failRef = useRef(onFail)
  useEffect(() => {
    pickRef.current = onPick
    failRef.current = onFail
  }, [onFail, onPick])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const hall = createHall(canvas, statues, (id) => {
        const c = beaten.find((b) => b.id === id)
        if (c) pickRef.current(c)
      })
      return () => hall.dispose()
    } catch {
      failRef.current()
    }
  }, [beaten, statues])

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10" data-hall3d={statues.length}>
      <canvas ref={canvasRef} className="block h-[min(70vh,34rem)] w-full touch-none cursor-grab active:cursor-grabbing" aria-label={`3D Trophy Hall with ${statues.length} statues. Drag to look around and walk; tap a statue for its plaque.`} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-center text-[11px] text-slate-300">Drag sideways to look · drag up and down or scroll to walk · tap a statue</div>
    </div>
  )
}
