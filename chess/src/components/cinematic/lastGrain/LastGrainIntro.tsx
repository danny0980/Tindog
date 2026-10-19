// "The Last Grain" — the 15 s startup film, and the live menu it hands off to.
//
// Hybrid route: a three.js scene draws the world (board, pieces, light,
// particles), React owns the clock and the DOM layer on top (title, glass
// menu, mode chips). Both are pure functions of film time, so Skip, a hidden
// tab or a frame capture always land on exactly the right frame. Sound waits
// for the first tap (browsers keep audio locked until then); after one second
// the film can be skipped; the last frame *is* the interactive menu, so there
// is nothing to cut to.
import { Crown, Infinity as InfinityIcon, Map as MapIcon, SkipForward } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { audioEngine, haptic } from '../../../audio'
import { settingsStore } from '../../../stores/settingsStore'
import type { IntroExit } from '../CinematicIntro'
import { type LastGrainAudio, createLastGrainAudio } from './audio'
import { type OverlayState, overlayAt } from './overlay'
import type { Quality } from './particles'
import { sampleTitle } from './sampleTitle'
import { LastGrainScene } from './scene'
import { FILM_LENGTH, T, TAGLINE, TITLE, type Cue, cuesBetween } from './timeline'
import './lastGrain.css'

interface LastGrainIntroProps {
  /** Called the moment a mode is chosen: the app switches to it underneath the film. */
  onExit: (target: IntroExit) => void
  /** Called once the film has dissolved away and can be unmounted. */
  onDone: () => void
}

/** How long the film's last frame takes to dissolve over the chosen screen (matches lastGrain.css). */
const EXIT_MS = 650

const TITLE_FONT_FAMILY = "'Cinzel', 'Trajan Pro', 'Times New Roman', serif"

const CHIPS: ReadonlyArray<{ id: IntroExit; label: string; detail: string; Icon: typeof Crown }> = [
  { id: 'classic', label: 'Classic Chess', detail: '100 rivals · pure chess', Icon: Crown },
  { id: 'grand', label: 'Grand Campaign', detail: 'Five realms through time', Icon: MapIcon },
  { id: 'gauntlet', label: 'Endless Gauntlet', detail: 'How long can you last?', Icon: InfinityIcon },
]

const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function pickQuality(): Quality {
  if (settingsStore.get().batterySaver) return 'low'
  const nav = navigator as Navigator & { deviceMemory?: number }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.screen.width, window.screen.height) < 820
  if ((nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4 || (coarse && small)) return 'low'
  return 'high'
}

/** Haptics ride on the film's big beats. */
function feel(cue: Cue): void {
  if (cue.kind === 'impact') haptic('move')
  else if (cue.kind === 'flare') haptic('capture')
  else if (cue.kind === 'lock') haptic('check')
}

interface Layers {
  root: HTMLDivElement | null
  canvas: HTMLCanvasElement | null
  title: HTMLDivElement | null
  letters: Array<HTMLSpanElement | null>
  shine: HTMLDivElement | null
  tagline: HTMLDivElement | null
  ray: HTMLDivElement | null
  glass: HTMLDivElement | null
  chips: Array<HTMLButtonElement | null>
  tap: HTMLButtonElement | null
  skip: HTMLButtonElement | null
}

/** Applies the overlay state to the DOM (no React re-render per frame). */
function paint(l: Layers, s: OverlayState): void {
  s.letters.forEach((letter, i) => {
    const el = l.letters[i]
    if (!el) return
    el.style.opacity = letter.opacity.toFixed(3)
    el.style.setProperty('--lg-glow', letter.glow.toFixed(3))
  })
  if (l.title) l.title.style.transform = `translate(-50%, calc(-50% - ${(s.title.lift * 21).toFixed(2)}vh)) scale(${s.title.scale.toFixed(4)})`
  if (l.shine) {
    l.shine.style.setProperty('--lg-sweep', `${(160 - s.sweep.at * 220).toFixed(1)}%`)
    l.shine.style.opacity = s.sweep.strength.toFixed(3)
  }
  if (l.tagline) {
    l.tagline.style.opacity = s.tagline.opacity.toFixed(3)
    l.tagline.style.letterSpacing = `${s.tagline.tracking.toFixed(3)}em`
  }
  if (l.ray) {
    l.ray.style.opacity = s.ray.opacity.toFixed(3)
    l.ray.style.transform = `translate(-50%, -50%) scaleX(${s.ray.width.toFixed(4)})`
  }
  if (l.glass) l.glass.style.opacity = s.glass.toFixed(3)
  if (l.canvas) l.canvas.style.filter = s.worldBlur > 0.05 ? `blur(${s.worldBlur.toFixed(2)}px) saturate(1.15)` : ''
  s.chips.forEach((chip, i) => {
    const el = l.chips[i]
    if (!el) return
    el.style.opacity = chip.opacity.toFixed(3)
    el.style.transform = `translateY(${(chip.rise * 46).toFixed(1)}px)`
    el.style.pointerEvents = chip.opacity > 0.5 ? 'auto' : 'none'
    el.tabIndex = chip.opacity > 0.5 ? 0 : -1
  })
  if (l.tap) {
    l.tap.style.opacity = s.tap.toFixed(3)
    l.tap.style.pointerEvents = s.tap > 0.5 ? 'auto' : 'none'
    l.tap.tabIndex = s.tap > 0.5 ? 0 : -1
  }
  if (l.skip) {
    l.skip.style.opacity = s.skip ? '1' : '0'
    l.skip.style.pointerEvents = s.skip ? 'auto' : 'none'
    l.skip.tabIndex = s.skip ? 0 : -1
  }
  if (l.root) l.root.dataset['live'] = s.live ? 'true' : 'false'
}

interface DevHandle {
  seek: (t: number) => void
  play: () => void
  time: () => number
}

export default function LastGrainIntro({ onExit, onDone }: LastGrainIntroProps) {
  const [reduced] = useState(prefersReducedMotion)
  // Audio stays locked until a tap; if it's already running (a replay) the film starts at once.
  const [stage, setStage] = useState<'gate' | 'playing'>(() => (reduced || audioEngine.context?.state === 'running' ? 'playing' : 'gate'))
  const timeRef = useRef(reduced ? FILM_LENGTH : 0)
  const pausedRef = useRef(false)
  const exitingRef = useRef(false)
  const sceneRef = useRef<LastGrainScene | null>(null)
  const audioRef = useRef<LastGrainAudio | null>(null)
  const layers = useRef<Layers>({ root: null, canvas: null, title: null, letters: [], shine: null, tagline: null, ray: null, glass: null, chips: [], tap: null, skip: null })

  const draw = useCallback((t: number) => {
    sceneRef.current?.render(t)
    paint(layers.current, overlayAt(t))
  }, [])

  // The WebGL world: built once; if WebGL is missing or lost, the CSS world shows instead.
  useEffect(() => {
    const { canvas, root } = layers.current
    if (!canvas || !root) return
    let disposed = false
    const fallback = () => {
      root.dataset['fallback'] = 'true'
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
    const quality = pickQuality()
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1.25)

    // The title grains home onto the real DOM letters, so sample them once the font is in.
    const resample = () => {
      const scene = sceneRef.current
      if (!scene) return
      const rootBox = root.getBoundingClientRect()
      const boxes = layers.current.letters.flatMap((el, i) => {
        if (!el) return []
        const r = el.getBoundingClientRect()
        return [{ char: TITLE[i] ?? '', left: r.left - rootBox.left, top: r.top - rootBox.top, width: r.width, height: r.height }]
      })
      const first = layers.current.letters[0]
      const size = first ? getComputedStyle(first).fontSize : '96px'
      scene.setTitleTargets(sampleTitle(boxes, `900 ${size} ${TITLE_FONT_FAMILY}`, scene.titleParticleCount))
    }
    const resize = () => {
      sceneRef.current?.setSize(root.clientWidth, root.clientHeight, dpr)
      // Targets are measured with the title at rest (before the menu lifts it).
      if (timeRef.current < T.menu) resample()
      draw(timeRef.current)
    }

    try {
      sceneRef.current = new LastGrainScene({ canvas, quality, onContextLost: fallback })
    } catch {
      fallback()
    }
    resize()
    void document.fonts?.load(`900 64px ${TITLE_FONT_FAMILY}`).then(() => {
      if (!disposed && timeRef.current < T.menu) resample()
    })

    const observer = new ResizeObserver(resize)
    observer.observe(root)
    return () => {
      disposed = true
      observer.disconnect()
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [draw])

  // The clock.
  useEffect(() => {
    if (stage !== 'playing') {
      draw(0)
      return
    }
    const audio = (audioRef.current ??= createLastGrainAudio())
    if (!reduced && timeRef.current < FILM_LENGTH) audio.start(() => timeRef.current)
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      // A long gap (tab hidden, slow frame) never jumps the film: at most 0.1 s per frame.
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (pausedRef.current) return
      const prev = timeRef.current
      const next = reduced ? prev : prev + dt
      timeRef.current = next
      for (const cue of cuesBetween(prev, next)) feel(cue)
      draw(next)
    }
    raf = requestAnimationFrame(tick)
    const onVisibility = () => {
      if (document.hidden) audio.pause()
      else if (!reduced && timeRef.current < FILM_LENGTH) audio.start(() => timeRef.current)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [stage, reduced, draw])

  const begin = useCallback((from: number) => {
    // This tap is the user gesture that unlocks sound.
    audioEngine.unlock()
    timeRef.current = from
    setStage('playing')
  }, [])

  const skip = useCallback(() => {
    if (timeRef.current >= T.skipTo) return
    timeRef.current = T.skipTo
    audioRef.current?.start(() => timeRef.current)
    draw(T.skipTo)
  }, [draw])

  const exit = useCallback(
    (target: IntroExit) => {
      if (exitingRef.current) return
      exitingRef.current = true
      const s = settingsStore.get()
      audioRef.current?.stop({ track: s.focusTrack, volume: s.focusVolume })
      onExit(target)
      // The world keeps moving while it dissolves away over the new screen.
      const root = layers.current.root
      if (root) root.dataset['exiting'] = 'true'
      window.setTimeout(onDone, reduced ? 0 : EXIT_MS)
    },
    [onExit, onDone, reduced],
  )

  // Leaving by any route always hands the sound back.
  useEffect(
    () => () => {
      if (exitingRef.current) return
      const s = settingsStore.get()
      audioRef.current?.stop({ track: s.focusTrack, volume: s.focusVolume })
    },
    [],
  )

  // Keyboard: Enter/Space begins; Escape skips, then leaves; Enter on the menu begins the game.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const onButton = e.target instanceof HTMLButtonElement
      if (stage === 'gate') {
        if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
          e.preventDefault()
          begin(0)
        } else if (e.key === 'Escape') begin(T.skipTo)
        return
      }
      if (e.key === 'Escape') {
        if (timeRef.current < T.skipTo) skip()
        else exit('play')
      } else if ((e.key === 'Enter' || e.key === ' ') && !onButton && timeRef.current >= T.tapToBegin) {
        e.preventDefault()
        exit('play')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, begin, skip, exit])

  // Development hook for frame-accurate review and capture: window.__lastGrain.seek(7.0).
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const handle: DevHandle = {
      seek: (t) => {
        pausedRef.current = true
        timeRef.current = t
        draw(t)
      },
      play: () => {
        pausedRef.current = false
      },
      time: () => timeRef.current,
    }
    const host = window as unknown as { __lastGrain?: DevHandle }
    host.__lastGrain = handle
    return () => {
      delete host.__lastGrain
    }
  }, [draw])

  return (
    <div
      ref={(el) => {
        layers.current.root = el
      }}
      className="lg-root fixed inset-0 z-[80] isolate overflow-hidden bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Chronos Chess — The Last Grain"
      data-intro="last-grain"
      data-stage={stage}
      onClick={(e) => {
        // "Tap to begin": anywhere on the live menu that isn't a chip.
        if (stage === 'playing' && timeRef.current >= T.tapToBegin && !(e.target instanceof Element && e.target.closest('button'))) exit('play')
      }}
    >
      <div className="lg-fallback" aria-hidden="true" />
      <canvas
        ref={(el) => {
          layers.current.canvas = el
        }}
        className="lg-canvas"
        aria-hidden="true"
      />

      <div
        ref={(el) => {
          layers.current.glass = el
        }}
        className="lg-glass"
        style={{ opacity: 0 }}
        aria-hidden="true"
      />

      {/* Title: the grains assemble into these exact letters. */}
      <div
        ref={(el) => {
          layers.current.title = el
        }}
        className="lg-title"
      >
        <h1 className="lg-word" aria-label="Chronos">
          {Array.from(TITLE, (ch, i) => (
            <span
              key={i}
              ref={(el) => {
                layers.current.letters[i] = el
              }}
              className="lg-letter"
              style={{ opacity: 0 }}
              aria-hidden="true"
            >
              {ch}
            </span>
          ))}
          <div
            ref={(el) => {
              layers.current.shine = el
            }}
            className="lg-shine"
            style={{ opacity: 0 }}
            aria-hidden="true"
          >
            {TITLE}
          </div>
        </h1>
        <div
          ref={(el) => {
            layers.current.ray = el
          }}
          className="lg-ray"
          style={{ opacity: 0 }}
          aria-hidden="true"
        />
        <div
          ref={(el) => {
            layers.current.tagline = el
          }}
          className="lg-tagline"
          style={{ opacity: 0 }}
        >
          {TAGLINE}
        </div>
      </div>

      {/* The live menu. */}
      <nav className="lg-chips" aria-label="Choose a mode">
        {CHIPS.map(({ id, label, detail, Icon }, i) => (
          <button
            key={id}
            type="button"
            ref={(el) => {
              layers.current.chips[i] = el
            }}
            className="lg-chip"
            style={{ opacity: 0, pointerEvents: 'none' }}
            tabIndex={-1}
            data-intro-exit={id}
            onClick={() => exit(id)}
          >
            <span className="lg-chip-icon">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block font-display text-sm font-extrabold tracking-wide text-white sm:text-base">{label}</span>
              <span className="block text-[11px] text-amber-100/70 sm:text-xs">{detail}</span>
            </span>
          </button>
        ))}
      </nav>
      <button
        type="button"
        ref={(el) => {
          layers.current.tap = el
        }}
        className="lg-tap"
        style={{ opacity: 0, pointerEvents: 'none' }}
        tabIndex={-1}
        data-intro-exit="play"
        onClick={() => exit('play')}
      >
        Tap to begin
      </button>

      <button
        type="button"
        ref={(el) => {
          layers.current.skip = el
        }}
        className="lg-skip"
        style={{ opacity: 0, pointerEvents: 'none' }}
        tabIndex={-1}
        onClick={skip}
        data-intro-skip
      >
        Skip <SkipForward className="size-4" />
      </button>

      {stage === 'gate' && (
        <div className="lg-gate" data-intro-gate>
          <button type="button" className="lg-gate-touch" onClick={() => begin(0)} autoFocus>
            <span className="lg-gate-grain" aria-hidden="true" />
            <span className="lg-gate-title">Chronos Chess</span>
            <span className="lg-gate-hint">Touch to awaken time</span>
          </button>
          <button type="button" className="lg-gate-skip" onClick={() => begin(T.skipTo)}>
            Skip intro
          </button>
        </div>
      )}
    </div>
  )
}
