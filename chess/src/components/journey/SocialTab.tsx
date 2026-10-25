import { Check, Copy, Eye, Gift, Globe2, Link2, Shield, Smile, Swords, UserMinus, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useApi } from '../../hooks/useApi'
import { useStore } from '../../hooks/useStore'
import { challengeFrom, challengeLink } from '../../journey/challenge'
import { payRewards } from '../../journey/journeyActions'
import { journeyStore } from '../../journey/journeyStore'
import { REFERRAL_COINS, takePendingReferral } from '../../journey/referral'
import { accountStore } from '../../online/ranked/account'
import { ApiError, type FriendsInfo, type ReferralInfo, api } from '../../online/ranked/api'
import { EMOTES, EMOTE_IDS } from '../../online/ranked/protocol'
import { profileStore } from '../../stores/profileStore'
import { showToast } from '../../stores/toastStore'
import { formatShortDate } from '../../utils/date'
import { shareText } from '../../utils/share'
import { Button } from '../ui/Button'
import type { JourneyLaunch } from './launch'
import { Card, Pill } from './ui'

const origin = (): string => (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}` : '')

export function SocialTab({ launch }: { launch: JourneyLaunch }) {
  const account = useStore(accountStore, (a) => a)
  const signedIn = account.status === 'signed-in'
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-social>
      {signedIn ? (
        <>
          <Friends />
          <Referrals />
        </>
      ) : (
        <Card title="Friends & invites" icon={<Users className="size-4" />} className="lg:col-span-2">
          <p className="text-sm text-slate-300">
            {account.status === 'unavailable' ? 'The game server can’t be reached right now, so friends and invites are off.' : 'Sign in with a free account to add friends, see who is online and invite friends for rewards.'}
          </p>
          <Button variant="primary" className="mt-3" icon={<Globe2 className="size-4" />} onClick={() => launch.navigate('online')}>
            Sign in on the Online screen
          </Button>
        </Card>
      )}
      <ChallengeCard />
      <Card title="Watch & clans" icon={<Eye className="size-4" />} data-social-watch>
        <p className="text-sm text-slate-300">Watch live ranked games, follow the weekly clan war and join a clan — all on the Online screen.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button icon={<Eye className="size-4" />} onClick={() => launch.navigate('online')}>
            Live games
          </Button>
          <Button icon={<Shield className="size-4" />} onClick={() => launch.navigate('online')}>
            Clan war
          </Button>
        </div>
      </Card>
      <Card title="Quick emotes" icon={<Smile className="size-4" />}>
        <p className="text-sm text-slate-300">In online games you can send quick emotes — no open chat, so it stays friendly for everyone.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EMOTE_IDS.map((e) => (
            <span key={e} className="rounded-xl bg-white/[0.05] px-2 py-1 text-sm">
              {EMOTES[e].emoji} <span className="text-xs text-slate-400">{EMOTES[e].text}</span>
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Friends() {
  const { data, error, reload } = useApi<FriendsInfo>(api.friends)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) showToast('success', ok)
      reload()
    } catch (err) {
      showToast('warning', 'Friends', err instanceof ApiError ? err.message : 'Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }
  const copyCode = async () => {
    if (!data) return
    const r = await shareText('My Chronos Chess friend code', `Add me on Chronos Chess! My friend code: ${data.code}`)
    if (r !== 'failed') showToast('success', r === 'copied' ? 'Friend code copied' : 'Shared')
  }
  const friends = data?.friends ?? []
  return (
    <Card title="Friends" icon={<Users className="size-4" />} data-friends action={data ? <Pill tone="sky">{friends.filter((f) => f.status === 'friend').length} friends</Pill> : undefined}>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-2 text-xs">
            <span className="text-slate-400">Your friend code</span>
            <code className="min-w-0 flex-1 truncate font-mono text-white" data-friend-code>
              {data.code}
            </code>
            <Button size="sm" icon={<Copy className="size-4" />} onClick={() => void copyCode()}>
              Share
            </Button>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const c = code.trim()
              if (c) void act(() => api.addFriend(c), 'Friend request sent').then(() => setCode(''))
            }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="A friend’s code" className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-accent" aria-label="Friend code" />
            <Button type="submit" variant="primary" size="sm" disabled={busy || !code.trim()} icon={<UserPlus className="size-4" />}>
              Add
            </Button>
          </form>
          {friends.length === 0 ? (
            <p className="text-xs text-slate-500">No friends yet. Share your code, or add a friend’s.</p>
          ) : (
            <ul className="space-y-1.5">
              {friends.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5 text-sm" data-friend={f.status}>
                  <span className={`size-2 rounded-full ${f.online ? 'bg-emerald-400' : 'bg-slate-600'}`} aria-label={f.online ? 'Online' : 'Offline'} />
                  <span className="min-w-0 flex-1 truncate text-white">{f.name}</span>
                  <span className="font-mono text-xs text-slate-400">{f.rating}</span>
                  {f.status === 'incoming' && (
                    <Button size="sm" variant="primary" icon={<Check className="size-4" />} disabled={busy} onClick={() => void act(() => api.acceptFriend(f.id), `You and ${f.name} are friends`)}>
                      Accept
                    </Button>
                  )}
                  {f.status === 'outgoing' && <Pill>Pending</Pill>}
                  <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-red-300 pointer-coarse:min-h-10 pointer-coarse:min-w-10" aria-label={`Remove ${f.name}`} disabled={busy} onClick={() => void act(() => api.removeFriend(f.id))}>
                    <UserMinus className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500">To play a friend, create a room on the Online screen and send them the link.</p>
        </div>
      )}
    </Card>
  )
}

function Referrals() {
  const { data, error, reload } = useApi<ReferralInfo>(api.referral)
  const paid = useStore(journeyStore, (j) => j.referralPaid)
  const [code, setCode] = useState('')
  // A ?ref= code from the link you arrived with is used once you are signed in.
  useEffect(() => {
    if (!data || data.referredBy) return
    const pending = takePendingReferral()
    if (pending && pending !== data.code) void api.redeemReferral(pending).then(reload, () => undefined)
  }, [data, reload])
  const earned = data ? data.referred + (data.referredBy ? 1 : 0) : 0
  const due = Math.max(0, earned - paid)
  const link = data ? `${origin()}/?ref=${data.code}` : ''
  return (
    <Card title="Invite friends" icon={<Gift className="size-4" />} data-referral action={data ? <Pill tone="gold">{data.referred} joined</Pill> : undefined}>
      {error && <p className="text-xs text-red-300">{error}</p>}
      {data && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">When a friend signs up with your link, you both get {REFERRAL_COINS} coins.</p>
          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-2 text-xs">
            <Link2 className="size-4 text-slate-400" />
            <span className="min-w-0 flex-1 truncate font-mono text-slate-200">{link}</span>
            <Button size="sm" icon={<Copy className="size-4" />} onClick={() => void shareText('Play Chronos Chess with me', `Play Chronos Chess with me — chess against the legends of history! ${link}`).then((r) => r !== 'failed' && showToast('success', r === 'copied' ? 'Invite link copied' : 'Shared'))}>
              Share
            </Button>
          </div>
          {due > 0 && (
            <Button
              variant="primary"
              className="w-full"
              icon={<Gift className="size-4" />}
              onClick={() => {
                journeyStore.set((j) => ({ ...j, referralPaid: earned }))
                payRewards([{ kind: 'coins', amount: due * REFERRAL_COINS }], 'Invite rewards')
              }}
              data-referral-claim
            >
              Claim {due * REFERRAL_COINS} coins
            </Button>
          )}
          {data.referredBy ? (
            <p className="text-xs text-slate-400">You joined with {data.referredBy}’s invite.</p>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const c = code.trim()
                if (c)
                  void api.redeemReferral(c).then(
                    () => {
                      showToast('success', 'Invite code used')
                      reload()
                    },
                    (err: unknown) => showToast('warning', 'Invite code', err instanceof ApiError ? err.message : 'Could not reach the server.'),
                  )
              }}
            >
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Got an invite code?" className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-accent" aria-label="Invite code" />
              <Button type="submit" size="sm" disabled={!code.trim()}>
                Use
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  )
}

function ChallengeCard() {
  const matches = useStore(profileStore, (p) => p.matches)
  const name = useStore(profileStore, (p) => p.name)
  const wins = useMemo(() => matches.filter((m) => m.outcome === 'win' && m.humanColor && m.plies >= 16).slice(0, 6), [matches])
  const share = async (id: string) => {
    const m = wins.find((x) => x.id === id)
    const c = m ? challengeFrom(m, name) : null
    if (!c) return
    const r = await shareText('Beat my position', `Can you beat my position? I ${c.note}. ${challengeLink(c, origin())}`)
    if (r !== 'failed') showToast('success', r === 'copied' ? 'Challenge link copied' : 'Challenge sent')
  }
  return (
    <Card title="Beat my position" icon={<Swords className="size-4" />} data-challenge-card>
      <p className="text-sm text-slate-300">Pick a game you won and send a friend the position from twelve moves before the end. Can they win it too?</p>
      {wins.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">Win a game first, then it shows up here.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {wins.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-white">vs {m.opponent}</span>
              <span className="text-xs text-slate-500">{formatShortDate(m.date)}</span>
              <Button size="sm" icon={<Link2 className="size-4" />} onClick={() => void share(m.id)}>
                Send
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
