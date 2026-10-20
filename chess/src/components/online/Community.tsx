import { Activity, Crown, EyeOff, Gamepad2, Globe2, Layers, Loader2, Medal, RefreshCw, Shield, Swords, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { useStore } from '../../hooks/useStore'
import { type PlayerRow, type RatedModeId, api } from '../../online/ranked/api'
import { closeProfile, openProfile, profileTarget } from '../../online/ranked/profileTarget'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

type Board = 'chess' | RatedModeId
const BOARDS: ReadonlyArray<{ id: Board; label: string; icon: typeof Swords }> = [
  { id: 'chess', label: 'Ranked', icon: Swords },
  { id: 'vanish', label: 'Vanishing', icon: EyeOff },
  { id: 'cards', label: 'Card Chess', icon: Layers },
  { id: 'royale', label: 'Royale', icon: Crown },
]
const MODE_NAME: Record<Board, string> = { chess: 'Ranked', vanish: 'Vanishing', cards: 'Card Chess', royale: 'Battle Royale' }
const TIER_NAME: Record<string, string> = { legend: 'Legend', diamond: 'Diamond', platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' }
const date = (ms: number | null): string => (ms ? new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '')
const num = (n: number): string => n.toLocaleString()

/** A player's name; when the server gave their id, it opens their profile. */
export function PlayerName({ player, className = '' }: { player: Pick<PlayerRow, 'id' | 'name'>; className?: string }) {
  if (!player.id) return <span className={className}>{player.name}</span>
  const id = player.id
  return (
    <button type="button" onClick={() => openProfile(id)} className={`truncate text-left underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none ${className}`} data-player-link={id}>
      {player.name}
    </button>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400">
        <Icon className="size-3" /> {label}
      </div>
      <div className="font-mono text-lg font-bold text-white">{value}</div>
    </div>
  )
}

/** The whole community at a glance: numbers, the best players in each mode, the champions and the clans. */
export function CommunityTab() {
  const { data, error, reload } = useApi(api.community)
  const [board, setBoard] = useState<Board>('chess')
  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-200" role="alert" data-community="error">
        <span className="flex-1">{error}</span>
        <Button size="sm" onClick={reload} icon={<RefreshCw className="size-3.5" />}>
          Retry
        </Button>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400" data-community="loading">
        <Loader2 className="size-4 animate-spin" /> Loading the community…
      </div>
    )
  }
  const s = data.stats
  const top = data.top[board] ?? []
  const week = s.weekByMode
  const weekTotal = week.chess + week.vanish + week.cards + week.royale
  return (
    <div className="space-y-4" data-community="ready">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat icon={Activity} label="Online now" value={num(data.live.online)} />
        <Stat icon={Gamepad2} label="Games live" value={num(data.live.games + data.live.modes.cards + data.live.modes.royale)} />
        <Stat icon={Users} label="Active this week" value={num(s.activeThisWeek)} />
        <Stat icon={Globe2} label="Players" value={num(s.players)} />
        <Stat icon={Swords} label="Games played" value={num(s.games)} />
        <Stat icon={Shield} label="Clans" value={num(s.clans)} />
      </div>
      {weekTotal > 0 && (
        <div className="space-y-1" data-community-week>
          <div className="text-[11px] text-slate-400">
            {num(weekTotal)} games this week · {num(s.gamesToday)} today
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-white/5" role="img" aria-label={`This week: ${week.chess} ranked, ${week.vanish} Vanishing, ${week.cards} Card Chess, ${week.royale} Battle Royale`}>
            <span className="bg-sky-400" style={{ width: `${(week.chess / weekTotal) * 100}%` }} />
            <span className="bg-fuchsia-400" style={{ width: `${(week.vanish / weekTotal) * 100}%` }} />
            <span className="bg-amber-400" style={{ width: `${(week.cards / weekTotal) * 100}%` }} />
            <span className="bg-emerald-400" style={{ width: `${(week.royale / weekTotal) * 100}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-400">
            <span className="text-sky-300">● Ranked {week.chess}</span>
            <span className="text-fuchsia-300">● Vanishing {week.vanish}</span>
            <span className="text-amber-300">● Card Chess {week.cards}</span>
            <span className="text-emerald-300">● Royale {week.royale}</span>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
          <Medal className="size-3.5" /> Top players
        </h4>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label="Leaderboard">
          {BOARDS.map((b) => (
            <button key={b.id} type="button" role="tab" aria-selected={board === b.id} onClick={() => setBoard(b.id)} className={`rounded-lg px-1 py-1 text-[11px] font-semibold ${board === b.id ? 'bg-sky-400/20 text-white' : 'text-slate-400'}`} data-community-board={b.id}>
              {b.label}
            </button>
          ))}
        </div>
        {top.length === 0 ? (
          <p className="text-xs text-slate-400">No rated {MODE_NAME[board]} games yet. Be the first on the board!</p>
        ) : (
          <ol className="space-y-1" data-community-top>
            {top.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1 text-xs">
                <span className={`w-5 text-right font-mono ${i < 3 ? 'text-amber-300' : 'text-slate-500'}`}>{i + 1}</span>
                <PlayerName player={p} className="min-w-0 flex-1 text-slate-200" />
                <span className="font-mono text-white">{p.rating}</span>
                <span className="w-14 text-right text-[10px] text-slate-500">{p.games} games</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">
            <Trophy className="size-3.5" /> Hall of champions
          </h4>
          {data.champions.length === 0 ? (
            <p className="text-xs text-slate-400">No Weekly Knockout has finished yet.</p>
          ) : (
            <ul className="space-y-1" data-community-champions>
              {data.champions.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-xs">
                  <Crown className="size-3.5 shrink-0 text-amber-300" />
                  {c.champion ? <PlayerName player={c.champion} className="min-w-0 flex-1 text-white" /> : <span className="flex-1 text-slate-500">—</span>}
                  <span className="text-[10px] text-slate-500">
                    {date(c.finishedAt)} · {c.players} players
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.titles.length > 0 && (
            <p className="text-[11px] text-slate-400" data-community-titles>
              Most titles:{' '}
              {data.titles.slice(0, 3).map((t, i) => (
                <span key={t.player.id ?? i}>
                  {i > 0 && ', '}
                  <PlayerName player={t.player} className="inline text-slate-200" /> ({t.titles})
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
            <Shield className="size-3.5" /> Clan war this week
          </h4>
          {data.clans.length === 0 ? (
            <p className="text-xs text-slate-400">No clans yet: found one in the Clans tab.</p>
          ) : (
            <ol className="space-y-1" data-community-clans>
              {data.clans.slice(0, 5).map((c, i) => (
                <li key={c.id} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-right font-mono text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">
                    [{c.tag}] {c.name}
                  </span>
                  <span className="font-mono text-white">{c.points}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

/** The public profile window, opened from any player name (mounted once, on the Online screen). */
export function PlayerProfileHost() {
  const id = useStore(profileTarget, (t) => t)
  if (!id) return null
  return <PlayerProfileModal key={id} id={id} />
}

function PlayerProfileModal({ id }: { id: string }) {
  const { data, error, reload } = useApi(() => api.player(id), id)
  return (
    <Modal open title={data ? data.name : 'Player'} onClose={closeProfile} size="md">
      <div className="space-y-4 py-2 text-sm" data-player-profile={id}>
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-200" role="alert">
            <span className="flex-1">{error}</span>
            <Button size="sm" onClick={reload} icon={<RefreshCw className="size-3.5" />}>
              Retry
            </Button>
          </div>
        )}
        {!data && !error && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="size-4 animate-spin" /> Loading the profile…
          </div>
        )}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className={`size-2 rounded-full ${data.online ? 'bg-emerald-400' : 'bg-slate-600'}`} aria-hidden="true" />
              {data.online ? 'Online now' : 'Offline'} · member since {date(data.memberSince)}
              {data.clan && (
                <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-slate-200">
                  [{data.clan.tag}] {data.clan.name}
                </span>
              )}
              {data.titles.length > 0 && (
                <span className="flex items-center gap-1 rounded-md bg-amber-300/15 px-1.5 py-0.5 text-amber-200" data-profile-titles>
                  <Crown className="size-3" /> {data.titles.length} Weekly Knockout title{data.titles.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-profile-ratings>
              <Stat icon={Swords} label={`Ranked · ${TIER_NAME[data.tier] ?? data.tier}`} value={String(data.rating)} />
              <Stat icon={EyeOff} label="Vanishing" value={String(data.modes.vanish.rating)} />
              <Stat icon={Layers} label="Card Chess" value={String(data.modes.cards.rating)} />
              <Stat icon={Crown} label="Royale" value={String(data.modes.royale.rating)} />
            </div>
            <div className="text-xs text-slate-300">
              Ranked record: {data.record.wins}W · {data.record.losses}L · {data.record.draws}D
              {data.season.rank && ` · #${data.season.rank} this season`}
              {data.season.row && ` (peak ${data.season.row.peak})`}
            </div>
            {data.season.history.length > 0 && (
              <div className="flex flex-wrap gap-1 text-[11px]" data-profile-seasons>
                {data.season.history.map((h) => (
                  <span key={h.season} className="rounded-md bg-white/5 px-1.5 py-0.5 text-slate-300">
                    {h.season}: {TIER_NAME[h.tier] ?? h.tier} #{h.rank}
                  </span>
                ))}
              </div>
            )}
            <div>
              <h4 className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Recent games</h4>
              {data.recent.length === 0 ? (
                <p className="text-xs text-slate-500">No online games yet.</p>
              ) : (
                <ul className="space-y-1 text-xs" data-profile-recent>
                  {data.recent.map((g, i) => (
                    <li key={`${g.endedAt}-${i}`} className="flex items-center gap-2">
                      <span className={`w-12 font-semibold ${g.result === 'win' ? 'text-emerald-300' : g.result === 'loss' ? 'text-red-300' : 'text-slate-400'}`}>{g.result === 'win' ? 'Won' : g.result === 'loss' ? 'Lost' : g.result === 'draw' ? 'Draw' : 'Aborted'}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-300">
                        {MODE_NAME[g.kind === 'chess' ? 'chess' : g.kind]} vs {g.opponent}
                      </span>
                      <span className="text-[10px] text-slate-500">{date(g.endedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
