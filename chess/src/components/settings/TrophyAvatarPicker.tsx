import { Trophy } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { loadRealmRoster, rosterStore } from '../../data/campaign/loader'
import { realmOfBoss } from '../../data/campaign/realms'
import { CLASSIC_ROSTER } from '../../data/classic/roster'
import { LEGENDS } from '../../data/legends'
import { beatenIds, classicTrophy } from '../../data/trophyAvatars'
import { useStore } from '../../hooks/useStore'
import { profileStore } from '../../stores/profileStore'
import { settingsStore, updateSettings } from '../../stores/settingsStore'
import type { GrandRealmId } from '../../types/campaign'
import type { TrophyAvatar } from '../../types/settings'
import { PortraitEmblem } from '../legends/PortraitEmblem'
import { type ChoiceItem, ChoiceGrid } from './ChoiceGrid'

/**
 * Trophy avatars: every opponent you have beaten — Chronos legends, Grand
 * Campaign bosses and Classic characters — can be worn as your avatar. Only
 * the beaten ones are offered; the rest are won at the board.
 */
export function TrophyAvatarPicker({ compact = false }: { compact?: boolean }) {
  const profile = useStore(profileStore, (p) => p)
  const current = useStore(settingsStore, (s) => s.trophyAvatar)
  const rosters = useStore(rosterStore, (r) => r)
  const beaten = useMemo(() => beatenIds(profile), [profile])

  // Boss names and emblems live in the lazily loaded realm rosters: fetch the realms you have won in.
  const realms = useMemo(() => [...new Set(beaten.bosses.map(realmOfBoss))] as GrandRealmId[], [beaten.bosses])
  useEffect(() => {
    for (const realm of realms) void loadRealmRoster(realm).catch(() => {})
  }, [realms])

  const trophies = useMemo<TrophyAvatar[]>(() => {
    const legends = LEGENDS.filter((l) => beaten.legends.includes(l.id)).map((l) => ({ key: `legend:${l.id}`, name: l.name, portrait: l.portrait }))
    const bosses = beaten.bosses.flatMap((id) => {
      const boss = rosters[realmOfBoss(id)]?.find((b) => b.id === id)
      return boss ? [{ key: `boss:${boss.id}`, name: boss.name, portrait: boss.portrait }] : []
    })
    const classics = CLASSIC_ROSTER.filter((c) => beaten.classicIds.has(c.id) || beaten.classicNames.has(c.name)).map(classicTrophy)
    // One entry per name (a legend can also be a boss or a Classic character).
    const seen = new Set<string>()
    return [...legends, ...bosses, ...classics].filter((t) => !seen.has(t.name) && seen.add(t.name))
  }, [beaten, rosters])

  const items = trophies.map<ChoiceItem>((t) => ({
    id: `trophy-${t.key}`,
    label: t.name,
    active: current?.key === t.key,
    onSelect: () => updateSettings({ trophyAvatar: t, playerAvatar: null }),
    preview: () => <PortraitEmblem spec={t.portrait} label={t.name} size="md" />,
  }))
  const none: ChoiceItem = {
    id: 'trophy-none',
    label: 'None',
    active: current === null,
    onSelect: () => updateSettings({ trophyAvatar: null }),
    preview: () => <span className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-slate-500 ring-2 ring-white/10">—</span>,
  }

  if (items.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3 text-xs text-slate-400" data-trophy-empty>
        <Trophy className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <span>Beat an opponent — a Classic character, a campaign boss or a legend — and you can wear their portrait as your avatar.</span>
      </div>
    )
  }
  return <ChoiceGrid title="Opponents you have beaten" items={items} pinned={none} compact={compact} testId="trophy-avatars" />
}
