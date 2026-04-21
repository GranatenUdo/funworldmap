import type { DailyHistoryV1, DailyDayResult, StreakState } from './types'
import { STORAGE_KEY } from './types'
import type { ModeId } from '../shared/types'
import { toLocalDateString } from './dates'

const EMPTY_STREAK: StreakState = {
  current: 0,
  longest: 0,
  lastActiveDate: null,
  lastMilestoneShown: 0,
}

export function emptyHistory(): DailyHistoryV1 {
  return { version: 1, streak: { ...EMPTY_STREAK }, days: {} }
}

export function readHistory(): DailyHistoryV1 {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyHistory()
    const parsed = JSON.parse(raw) as Partial<DailyHistoryV1>
    if (parsed.version !== 1) return emptyHistory()
    return {
      version: 1,
      streak: { ...EMPTY_STREAK, ...(parsed.streak ?? {}) } as StreakState,
      days: parsed.days ?? {},
    }
  } catch {
    return emptyHistory()
  }
}

export function writeHistory(h: DailyHistoryV1): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(h))
  } catch {
    /* private-mode / quota exceeded — best-effort */
  }
}

export function mergeDay(
  h: DailyHistoryV1,
  date: string,
  modeId: ModeId,
  result: DailyDayResult,
): DailyHistoryV1 {
  const prior = h.days[date] ?? {}
  return {
    ...h,
    days: {
      ...h.days,
      [date]: { ...prior, [modeId]: result },
    },
  }
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const da = Date.UTC(ay, am - 1, ad)
  const db = Date.UTC(by, bm - 1, bd)
  return Math.round((db - da) / 86_400_000)
}

export function updateStreak(h: DailyHistoryV1, date: string): DailyHistoryV1 {
  const last = h.streak.lastActiveDate
  if (last === date) return h
  let current: number
  if (last && daysBetween(last, date) === 1) {
    current = h.streak.current + 1
  } else {
    current = 1
  }
  const longest = Math.max(h.streak.longest, current)
  return {
    ...h,
    streak: { ...h.streak, current, longest, lastActiveDate: date },
  }
}

export function pruneOlderThan(
  h: DailyHistoryV1,
  days: number,
  now: Date = new Date(),
): DailyHistoryV1 {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = toLocalDateString(cutoff)
  const kept: DailyHistoryV1['days'] = {}
  for (const [date, entry] of Object.entries(h.days)) {
    if (date >= cutoffStr) kept[date] = entry
  }
  return { ...h, days: kept }
}
