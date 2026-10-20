import type { PlayerId, Pos } from '../../royale/royale'

/** Each army's colour (rubble is grey). */
export const ROYALE_COLOR: Record<PlayerId | 'dead', string> = { red: '#ef4444', blue: '#3b82f6', yellow: '#eab308', green: '#22c55e', dead: '#64748b' }

export const samePos = (a: Pos, b: Pos): boolean => a[0] === b[0] && a[1] === b[1]
