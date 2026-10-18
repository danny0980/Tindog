import { Check, Coins, Lock, Sparkles } from 'lucide-react'
import { sfx } from '../audio'
import { ThemeSwatch } from '../components/shop/ThemeSwatch'
import { Button } from '../components/ui/Button'
import { BOARD_THEMES, PIECE_SETS, getBoardTheme } from '../constants/themes'
import { useStore } from '../hooks/useStore'
import { profileStore } from '../stores/profileStore'
import { settingsStore, updateSettings } from '../stores/settingsStore'
import { showToast } from '../stores/toastStore'
import { type ShopItem, itemPrice, ownsItem, purchase } from '../utils/progression'

export function ShopView() {
  const profile = useStore(profileStore, (p) => p)
  const settings = useStore(settingsStore, (s) => s)
  const previewTheme = getBoardTheme(settings.boardTheme)

  const buy = (item: ShopItem, name: string) => {
    const out = purchase(profileStore.get(), item)
    if (!out.ok) {
      sfx.error()
      showToast('warning', 'Not enough coins', `${name} costs ${itemPrice(item)} coins.`)
      return
    }
    profileStore.set(out.profile)
    sfx.coins()
    showToast('success', `${name} unlocked!`, 'Equipped and ready.')
    if (item.kind === 'theme') updateSettings({ boardTheme: item.id })
    else updateSettings({ pieceSet: item.id })
    out.unlocked.forEach((a) => {
      sfx.achievement()
      showToast('achievement', a.title, `${a.description} · +${a.reward} coins`, 5000)
    })
  }

  const action = (item: ShopItem, name: string, equipped: boolean) => {
    if (equipped)
      return (
        <Button size="sm" variant="ghost" className="w-full text-accent" icon={<Check className="size-4" />} disabled>
          Equipped
        </Button>
      )
    if (ownsItem(profile, item))
      return (
        <Button
          size="sm"
          className="w-full"
          onClick={() => (item.kind === 'theme' ? updateSettings({ boardTheme: item.id }) : updateSettings({ pieceSet: item.id }))}
        >
          Equip
        </Button>
      )
    const price = itemPrice(item)
    const affordable = profile.coins >= price
    return (
      <Button
        size="sm"
        variant={affordable ? 'primary' : 'secondary'}
        className="w-full"
        icon={affordable ? <Coins className="size-4" /> : <Lock className="size-4" />}
        onClick={() => buy(item, name)}
      >
        {price}
      </Button>
    )
  }

  return (
    <div className="safe-px mx-auto w-full max-w-7xl flex-1 space-y-4 pb-4">
      <section className="glass relative overflow-hidden rounded-2xl p-5">
        <div className="pointer-events-none absolute -top-20 -left-16 size-64 rounded-full bg-accent-2/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-600 text-ink-950 shadow-[0_15px_40px_-12px_rgba(250,204,21,0.8)]">
            <Sparkles className="size-7" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-extrabold tracking-wider text-white">COSMETICS VAULT</h2>
            <p className="text-sm text-slate-400">Earn coins by winning games, solving daily puzzles and unlocking achievements.</p>
          </div>
          <div className="rounded-2xl bg-yellow-400/10 px-4 py-2 text-center ring-1 ring-yellow-300/30">
            <div className="flex items-center gap-1.5 font-mono text-2xl font-bold text-yellow-300">
              <Coins className="size-5" /> {profile.coins}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-yellow-200/70">balance</div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Board themes</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {BOARD_THEMES.map((theme) => {
            const equipped = settings.boardTheme === theme.id
            return (
              <article key={theme.id} className={`glass flex flex-col gap-2 rounded-2xl p-3 transition ${equipped ? 'ring-2 ring-accent' : ''}`}>
                <ThemeSwatch theme={theme} size="lg" />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                    {theme.name}
                    {theme.price > 0 && <span className="rounded bg-white/10 px-1 text-[9px] font-black uppercase text-accent">Premium</span>}
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-400">{theme.description}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{theme.material} sound set</p>
                </div>
                <div className="mt-auto">{action({ kind: 'theme', id: theme.id }, theme.name, equipped)}</div>
              </article>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Piece styles</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PIECE_SETS.map((set) => {
            const equipped = settings.pieceSet === set.id
            return (
              <article key={set.id} className={`glass flex flex-col gap-2 rounded-2xl p-3 ${equipped ? 'ring-2 ring-accent' : ''}`}>
                <ThemeSwatch theme={previewTheme} pieceSet={set} size="lg" />
                <div>
                  <div className="text-sm font-bold text-white">{set.name}</div>
                  <p className="text-xs text-slate-400">{set.description}</p>
                </div>
                <div className="mt-auto">{action({ kind: 'pieces', id: set.id }, set.name, equipped)}</div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
