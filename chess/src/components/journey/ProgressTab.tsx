import { ArrowDown, ArrowUp, Check, Crown, Gift, Lock, Medal, Sparkles, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { assetUrl } from '../../assets/artManifest'
import { getClassic } from '../../data/classic/roster'
import { useStore } from '../../hooks/useStore'
import { claimPassTier, doPrestige, ensureCurrent, learnSkill } from '../../journey/journeyActions'
import { journeyStore } from '../../journey/journeyStore'
import { LEAGUE_INFO, LEAGUE_SIZE, PROMOTE, DEMOTE, moveFor, standings, weekProgress } from '../../journey/league'
import { canPrestige } from '../../journey/progress'
import { PASS_TIERS, XP_PER_TIER, passReward, passRewardLabel, seasonFor, tiersReached } from '../../journey/season'
import { SKILLS, SKILL_BRANCHES, type SkillBranch, canLearn, skillPoints, spentPoints } from '../../journey/skills'
import { LEVEL_TITLES, MAX_PRESTIGE, PRESTIGE_COINS, PRESTIGE_ELO, levelInfo, levelTitle, nextLevelTitle, roman } from '../../journey/xp'
import { profileStore } from '../../stores/profileStore'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Bar, Card, ClassicFace, FrameRing, Pill, Stat } from './ui'

/** Level, prestige, the season pass, the weekly league and the skill tree. */
export function ProgressTab() {
  const j = useStore(journeyStore, (s) => s)
  const name = useStore(profileStore, (p) => p.name)
  useEffect(() => {
    ensureCurrent()
  }, [])
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LevelCard />
      <LeagueCard name={name} />
      <SeasonPass />
      <SkillTree key={j.prestige} />
    </div>
  )
}

function LevelCard() {
  const j = useStore(journeyStore, (s) => s)
  const info = levelInfo(j.xp)
  const title = levelTitle(info.level)
  const next = nextLevelTitle(info.level)
  const [confirm, setConfirm] = useState(false)
  return (
    <Card title="Your level" icon={<Crown className="size-4" />} data-journey-level={String(info.level)}>
      <div className="flex items-center gap-4">
        <FrameRing>
          <span className="flex size-16 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-ink-950">
            <span className="text-[9px] font-black tracking-widest uppercase">Level</span>
            <span className="font-display text-2xl leading-none font-black">{info.level}</span>
          </span>
        </FrameRing>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-display text-lg font-extrabold text-white">{title.name}</span>
            {j.prestige > 0 && (
              <Pill tone="gold">
                <Crown className="size-3" /> Prestige {roman(j.prestige)}
              </Pill>
            )}
          </div>
          <Bar value={info.fraction} className="mt-2" label="Level progress" />
          <div className="mt-1 text-xs text-slate-400">
            {info.maxed ? 'Maximum level reached!' : `${info.into} / ${info.need} XP to level ${info.level + 1}`}
            {next && !info.maxed ? ` · “${next.name}” at level ${next.level}` : ''}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Total XP" value={j.totalXp.toLocaleString()} />
        <Stat label="Titles" value={`${LEVEL_TITLES.filter((t) => j.prestige > 0 || info.level >= t.level).length}/${LEVEL_TITLES.length}`} />
        <Stat label="Crowns" value={`${j.prestige}/${MAX_PRESTIGE}`} />
      </div>
      {canPrestige(j) ? (
        <Button variant="primary" className="mt-3 w-full" icon={<Crown className="size-4" />} onClick={() => setConfirm(true)} data-prestige>
          Prestige: start again with a crown
        </Button>
      ) : (
        <p className="mt-3 text-xs text-slate-500">At level 50 you can prestige: back to level 1 with a crown, {PRESTIGE_COINS} coins and opponents {PRESTIGE_ELO} Elo stronger per crown.</p>
      )}
      <ConfirmDialog
        open={confirm}
        title={`Prestige ${roman(j.prestige + 1)}?`}
        message={`You go back to level 1 and your skill points are refunded. You keep your titles, frames and coins, gain ${PRESTIGE_COINS} coins, and the characters play ${PRESTIGE_ELO} Elo stronger.`}
        confirmLabel="Prestige"
        confirmVariant="primary"
        onConfirm={() => {
          setConfirm(false)
          doPrestige()
        }}
        onCancel={() => setConfirm(false)}
      />
    </Card>
  )
}

function SeasonPass() {
  const j = useStore(journeyStore, (s) => s)
  const season = seasonFor()
  const reached = tiersReached(j.season.xp)
  const into = j.season.xp - reached * XP_PER_TIER
  const tiers = Array.from({ length: PASS_TIERS }, (_, i) => i + 1)
  const claimable = tiers.filter((t) => t <= reached && !j.season.claimed.includes(t))
  return (
    <Card className="relative overflow-hidden lg:col-span-2" data-season={season.id}>
      <img src={assetUrl(season.theme.backdrop)} alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-25" onError={(e) => (e.currentTarget.style.display = 'none')} />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/80 to-ink-950/50" aria-hidden="true" />
      <div className="relative">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-[0.25em] uppercase" style={{ color: season.theme.to }}>
              Season {season.number} · {season.daysLeft} day{season.daysLeft === 1 ? '' : 's'} left
            </div>
            <h3 className="font-display text-xl font-extrabold text-white sm:text-2xl">{season.theme.name}</h3>
            <p className="text-xs text-slate-300">{season.theme.tagline} Games against the season’s era earn +50% XP.</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl font-black text-white">
              {reached}
              <span className="text-sm text-slate-400">/{PASS_TIERS}</span>
            </div>
            <div className="text-[10px] tracking-wider text-slate-400 uppercase">Pass tier</div>
          </div>
        </div>
        <Bar value={reached >= PASS_TIERS ? 1 : into / XP_PER_TIER} className="mt-3" color={`linear-gradient(90deg, ${season.theme.from}, ${season.theme.to})`} label="Season pass progress" />
        <div className="mt-1 text-[11px] text-slate-400">{reached >= PASS_TIERS ? 'Pass complete — champion of the season!' : `${into} / ${XP_PER_TIER} XP to tier ${reached + 1}`}</div>
        {claimable.length > 0 && (
          <Button variant="primary" size="sm" className="mt-3" icon={<Gift className="size-4" />} onClick={() => claimable.forEach((t) => claimPassTier(t))} data-pass-claim-all>
            Claim {claimable.length} reward{claimable.length === 1 ? '' : 's'}
          </Button>
        )}
        <div className="-mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-2" aria-label="Season pass tiers">
          {tiers.map((t) => {
            const r = passReward(season.index, t)
            const got = j.season.claimed.includes(t)
            const ready = t <= reached && !got
            const big = r.kind !== 'coins' && r.kind !== 'potion'
            return (
              <button
                key={t}
                type="button"
                disabled={!ready}
                onClick={() => claimPassTier(t)}
                data-pass-tier={t}
                className={`flex w-20 shrink-0 snap-start flex-col items-center gap-1 rounded-2xl border p-2 text-center transition ${
                  ready ? 'animate-pulse-soft border-amber-300 bg-amber-300/15' : got ? 'border-emerald-300/40 bg-emerald-400/10' : 'border-white/10 bg-black/30'
                } ${big ? 'ring-1 ring-amber-300/40' : ''}`}
              >
                <span className="text-[10px] font-bold text-slate-400">Tier {t}</span>
                <span className={`flex size-8 items-center justify-center rounded-xl ${big ? 'bg-gradient-to-br from-amber-300 to-orange-500 text-ink-950' : 'bg-white/10 text-white'}`}>
                  {got ? <Check className="size-4" /> : t > reached ? <Lock className="size-3.5 opacity-60" /> : big ? <Sparkles className="size-4" /> : <Gift className="size-4" />}
                </span>
                <span className="line-clamp-2 text-[10px] leading-tight text-slate-200">{passRewardLabel(r)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function LeagueCard({ name }: { name: string }) {
  const j = useStore(journeyStore, (s) => s)
  const progress = weekProgress()
  const table = useMemo(() => standings(j.league.week, j.league.tier, j.league.points, name, progress), [j.league.points, j.league.tier, j.league.week, name, progress])
  const myRank = table.findIndex((r) => r.you) + 1
  const info = LEAGUE_INFO[j.league.tier]
  const daysLeft = Math.max(1, Math.ceil((1 - progress) * 7))
  const zone = moveFor(j.league.tier, myRank)
  const [all, setAll] = useState(false)
  const shown = all ? table : table.filter((_, i) => i < 5 || Math.abs(i + 1 - myRank) <= 2 || i >= LEAGUE_SIZE - 2)
  const last = j.leagueHistory[j.leagueHistory.length - 1]
  return (
    <Card title={info.name} icon={<Trophy className="size-4" style={{ color: info.color }} />} data-league={j.league.tier} action={<Pill tone={zone === 'up' ? 'green' : zone === 'down' ? 'red' : 'slate'}>#{myRank} · {daysLeft}d left</Pill>}>
      <p className="mb-2 text-xs text-slate-400">
        This week you race 19 characters from history for league points (the XP you earn). Top {PROMOTE} move up, bottom {DEMOTE} move down.
        {last ? ` Last week: #${last.rank} in ${LEAGUE_INFO[last.tier].name}${last.move === 'up' ? ' — promoted!' : last.move === 'down' ? ' — relegated.' : '.'}` : ''}
      </p>
      <ol className="space-y-1" aria-label="League table">
        {shown.map((r) => {
          const rank = table.indexOf(r) + 1
          const c = r.classicId ? getClassic(r.classicId) : null
          const z = moveFor(j.league.tier, rank)
          return (
            <li
              key={r.key}
              className={`flex items-center gap-2 rounded-xl px-2 py-1 text-xs ${r.you ? 'bg-accent/15 ring-1 ring-accent/50' : 'bg-white/[0.03]'}`}
              data-league-row={r.you ? 'you' : r.classicId ?? ''}
            >
              <span className={`w-5 text-right font-mono font-bold ${z === 'up' ? 'text-emerald-300' : z === 'down' ? 'text-red-300' : 'text-slate-400'}`}>{rank}</span>
              {c ? <ClassicFace c={c} size="xs" /> : <FrameRing><span className="flex size-9 items-center justify-center rounded-xl bg-accent/30 text-[10px] font-black text-white">YOU</span></FrameRing>}
              <span className={`min-w-0 flex-1 truncate ${r.you ? 'font-bold text-white' : 'text-slate-200'}`}>{r.name}</span>
              {z === 'up' && <ArrowUp className="size-3 text-emerald-300" aria-label="Promotion zone" />}
              {z === 'down' && <ArrowDown className="size-3 text-red-300" aria-label="Relegation zone" />}
              <span className="font-mono text-slate-300">{r.points}</span>
            </li>
          )
        })}
      </ol>
      <button type="button" className="mt-2 text-xs text-sky-300 hover:underline" onClick={() => setAll((v) => !v)}>
        {all ? 'Show less' : `Show all ${LEAGUE_SIZE}`}
      </button>
    </Card>
  )
}

function SkillTree() {
  const j = useStore(journeyStore, (s) => s)
  const level = levelInfo(j.xp).level
  const total = skillPoints(level, j.prestige)
  const free = total - spentPoints(j.skills)
  const branches = Object.keys(SKILL_BRANCHES) as SkillBranch[]
  return (
    <Card title="Skill tree" icon={<Medal className="size-4" />} action={<Pill tone={free > 0 ? 'gold' : 'slate'}>{free} point{free === 1 ? '' : 's'}</Pill>} className="lg:col-span-2" data-skills>
      <p className="mb-3 text-xs text-slate-400">One point per level, five per prestige crown. Each branch unlocks from the top down.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {branches.map((b) => (
          <div key={b} className="rounded-2xl bg-white/[0.03] p-3">
            <div className="font-display text-sm font-bold text-white">{SKILL_BRANCHES[b].name}</div>
            <div className="mb-2 text-[11px] text-slate-500">{SKILL_BRANCHES[b].caption}</div>
            <ol className="space-y-2">
              {SKILLS.filter((s) => s.branch === b).map((s) => {
                const owned = j.skills.includes(s.id)
                const check = canLearn(j.skills, s.id, total)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => !owned && learnSkill(s.id)}
                      disabled={owned}
                      data-skill={s.id}
                      className={`w-full rounded-xl border p-2 text-left transition ${owned ? 'border-emerald-300/50 bg-emerald-400/10' : check.ok ? 'border-amber-300/60 bg-amber-300/10 hover:bg-amber-300/20' : 'border-white/10 bg-black/20 opacity-70'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {owned ? <Check className="size-3.5 text-emerald-300" /> : check.ok ? <Sparkles className="size-3.5 text-amber-200" /> : <Lock className="size-3.5 text-slate-500" />}
                        <span className="flex-1 text-xs font-semibold text-white">{s.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{s.cost} pt</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{s.description}</div>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>
    </Card>
  )
}
