import { Crown, Swords, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { getLegend } from '../../data/legends'
import { rankForElo } from '../../data/titles'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import type { TournamentEntrant, TournamentMatch, TournamentState } from '../../types/rpg'
import { ROUND_NAMES, ROUND_PRIZES, YOU, championOf, currentMatch, ensureTournament, entrant } from '../../utils/tournament'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'

interface TournamentViewProps {
  onFight: (opponent: TournamentEntrant, round: number) => void
}

/**
 * Today's single-elimination bracket: you and seven legends near your rating.
 * You play your own matches; the rest are simulated from ratings.
 */
export default function TournamentView({ onFight }: TournamentViewProps) {
  const tournament = useStore(profileStore, (p) => p.tournament)
  useEffect(() => {
    profileStore.set((p) => ensureTournament(p))
  }, [])
  if (!tournament) return null
  const pending = currentMatch(tournament)
  const champion = championOf(tournament)

  return (
    <div className="space-y-4" data-tournament>
      <section className="glass flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">{tournament.date}</div>
          <div className="font-display text-lg font-extrabold text-white">
            {tournament.status === 'won' ? 'You are today’s champion!' : tournament.status === 'eliminated' ? 'Eliminated — a new bracket opens tomorrow' : pending ? `${ROUND_NAMES[pending.round]}: you vs ${pending.opponent.name}` : 'Bracket in progress'}
          </div>
          <div className="text-xs text-slate-400">
            Prizes: {ROUND_PRIZES.map((p, i) => `${ROUND_NAMES[i]} win +${p}`).join(' · ')} · rated games, 5 + 3 clock
            {tournament.coins > 0 ? ` · won today: ${tournament.coins} coins` : ''}
          </div>
        </div>
        {pending && (
          <Button variant="primary" size="lg" className="w-full sm:w-auto" data-tournament-play onClick={() => onFight(pending.opponent, pending.round)} icon={<Swords className="size-5" />}>
            Play {ROUND_NAMES[pending.round]?.toLowerCase()}
          </Button>
        )}
      </section>

      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[40rem] grid-cols-3 gap-3" role="list" aria-label="Bracket">
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex flex-col justify-around gap-3" role="listitem">
              <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{ROUND_NAMES[r]}</div>
              {(tournament.rounds[r] ?? placeholders(r)).map((m, i) => (
                <MatchCard key={`${r}-${i}`} t={tournament} match={m} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {champion && (
        <div className="glass flex items-center justify-center gap-2 rounded-2xl p-3 text-sm font-bold text-amber-200">
          <Crown className="size-5" /> Champion: {entrant(tournament, champion)?.name ?? '—'}
        </div>
      )}
    </div>
  )
}

const placeholders = (round: number): TournamentMatch[] => Array.from({ length: 4 >> round }, () => ({ a: '', b: '', winner: null }))

function MatchCard({ t, match }: { t: TournamentState; match: TournamentMatch }) {
  return (
    <div className="space-y-1 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
      <Row t={t} id={match.a} winner={match.winner} />
      <Row t={t} id={match.b} winner={match.winner} />
    </div>
  )
}

function Row({ t, id, winner }: { t: TournamentState; id: string; winner: string | null }) {
  const e = id ? entrant(t, id) : undefined
  if (!e) return <div className="h-10 rounded-xl bg-white/[0.03]" />
  const won = winner === id
  const lost = winner !== null && !won
  const legend = e.legendId ? getLegend(e.legendId) : null
  return (
    <div className={`flex h-10 items-center gap-2 rounded-xl px-1.5 text-xs ${e.id === YOU ? 'bg-accent/15' : ''} ${lost ? 'opacity-40' : ''}`}>
      {legend ? <PortraitEmblem spec={legend.portrait} label={legend.name} size="xs" /> : <Trophy className="size-4 text-accent" />}
      <span className={`min-w-0 flex-1 truncate ${won ? 'font-bold text-white' : 'text-slate-200'}`}>{e.name}</span>
      <span className="font-mono text-[10px] text-slate-400" title={rankForElo(e.elo)}>
        {e.elo}
      </span>
    </div>
  )
}
