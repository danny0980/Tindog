// The skill tree: one point per level (and five per prestige), spent on three
// branches. The Treasury pays more, the War Room helps in Grand Campaign
// battles, and the Library speeds up learning. Pure and unit-tested.

export type SkillBranch = 'treasury' | 'war' | 'library'

export interface SkillEffects {
  /** Extra coins from finished games, percent. */
  coinBonus: number
  /** Extra XP, percent. */
  xpBonus: number
  /** Extra rolls on the daily chest (the best roll is kept). */
  chestRolls: number
  /** Free takebacks in Grand Campaign battles. */
  campaignUndos: number
  /** Extra seconds on your clock in timed Grand Campaign battles. */
  campaignSeconds: number
  /** Bond progress multiplier with the characters (1 = normal). */
  bondFactor: number
  /** Extra league points, percent. */
  leagueBonus: number
}

export interface SkillDef {
  id: string
  branch: SkillBranch
  /** 1–4: a node needs the node before it in its branch. */
  tier: number
  name: string
  description: string
  cost: number
  effect: Partial<SkillEffects>
}

export const SKILL_BRANCHES: Readonly<Record<SkillBranch, { name: string; caption: string }>> = {
  treasury: { name: 'Treasury', caption: 'Coins and treasure' },
  war: { name: 'War Room', caption: 'Grand Campaign battles' },
  library: { name: 'Library', caption: 'Learning and bonds' },
}

export const SKILLS: readonly SkillDef[] = [
  { id: 'purse-1', branch: 'treasury', tier: 1, name: 'Heavy Purse', description: '+5% coins from every finished game.', cost: 1, effect: { coinBonus: 5 } },
  { id: 'purse-2', branch: 'treasury', tier: 2, name: 'Royal Treasury', description: 'Another +10% coins from games.', cost: 2, effect: { coinBonus: 10 } },
  { id: 'golden-touch', branch: 'treasury', tier: 3, name: 'Golden Touch', description: 'The daily chest rolls twice and keeps the better prize.', cost: 3, effect: { chestRolls: 1 } },
  { id: 'purse-3', branch: 'treasury', tier: 4, name: 'Midas', description: 'Another +15% coins from games.', cost: 4, effect: { coinBonus: 15 } },
  { id: 'steady-hand', branch: 'war', tier: 1, name: 'Steady Hand', description: 'One free takeback in every Grand Campaign battle.', cost: 1, effect: { campaignUndos: 1 } },
  { id: 'war-clock', branch: 'war', tier: 2, name: 'Borrowed Time', description: '+15 seconds on your clock in timed campaign battles.', cost: 2, effect: { campaignSeconds: 15 } },
  { id: 'second-hand', branch: 'war', tier: 3, name: 'Second Chance', description: 'A second free takeback in campaign battles.', cost: 3, effect: { campaignUndos: 1 } },
  { id: 'war-clock-2', branch: 'war', tier: 4, name: 'Master of Hours', description: 'Another +30 seconds in timed campaign battles.', cost: 4, effect: { campaignSeconds: 30 } },
  { id: 'quick-study', branch: 'library', tier: 1, name: 'Quick Study', description: '+10% XP from everything.', cost: 1, effect: { xpBonus: 10 } },
  { id: 'kindred', branch: 'library', tier: 2, name: 'Kindred Spirit', description: 'Bonds with the characters grow twice as fast.', cost: 2, effect: { bondFactor: 2 } },
  { id: 'competitor', branch: 'library', tier: 3, name: 'Competitor', description: '+20% league points.', cost: 3, effect: { leagueBonus: 20 } },
  { id: 'scholar', branch: 'library', tier: 4, name: 'Scholar of Ages', description: 'Another +15% XP.', cost: 4, effect: { xpBonus: 15 } },
]

export const getSkill = (id: string): SkillDef | undefined => SKILLS.find((s) => s.id === id)
export const isSkillId = (v: unknown): v is string => typeof v === 'string' && getSkill(v) !== undefined

/** Skill points earned: one per level after the first, five per prestige. */
export const skillPoints = (level: number, prestige: number): number => Math.max(0, level - 1) + prestige * 5

export const spentPoints = (owned: readonly string[]): number => owned.reduce((n, id) => n + (getSkill(id)?.cost ?? 0), 0)

export type LearnCheck = { ok: true } | { ok: false; reason: string }

export function canLearn(owned: readonly string[], id: string, available: number): LearnCheck {
  const skill = getSkill(id)
  if (!skill) return { ok: false, reason: 'Unknown skill.' }
  if (owned.includes(id)) return { ok: false, reason: 'Already learned.' }
  const before = SKILLS.find((s) => s.branch === skill.branch && s.tier === skill.tier - 1)
  if (before && !owned.includes(before.id)) return { ok: false, reason: `Learn ${before.name} first.` }
  if (available - spentPoints(owned) < skill.cost) return { ok: false, reason: `Needs ${skill.cost} skill point${skill.cost === 1 ? '' : 's'}.` }
  return { ok: true }
}

export function skillEffects(owned: readonly string[]): SkillEffects {
  const out: SkillEffects = { coinBonus: 0, xpBonus: 0, chestRolls: 0, campaignUndos: 0, campaignSeconds: 0, bondFactor: 1, leagueBonus: 0 }
  for (const id of owned) {
    const e = getSkill(id)?.effect
    if (!e) continue
    out.coinBonus += e.coinBonus ?? 0
    out.xpBonus += e.xpBonus ?? 0
    out.chestRolls += e.chestRolls ?? 0
    out.campaignUndos += e.campaignUndos ?? 0
    out.campaignSeconds += e.campaignSeconds ?? 0
    out.leagueBonus += e.leagueBonus ?? 0
    if (e.bondFactor) out.bondFactor = Math.max(out.bondFactor, e.bondFactor)
  }
  return out
}
