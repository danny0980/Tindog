import { Map as MapIcon, Shield } from 'lucide-react'
import { getRelic } from '../../data/campaign/relics'
import type { Boss, RelicId } from '../../types/campaign'
import { starTarget, twoStarTarget } from '../../utils/campaign'
import { RelicTile } from './RelicTile'

interface CampaignBattleStripProps {
  boss: Boss
  relics: readonly RelicId[]
  movesPlayed: number
  casual: boolean
  shieldUsed: boolean
}

/** In-battle HUD for a Grand Campaign boss: star targets, move count and relics in effect. */
export function CampaignBattleStrip({ boss, relics, movesPlayed, casual, shieldUsed }: CampaignBattleStripProps) {
  const three = starTarget(boss.par, relics)
  const two = twoStarTarget(boss.par, relics)
  const projected = casual ? 1 : movesPlayed <= three ? 3 : movesPlayed <= two ? 2 : 1
  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
        <MapIcon className="size-3.5" /> Grand Campaign · {boss.zone.name}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
        <div className="text-slate-300">
          <span className="font-mono font-bold text-white">{movesPlayed}</span> moves ·{' '}
          <span className={projected === 3 ? 'text-amber-300' : 'text-slate-400'}>★★★ ≤ {three}</span> ·{' '}
          <span className={projected === 2 ? 'text-amber-300' : 'text-slate-400'}>★★ ≤ {two}</span>
        </div>
        {relics.length > 0 && (
          <div className="flex shrink-0 gap-1">
            {relics.map((id) => (
              <span key={id} title={getRelic(id).name}>
                <RelicTile relic={getRelic(id)} size="sm" />
              </span>
            ))}
          </div>
        )}
      </div>
      {casual && <div className="mt-1 text-[11px] text-orange-300">Takeback used — this victory is capped at one star.</div>}
      {!casual && relics.includes('shield-of-kings') && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
          <Shield className="size-3" /> {shieldUsed ? 'Shield of Kings spent' : 'Shield of Kings ready (first 15 moves)'}
        </div>
      )}
    </div>
  )
}
