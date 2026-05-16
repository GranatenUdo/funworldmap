import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/react'
import { readHistory } from '../storage'
import { readResume } from '../resume'
import { STORAGE_KEY } from '../types'
import { RESUME_KEY } from '../resume'

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}))

describe('readHistory on corruption', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('captures a Sentry exception when JSON.parse fails', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    const result = readHistory()
    expect(Object.keys(result.days)).toHaveLength(0)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [err, ctx] = (Sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      unknown,
    ]
    expect(err).toBeInstanceOf(Error)
    expect((ctx as { tags?: { area?: string; kind?: string } }).tags?.area).toBe('daily-storage')
    expect((ctx as { tags?: { area?: string; kind?: string } }).tags?.kind).toBe('parse-failure')
  })

  it('captures a Sentry exception when version is unknown', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 99,
        days: {},
        streak: { current: 0, longest: 0, lastActiveDate: null, lastMilestoneShown: 0 },
      }),
    )
    readHistory()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [, ctx] = (Sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      unknown,
    ]
    expect((ctx as { tags?: { area?: string; kind?: string } }).tags?.kind).toBe('unknown-version')
  })

  it('does NOT capture when localStorage entry is absent (fresh user)', () => {
    readHistory()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('readResume on corruption', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('captures a Sentry exception on JSON.parse failure', () => {
    localStorage.setItem(RESUME_KEY, '{broken')
    expect(readResume()).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [, ctx] = (Sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      unknown,
    ]
    expect((ctx as { tags?: { area?: string; kind?: string } }).tags?.area).toBe('daily-storage')
    expect((ctx as { tags?: { area?: string; kind?: string } }).tags?.kind).toBe('parse-failure')
  })

  it('captures unknown-version on resume version mismatch', () => {
    localStorage.setItem(
      RESUME_KEY,
      JSON.stringify({ version: 99, date: '2026-05-12', modeId: 'country-pinning', attempts: [] }),
    )
    expect(readResume()).toBeNull()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [, ctx] = (Sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0] as [
      unknown,
      unknown,
    ]
    expect((ctx as { tags?: { area?: string; kind?: string } }).tags?.kind).toBe('unknown-version')
  })

  it('does NOT capture on stale-date (benign)', () => {
    // Stale date branch is intentional (yesterday's blob); not corruption.
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const isoDate = yesterday.toISOString().slice(0, 10)
    localStorage.setItem(
      RESUME_KEY,
      JSON.stringify({ version: 1, date: isoDate, modeId: 'country-pinning', attempts: [] }),
    )
    expect(readResume()).toBeNull()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('does NOT capture when localStorage entry is absent', () => {
    readResume()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
