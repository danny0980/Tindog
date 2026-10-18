import { getLegend } from '../../data/legends'
import type { LegendId } from '../../types/legend'
import { PortraitEmblem, type PortraitEmblemProps } from './PortraitEmblem'

/** Portrait of a hand-crafted Chronos legend. */
export function LegendPortrait({ legendId, ...rest }: Omit<PortraitEmblemProps, 'spec' | 'label'> & { legendId: LegendId }) {
  const legend = getLegend(legendId)
  return <PortraitEmblem spec={legend.portrait} label={legend.name} {...rest} />
}
