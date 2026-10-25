import { BookOpen, Coins, Compass, Gift, GraduationCap, Heart, Swords, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ArtBackdrop } from '../components/fx/ArtBackdrop'
import { ArenaTab } from '../components/journey/ArenaTab'
import { CharactersTab } from '../components/journey/CharactersTab'
import { JourneyBoardGame } from '../components/journey/JourneyBoardGame'
import type { JourneyLaunch } from '../components/journey/launch'
import { LearnTab } from '../components/journey/LearnTab'
import { ProgressTab } from '../components/journey/ProgressTab'
import { RewardsTab } from '../components/journey/RewardsTab'
import { SocialTab } from '../components/journey/SocialTab'
import { StoryTab } from '../components/journey/StoryTab'
import { Bar, FrameRing, Pill } from '../components/journey/ui'
import { useStore } from '../hooks/useStore'
import { type PositionChallenge, decodeChallenge } from '../journey/challenge'
import { ensureCurrent, recordJourney } from '../journey/journeyActions'
import { journeyStore } from '../journey/journeyStore'
import { levelInfo, levelTitle, roman } from '../journey/xp'
import { profileStore } from '../stores/profileStore'
import type { JourneyTab } from '../types/ui'
import { LEVELS } from '../variants/useVariantGame'

const TABS: ReadonlyArray<{ id: JourneyTab; label: string; icon: typeof Compass }> = [
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'story', label: 'Story', icon: BookOpen },
  { id: 'characters', label: 'Characters', icon: Heart },
  { id: 'arena', label: 'Arena', icon: Swords },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
  { id: 'social', label: 'Friends', icon: Users },
  { id: 'rewards', label: 'Rewards', icon: Gift },
]

/** A position challenge from a friend's link (?challenge=…), read once. */
function linkChallenge(): PositionChallenge | null {
  if (typeof window === 'undefined') return null
  return decodeChallenge(new URLSearchParams(window.location.search).get('challenge'))
}

/** The Journey: your level, season and league, the story, the characters, new modes, learning, friends and rewards. */
export function JourneyView({ launch, tab, onTab }: { launch: JourneyLaunch; tab: JourneyTab; onTab: (t: JourneyTab) => void }) {
  const j = useStore(journeyStore, (s) => s)
  const coins = useStore(profileStore, (p) => p.coins)
  const name = useStore(profileStore, (p) => p.name)
  const info = levelInfo(j.xp)
  const [challenge, setChallenge] = useState<PositionChallenge | null>(linkChallenge)
  useEffect(() => {
    ensureCurrent()
  }, [])
  const closeChallenge = () => {
    setChallenge(null)
    if (window.location.search.includes('challenge=')) window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  }

  if (challenge) {
    const side = challenge.fen.split(' ')[1] === 'b' ? 'b' : 'w'
    return (
      <div className="safe-px mx-auto w-full max-w-6xl flex-1 pb-4">
        <JourneyBoardGame
          id="friend-challenge"
          title={`${challenge.from}’s challenge`}
          subtitle={`${challenge.from} ${challenge.note}. Can you win it too?`}
          setup={{ variant: 'battle', rules: { fen: challenge.fen, objective: { kind: 'material', at: 9999 }, events: [] } }}
          color={side}
          onLeave={closeChallenge}
          onResult={(r, me, level) => {
            const won = r.winner === me
            recordJourney({ outcome: r.winner === null ? 'draw' : won ? 'win' : 'loss', opponentElo: LEVELS[level].rating })
            return won ? `You beat ${challenge.from}’s position! Send them one back from the Friends tab.` : 'Not this time — try again?'
          }}
        />
      </div>
    )
  }

  return (
    <div className="safe-px mx-auto w-full max-w-6xl flex-1 space-y-4 pb-4" data-journey={tab}>
      <ArtBackdrop slot="realm" fixed opacity={0.18} />
      <header className="glass flex flex-wrap items-center gap-3 rounded-3xl p-3 sm:p-4">
        <FrameRing>
          <span className="flex size-12 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-ink-950">
            <span className="text-[8px] font-black tracking-widest uppercase">Lvl</span>
            <span className="font-display text-lg leading-none font-black">{info.level}</span>
          </span>
        </FrameRing>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="truncate font-display text-lg font-extrabold tracking-wider text-white sm:text-2xl">{name}</h1>
            <Pill tone="gold">{levelTitle(info.level).name}</Pill>
            {j.prestige > 0 && <Pill tone="gold">Prestige {roman(j.prestige)}</Pill>}
          </div>
          <Bar value={info.fraction} className="mt-1.5 max-w-sm" label="Level progress" />
        </div>
        <div className="flex items-center gap-1 font-mono text-lg font-bold text-yellow-300">
          <Coins className="size-5" /> {coins}
        </div>
      </header>
      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Journey">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            data-journey-tab={t.id}
            className={`flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-semibold transition pointer-coarse:min-h-11 ${tab === t.id ? 'bg-gradient-to-br from-accent to-accent-2 text-ink-950' : 'glass text-slate-300 hover:text-white'}`}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </nav>
      {tab === 'progress' && <ProgressTab />}
      {tab === 'story' && <StoryTab launch={launch} />}
      {tab === 'characters' && <CharactersTab launch={launch} />}
      {tab === 'arena' && <ArenaTab launch={launch} />}
      {tab === 'learn' && <LearnTab launch={launch} />}
      {tab === 'social' && <SocialTab launch={launch} />}
      {tab === 'rewards' && <RewardsTab />}
    </div>
  )
}
