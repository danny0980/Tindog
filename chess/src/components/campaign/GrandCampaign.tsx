import { ChevronRight, CloudOff, Gem, Lock, Map as MapIcon, RotateCcw, Star, TriangleAlert, Trophy } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { GRAND_REALMS, TOTAL_BOSSES, getGrandRealm } from '../../data/campaign/realms'
import { RELICS } from '../../data/campaign/relics'
import { useRealmRoster } from '../../hooks/useCampaignRoster'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import { setThemeOverride } from '../../stores/themeOverrideStore'
import type { Boss, BossId, CampaignProgress, GrandRealmId, RelicId } from '../../types/campaign'
import { clearedCount, isBossUnlocked, isRealmUnlocked, maxStars, nextBoss, starCount, toggleRelic } from '../../utils/campaign'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import type { BattleOptions } from './battleOptions'
import { BossBattleAction, BossDossier } from './BossDossier'
import { Reliquary } from './Reliquary'
import { WorldMap } from './WorldMap'

interface GrandCampaignProps {
  onChallenge: (bossId: BossId, options: BattleOptions) => void
}

const updateCampaign = (fn: (c: CampaignProgress) => CampaignProgress) => profileStore.set((p) => ({ ...p, campaign: fn(p.campaign) }))

function lockReasonFor(boss: Boss, roster: readonly Boss[], progress: CampaignProgress): string {
  if (!isRealmUnlocked(boss.realm, progress)) return realmLockReason(boss.realm)
  const previous = roster[boss.index - 1]
  return previous ? `Defeat ${previous.name} (#${previous.index + 1}) to reach this boss.` : ''
}

function realmLockReason(realm: GrandRealmId): string {
  const previous = GRAND_REALMS[getGrandRealm(realm).order - 1]
  return previous ? `Defeat the overlord of ${previous.name} to open this realm.` : ''
}

/**
 * Grand Campaign hub: progress overview, realm switcher, the node-based world
 * map of the selected realm and the boss dossier — a side panel on wide or
 * landscape screens, a bottom sheet on phones.
 */
export default function GrandCampaign({ onChallenge }: GrandCampaignProps) {
  const progress = useStore(profileStore, (p) => p.campaign)
  const realmId = useStore(settingsStore, (s) => s.grandRealm)
  const realm = getGrandRealm(realmId)
  const { roster, error: rosterError, retry: retryRoster } = useRealmRoster(realmId)
  const wide = useMediaQuery('(min-width: 1024px), (orientation: landscape) and (max-height: 520px)')
  const [picked, setPicked] = useState<Partial<Record<GrandRealmId, BossId>>>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reliquaryOpen, setReliquaryOpen] = useState(false)
  const [options, setOptions] = useState<BattleOptions>({ color: 'w', timeControlId: 'none' })

  const realmUnlocked = isRealmUnlocked(realmId, progress)
  const frontier = roster ? nextBoss(roster, progress) : null
  const selectedId = picked[realmId] ?? frontier?.id ?? roster?.[roster.length - 1]?.id ?? null
  const selected = roster?.find((b) => b.id === selectedId) ?? null

  // Preview the selected boss's battleground (board, colours, soundtrack) app-wide.
  const previewTheme = selected?.themeId ?? null
  useEffect(() => {
    setThemeOverride(previewTheme)
  }, [previewTheme])

  const toggle = (id: RelicId) => updateCampaign((c) => toggleRelic(c, id))
  const select = (id: BossId) => {
    setPicked((prev) => ({ ...prev, [realmId]: id }))
    if (!wide) setSheetOpen(true)
  }
  const battle = (boss: Boss) => {
    setSheetOpen(false)
    onChallenge(boss.id, options)
  }

  const unlockedSelected = Boolean(selected && roster && isBossUnlocked(selected, roster, progress))
  const lockedSelectedReason = selected && roster ? lockReasonFor(selected, roster, progress) : ''
  const dossier = (showAction: boolean) =>
    selected &&
    roster && (
    <BossDossier
      showAction={showAction}
      key={selected.id}
      boss={selected}
      progress={progress}
      unlocked={unlockedSelected}
      lockedReason={lockedSelectedReason}
      options={options}
      onOptions={setOptions}
      onToggleRelic={toggle}
      onBattle={() => battle(selected)}
    />
  )

  return (
    <div className="space-y-4">
      {/* Overview */}
      <section className="glass flex flex-wrap items-center gap-x-5 gap-y-3 rounded-3xl p-4" aria-label="Campaign progress">
        <Metric icon={<Star className="size-4 fill-amber-300 text-amber-300" />} label="Stars" value={`${starCount(progress)}/${maxStars()}`} />
        <Metric icon={<Trophy className="size-4 text-accent" />} label="Bosses" value={`${clearedCount(progress)}/${TOTAL_BOSSES}`} />
        <Metric icon={<Gem className="size-4 text-amber-200" />} label="Relics" value={`${progress.relics.length}/${RELICS.length}`} />
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => setReliquaryOpen(true)} icon={<Gem className="size-4" />}>
            Reliquary
          </Button>
          {frontier && realmUnlocked && (
            <Button size="sm" variant="primary" onClick={() => select(frontier.id)} icon={<ChevronRight className="size-4" />}>
              Next: {frontier.shortName}
            </Button>
          )}
        </div>
      </section>

      {/* Realm switcher */}
      <nav className="scrollbar-thin -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible" aria-label="Realms">
        {GRAND_REALMS.map((r) => {
          const open = isRealmUnlocked(r.id, progress)
          const active = r.id === realmId
          const cleared = clearedCount(progress, r.id)
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => updateSettings({ grandRealm: r.id })}
              aria-pressed={active}
              data-realm={r.id}
              className={`flex min-w-[11.5rem] snap-start items-center gap-2.5 rounded-2xl border p-2.5 text-left transition lg:min-w-0 ${
                active ? 'border-accent bg-accent/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
              }`}
            >
              <PortraitEmblem
                spec={{ icon: r.icon, from: r.colors.from, to: r.colors.to, monogram: ['I', 'II', 'III', 'IV', 'V'][r.order] ?? '' }}
                label={r.name}
                size="sm"
                locked={!open}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">{r.name}</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  {open ? (
                    <>
                      {cleared}/20 · <Star className="size-3 fill-amber-300 text-amber-300" /> {starCount(progress, r.id)}
                    </>
                  ) : (
                    <>
                      <Lock className="size-3" /> Sealed · ~{r.eloRange[0]}–{r.eloRange[1]}
                    </>
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
            Realm {['I', 'II', 'III', 'IV', 'V'][realm.order]} · Elo {realm.eloRange[0]}–{realm.eloRange[1]}
          </div>
          <h2 className="font-display text-2xl font-extrabold tracking-wide text-white">{realm.name}</h2>
          <p className="text-sm text-slate-400">{realm.description}</p>
        </div>
      </header>

      <div className={wide ? 'grid grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] items-start gap-4' : ''}>
        {roster ? (
          <WorldMap
            realm={realm}
            roster={roster}
            progress={progress}
            realmUnlocked={realmUnlocked}
            lockedReason={realmLockReason(realmId)}
            selected={selectedId}
            onSelect={select}
          />
        ) : rosterError ? (
          <div className="glass flex h-96 flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center" role="alert">
            {rosterError.offline ? <CloudOff className="size-8 text-amber-300" /> : <TriangleAlert className="size-8 text-amber-300" />}
            <div className="font-bold text-white">{rosterError.offline ? 'You’re offline' : `Couldn’t chart ${realm.name}`}</div>
            <p className="max-w-xs text-sm text-slate-400">
              {rosterError.offline
                ? 'This realm downloads the first time you open it. It will load as soon as you reconnect.'
                : 'The realm failed to download after several attempts. Your progress is safe.'}
            </p>
            <Button size="sm" onClick={retryRoster} icon={<RotateCcw className="size-4" />}>
              Retry download
            </Button>
          </div>
        ) : (
          <div className="glass flex h-96 items-center justify-center rounded-3xl text-sm text-slate-400" role="status">
            <MapIcon className="mr-2 size-5 animate-pulse-soft" /> Charting {realm.name}…
          </div>
        )}
        {wide && selected && <aside className="glass scrollbar-thin sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl p-4">{dossier(true)}</aside>}
      </div>

      {!wide && (
        <Modal
          open={sheetOpen && Boolean(selected && roster)}
          title={selected ? `#${selected.index + 1} · ${selected.zone.name}` : 'Boss'}
          onClose={() => setSheetOpen(false)}
          size="md"
          // Pinned above the home indicator so the main action never needs a scroll.
          footer={
            selected ? (
              <BossBattleAction boss={selected} progress={progress} unlocked={unlockedSelected} lockedReason={lockedSelectedReason} onBattle={() => battle(selected)} />
            ) : undefined
          }
        >
          {dossier(false)}
        </Modal>
      )}

      <Reliquary open={reliquaryOpen} progress={progress} onClose={() => setReliquaryOpen(false)} onToggle={toggle} />
    </div>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-xl bg-white/5">{icon}</span>
      <span>
        <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</span>
        <span className="block font-mono text-sm font-bold text-white">{value}</span>
      </span>
    </div>
  )
}

