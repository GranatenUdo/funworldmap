import type { ModeId } from '../shared/types'
import type { AttemptRecord, DailyDayResult, StreakState } from './types'

export type ShareResults = Partial<Record<ModeId, DailyDayResult | null>>

export interface BuildShareTextArgs {
  date: string // YYYY-MM-DD
  results: ShareResults
  streak: StreakState
  originUrl: string // e.g. https://funworldmap.com (no trailing slash)
}

const MODE_EMOJI: Record<ModeId, string> = {
  'country-pinning': '🌍',
  'city-guessing': '🏙️',
}

const MODE_LABEL: Record<ModeId, string> = {
  'country-pinning': 'Country',
  'city-guessing': 'City   ',
}

function quintile(score: number): '🟩' | '🟨' | '🟧' | '🟥' | '⬛' {
  if (score >= 90) return '🟩'
  if (score >= 70) return '🟨'
  if (score >= 50) return '🟧'
  if (score >= 30) return '🟥'
  return '⬛'
}

function attemptStrip(attempts: readonly AttemptRecord[]): string {
  const emojis = attempts.slice(0, 3).map((a) => quintile(a.pointsEarned))
  while (emojis.length < 3) emojis.push('⬛')
  return emojis.join('')
}

function modeLine(modeId: ModeId, result: DailyDayResult | null | undefined): string {
  const prefix = `${MODE_EMOJI[modeId]} ${MODE_LABEL[modeId]}`
  if (!result) return `${prefix} ⬜⬜⬜  not played`
  return `${prefix} ${attemptStrip(result.attempts)}  ${result.score}/100`
}

function mmdd(date: string): string {
  return date.slice(5)
}

export function buildShareText({ date, results, streak, originUrl }: BuildShareTextArgs): string {
  const lines: string[] = []
  lines.push(`funworldmap · ${mmdd(date)}`)
  lines.push(modeLine('country-pinning', results['country-pinning']))
  lines.push(modeLine('city-guessing', results['city-guessing']))
  if (streak.current > 0) lines.push(`🔥 ${streak.current}-day streak`)
  lines.push(`${originUrl}/#daily/${date}`)
  return lines.join('\n')
}

export function modesPlayed(results: ShareResults): 0 | 1 | 2 {
  const cp = results['country-pinning'] ? 1 : 0
  const cg = results['city-guessing'] ? 1 : 0
  return (cp + cg) as 0 | 1 | 2
}
