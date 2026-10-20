import { TIERS, applyTier } from '../data/campaign/tiers'
import { Chess } from 'chess.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ambientMusic, resolveMaterial, sfx } from '../audio'
import { DIFFICULTIES, PERSONALITIES, resolveTimeControl, standardOpponent } from '../constants/game'
import { getClassic } from '../data/classic/roster'
import { getBoardTheme, getPieceSet } from '../constants/themes'
import { getCachedBoss, loadRealmRoster, rosterStore } from '../data/campaign/loader'
import { realmOfBoss } from '../data/campaign/realms'
import { EMBER_BONUS_MS, FIREWALL_ELO_CAP, SHIELD_MOVE_LIMIT, activeRelics, applyRelicsToProfile } from '../data/campaign/relics'
import { getLegend, strengthInfo } from '../data/legends'
import { bossPersona, classicPersona, ghostPersona, legendPersona } from '../data/personas'
import { fingerprint } from '../ghost/fingerprint'
import { withMemory } from '../memory/memory'
import type { ArmyEffects } from '../army/army'
import { type BattleMode, getTerritory, resolveBattle } from '../war/war'
import { rescaleProfile } from '../data/campaign/archetypes'
import { POTIONS, RESTRICTIONS, WEATHER } from '../data/arena'
import { displayTitle } from '../data/titles'
import { gauntletStore } from '../stores/gauntletStore'
import { type ArenaOptions, SPELLS, buildBattleSetup, getTactic, hashSeed, seededRandom } from '../data/spells'
import {
  afterPly,
  altarCandidates,
  applyPotion,
  bossSearchMoves,
  bossSpecialMoves,
  createEffects,
  frostSquares,
  glueSquares,
  humanSpecialMoves,
  moveRefusal,
  placeGlue,
  restrictionHonoured,
} from '../engine/spellEngine'
import { analyzeTaunt } from '../engine/taunts'
import { type SpecialMove, kingSquare, passTurn, sacrificePawn } from '../engine/variant'
import { personaLine, personaSay, personaTaunt } from '../stores/dialogueStore'
import { type GauntletSummary, endGauntletRun, finishGauntletBattle } from '../stores/gauntletActions'
import type { BattleEffects, BattleEvent, BattleKind, BattleSetup, TacticId } from '../types/spells'
import type { PotionId } from '../types/rpg'
import type { BoardArena, BoardPicker } from '../components/board/ChessBoard'
import { type BoardFx, boardFxFor } from '../components/fx/boardFx'
import type { TauntEvent, TauntMood } from '../types/taunts'
import type { GrandRealmId, RelicDef, RelicId, StarCount } from '../types/campaign'
import type { Persona, PortraitSpec } from '../types/persona'
import { applyBossResult } from '../utils/campaign'
import { consumePotion } from '../utils/inventory'
import { IRONMAN_COIN_FACTOR, applyIronmanResult } from '../utils/ironman'
import { summarizeAnalysis } from '../utils/notebook'
import { recordTournamentResult } from '../utils/tournament'
import { consumeBlessings, resolveAmbush, resolveBounty } from '../utils/world'
import { grant } from '../utils/progression'
import { profileStore } from '../stores/profileStore'
import { settingsStore, updateSettings } from '../stores/settingsStore'
import { showToast } from '../stores/toastStore'
import type { GameAnalysis, PositionEval } from '../types/analysis'
import type { ClockTimes, Color, GameResult, GameSettings, Move, MoveInput, Outcome, Square, TimeControl } from '../types/chess'
import type { AchievementDef, MatchRecord } from '../types/profile'
import { fenAtPly, getCapturedPieces, givesCheck, opposite } from '../utils/chess'
import { type Mood, deriveMood, gameTension } from '../utils/mood'
import { detectOpening } from '../utils/openings'
import { type MatchInput, applyAnalysis, applyLegendResult, applyMatch, matchQuestEvents, outcomeFor } from '../utils/progression'
import { trackQuestEvents } from '../stores/questActions'
import { usePageVisible } from './useAppEnvironment'
import { useAiOpponent } from './useAiOpponent'
import { useChessClock } from './useChessClock'
import { useChessGame } from './useChessGame'
import { useEngine } from './useEngine'
import { useEvaluation } from './useEvaluation'
import { useGameAnalysis } from './useGameAnalysis'
import { useStore } from './useStore'
import { useTimeMachine } from './useTimeMachine'

/** Battles booked by their own mode instead of the rating. */
const UNRATED_KINDS: readonly BattleKind[] = ['gauntlet', 'event', 'bounty']
/** How long the checkmate kill-cam plays before the results card. */
export const KILL_CAM_MS = 2600

const UNTIMED: TimeControl = { id: 'none', label: 'Unlimited', category: 'none', initialMs: 0, incrementMs: 0 }

/** Extra rules for a character battle, chosen by the screen that launches it. */
export interface BattleLaunch {
  kind: BattleKind
  /** Tactics drafted before the battle (campaign) or granted by boons (gauntlet). */
  tactics: readonly TacticId[]
  /** Gauntlet: your clock (the run's time bank) overrides the time control for your side. */
  humanClockMs?: number
  /** Gauntlet EMP boon: the boss searches shallower this battle. */
  emp?: boolean
  /** Free takebacks; the Gauntlet otherwise forbids undo. */
  freeUndos?: number
  /** Arena modifiers: bounty contract, weather, parley boost and reward factor. */
  arena?: ArenaOptions
  /** World-map ambush / bounty contract this battle settles. */
  eventId?: string
  bountyId?: string
  /** The boss's answer to your parley choice (spoken as the battle begins). */
  parleyReply?: { text: string; mood: TauntMood }
  /** World War: the territory fought over, and what your army brings. */
  war?: WarLaunch
}

export interface WarLaunch {
  territoryId: string
  mode: BattleMode
  effects: ArmyEffects
}

/** Light / dark lighting of the arena, from the opponent's alignment. */
export type Alignment = 'light' | 'dark'

/** A finished checkmate replayed as a slow-motion cinematic. */
export interface KillCam {
  id: number
  /** Square of the mated king and the mating move. */
  king: Square | null
  move: Pick<Move, 'from' | 'to' | 'san'> | null
  youWon: boolean
  caption: string
}

/** Player actions that cost no move (potions, traps, the altar). */
export type PickMode = 'glue' | 'altar' | null

const LAUNCH_DEFAULTS = { emp: false, freeUndos: 0, eventId: null, bountyId: null, war: null } as const

/** A short holographic banner over the board (spell warnings, casts, tactics). */
export interface SpellFlash {
  id: number
  text: string
  tone: 'danger' | 'accent' | 'gold'
}

const resolveColor = (settings: GameSettings): Color =>
  settings.playerColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.playerColor

export interface PlayerInfo {
  color: Color
  name: string
  subtitle: string
  isEngine: boolean
  mood: Mood
  /** Set when this side is a character (legend or campaign boss): portrait + dialogue routing. */
  character: { key: string; name: string; portrait: PortraitSpec } | null
}

export interface GameEndSummary {
  result: GameResult
  outcome: Outcome | null
  eloDelta: number | null
  eloAfter: number | null
  coins: number
  unlocked: AchievementDef[]
  matchId: string
  rated: boolean
  /** Chronos campaign outcome when the opponent was a legend. */
  legend: { name: string; firstDefeat: boolean; coins: number; rewards: string[] } | null
  /** Grand Campaign outcome when the opponent was a boss. */
  campaign: {
    bossName: string
    stars: StarCount
    previousStars: StarCount
    firstClear: boolean
    coins: number
    relic: RelicDef | null
    realmCleared: GrandRealmId | null
    rewards: string[]
  } | null
  /** Endless Gauntlet bookkeeping when the battle was part of a run. */
  gauntlet: GauntletSummary | null
  /** Ironman: did this defeat wipe the run? */
  ironman: { wiped: boolean; lostBosses: number; factor: number } | null
  /** Ambush, bounty or tournament payout. */
  arena: { title: string; detail: string; coins: number; potion: PotionId | null; success: boolean } | null
  /** World War battle: what happened on the map, and the spoils. */
  war: { territory: string; events: string[]; coins: number; spoils: number } | null
}

const characterOf = (p: Persona): PlayerInfo['character'] => ({ key: p.key, name: p.name, portrait: p.portrait })

function announceAchievements(unlocked: AchievementDef[], delay: number): void {
  unlocked.forEach((a, i) =>
    window.setTimeout(() => {
      sfx.achievement()
      showToast('achievement', a.title, `${a.description} · +${a.reward} coins`, 5000)
    }, delay + i * 1100),
  )
}

export function useGameController({ active }: { active: boolean }) {
  const settings = useStore(settingsStore, (s) => s)
  const [gameSettings, setGameSettings] = useState<GameSettings>(() => settingsStore.get().game)
  const [humanColor, setHumanColor] = useState<Color>(() => resolveColor(gameSettings))
  const [orientation, setOrientation] = useState<Color>(() => (gameSettings.mode === 'ai' ? humanColor : 'w'))
  const [gameId, setGameId] = useState(0)
  const [casual, setCasual] = useState(false)
  const [gameOverDismissed, setGameOverDismissed] = useState(false)
  const [summary, setSummary] = useState<GameEndSummary | null>(null)
  const [review, setReview] = useState<MatchRecord | null>(null)
  const [celebration, setCelebration] = useState(0)
  const [analysisRequestedFor, setAnalysisRequestedFor] = useState<string | null>(null)
  // Grand Campaign: relics snapshotted at the start of a boss battle.
  const [battleRelics, setBattleRelics] = useState<RelicId[]>([])
  const [shieldUsed, setShieldUsed] = useState(false)
  // Spells & tactics: the battle's rules, and the effect state after every ply (index = ply).
  const [battle, setBattle] = useState<BattleSetup | null>(null)
  const [launchExtras, setLaunchExtras] = useState<{ emp: boolean; freeUndos: number; eventId: string | null; bountyId: string | null; war: WarLaunch | null }>(LAUNCH_DEFAULTS)
  const war = launchExtras.war
  const [pickMode, setPickMode] = useState<PickMode>(null)
  const [killCam, setKillCam] = useState<KillCam | null>(null)
  /** Bumped when the opponent lands a severe check (screen shake). */
  const [severeCheck, setSevereCheck] = useState(0)
  /** The latest on-board particle effect (spell, frost, glue, potion, check, mate). */
  const [boardFx, setBoardFx] = useState<BoardFx | null>(null)
  const boardFxIdRef = useRef(0)
  const pushBoardFx = useCallback((fx: Omit<BoardFx, 'id'>) => {
    boardFxIdRef.current += 1
    setBoardFx({ id: boardFxIdRef.current, ...fx })
  }, [])
  /** Per-battle feat counters, booked when the game ends. */
  const battleFeatsRef = useRef({ sacrifices: 0, trapsSprung: 0 })
  const [effectsLog, setEffectsLog] = useState<BattleEffects[]>([])
  const effectsLogRef = useRef<BattleEffects[]>([])
  const [spellFlash, setSpellFlash] = useState<SpellFlash | null>(null)
  const flashIdRef = useRef(0)
  const rngRef = useRef<() => number>(seededRandom(1))
  /** When the player's current turn began (for Time Dilation). */
  const turnStartRef = useRef(0)
  /** The opponent's evaluation after its last move (for blunder / brilliancy taunts). */
  const bossEvalRef = useRef<number | null>(null)
  const timeTroubleRef = useRef(false)
  /** Clock reader for callbacks declared before the clock exists (the clock's flag handler needs them). */
  const getClockTimesRef = useRef<() => ClockTimes>(() => ({ w: 0, b: 0 }))

  const game = useChessGame()
  const visible = usePageVisible()
  const isAiMode = gameSettings.mode === 'ai' && review === null
  // Character battles: a Chronos legend or a Grand Campaign boss brings its own
  // board, pieces, soundtrack, portrait and dialogue (one Persona code path).
  // Boss rosters load lazily; subscribing re-renders once the realm chunk arrives.
  const boss = useStore(rosterStore, () => (isAiMode && gameSettings.bossId ? getCachedBoss(gameSettings.bossId) : null))
  const legend = isAiMode && !gameSettings.bossId && gameSettings.legendId ? getLegend(gameSettings.legendId) : null
  const classic = isAiMode && !gameSettings.bossId && !gameSettings.legendId && gameSettings.classicId ? getClassic(gameSettings.classicId) : null
  // Ghost of Yourself: built from your saved games when the game starts (a new game picks up new habits).
  const wantsGhost = isAiMode && !gameSettings.bossId && !gameSettings.legendId && !gameSettings.classicId && gameSettings.ghost
  const myMatches = useStore(profileStore, (p) => p.matches)
  const myElo = useStore(profileStore, (p) => p.elo)
  const myName = useStore(profileStore, (p) => p.name)
  const ghost = useMemo(() => (wantsGhost ? ghostPersona(fingerprint(myMatches, myElo), myName) : null), [myElo, myMatches, myName, wantsGhost])
  const reviewBoss = useStore(rosterStore, () => (review?.bossId ? getCachedBoss(review.bossId) : null))
  const reviewLegend = review?.legendId ? getLegend(review.legendId) : null
  // What the opponent remembers of you, as it stood when this game began.
  const [memoryAtStart, setMemoryAtStart] = useState(() => profileStore.get().memory)
  const persona = useMemo<Persona | null>(() => {
    const base = boss ? bossPersona(boss) : legend ? legendPersona(legend, gameSettings.legendStrength) : classic ? classicPersona(classic, settings.classicAvatar) : ghost
    return base ? withMemory(base, memoryAtStart[base.key]) : null
  }, [boss, classic, gameSettings.legendStrength, ghost, legend, memoryAtStart, settings.classicAvatar])
  const reviewPersona = useMemo<Persona | null>(
    () => (reviewBoss ? bossPersona(reviewBoss) : reviewLegend ? legendPersona(reviewLegend, 'authentic') : null),
    [reviewBoss, reviewLegend],
  )
  /** Whoever sets the scene (theme, pieces, music): the live opponent or the reviewed one. */
  const stage = persona ?? reviewPersona
  // Your loadout can replace the opponent's realm / era look with your own board and pieces.
  const realmLook = settings.battleLook === 'realm' ? stage : null
  const theme = getBoardTheme(realmLook?.themeId ?? settings.boardTheme)
  const pieceSet = getPieceSet(realmLook?.pieceSetId ?? settings.pieceSet)
  const material = resolveMaterial(settings.soundMaterial, theme)
  const isPlaying = game.status.kind === 'playing' && review === null
  const aiColor = opposite(humanColor)
  const gameKey = review ? `review-${review.id}` : `game-${gameId}`
  const timeControl = useMemo(() => (review ? UNTIMED : resolveTimeControl(gameSettings)), [gameSettings, review])
  const difficultyLabel = DIFFICULTIES.find((d) => d.id === gameSettings.difficulty)?.label ?? ''
  const personality = PERSONALITIES.find((p) => p.id === gameSettings.personality) ?? PERSONALITIES[0]
  const effects: BattleEffects | null = battle ? (effectsLog[game.history.length] ?? effectsLog[effectsLog.length - 1] ?? null) : null
  const overclocked = effects?.overclock ?? false
  const opponent = useMemo(() => {
    let profile = boss && persona ? applyRelicsToProfile(persona.profile, battleRelics) : persona ? persona.profile : standardOpponent(gameSettings.difficulty, gameSettings.personality)
    if (launchExtras.emp) profile = applyRelicsToProfile(profile, ['emp-spike'])
    // Campaign difficulty tier.
    if (boss && battle) profile = applyTier(profile, battle.tier)
    // Parley / elite ambush: the boss is weakened or empowered for the whole battle.
    if (battle?.bossBoost === 1) profile = { ...profile, skillLevel: Math.min(20, profile.skillLevel + 3), depth: profile.depth + 2, toleranceCp: Math.max(5, profile.toleranceCp - 10) }
    if (battle?.bossBoost === -1) profile = { ...profile, skillLevel: Math.max(0, profile.skillLevel - 3), depth: Math.max(2, profile.depth - 2), toleranceCp: profile.toleranceCp + 25 }
    // Overclock spells: this one move is computed at full power.
    if (overclocked) {
      profile = { ...profile, skillLevel: 20, depth: profile.depth + 4, moveTimeMs: Math.round(profile.moveTimeMs * 1.5), toleranceCp: Math.min(profile.toleranceCp, 15), noise: 0 }
    }
    // World War: your army's Rally weakens the enemy; a Surprise attack catches it without its book.
    if (war && persona && war.effects.rally > 0) profile = rescaleProfile(profile, Math.max(400, persona.elo - war.effects.rally))
    if (war?.effects.surprise) profile = { ...profile, repertoire: { w: [], b: [] } }
    return profile
  }, [battle, battleRelics, boss, gameSettings.difficulty, gameSettings.personality, launchExtras.emp, overclocked, persona, war])

  const clockSnapshotsRef = useRef<ClockTimes[]>([])
  const recordedGameRef = useRef<number | null>(null)
  const lastOpeningRef = useRef<string | null>(null)
  const summaryRef = useRef<GameEndSummary | null>(null)
  const reviewRef = useRef<MatchRecord | null>(null)
  useEffect(() => {
    summaryRef.current = summary
    reviewRef.current = review
  }, [review, summary])

  // ── Engines, time machine, evaluation & analysis ───────────────────────────
  const playEngine = useEngine('play', isAiMode)
  const timeMachine = useTimeMachine(game.history.length, gameKey)
  const analysisWanted = analysisRequestedFor === gameKey
  const analysisEngine = useEngine('analysis', active && (settings.showEvalBar || analysisWanted))
  const analysis = useGameAnalysis(analysisEngine, game.history, gameKey, settings.batterySaver ? 9 : 13)
  const displayPly = timeMachine.displayPly
  const displayFen = timeMachine.isLive ? game.fen : fenAtPly(game.history, displayPly)

  const analysisEvals: PositionEval[] | null =
    analysis.state.status === 'done' ? analysis.state.analysis.evals : analysis.state.status === 'running' ? analysis.state.partial : null
  const evalFromAnalysis = analysisEvals?.[displayPly] ?? null
  const liveEval = useEvaluation(
    analysisEngine,
    displayFen,
    settings.showEvalBar && active && visible && analysis.state.status !== 'running' && evalFromAnalysis === null,
    settings.batterySaver ? 8 : 14,
  )
  const evaluation = evalFromAnalysis ?? liveEval

  const opening = useMemo(() => detectOpening(game.history.slice(0, displayPly)), [displayPly, game.history])

  // ── Game end ───────────────────────────────────────────────────────────────
  const playerNames = useCallback(
    (color: Color): string => {
      if (gameSettings.mode !== 'ai') return color === 'w' ? 'White' : 'Black'
      if (color === humanColor) return profileStore.get().name
      if (persona) return persona.name
      return `Stockfish (${difficultyLabel}${personality && personality.id !== 'balanced' ? `, ${personality.name}` : ''})`
    },
    [difficultyLabel, gameSettings.mode, humanColor, persona, personality],
  )

  const finishGame = useCallback(
    (result: GameResult) => {
      if (recordedGameRef.current === gameId) return
      recordedGameRef.current = gameId
      const history = game.getLiveHistory()
      const openingName = detectOpening(history)?.name ?? null
      const pgn = game.buildPgn(
        {
          white: playerNames('w'),
          black: playerNames('b'),
          timeControl: timeControl.initialMs > 0 ? `${timeControl.initialMs / 1000}+${timeControl.incrementMs / 1000}` : '-',
          ...(openingName ? { opening: openingName } : {}),
        },
        result,
      )
      const ai = gameSettings.mode === 'ai'
      const matchInput: MatchInput = {
        mode: gameSettings.mode,
        opponent: ai ? playerNames(aiColor) : 'Local game',
        difficulty: ai ? (persona?.difficulty ?? gameSettings.difficulty) : null,
        personality: ai && !persona ? gameSettings.personality : null,
        humanColor: ai ? humanColor : null,
        result,
        pgn,
        history,
        timeControl,
        // Gauntlet, ambush and bounty battles are arcade (handicaps, boosts): unrated.
        rated: ai && !casual && (battle === null || UNRATED_KINDS.indexOf(battle.kind) === -1),
        opening: openingName,
        variant: game.getVariantEvents(),
        legendId: legend?.id ?? null,
        bossId: boss?.id ?? null,
        classicId: classic?.id ?? null,
        opponentKey: persona?.key ?? null,
        ...(persona ? { opponentElo: persona.elo } : {}),
        ...(boss && battleRelics.includes('firewall-core') ? { eloLossCap: FIREWALL_ELO_CAP } : {}),
        ...(war?.effects.eloLossCap ? { eloLossCap: war.effects.eloLossCap } : {}),
      }
      const out = applyMatch(profileStore.get(), matchInput)
      profileStore.set(out.profile)
      const outcome = ai ? outcomeFor(result, humanColor) : null

      // Chronos campaign: bounty, epoch cosmetics, historical trophies and a parting remark.
      let legendSummary: GameEndSummary['legend'] = null
      let unlocked = out.unlocked
      if (legend && outcome && battle?.kind !== 'tournament') {
        const lr = applyLegendResult(
          profileStore.get(),
          legend.id,
          outcome,
          history.filter((m) => m.color === humanColor).length,
          new Date(),
          gameSettings.legendStrength,
        )
        profileStore.set(lr.profile)
        legendSummary = { name: legend.name, firstDefeat: lr.firstDefeat, coins: lr.coins, rewards: lr.rewards }
        unlocked = [...unlocked, ...lr.unlocked]
      }

      // Grand Campaign: stars, bounty, relics and realm progression.
      let campaignSummary: GameEndSummary['campaign'] = null
      let ironmanSummary: GameEndSummary['ironman'] = null
      const humanMoves = history.filter((m) => m.color === humanColor && !m.flags.includes('s')).length
      if (boss && outcome && battle?.kind === 'campaign') {
        // A broken mutator contract (Swift Hunt) forfeits the mutators' bonus: only the tier's factor stays.
        const kept = restrictionHonoured(battle, humanMoves) ? battle.rewardFactor : TIERS[battle.tier].rewardFactor
        const factor = kept * (battle.ironman ? IRONMAN_COIN_FACTOR : 1)
        const br = applyBossResult(profileStore.get(), boss, {
          outcome,
          humanMoves,
          clean: !casual,
          relics: battleRelics,
          rewardFactor: factor,
          tier: battle.tier,
        })
        profileStore.set(br.profile)
        if (battle.ironman) {
          const iron = applyIronmanResult(profileStore.get(), outcome, br.realmCleared)
          profileStore.set(iron.profile)
          ironmanSummary = { wiped: iron.wiped, lostBosses: iron.lostBosses, factor }
          unlocked = [...unlocked, ...iron.unlocked]
        }
        campaignSummary = {
          bossName: boss.name,
          stars: br.stars,
          previousStars: br.previousStars,
          firstClear: br.firstClear,
          coins: br.coins,
          relic: br.relic,
          realmCleared: br.realmCleared,
          rewards: br.rewards,
        }
        unlocked = [...unlocked, ...br.unlocked]
      }
      // Endless Gauntlet: the bank carries on (or the run ends).
      const gauntletSummary = boss && outcome && battle?.kind === 'gauntlet' ? finishGauntletBattle(boss, outcome, getClockTimesRef.current()[humanColor]) : null

      // World map, bounty board and the daily tournament.
      let arenaSummary: GameEndSummary['arena'] = null
      if (outcome && battle?.kind === 'event' && launchExtras.eventId) {
        const r = resolveAmbush(profileStore.get(), launchExtras.eventId, outcome === 'win')
        profileStore.set(r.profile)
        unlocked = [...unlocked, ...r.unlocked]
        arenaSummary = { title: 'Elite ambush', detail: outcome === 'win' ? 'The ambushers scatter.' : 'The ambushers vanish into the night.', coins: r.coins, potion: r.potion, success: outcome === 'win' }
      }
      if (outcome && battle?.kind === 'bounty' && launchExtras.bountyId) {
        const honoured = restrictionHonoured(battle, humanMoves)
        const success = outcome === 'win' && honoured
        const r = resolveBounty(profileStore.get(), launchExtras.bountyId, success)
        profileStore.set(r.profile)
        unlocked = [...unlocked, ...r.unlocked]
        const rule = battle.restriction ? RESTRICTIONS[battle.restriction].name : 'Contract'
        arenaSummary = {
          title: `Bounty · ${rule}`,
          detail: success ? 'Contract fulfilled.' : outcome === 'win' ? 'You won, but broke the contract — try again.' : 'Contract failed — it stays on the board.',
          coins: r.coins,
          potion: r.potion,
          success,
        }
      }
      if (outcome && battle?.kind === 'tournament') {
        const r = recordTournamentResult(profileStore.get(), outcome)
        if (r) {
          profileStore.set(r.profile)
          unlocked = [...unlocked, ...r.unlocked]
          arenaSummary = {
            title: r.champion ? 'Tournament champion!' : r.advanced ? 'You advance' : 'Eliminated',
            detail: r.champion ? 'The Chronos Cup is yours.' : r.advanced ? 'The next round awaits in the bracket.' : 'Better luck in tomorrow’s bracket.',
            coins: r.coins,
            potion: null,
            success: r.advanced,
          }
        }
      }
      // Lifetime feats from this battle (altar sacrifices, glue catches, cinematic mates).
      const killCamWin = outcome === 'win' && result.kind === 'checkmate'
      const bf = battleFeatsRef.current
      if (bf.sacrifices > 0 || bf.trapsSprung > 0 || killCamWin) {
        const p = profileStore.get()
        const feats = { ...p.feats, sacrifices: p.feats.sacrifices + bf.sacrifices, trapsSprung: p.feats.trapsSprung + bf.trapsSprung, killCams: p.feats.killCams + (killCamWin ? 1 : 0) }
        const ids = [...(feats.sacrifices > 0 ? ['blood-for-power'] : []), ...(feats.trapsSprung >= 3 ? ['trapper'] : [])]
        const granted = grant({ ...p, feats }, ids, new Date().toISOString())
        profileStore.set(granted.profile)
        unlocked = [...unlocked, ...granted.unlocked]
      }
      battleFeatsRef.current = { sacrifices: 0, trapsSprung: 0 }
      // Kill-cam: replay the mating blow before the results card.
      if (result.kind === 'checkmate' && !settingsStore.get().batterySaver) {
        const last = history[history.length - 1]
        const loser = opposite(result.winner)
        setKillCam({
          id: gameId,
          king: last ? kingSquare(last.after, loser) : null,
          move: last ? { from: last.from, to: last.to, san: last.san } : null,
          youWon: ai ? outcome === 'win' : true,
          caption: ai ? (outcome === 'win' ? `${persona?.name ?? 'Stockfish'} falls` : 'Checkmate') : `${result.winner === 'w' ? 'White' : 'Black'} wins`,
        })
        sfx.killCam(ai ? outcome === 'win' : true)
        pushBoardFx({ kind: 'mate', square: last ? kingSquare(last.after, loser) : null })
        window.setTimeout(() => setKillCam((k) => (k?.id === gameId ? null : k)), KILL_CAM_MS)
      }
      if (persona && outcome) personaSay(persona, outcome === 'win' ? 'legendLoses' : outcome === 'loss' ? 'legendWins' : 'draw')
      trackQuestEvents(matchQuestEvents(matchInput), 1400 + unlocked.length * 1100)
      // World War: the map moves (conquest, sieges, counter-attacks) and your army's spoils are paid.
      let warSummary: GameEndSummary['war'] = null
      const warState = profileStore.get().war
      if (war && outcome && warState) {
        const r = resolveBattle(warState, war.territoryId, war.mode, outcome === 'win')
        const spoils = outcome === 'win' ? Math.round(((out.coins + r.coins) * war.effects.spoils) / 100) : 0
        const coins = r.coins + spoils
        const ids = [...(outcome === 'win' && war.mode === 'attack' ? ['first-conquest'] : []), ...(r.factionFallen ? ['empire-breaker'] : []), ...(r.warWon ? ['world-conqueror'] : [])]
        const p = profileStore.get()
        const granted = grant({ ...p, war: r.state, coins: p.coins + coins, totalCoinsEarned: p.totalCoinsEarned + coins }, ids, new Date().toISOString())
        profileStore.set(granted.profile)
        unlocked = [...unlocked, ...granted.unlocked]
        warSummary = { territory: getTerritory(war.territoryId)?.name ?? war.territoryId, events: r.events, coins, spoils }
      }
      setSummary({
        result,
        outcome,
        eloDelta: out.eloDelta,
        eloAfter: out.record.eloAfter,
        coins: out.coins,
        unlocked,
        matchId: out.record.id,
        rated: out.record.rated,
        legend: legendSummary,
        campaign: campaignSummary,
        gauntlet: gauntletSummary,
        ironman: ironmanSummary,
        arena: arenaSummary,
        war: warSummary,
      })
      setGameOverDismissed(false)

      if (result.kind === 'timeout') sfx.timeout()
      else if (result.kind === 'draw') sfx.draw()
      else if (!ai || outcome === 'win') sfx.victory()
      else sfx.defeat()
      if (ai ? outcome === 'win' : result.kind !== 'draw') setCelebration((c) => c + 1)
      if (out.coins > 0 || legendSummary?.coins || campaignSummary?.coins || arenaSummary?.coins || warSummary?.coins) window.setTimeout(() => sfx.coins(), 900)
      if (ironmanSummary?.wiped) window.setTimeout(() => showToast('warning', 'Ironman run lost', `Permadeath: ${ironmanSummary.lostBosses} conquered bosses fall back into darkness.`, 6000), 1200)
      announceAchievements(unlocked, 1400)
    },
    [aiColor, battle, battleRelics, boss, casual, classic, game, gameId, gameSettings, humanColor, launchExtras.bountyId, launchExtras.eventId, legend, persona, playerNames, pushBoardFx, timeControl, war],
  )

  const handleFlag = useCallback(
    (color: Color) => {
      if (game.externalResult || game.getLiveBoardResult()) return
      const winner = opposite(color)
      const result: GameResult = game.canColorMate(winner) ? { kind: 'timeout', winner } : { kind: 'draw', reason: 'timeout-insufficient' }
      playEngine.stop()
      game.setExternalResult(result)
      finishGame(result)
    },
    [finishGame, game, playEngine],
  )

  const clock = useChessClock({
    timeControl,
    activeColor: game.turn,
    running: isPlaying && active && visible && game.history.length > 0,
    onFlag: handleFlag,
    tickMs: settings.batterySaver ? 250 : 100,
  })

  useEffect(() => {
    getClockTimesRef.current = clock.getTimes
  }, [clock.getTimes])

  // ── Spells, tactics & taunts ───────────────────────────────────────────────
  const flash = useCallback((text: string, tone: SpellFlash['tone']) => {
    flashIdRef.current += 1
    setSpellFlash({ id: flashIdRef.current, text, tone })
  }, [])

  /** Dynamic reaction to a board event; classic check lines keep the legends' own voice half the time. */
  const react = useCallback(
    (event: TauntEvent) => {
      if (!persona) return
      if ((event.kind === 'check-given' || event.kind === 'in-check') && Math.random() < 0.5) {
        personaSay(persona, event.kind === 'check-given' ? 'checkGiven' : 'inCheck', 0.8)
        return
      }
      personaTaunt(persona, event, Math.min(1, event.priority / 100 + 0.15))
    },
    [persona],
  )

  const emitBattleEvents = useCallback(
    (events: readonly BattleEvent[]) => {
      for (const e of events) {
        const fx = boardFxFor(e)
        if (fx) pushBoardFx(fx)
        if (e.kind === 'clock') {
          clock.adjust(e.side === 'human' ? humanColor : aiColor, e.deltaMs)
          showToast('info', e.reason, `${e.side === 'human' ? 'You gain' : `${persona?.name ?? 'Opponent'} gains`} ${Math.round(e.deltaMs / 1000)} s`, 2400)
        } else if (e.kind === 'spell-warning') {
          const spell = SPELLS[e.spell]
          sfx.spellWarning()
          flash(`${spell.name} charging`, 'gold')
          showToast('warning', `${spell.name} incoming`, spell.description, 3200)
        } else if (e.kind === 'spell-cast') {
          const spell = SPELLS[e.spell]
          sfx.spellCast()
          flash(spell.name, 'danger')
          const turns = spell.duration ?? 1
          showToast('warning', spell.name, e.square ? `${e.square.toUpperCase()} is frozen for your next ${turns === 1 ? 'move' : `${turns} moves`}.` : spell.description, 3200)
          react({ kind: 'spell-cast', mood: 'smug', priority: 88, vars: { spell: spell.name } })
        } else if (e.kind === 'spell-blocked') {
          sfx.achievement()
          flash('Spell warded', 'accent')
          showToast('success', 'Spell Ward', `${SPELLS[e.spell].name} was blocked.`, 2800)
          react({ kind: 'spell-blocked', mood: 'angry', priority: 86, vars: { spell: SPELLS[e.spell].name } })
        } else if (e.kind === 'tactic') {
          flash(getTactic(e.tactic).name, 'accent')
          showToast('success', getTactic(e.tactic).name, e.detail, 2600)
          if (e.tactic === 'katana-blade') react({ kind: 'tactic-used', mood: 'angry', priority: 84, vars: {} })
        } else if (e.kind === 'trap') {
          if (e.sprung) {
            battleFeatsRef.current.trapsSprung += 1
            sfx.trap()
            flash('Caught in glue!', 'gold')
            react({ kind: 'tactic-used', mood: 'angry', priority: 84, vars: {} })
          }
          showToast(e.sprung ? 'success' : 'info', e.sprung ? 'Glue trap' : 'Arena', e.detail, 2600)
        } else if (e.kind === 'weather') {
          flash(e.detail, 'accent')
        } else {
          sfx.potion()
          flash(POTIONS[e.potion].name, 'gold')
          showToast('success', POTIONS[e.potion].name, e.detail, 2400)
        }
      }
    },
    [aiColor, clock, flash, humanColor, persona, pushBoardFx, react],
  )

  // ── Moves ──────────────────────────────────────────────────────────────────
  /**
   * Book-keeping shared by every ply (normal, special or pass): clocks, sound,
   * taunts, opening names, spell / tactic effects and the game result.
   */
  const commitPly = useCallback(
    (move: Move, before: ClockTimes): void => {
      const mover: 'human' | 'boss' = isAiMode && move.color === aiColor ? 'boss' : 'human'
      clockSnapshotsRef.current.push(before)
      if (!move.flags.includes('z') && !move.flags.includes('s')) clock.addIncrement(move.color)
      timeMachine.goTo(null)
      sfx.move(material, move, givesCheck(move))

      const history = game.getLiveHistory()
      const ply = history.length
      if (persona && isAiMode) {
        const taunt = analyzeTaunt({ mover, move, fen: move.after, humanColor, evalSwingCp: null, ply })
        if (taunt) react(taunt)
      }

      const detected = detectOpening(history)
      if (detected && detected.ply === ply && detected.name !== lastOpeningRef.current) {
        lastOpeningRef.current = detected.name
        showToast('opening', detected.name, detected.eco, 2600)
      }

      let result = game.getLiveBoardResult()
      // Severe check: the opponent checks you and few replies remain — the screen shudders.
      if (!result && isAiMode && mover === 'boss' && givesCheck(move)) {
        try {
          if (new Chess(move.after).moves().length <= 3) {
            setSevereCheck((n) => n + 1)
            pushBoardFx({ kind: 'check', square: kingSquare(move.after, humanColor) })
            sfx.severeCheck()
          }
        } catch {
          // Unparseable position: no shake.
        }
      }
      let passBoss = false
      if (battle) {
        const previous = effectsLogRef.current[ply - 1] ?? createEffects(battle)
        const thinkMs = mover === 'human' && turnStartRef.current > 0 ? performance.now() - turnStartRef.current : 0
        const out = afterPly(previous, { setup: battle, mover, move, fen: move.after, humanColor, thinkMs, clocks: clock.getTimes(), rng: rngRef.current })
        effectsLogRef.current = [...effectsLogRef.current.slice(0, ply), out.effects]
        setEffectsLog(effectsLogRef.current)
        if (!result) {
          emitBattleEvents(out.events)
          passBoss = out.passBoss
        }
      }

      // Katana Blade: the boss loses this turn — recorded as a pass ply.
      if (!result && passBoss) {
        const pass = passTurn(game.getFen())
        const passBefore = clock.getTimes()
        if (pass && game.applySpecial(pass)) {
          clockSnapshotsRef.current.push(passBefore)
          // A pass changes no spell state: the snapshot after it equals the one before.
          const unchanged = effectsLogRef.current[ply]
          if (unchanged) effectsLogRef.current = [...effectsLogRef.current.slice(0, ply + 1), unchanged]
          setEffectsLog(effectsLogRef.current)
          result = game.getLiveBoardResult()
        }
      }
      if (mover === 'boss' || passBoss) turnStartRef.current = performance.now()
      if (result) finishGame(result)
    },
    [aiColor, battle, clock, emitBattleEvents, finishGame, game, humanColor, isAiMode, material, persona, pushBoardFx, react, timeMachine],
  )

  /** The player's (or a local game's) move; also accepts spell / tactic moves the board offers. */
  const applyMove = useCallback(
    (input: MoveInput): Move | null => {
      const before = clock.getTimes()
      const fen = game.getFen()
      const sideToMove = fen.split(' ')[1] === 'b' ? 'b' : 'w'
      const humanTurn = !isAiMode || sideToMove === humanColor
      const current = battle ? (effectsLogRef.current[game.getLiveHistory().length] ?? null) : null
      if (battle && humanTurn && current && isAiMode) {
        const legal = new Chess(fen).moves({ verbose: true }).find((m) => m.from === input.from && m.to === input.to)
        const refusal = legal ? moveRefusal(current, battle, fen, legal, 'human') : null
        if (refusal) {
          sfx.error()
          showToast('warning', 'Arena rule', refusal, 2400)
          return null
        }
      }
      let move = game.makeMove(input)
      if (!move && battle && humanTurn && current) {
        const special = humanSpecialMoves(current, battle, fen, humanColor).find((s) => s.from === input.from && s.to === input.to)
        if (special) move = game.applySpecial(special)
      }
      if (move) setPickMode(null)
      if (!move) {
        sfx.error()
        return null
      }
      commitPly(move, before)
      return move
    },
    [battle, clock, commitPly, game, humanColor, isAiMode],
  )

  /** The opponent casts a rule-bending move (Berserker Charge, Shadow Step). */
  const applyOpponentSpecial = useCallback(
    (special: SpecialMove) => {
      const before = clock.getTimes()
      const move = game.applySpecial(special)
      if (!move) return
      if (persona && battle) {
        const spell = battle.spells.find((id) => (special.kind === 'leap' ? SPELLS[id].mechanic === 'shadow-step' : SPELLS[id].mechanic === 'berserker'))
        if (spell) flash(SPELLS[spell].name, 'danger')
      }
      commitPly(move, before)
    },
    [battle, clock, commitPly, flash, game, persona],
  )

  /** Arena rules for the opponent's search (glue, snow, wind). */
  const getOpponentAllowed = useCallback((): string[] | null => {
    if (!battle) return null
    const current = effectsLogRef.current[game.getLiveHistory().length]
    return current ? bossSearchMoves(current, battle, game.getFen()) : null
  }, [battle, game])

  const getOpponentSpecials = useCallback((): SpecialMove[] => {
    if (!battle) return []
    const current = effectsLogRef.current[game.getLiveHistory().length]
    return current ? bossSpecialMoves(current, battle, game.getFen(), aiColor) : []
  }, [aiColor, battle, game])

  /** Blunder / brilliancy detection from the opponent's own search (no extra engine work). */
  const onOpponentEval = useCallback(
    (cp: number) => {
      const previous = bossEvalRef.current
      if (previous === null || !persona) return
      const swing = cp - previous
      if (swing >= 250) react({ kind: 'blunder', mood: 'smug', priority: 85, vars: {} })
      else if (swing <= -250) react({ kind: 'brilliance', mood: 'shocked', priority: 84, vars: {} })
    },
    [persona, react],
  )
  const onOpponentChosen = useCallback((cp: number | null) => {
    bossEvalRef.current = cp
  }, [])

  const isAiTurn = isAiMode && isPlaying && game.turn === aiColor
  useAiOpponent({
    engine: playEngine,
    fen: game.fen,
    active: isAiTurn && active && visible,
    profile: opponent,
    gameId,
    getFen: game.getFen,
    getHistory: game.getLiveHistory,
    onMove: applyMove,
    onThink: persona ? () => personaSay(persona, 'thinking', 0.12) : undefined,
    getSpecials: getOpponentSpecials,
    onSpecial: applyOpponentSpecial,
    onEval: onOpponentEval,
    onChosen: onOpponentChosen,
    getAllowedMoves: getOpponentAllowed,
  })
  const aiThinking = isAiTurn && playEngine.status === 'ready'

  // ── Adaptive soundtrack & low-time warning ─────────────────────────────────
  const humanClockColor: Color | null = isAiMode ? humanColor : isPlaying && game.status.kind === 'playing' ? game.status.turn : null
  const lowTime = clock.enabled && humanClockColor !== null && clock.times[humanClockColor] < 15_000
  const tension = gameTension(game.status, evaluation?.cp ?? null, lowTime)
  useEffect(() => {
    ambientMusic.setTension(tension)
  }, [tension])

  const lowTimeSecond =
    clock.enabled && isPlaying && humanClockColor === game.turn && clock.times[game.turn] < 10_000
      ? Math.ceil(clock.times[game.turn] / 1000)
      : null
  useEffect(() => {
    if (lowTimeSecond !== null && lowTimeSecond > 0) sfx.lowTime()
  }, [lowTimeSecond])

  // ── Character reactions to the flow of the game ───────────────────────────
  const legendAdvantage = persona && evaluation && isPlaying && timeMachine.isLive ? (aiColor === 'w' ? evaluation.cp : -evaluation.cp) : null
  const advantageBand = legendAdvantage === null ? null : legendAdvantage > 250 ? 'up' : legendAdvantage < -250 ? 'down' : 'even'
  const bandRef = useRef<string | null>(null)
  useEffect(() => {
    const previous = bandRef.current
    bandRef.current = advantageBand
    if (!persona || advantageBand === null || previous === null || previous === advantageBand) return
    if (advantageBand === 'up') personaSay(persona, 'advantage', 0.9)
    else if (advantageBand === 'down') personaSay(persona, 'disadvantage', 0.9)
  }, [advantageBand, persona])

  const playerToMove = Boolean(persona) && isPlaying && game.turn === humanColor && active && visible
  useEffect(() => {
    if (!playerToMove || !persona) return
    // Taking too long: a clock-aware jab (or the character's own line).
    const id = window.setTimeout(() => {
      if (Math.random() < 0.5) personaSay(persona, 'playerSlow')
      else personaTaunt(persona, { kind: 'long-think', mood: 'smug', priority: 50, vars: { seconds: '25' } })
    }, 25_000)
    return () => window.clearTimeout(id)
  }, [game.fen, persona, playerToMove])

  // Time trouble: one urgent taunt when your clock first drops under 20 s.
  const humanInTimeTrouble = Boolean(persona) && clock.enabled && isPlaying && clock.times[humanColor] < 20_000
  useEffect(() => {
    if (!humanInTimeTrouble || !persona || timeTroubleRef.current) return
    timeTroubleRef.current = true
    personaTaunt(persona, { kind: 'time-trouble', mood: 'smug', priority: 82, vars: {} })
  }, [humanInTimeTrouble, persona])

  // ── Commands ───────────────────────────────────────────────────────────────
  const movableColor: Color | null =
    isPlaying && timeMachine.isLive && (!isAiMode || game.turn === humanColor) ? game.turn : null

  const isCampaignBattle = battle?.kind === 'campaign'
  const isGauntletBattle = battle?.kind === 'gauntlet'
  const undoPlies = (() => {
    if (!isPlaying) return 0
    if (!isAiMode) return game.history.length > 0 ? 1 : 0
    // The Gauntlet forbids takebacks unless an Aegis boon granted one; Ironman forbids them outright.
    if (isGauntletBattle && launchExtras.freeUndos <= 0) return 0
    if (battle?.ironman) return 0
    const plies = game.turn === humanColor ? 2 : 1
    return game.history.length >= plies ? plies : 0
  })()

  // Shield of Kings: one free takeback early in a campaign battle.
  const shieldReady = isCampaignBattle && battleRelics.includes('shield-of-kings') && !shieldUsed && Math.ceil(game.history.length / 2) <= SHIELD_MOVE_LIMIT
  /** What a takeback would cost right now in a campaign battle (null = nothing at stake). */
  const undoCost: 'shield' | 'stars' | null = isAiMode && isCampaignBattle && !casual && undoPlies > 0 ? (shieldReady ? 'shield' : 'stars') : null

  const undo = useCallback(() => {
    if (undoPlies === 0) return
    playEngine.stop()
    const undone = game.undo(undoPlies)
    const snapshots = clockSnapshotsRef.current
    const restoreTo = snapshots[snapshots.length - undone]
    snapshots.splice(snapshots.length - undone, undone)
    if (restoreTo) clock.restore(restoreTo)
    timeMachine.goTo(null)
    // Spell / tactic state rewinds with the position.
    effectsLogRef.current = effectsLogRef.current.slice(0, Math.max(1, game.getLiveHistory().length + 1))
    setEffectsLog(effectsLogRef.current)
    setPickMode(null)
    turnStartRef.current = performance.now()
    bossEvalRef.current = null
    if (isGauntletBattle || (war && launchExtras.freeUndos > 0)) {
      setLaunchExtras((x) => ({ ...x, freeUndos: Math.max(0, x.freeUndos - 1) }))
      showToast('info', war ? 'Second chance' : 'Aegis', war ? 'Your army’s free takeback is spent; the battle stays rated.' : 'Your free takeback is spent.', 2400)
      return
    }
    if (isAiMode && !casual) {
      if (shieldReady) {
        setShieldUsed(true)
        showToast('info', 'Shield of Kings', 'The relic absorbed this takeback — the battle stays rated.', 2800)
      } else {
        setCasual(true)
        showToast('info', 'Casual game', boss ? 'Takebacks make this battle unrated and cap it at one star.' : 'Takebacks make this game unrated.', 2800)
      }
    }
  }, [boss, casual, clock, game, isAiMode, isGauntletBattle, launchExtras.freeUndos, playEngine, shieldReady, timeMachine, undoPlies, war])

  /** Engine help mid-game (the brain, the What-If engine) makes a rated game casual, like a takeback. */
  const makeCasual = useCallback(
    (why: string) => {
      if (!isAiMode || casual || !isPlaying) return
      setCasual(true)
      showToast('info', 'Casual game', `${why} makes this game unrated.`, 2800)
    },
    [casual, isAiMode, isPlaying],
  )

  const resign = useCallback(() => {
    if (!isPlaying) return
    const loser = isAiMode ? humanColor : game.turn
    const result: GameResult = { kind: 'resign', winner: opposite(loser) }
    playEngine.stop()
    game.setExternalResult(result)
    finishGame(result)
  }, [finishGame, game, humanColor, isAiMode, isPlaying, playEngine])

  const startNewGame = useCallback(
    (next: GameSettings, launch?: BattleLaunch) => {
      // Leaving a Gauntlet battle unfinished forfeits the run.
      if (battle?.kind === 'gauntlet' && recordedGameRef.current !== gameId) endGauntletRun()
      const color = resolveColor(next)
      // Gauntlet clocks are per-run, not the player's preferred time control.
      if (launch?.kind !== 'gauntlet') updateSettings({ game: next })
      playEngine.stop()
      playEngine.newGame()
      analysis.cancel()
      setGameSettings(next)
      setHumanColor(color)
      setOrientation(next.mode === 'ai' ? color : 'w')
      game.reset()
      clockSnapshotsRef.current = []
      const tc = resolveTimeControl(next)
      clock.reset(tc)
      const challengerBoss = next.mode === 'ai' && next.bossId ? getCachedBoss(next.bossId) : null
      const challengerClassic = next.mode === 'ai' && !next.bossId && !next.legendId && next.classicId ? getClassic(next.classicId) : null
      const memory = profileStore.get().memory
      setMemoryAtStart(memory)
      const challengerBase = challengerBoss
        ? bossPersona(challengerBoss)
        : next.mode === 'ai' && next.legendId
          ? legendPersona(getLegend(next.legendId), next.legendStrength)
          : challengerClassic
            ? classicPersona(challengerClassic, settingsStore.get().classicAvatar)
            : next.mode === 'ai' && next.ghost
              ? ghostPersona(fingerprint(profileStore.get().matches, profileStore.get().elo), profileStore.get().name)
              : null
      const challenger = challengerBase ? withMemory(challengerBase, memory[challengerBase.key]) : null
      // World War: your army's briefing, and what the scouts found out.
      if (launch?.war && challenger) {
        const brief = launch.war.effects.briefing
        if (brief.length > 0) window.setTimeout(() => showToast('info', 'Your army', brief.join(' · '), 6000), 2400)
        const book = launch.war.effects.scout ? challenger.profile.repertoire?.[color === 'w' ? 'b' : 'w']?.[0] : undefined
        if (book) window.setTimeout(() => showToast('info', 'Scouts report', `${challenger.name} favours ${book.split(' ').slice(0, 6).join(' ')}…`, 6000), 3600)
      }
      const kind: BattleKind = launch?.kind ?? (challengerBoss ? 'campaign' : 'legend')
      // Shrine blessings join the next campaign battle's tactics.
      let tactics: readonly TacticId[] = launch?.tactics ?? []
      if (kind === 'campaign' && challengerBoss) {
        const blessed = consumeBlessings(profileStore.get())
        if (blessed.blessings.length > 0) {
          profileStore.set(blessed.profile)
          tactics = [...tactics, ...blessed.blessings]
          const names = blessed.blessings.map((t) => getTactic(t).name).join(', ')
          window.setTimeout(() => showToast('success', 'Shrine blessing', names, 3200), 2200)
        }
      }
      const ironman = kind === 'campaign' && profileStore.get().ironman.enabled
      // Campaign relics are fixed for the whole battle (other modes don't use them).
      const campaign = profileStore.get().campaign
      const relics = challengerBoss && kind === 'campaign' ? activeRelics(campaign.relics, campaign.equipped) : []
      setBattleRelics(relics)
      setShieldUsed(false)
      if (relics.includes('dragonheart-ember') && tc.initialMs > 0) {
        clock.restore({ w: tc.initialMs, b: tc.initialMs, [color]: tc.initialMs + EMBER_BONUS_MS })
      }
      if (launch?.humanClockMs !== undefined && tc.initialMs > 0) {
        clock.restore({ w: tc.initialMs, b: tc.initialMs, [color]: launch.humanClockMs })
      }
      // Spells & tactics for character battles.
      // Classic Chess is pure chess: no spells, tactics, weather or contracts — no battle setup at all.
      const setup = challenger && !challengerClassic ? buildBattleSetup(kind, challenger.spells, tactics, tc.initialMs > 0, campaign.relics, { ...launch?.arena, ironman }) : null
      setBattle(setup)
      effectsLogRef.current = setup ? [createEffects(setup)] : []
      setEffectsLog(effectsLogRef.current)
      setLaunchExtras({ emp: launch?.emp ?? false, freeUndos: launch?.freeUndos ?? launch?.war?.effects.takebacks ?? 0, eventId: launch?.eventId ?? null, bountyId: launch?.bountyId ?? null, war: launch?.war ?? null })
      setSpellFlash(null)
      setPickMode(null)
      setKillCam(null)
      battleFeatsRef.current = { sacrifices: 0, trapsSprung: 0 }
      rngRef.current = seededRandom(hashSeed(`${challenger?.key ?? 'game'}:${Date.now()}`))
      turnStartRef.current = performance.now()
      bossEvalRef.current = null
      timeTroubleRef.current = false
      lastOpeningRef.current = null
      setCasual(false)
      setSummary(null)
      setReview(null)
      setGameOverDismissed(false)
      setAnalysisRequestedFor(null)
      setGameId((id) => id + 1)
      if (challenger) {
        sfx.timeTravel()
        const reply = launch?.parleyReply
        window.setTimeout(() => (reply ? personaLine(challenger, reply.text, reply.mood) : personaSay(challenger, 'intro')), 1700)
        if (setup && setup.spells.length > 0) {
          const names = setup.spells.map((id) => SPELLS[id].name).join(', ')
          window.setTimeout(() => showToast('warning', `${challenger.name} wields ${names}`, SPELLS[setup.spells[0] ?? 'frost-sigil'].trigger, 4200), 2600)
        }
        if (setup && setup.weather !== 'clear') window.setTimeout(() => showToast('info', WEATHER[setup.weather].name, WEATHER[setup.weather].description, 4200), 3400)
        if (setup?.restriction) window.setTimeout(() => showToast('warning', `Contract: ${RESTRICTIONS[setup.restriction ?? 'pawnless'].name}`, RESTRICTIONS[setup.restriction ?? 'pawnless'].description, 4200), 4200)
        if (ironman) window.setTimeout(() => showToast('warning', 'Ironman battle', 'No takebacks. A defeat ends this run.', 3600), 900)
      } else {
        sfx.notify()
      }
    },
    [analysis, battle, clock, game, gameId, playEngine],
  )

  const loadReview = useCallback(
    (match: MatchRecord) => {
      playEngine.stop()
      analysis.cancel()
      if (!game.loadGame(match.pgn, match.result, match.variant ?? [])) {
        showToast('warning', 'Could not open game', 'The saved PGN is invalid.')
        return
      }
      setReview(match)
      setBattle(null)
      setPickMode(null)
      setKillCam(null)
      effectsLogRef.current = []
      setEffectsLog([])
      // Campaign reviews show the boss once its realm chunk arrives.
      // (A failed download just leaves the generic opponent bar; the map offers a retry.)
      if (match.bossId) loadRealmRoster(realmOfBoss(match.bossId)).catch(() => undefined)
      setOrientation(match.humanColor ?? 'w')
      setSummary(null)
      setGameOverDismissed(true)
      setGameId((id) => id + 1)
    },
    [analysis, game, playEngine],
  )

  const humanColorRef = useRef(humanColor)
  useEffect(() => {
    humanColorRef.current = humanColor
  }, [humanColor])

  const onAnalysisDone = useCallback((result: GameAnalysis) => {
    const s = summaryRef.current
    const r = reviewRef.current
    const color = r ? r.humanColor : s && s.outcome !== null ? humanColorRef.current : null
    const accuracy = color ? result.accuracy[color] : null
    const won = r ? r.outcome === 'win' : s?.outcome === 'win'
    const out = applyAnalysis(profileStore.get(), r?.id ?? s?.matchId ?? null, accuracy, won, new Date(), color ? summarizeAnalysis(result, color) : null)
    profileStore.set(out.profile)
    announceAchievements(out.unlocked, 300)
    trackQuestEvents({ analyses: 1 }, 600)
  }, [])
  const requestAnalysis = useCallback(() => {
    setAnalysisRequestedFor(gameKey)
    setGameOverDismissed(true)
  }, [gameKey])

  const { run: runAnalysis, state: analysisState, engineReady: analysisReady } = analysis
  useEffect(() => {
    if (analysisWanted && analysisReady && analysisState.status === 'idle') void runAnalysis(onAnalysisDone)
  }, [analysisReady, analysisState.status, analysisWanted, onAnalysisDone, runAnalysis])

  const flipBoard = useCallback(() => setOrientation((o) => opposite(o)), [])
  const dismissGameOver = useCallback(() => setGameOverDismissed(true), [])

  const getPgn = useCallback(() => {
    if (review) return review.pgn
    const openingName = detectOpening(game.history)?.name
    return game.buildPgn({ white: playerNames('w'), black: playerNames('b'), ...(openingName ? { opening: openingName } : {}) }, game.result)
  }, [game, playerNames, review])

  // ── Derived view data ──────────────────────────────────────────────────────
  const visibleHistory = useMemo(() => game.history.slice(0, displayPly), [displayPly, game.history])
  const captured = useMemo(() => getCapturedPieces(visibleHistory), [visibleHistory])
  const lastMove = visibleHistory[visibleHistory.length - 1] ?? null

  // A Classic Chess character chosen as your avatar (portrait only — it never speaks for you).
  const classicAvatar = settings.classicAvatar ? getClassic(settings.classicAvatar) : null
  const avatarCharacter = useMemo<PlayerInfo['character']>(() => {
    if (!classicAvatar) return null
    const p = classicPersona(classicAvatar)
    return { key: `avatar:${classicAvatar.id}`, name: p.name, portrait: p.portrait }
  }, [classicAvatar])
  const players: Record<Color, PlayerInfo> = useMemo(() => {
    const info = (color: Color): PlayerInfo => {
      const thinking = aiThinking && color === aiColor
      const isTurn = game.status.kind === 'playing' && game.status.turn === color
      const low = clock.enabled && clock.times[color] < 15_000
      const mood = deriveMood({ color, status: game.status, evalCp: evaluation?.cp ?? null, isTurn, thinking, lowTime: low })
      if (review) {
        const isHuman = review.mode === 'ai' && review.humanColor === color
        const isEngine = review.mode === 'ai' && !isHuman
        if (isEngine && reviewPersona) {
          return { color, name: reviewPersona.name, subtitle: reviewPersona.title, isEngine, mood, character: characterOf(reviewPersona) }
        }
        return {
          color,
          name: isHuman ? profileStore.get().name : isEngine ? 'Stockfish' : color === 'w' ? 'White' : 'Black',
          subtitle: isEngine ? review.opponent.replace(/^Stockfish \(|\)$/g, '') : review.mode === 'ai' ? 'Review' : 'Local player',
          isEngine,
          mood,
          character: null,
        }
      }
      if (persona && color === aiColor) {
        const strength = gameSettings.legendStrength
        const tier = boss || strength === 'authentic' ? '' : ` · ${strengthInfo(strength).label}`
        return { color, name: persona.name, subtitle: `${persona.title} · ~${persona.elo}${tier}`, isEngine: true, mood, character: characterOf(persona) }
      }
      if (isAiMode && color === aiColor) {
        return {
          character: null,
          color,
          name: 'Stockfish',
          subtitle: `${difficultyLabel} · ${personality?.name ?? 'Balanced'}`,
          isEngine: true,
          mood,
        }
      }
      if (isAiMode) {
        const profile = profileStore.get()
        const title = displayTitle({ profile, gauntletBest: gauntletStore.get().record.bestStreak }).name
        return { color, name: profile.name, subtitle: `${title} · ${profile.elo} Elo${casual ? ' · casual' : ''}`, isEngine: false, mood, character: avatarCharacter }
      }
      return { color, name: color === 'w' ? 'White' : 'Black', subtitle: 'Local player', isEngine: false, mood, character: null }
    }
    return { w: info('w'), b: info('b') }
  }, [aiColor, aiThinking, avatarCharacter, boss, casual, clock.enabled, clock.times, difficultyLabel, evaluation, game.status, gameSettings.legendStrength, isAiMode, persona, personality, review, reviewPersona])

  const bestMoveArrow =
    !timeMachine.isLive && analysis.state.status === 'done' && evaluation?.bestMove
      ? { from: evaluation.bestMove.slice(0, 2), to: evaluation.bestMove.slice(2, 4) }
      : null

  // Spell / tactic / arena overlays for the board.
  const yourLiveTurn = Boolean(battle) && isAiMode && isPlaying && timeMachine.isLive && game.turn === humanColor
  const specialTargets = useMemo(
    () => (yourLiveTurn && effects && battle ? humanSpecialMoves(effects, battle, game.fen, humanColor).map((m) => ({ from: m.from, to: m.to, kind: m.kind })) : []),
    [battle, effects, game.fen, humanColor, yourLiveTurn],
  )
  const arena = useMemo<BoardArena | null>(() => {
    if (!battle || !effects || !isAiMode || !timeMachine.isLive || review) return null
    const fen = game.fen
    return {
      frozen: frostSquares(effects),
      snow: effects.weather.id === 'snow' ? effects.weather.snow : [],
      glue: glueSquares(effects),
      stuck: effects.stuck.map((s) => s.square),
      isBlocked: (m: Move) => moveRefusal(effects, battle, fen, m, 'human') !== null,
    }
  }, [battle, effects, game.fen, isAiMode, review, timeMachine.isLive])

  // ── Potions, glue traps & the Sacrifice Altar (no move spent) ─────────────
  /** Replaces the effect snapshot of the current ply (actions that cost no move). */
  const replaceCurrentEffects = useCallback((next: BattleEffects) => {
    const ply = game.getLiveHistory().length
    effectsLogRef.current = [...effectsLogRef.current.slice(0, ply), next]
    setEffectsLog(effectsLogRef.current)
  }, [game])

  const currentEffects = useCallback((): BattleEffects | null => (battle ? (effectsLogRef.current[game.getLiveHistory().length] ?? null) : null), [battle, game])

  const drinkPotion = useCallback(
    (potion: PotionId) => {
      const fx = currentEffects()
      if (!battle || !fx || !yourLiveTurn) return
      const def = POTIONS[potion]
      const out = applyPotion(fx, battle, potion)
      if (!out.ok) {
        sfx.error()
        showToast('warning', def.name, out.reason, 2400)
        return
      }
      const consumed = consumePotion(profileStore.get(), potion)
      if (!consumed) {
        showToast('warning', def.name, 'You have none left — merchants and bounties sell more.', 2400)
        return
      }
      profileStore.set(consumed.profile)
      announceAchievements(consumed.unlocked, 600)
      replaceCurrentEffects(out.effects)
      emitBattleEvents(out.events)
      setPickMode(potion === 'trap-kit' ? 'glue' : null)
    },
    [battle, currentEffects, emitBattleEvents, replaceCurrentEffects, yourLiveTurn],
  )

  const layGlue = useCallback(
    (square: Square) => {
      const fx = currentEffects()
      if (!fx || !yourLiveTurn) return
      const out = placeGlue(fx, game.getFen(), square)
      if (!out.ok) {
        sfx.error()
        showToast('warning', 'Glue trap', out.reason, 2400)
        return
      }
      sfx.place(material)
      replaceCurrentEffects(out.effects)
      emitBattleEvents(out.events)
      if (out.effects.glueCharges <= 0) setPickMode(null)
    },
    [currentEffects, emitBattleEvents, game, material, replaceCurrentEffects, yourLiveTurn],
  )

  const sacrifice = useCallback(
    (square: Square) => {
      const fx = currentEffects()
      if (!fx || !yourLiveTurn || !altarCandidates(fx, game.getFen(), humanColor).includes(square)) return
      const special = sacrificePawn(game.getFen(), square, humanColor)
      const before = clock.getTimes()
      const move = special ? game.applySpecial(special) : null
      if (!move) return
      battleFeatsRef.current.sacrifices += 1
      setPickMode(null)
      flash('Blood for power', 'danger')
      commitPly(move, before)
    },
    [clock, commitPly, currentEffects, flash, game, humanColor, yourLiveTurn],
  )

  const altarSquares = useMemo(() => (yourLiveTurn && effects ? altarCandidates(effects, game.fen, humanColor) : []), [effects, game.fen, humanColor, yourLiveTurn])
  const livePickMode: PickMode = yourLiveTurn ? pickMode : null
  const picker = useMemo<BoardPicker | null>(() => {
    if (livePickMode === 'altar') return { squares: altarSquares, tone: 'altar', onPick: sacrifice }
    if (livePickMode === 'glue' && effects) {
      const occupied = new Set<string>()
      for (const row of new Chess(game.fen).board()) for (const cell of row) if (cell) occupied.add(cell.square)
      const trapped = new Set(effects.traps.map((t) => t.square))
      const squares: Square[] = []
      for (const f of 'abcdefgh') for (let r = 1; r <= 8; r++) {
        const sq = `${f}${r}` as Square
        if (!occupied.has(sq) && !trapped.has(sq)) squares.push(sq)
      }
      return { squares, tone: 'glue', onPick: layGlue }
    }
    return null
  }, [altarSquares, effects, game.fen, layGlue, livePickMode, sacrifice])

  const alignment: Alignment | null = persona ? (persona.tone === 'cold' ? 'light' : 'dark') : null

  return {
    settings,
    gameSettings,
    battle,
    effects,
    arena,
    picker,
    pickMode: livePickMode,
    setPickMode,
    altarSquares,
    drinkPotion,
    killCam,
    severeCheck,
    alignment,
    yourLiveTurn,
    specialTargets,
    spellFlash,
    boardFx,
    freeUndos: launchExtras.freeUndos,
    theme,
    pieceSet,
    legend,
    boss,
    persona,
    stage,
    battleRelics,
    shieldUsed,
    opponentName: persona?.name ?? 'Stockfish',
    timeControl,
    humanColor,
    orientation,
    gameKey,
    isAiMode,
    review,
    casual,
    makeCasual,
    /** World War with a Calculator in your army: the engine brain doesn't cost the rating. */
    warInsight: Boolean(war?.effects.insight),
    fen: displayFen,
    liveFen: game.fen,
    history: game.history,
    status: game.status,
    result: game.result,
    lastMove,
    captured,
    players,
    clock: { times: clock.times, enabled: clock.enabled },
    engineStatus: playEngine.status,
    engineError: playEngine.error,
    retryEngine: playEngine.retry,
    aiThinking,
    movableColor,
    canUndo: undoPlies > 0,
    undoCost,
    canResign: isPlaying && game.history.length > 0,
    showGameOver: game.status.kind === 'over' && !gameOverDismissed && summary !== null && killCam === null,
    summary,
    celebration,
    evaluation,
    evalEnabled: settings.showEvalBar,
    opening,
    timeMachine,
    analysis: analysis.state,
    analysisAvailable: game.status.kind === 'over' && game.history.length > 0,
    bestMoveArrow,
    applyMove,
    undo,
    resign,
    startNewGame,
    loadReview,
    requestAnalysis,
    flipBoard,
    dismissGameOver,
    getPgn,
    playerNames,
  }
}

export type GameController = ReturnType<typeof useGameController>
