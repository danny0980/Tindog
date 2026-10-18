import { Clapperboard, Infinity as InfinityIcon, Map as MapIcon, Play, SkipForward, Swords, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { settingsStore } from '../../stores/settingsStore'
import { playFx } from '../fx/playFx'
import { createIntroAudio, type IntroAudio } from './introAudio'
import { IntroRenderer } from './renderer'
import { INTRO_TIMES, type IntroPhase, beatsBetween, moveAt, phaseAt } from './timeline'

/** Where the player goes when the intro ends. */
export type IntroExit = 'grand' | 'gauntlet' | 'play'

interface CinematicIntroProps {
  onExit: (target: IntroExit) => void
}

type Stage = 'gate' | 'playing'

/** Longest frame step fed to the simulation (keeps a stalled tab from teleporting particles). */
const MAX_DT = 1 / 20
const HEX = '0123456789ABCDEF'

const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isMobile = (): boolean => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/**
 * The "Visual Evolution" intro: a hyper-real study game on a varnished board
 * is torn open by a temporal rift (fracturing holographic UI, chromatic
 * aberration, a blue-gold shockwave) and reborn as the Chronos realm —
 * obsidian and lava, rune-lit pieces, embers and an orchestral score.
 *
 * Starts behind a gate so the first tap unlocks audio; skippable at any time
 * straight into the Grand Campaign, the Gauntlet or the board.
 */
export default function CinematicIntro({ onExit }: CinematicIntroProps) {
  const [stage, setStage] = useState<Stage>('gate')
  const [phase, setPhase] = useState<IntroPhase>('classic')
  const [caption, setCaption] = useState<{ key: number; text: string } | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const rendererRef = useRef<IntroRenderer | null>(null)
  const audioRef = useRef<IntroAudio | null>(null)
  const timeRef = useRef(0)
  const exitedRef = useRef(false)
  const [reduced] = useState(prefersReducedMotion)

  // Build textures and sprites while the gate is showing.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const mobile = isMobile()
    const renderer = new IntroRenderer(canvas, mobile)
    // Paint the textures off the critical path so the gate appears immediately.
    const id = window.setTimeout(() => {
      try {
        renderer.prepare(mobile)
        rendererRef.current = renderer
        const rect = canvas.getBoundingClientRect()
        renderer.resize(rect.width, rect.height)
        renderer.render(0.01, 0)
        setReady(true)
      } catch (err) {
        // A device that can't paint the intro still gets into the app.
        console.error('[intro] could not prepare the cinematic', err)
        setFailed(true)
      }
    }, 30)
    const onResize = () => {
      const rect = canvas.getBoundingClientRect()
      rendererRef.current?.resize(rect.width, rect.height)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // The animation loop (runs from Begin until the intro closes).
  useEffect(() => {
    if (stage !== 'playing') return
    let raf = 0
    let last = performance.now()
    let lastPhase: IntroPhase | null = null
    let lastMove = -1
    const frame = (now: number) => {
      const renderer = rendererRef.current
      const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000))
      last = now
      // Paused while the tab is hidden (rAF stops; dt is capped on return).
      const previous = timeRef.current
      const t = previous + dt
      timeRef.current = t
      for (const beat of beatsBetween(previous, t)) {
        renderer?.onBeat(beat)
        audioRef.current?.beat(beat)
        if ((beat.kind === 'check' || beat.kind === 'shockwave') && !reduced) playFx(canvasRef.current, 'chroma')
      }
      const p = phaseAt(t)
      if (p !== lastPhase) {
        lastPhase = p
        setPhase(p)
      }
      const m = moveAt(t)
      if (m && m.index !== lastMove) {
        lastMove = m.index
        setCaption({ key: m.index, text: m.move.san })
      }
      renderer?.render(t, dt)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [reduced, stage])

  const exit = useCallback(
    (target: IntroExit) => {
      if (exitedRef.current) return
      exitedRef.current = true
      const s = settingsStore.get()
      audioRef.current?.stop({ track: s.focusTrack, volume: s.focusVolume })
      onExit(target)
    },
    [onExit],
  )

  // If the intro can't be prepared, leave quietly for the board.
  useEffect(() => {
    if (failed) exit('play')
  }, [exit, failed])

  const begin = useCallback(() => {
    const audio = createIntroAudio()
    audio.start()
    audioRef.current = audio
    // Reduced motion: skip the camera moves, shake and flashes — straight to the realm's title card.
    if (reduced) timeRef.current = INTRO_TIMES.finale + 1
    setStage('playing')
  }, [reduced])

  /** Jump to the finale title card (the realm keeps animating behind it). */
  const skip = useCallback(() => {
    if (timeRef.current < INTRO_TIMES.finale) timeRef.current = INTRO_TIMES.finale - 0.01
  }, [])

  // Keyboard: Enter / Space begins, Escape skips (then leaves).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stage === 'gate' && (e.key === 'Enter' || e.key === ' ') && ready) {
        e.preventDefault()
        begin()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (stage === 'playing' && timeRef.current < INTRO_TIMES.finale) skip()
        else exit('play')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [begin, exit, ready, skip, stage])

  // Stop the score if the component goes away by other means.
  useEffect(
    () => () => {
      if (!exitedRef.current) {
        const s = settingsStore.get()
        audioRef.current?.stop({ track: s.focusTrack, volume: s.focusVolume })
      }
    },
    [],
  )

  const finale = phase === 'finale'
  const cta = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button type="button" data-intro-exit="grand" onClick={() => exit('grand')} className="cine-btn cine-btn-primary">
        <MapIcon className="size-4" /> Grand Campaign
      </button>
      <button type="button" data-intro-exit="gauntlet" onClick={() => exit('gauntlet')} className="cine-btn">
        <InfinityIcon className="size-4" /> Endless Gauntlet
      </button>
      <button type="button" data-intro-exit="play" onClick={() => exit('play')} className="cine-btn">
        <Swords className="size-4" /> To the board
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="Cinematic intro" data-intro={stage} data-phase={phase}>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 size-full ${phase === 'rift' && !reduced ? 'cine-rift-canvas' : ''}`}
        aria-hidden="true"
      />

      {stage === 'gate' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/55 px-6 text-center backdrop-blur-[2px]" data-intro-gate>
          {/* Always-visible way into the app, even before the board is ready. */}
          <button type="button" data-intro-close onClick={() => exit('play')} className="cine-btn safe-pt absolute top-3 right-3 text-xs" aria-label="Enter the app">
            Enter the app <X className="size-4" />
          </button>
          <div className="animate-cine-title font-display text-4xl font-black uppercase sm:text-6xl">Chronos Chess</div>
          <p className="max-w-md text-sm text-amber-100/80 sm:text-base">
            A quiet study game. A crack in time. A realm of obsidian and fire. <span className="text-white/60">Sound on for the full experience.</span>
          </p>
          <button
            type="button"
            data-intro-begin
            disabled={!ready}
            onClick={begin}
            className="cine-btn cine-btn-primary min-h-14 px-8 text-base disabled:opacity-50"
            autoFocus
          >
            {ready ? <Play className="size-5" fill="currentColor" /> : <Clapperboard className="size-5 animate-pulse-soft" />}
            {ready ? 'Begin the cinematic' : 'Preparing the board…'}
          </button>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <button type="button" onClick={() => exit('grand')} className="cine-link">
              Skip to the Grand Campaign
            </button>
            <span className="text-white/30">·</span>
            <button type="button" onClick={() => exit('gauntlet')} className="cine-link">
              Skip to the Gauntlet
            </button>
            <span className="text-white/30">·</span>
            <button type="button" onClick={() => exit('play')} className="cine-link">
              Skip to the board
            </button>
          </div>
        </div>
      )}

      {stage === 'playing' && (
        <>
          {/* Skip controls: always within thumb reach, clear of the notch. */}
          {!finale && (
            <div className="safe-pt absolute top-0 right-0 flex gap-2 p-3 sm:p-4">
              <button type="button" data-intro-skip onClick={skip} className="cine-btn text-xs">
                <SkipForward className="size-4" /> Skip
              </button>
            </div>
          )}
          {finale && (
            <button type="button" onClick={() => exit('play')} className="safe-pt absolute top-0 right-0 m-3 rounded-full bg-black/40 p-2 text-white/70 hover:text-white" aria-label="Close intro">
              <X className="size-5" />
            </button>
          )}

          {caption && !finale && (
            <div key={caption.key} className="animate-cine-caption pointer-events-none absolute inset-x-0 bottom-[12%] text-center font-serif text-2xl tracking-wide text-amber-50 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] sm:text-3xl" aria-live="polite">
              {caption.text}
            </div>
          )}

          {phase === 'classic' && (
            <div className="animate-cine-caption pointer-events-none absolute top-[14%] inset-x-0 text-center text-[11px] uppercase tracking-[0.5em] text-amber-100/70">A study · London, 1851</div>
          )}

          {phase === 'rift' && !reduced && <RiftHud />}

          {phase === 'realm' && (
            <div className="animate-cine-caption pointer-events-none absolute top-[14%] inset-x-0 text-center font-display text-sm uppercase tracking-[0.6em] text-orange-200 drop-shadow-[0_0_12px_rgba(255,120,40,0.9)]">
              The Chronos Realm
            </div>
          )}

          {finale && (
            <div className="safe-pb absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 px-4 pb-10 text-center" data-intro-finale>
              <div className="animate-cine-title font-display text-4xl font-black uppercase text-transparent drop-shadow-[0_0_30px_rgba(255,140,60,0.7)] sm:text-7xl" style={{ backgroundImage: 'linear-gradient(180deg,#fff6d6,#ffb347 55%,#ff5a1f)', backgroundClip: 'text', WebkitBackgroundClip: 'text' }}>
                Chronos Chess
              </div>
              <p className="max-w-lg text-sm text-orange-50/80">100 bosses. Five realms. Spells, relics and permadeath. Your move.</p>
              {cta}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Fracturing holographic UI during the rift: data panels that glitch, scramble and shatter. */
function RiftHud() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 90)
    return () => window.clearInterval(id)
  }, [])
  const scramble = (len: number, salt: number) => Array.from({ length: len }, (_, i) => HEX[(tick * 7 + i * 13 + salt * 31) % 16] ?? '0').join('')
  const integrity = Math.max(0, 99.7 - tick * 2.9).toFixed(1)
  const panels = [
    { title: 'TIMELINE INTEGRITY', value: `${integrity}%`, x: '6%', y: '18%', sx: '-60px', sy: '90px', r: '-14deg' },
    { title: 'ENGINE EVAL', value: tick % 6 < 3 ? '+0.31' : `±${scramble(3, 2)}`, x: '68%', y: '22%', sx: '70px', sy: '60px', r: '12deg' },
    { title: 'CHRONO-FLUX', value: `0x${scramble(8, 5)}`, x: '10%', y: '64%', sx: '-40px', sy: '110px', r: '20deg' },
    { title: 'REALITY ANCHOR', value: tick % 4 < 2 ? 'FAILING' : 'L0ST', x: '64%', y: '66%', sx: '50px', sy: '120px', r: '-18deg' },
  ]
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-rift-hud>
      {panels.map((p, i) => (
        <div
          key={p.title}
          className="animate-cine-shatter absolute w-44 sm:w-56"
          style={{ left: p.x, top: p.y, animationDelay: `${0.6 + i * 0.12}s`, ['--shard-x' as string]: p.sx, ['--shard-y' as string]: p.sy, ['--shard-r' as string]: p.r }}
        >
          <div className={`rounded-lg border border-cyan-300/60 bg-cyan-400/10 px-3 py-2 font-mono text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.45)] backdrop-blur-sm ${i % 2 === 0 ? 'animate-cine-glitch' : ''}`}>
            <div className="text-[9px] tracking-[0.3em] text-cyan-300/80">{p.title}</div>
            <div className="text-lg font-bold">{p.value}</div>
            <div className="truncate text-[9px] text-cyan-200/60">{scramble(24, i)}</div>
          </div>
        </div>
      ))}
      <div className="absolute inset-x-0 top-1/2 h-px animate-cine-glitch bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
    </div>
  )
}
