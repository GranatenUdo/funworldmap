import * as Sentry from '@sentry/react'
import type { ModeId, AttemptRecord } from '../shared/types'
import { toLocalDateString } from './dates'

export interface DailyResumeV1 {
  version: 1
  date: string             // YYYY-MM-DD
  modeId: ModeId
  attempts: AttemptRecord[]
}

export const RESUME_KEY = 'funworldmap-daily-resume'

function captureCorruption(err: unknown, kind: 'parse-failure' | 'unknown-version'): void {
  const error = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'resume corruption')
  Sentry.captureException(error, {
    tags: { area: 'daily-storage', kind },
  })
}

export function readResume(): DailyResumeV1 | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DailyResumeV1>
    if (parsed.version !== 1) {
      captureCorruption(`resume: unknown version ${String(parsed.version)}`, 'unknown-version')
      return null
    }
    if (typeof parsed.date !== 'string') {
      captureCorruption('resume: missing or invalid date field', 'parse-failure')
      return null
    }
    if (parsed.date !== toLocalDateString(new Date())) {
      // Stale-date is benign (yesterday's blob); not corruption.
      try { localStorage.removeItem(RESUME_KEY) } catch { /* no-op */ }
      return null
    }
    if (parsed.modeId !== 'country-pinning' && parsed.modeId !== 'city-guessing') {
      captureCorruption(`resume: invalid modeId ${String(parsed.modeId)}`, 'parse-failure')
      return null
    }
    if (!Array.isArray(parsed.attempts)) {
      captureCorruption('resume: attempts not array', 'parse-failure')
      return null
    }
    return parsed as DailyResumeV1
  } catch (err) {
    captureCorruption(err, 'parse-failure')
    return null
  }
}

export function writeResume(value: DailyResumeV1): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(value))
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'storage',
      level: 'warning',
      message: 'writeResume failed',
      data: { name: (err as Error)?.name, message: (err as Error)?.message },
    })
  }
}

export function clearResume(): void {
  try {
    localStorage.removeItem(RESUME_KEY)
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'storage',
      level: 'warning',
      message: 'clearResume failed',
      data: { name: (err as Error)?.name, message: (err as Error)?.message },
    })
  }
}
