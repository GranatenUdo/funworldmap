import { describe, it, expect, beforeEach } from 'vitest'
import { readResume, writeResume, clearResume, RESUME_KEY, type DailyResumeV1 } from '../resume'
import { toLocalDateString } from '../dates'

const today = toLocalDateString(new Date())

const blob = (overrides: Partial<DailyResumeV1> = {}): DailyResumeV1 => ({
  version: 1,
  date: today,
  modeId: 'country-pinning',
  attempts: [],
  ...overrides,
})

describe('daily resume storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a current-day blob', () => {
    writeResume(blob())
    expect(readResume()?.date).toBe(today)
  })

  it('discards stale-date blobs and clears the key', () => {
    localStorage.setItem(RESUME_KEY, JSON.stringify(blob({ date: '2020-01-01' })))
    expect(readResume()).toBeNull()
    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('rejects unknown version', () => {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ ...blob(), version: 99 }))
    expect(readResume()).toBeNull()
  })

  it('rejects malformed JSON', () => {
    localStorage.setItem(RESUME_KEY, '{not json')
    expect(readResume()).toBeNull()
  })

  it('rejects unknown modeId', () => {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ ...blob(), modeId: 'mystery' }))
    expect(readResume()).toBeNull()
  })

  it('clearResume removes the key', () => {
    writeResume(blob())
    clearResume()
    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })
})
