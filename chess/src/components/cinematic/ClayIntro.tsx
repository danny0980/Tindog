// "The Board Wakes Up" — the 41 s plasticine opening film (a pre-rendered
// video; its source project lives outside the app). A gate comes first so the
// tap that starts it also unlocks sound; Skip is always in reach, and the film
// hands over to the board when it ends.
import { Play, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { IntroExit } from './CinematicIntro'

interface ClayIntroProps {
  onExit: (target: IntroExit) => void
}

const VIDEO = `${import.meta.env.BASE_URL}intro/chronos-clay.mp4`
const POSTER = `${import.meta.env.BASE_URL}intro/chronos-clay-poster.jpg`

export default function ClayIntro({ onExit }: ClayIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const exitedRef = useRef(false)
  const [stage, setStage] = useState<'gate' | 'playing'>('gate')
  const [muted, setMuted] = useState(false)
  const [canSkip, setCanSkip] = useState(false)

  const exit = useCallback(
    (target: IntroExit) => {
      if (exitedRef.current) return
      exitedRef.current = true
      videoRef.current?.pause()
      onExit(target)
    },
    [onExit],
  )

  const begin = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    setStage('playing')
    window.setTimeout(() => setCanSkip(true), 1000)
    try {
      video.muted = false
      await video.play()
    } catch {
      // Sound blocked (or the device is in silent autoplay mode): play muted rather than not at all.
      try {
        video.muted = true
        setMuted(true)
        await video.play()
      } catch {
        exit('play')
      }
    }
  }, [exit])

  // Keyboard: Enter/Space starts the film, Escape skips it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit('play')
      else if (stage === 'gate' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        void begin()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, begin, exit])

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="Opening film" data-intro="clay" data-stage={stage}>
      <video
        ref={videoRef}
        src={VIDEO}
        poster={POSTER}
        className="absolute inset-0 size-full object-contain"
        playsInline
        preload="auto"
        onEnded={() => exit('play')}
        // A missing or undecodable file never blocks the way into the game.
        onError={() => exit('play')}
        aria-hidden="true"
      />

      {stage === 'gate' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/55 px-6 text-center backdrop-blur-[2px]" data-intro-gate>
          <button type="button" data-intro-close onClick={() => exit('play')} className="cine-btn safe-pt absolute top-3 right-3 text-xs" aria-label="Enter the app">
            Enter the app <X className="size-4" />
          </button>
          <div className="animate-cine-title font-display text-4xl font-black uppercase sm:text-6xl">Chronos Chess</div>
          <p className="max-w-md text-sm text-amber-100/80 sm:text-base">
            Midnight in the study. The clock runs out — and the pieces wake up. <span className="text-white/60">Sound on.</span>
          </p>
          <button type="button" data-intro-begin onClick={() => void begin()} className="cine-btn cine-btn-primary min-h-14 px-8 text-base" autoFocus>
            <Play className="size-5" fill="currentColor" /> Wake the board
          </button>
        </div>
      )}

      {stage === 'playing' && (
        // Always within thumb reach, clear of the notch.
        <div className={`safe-pt absolute top-0 right-0 flex gap-2 p-3 transition-opacity duration-500 sm:p-4 ${canSkip ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current
              if (!video) return
              video.muted = !video.muted
              setMuted(video.muted)
            }}
            className="cine-btn text-xs"
            aria-label={muted ? 'Sound on' : 'Sound off'}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button type="button" data-intro-skip onClick={() => exit('play')} className="cine-btn text-xs">
            Skip <SkipForward className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
