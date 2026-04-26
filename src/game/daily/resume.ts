import type { ModeId, AttemptRecord } from '../shared/types'
import { toLocalDateString } from './dates'

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
    if (parsed.version !== 1) return null
    if (typeof parsed.date !== 'string') return null
    if (parsed.date !== toLocalDateString(new Date())) {
      try { localStorage.removeItem(RESUME_KEY) } catch { /* no-op */ }
      return null
    }
    if (parsed.modeId !== 'country-pinning' && parsed.modeId !== 'city-guessing') return null
    if (!Array.isArray(parsed.attempts)) return null
    return parsed as DailyResumeV1
  } catch {
    return null
  }
}

export function writeResume(value: DailyResumeV1): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(value))
  } catch {
    /* quota / private mode — best-effort */
  }
}

export function clearResume(): void {
  try {
    localStorage.removeItem(RESUME_KEY)
  } catch {
    /* no-op */
  }
}
