import type { DailyHistoryV1, DailyDayResult, StreakState, Milestone } from './types'
import { STORAGE_KEY, MILESTONES } from './types'
import type { ModeId } from '../shared/types'
import { toLocalDateString } from './dates'
import { breadcrumbDailyStorage, captureDailyStorage } from './sentry'

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
    if (parsed.version !== 1) {
      captureDailyStorage(
        `daily-history: unknown version ${String(parsed.version)}`,
        'unknown-version',
      )
      return emptyHistory()
    }
    return {
      version: 1,
      streak: { ...EMPTY_STREAK, ...(parsed.streak ?? {}) } as StreakState,
      days: parsed.days ?? {},
    }
  } catch (err) {
    captureDailyStorage(err, 'parse-failure')
    return emptyHistory()
  }
}

export function writeHistory(h: DailyHistoryV1): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(h))
  } catch (err) {
    breadcrumbDailyStorage('writeHistory failed', err)
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
  const continued = !!last && daysBetween(last, date) === 1
  const current = continued ? h.streak.current + 1 : 1
  const longest = Math.max(h.streak.longest, current)
  // Reset milestone-shown on streak break so the user can re-celebrate 3/7/14/30 on rebuild.
  const broke = !!last && !continued
  const lastMilestoneShown = broke ? 0 : h.streak.lastMilestoneShown
  return {
    ...h,
    streak: { ...h.streak, current, longest, lastActiveDate: date, lastMilestoneShown },
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
  if (Object.keys(kept).length === Object.keys(h.days).length) return h
  return { ...h, days: kept }
}

/**
 * Return the milestone threshold the current streak has just crossed and
 * has not yet been marked as shown, or null if none pending.
 */
export function pendingMilestone(h: DailyHistoryV1): Milestone | null {
  const current = h.streak.current
  const lastShown = h.streak.lastMilestoneShown
  // MILESTONES is ascending; pick the single threshold equal to `current`
  // (streak increments by 1 on each new day, so it can only equal exactly one).
  const hit = MILESTONES.find((m) => m === current) as Milestone | undefined
  if (!hit) return null
  if (hit <= lastShown) return null
  return hit
}

export function withMilestoneShown(h: DailyHistoryV1, m: Milestone): DailyHistoryV1 {
  if (m <= h.streak.lastMilestoneShown) return h
  return {
    ...h,
    streak: { ...h.streak, lastMilestoneShown: m },
  }
}
