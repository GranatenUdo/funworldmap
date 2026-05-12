import type { ModeId, AttemptRecord } from '../shared/types'
import { toLocalDateString } from './dates'
import { breadcrumbDailyStorage, captureDailyStorage } from './sentry'

export interface DailyResumeV1 {
  version: 1
  date: string             // YYYY-MM-DD
  modeId: ModeId
  attempts: AttemptRecord[]
}

export const RESUME_KEY = 'funworldmap-daily-resume'

export function readResume(): DailyResumeV1 | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DailyResumeV1>
    if (parsed.version !== 1) {
      captureDailyStorage(`resume: unknown version ${String(parsed.version)}`, 'unknown-version')
      return null
    }
    if (typeof parsed.date !== 'string') {
      captureDailyStorage('resume: missing or invalid date field', 'parse-failure')
      return null
    }
    if (parsed.date !== toLocalDateString(new Date())) {
      // Stale-date is benign (yesterday's blob); not corruption.
      try { localStorage.removeItem(RESUME_KEY) } catch { /* no-op */ }
      return null
    }
    if (parsed.modeId !== 'country-pinning' && parsed.modeId !== 'city-guessing') {
      captureDailyStorage(`resume: invalid modeId ${String(parsed.modeId)}`, 'parse-failure')
      return null
    }
    if (!Array.isArray(parsed.attempts)) {
      captureDailyStorage('resume: attempts not array', 'parse-failure')
      return null
    }
    return parsed as DailyResumeV1
  } catch (err) {
    captureDailyStorage(err, 'parse-failure')
    return null
  }
}

export function writeResume(value: DailyResumeV1): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(value))
  } catch (err) {
    breadcrumbDailyStorage('writeResume failed', err)
  }
}

export function clearResume(): void {
  try {
    localStorage.removeItem(RESUME_KEY)
  } catch (err) {
    breadcrumbDailyStorage('clearResume failed', err)
  }
}
