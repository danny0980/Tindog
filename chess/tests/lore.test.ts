// Tests for the historical lore of the Classic Chess opponents, the post-game
// move insight, and the character voices. Run with `npm run test:lore`.
import { deliver, hash, pickVoice, registerOf, shouldSpeak, voiceProfile } from '../src/audio/voice'
import { CLASSIC_LORE, factFor, loreFor } from '../src/data/classic/lore'
import { CLASSIC_ROSTER } from '../src/data/classic/roster'
import { classicPersona } from '../src/data/personas'
import { formatEval, moveInsight } from '../src/engine/insight'
import type { MoveAnalysis } from '../src/types/analysis'

let failures = 0
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failures += 1
}

// ── Lore ────────────────────────────────────────────────────────────────────
const missing = CLASSIC_ROSTER.filter((c) => !loreFor(c.id)).map((c) => c.id)
check('every Classic opponent has lore', missing.length === 0, missing.join(', '))
const ids = new Set(CLASSIC_ROSTER.map((c) => c.id))
const extra = Object.keys(CLASSIC_LORE).filter((id) => !ids.has(id))
check('no lore for characters that are not in the game', extra.length === 0, extra.join(', '))
const entries = Object.entries(CLASSIC_LORE)
const tooLong = entries.filter(([, l]) => l.bio.length > 320 || l.facts.some((f) => f.length > 170) || l.victory.length > 120 || l.defeat.length > 120).map(([id]) => id)
check('bios, facts and lines stay short enough to read in a game', tooLong.length === 0, tooLong.join(', '))
const empty = entries.filter(([, l]) => [l.lived, l.bio, l.victory, l.defeat, ...l.facts].some((t) => t.trim().length < 3) || l.facts.length !== 3).map(([id]) => id)
check('every entry is complete, with exactly three facts', empty.length === 0, empty.join(', '))
const allFacts = entries.flatMap(([, l]) => l.facts)
check('no fact is repeated', new Set(allFacts).size === allFacts.length)
const quoted = entries.filter(([, l]) => /^["“]|["”]$/.test(l.victory.trim()) || /^["“]|["”]$/.test(l.defeat.trim())).map(([id]) => id)
check('end-of-game lines are written as dialogue, not as quotations', quoted.length === 0, quoted.join(', '))
check('facts change from game to game', factFor('fischer', 0) !== factFor('fischer', 1) && factFor('nobody', 3) === null)
const fischer = CLASSIC_ROSTER.find((c) => c.id === 'fischer')
check('a Classic opponent ends the game with their own words', fischer !== undefined && classicPersona(fischer).quotes.legendWins[0] === loreFor('fischer')?.victory && classicPersona(fischer).quotes.legendLoses[0] === loreFor('fischer')?.defeat)

// ── Move insight ────────────────────────────────────────────────────────────
const ev = (cp: number, mate: number | null = null) => ({ cp, mate, bestMove: null, depth: 12 })
check('evaluations read from the mover’s side', formatEval(ev(120), 'w') === '+1.2' && formatEval(ev(120), 'b') === '−1.2' && formatEval(ev(2), 'w') === '0.0')
check('mates read as #n', formatEval(ev(9997, 3), 'w') === '#3' && formatEval(ev(9997, 3), 'b') === '#−3')
const move = (over: Partial<MoveAnalysis>): MoveAnalysis => ({ ply: 27, san: 'Qxf7', color: 'w', classification: 'blunder', evalBefore: ev(80), evalAfter: ev(-260), winChanceLoss: 38.4, bestMoveSan: 'Nf3', ...over })
const blunder = moveInsight(move({}))
check('a blunder says what it cost and what was better', blunder.title === '14. Qxf7 — Blunder' && blunder.swing === '+0.8 → −2.6' && blunder.verdict.includes('38%') && blunder.better === 'Nf3' && /captures, checks and threats/.test(blunder.tip))
const black = moveInsight(move({ ply: 28, color: 'b', san: 'Nf6', classification: 'best', evalBefore: ev(-50), evalAfter: ev(-60), winChanceLoss: 0, bestMoveSan: 'Nf6' }))
check('a best move is praised, with no "better" move', black.title === '14… Nf6 — Best move' && black.better === null && black.swing === '+0.5 → +0.6' && /Kept every bit/.test(black.verdict))

// ── Voices ──────────────────────────────────────────────────────────────────
check('registers: women, men and machines', registerOf('Cleopatra VII') === 'female' && registerOf('Hatshepsut') === 'female' && registerOf('Genghis Khan') === 'male' && registerOf('ORACLE-7') === 'machine')
check('a character always sounds the same', JSON.stringify(voiceProfile('Bobby Fischer')) === JSON.stringify(voiceProfile('Bobby Fischer')) && hash('a') !== hash('b'))
const all = CLASSIC_ROSTER.map((c) => voiceProfile(c.name))
check('pitch and pace stay natural for everyone', all.every((p) => p.pitch > 0.4 && p.pitch < 1.5 && p.rate > 0.8 && p.rate < 1.2))
check('distinct characters get distinct voices', new Set(all.map((p) => `${p.pitch}/${p.rate}`)).size > 60)
const lines = { angry: deliver(voiceProfile('Attila the Hun'), 'angry'), calm: deliver(voiceProfile('Attila the Hun'), 'calm') }
check('mood colours the delivery', lines.angry.rate > lines.calm.rate)
const system = [
  { name: 'Google Deutsch', lang: 'de-DE' },
  { name: 'Daniel', lang: 'en-GB' },
  { name: 'Samantha', lang: 'en-US' },
  { name: 'Google UK English Male', lang: 'en-GB' },
  { name: 'Microsoft Zira', lang: 'en-US' },
]
check('women get a female voice', ['Samantha', 'Microsoft Zira'].includes(pickVoice(system, voiceProfile('Cleopatra VII'))?.name ?? ''))
check('men get a male voice', ['Daniel', 'Google UK English Male'].includes(pickVoice(system, voiceProfile('Napoleon Bonaparte'))?.name ?? ''))
check('English voices are preferred, any voice beats none', pickVoice([{ name: 'Google Deutsch', lang: 'de-DE' }], voiceProfile('Zeus'))?.name === 'Google Deutsch' && pickVoice([], voiceProfile('Zeus')) === null)
check('"key moments" reads only the important lines', shouldSpeak('key', { urgent: true }) && !shouldSpeak('key', { urgent: false }) && shouldSpeak('all', { urgent: false }) && !shouldSpeak('off', { urgent: true }))

console.log(failures === 0 ? '\nAll lore checks passed.' : `\n${failures} check(s) FAILED`)
if (failures > 0) process.exitCode = 1
