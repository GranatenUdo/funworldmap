import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDailyResumePersistence } from '../useDailyResumePersistence'
import { makeSession, makeAttempt } from '../../shared/__tests__/factories'
import { RESUME_KEY } from '../../daily/resume'

describe('useDailyResumePersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('writes resume blob when status=playing, attemptsPerRound>1, currentAttempts non-empty, dailyDate set', () => {
    const attempt = makeAttempt()
    const session = makeSession({
      status: 'playing',
      attemptsPerRound: 3,
      currentAttempts: [attempt],
      dailyDate: '2026-05-14',
      modeId: 'country-pinning',
    })

    renderHook(() => useDailyResumePersistence(session))

    const raw = localStorage.getItem(RESUME_KEY)
    expect(raw).not.toBeNull()
    const blob = JSON.parse(raw!)
    expect(blob.version).toBe(1)
    expect(blob.date).toBe('2026-05-14')
    expect(blob.modeId).toBe('country-pinning')
    expect(blob.attempts).toHaveLength(1)
  })

  it('does NOT write when status is not playing', () => {
    const session = makeSession({
      status: 'round-ended',
      attemptsPerRound: 3,
      currentAttempts: [makeAttempt()],
      dailyDate: '2026-05-14',
    })

    renderHook(() => useDailyResumePersistence(session))

    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('does NOT write when attemptsPerRound <= 1 (free-mode play)', () => {
    const session = makeSession({
      status: 'playing',
      attemptsPerRound: 1,
      currentAttempts: [makeAttempt()],
      dailyDate: '2026-05-14',
    })

    renderHook(() => useDailyResumePersistence(session))

    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('does NOT write when currentAttempts is empty (before first guess)', () => {
    const session = makeSession({
      status: 'playing',
      attemptsPerRound: 3,
      currentAttempts: [],
      dailyDate: '2026-05-14',
    })

    renderHook(() => useDailyResumePersistence(session))

    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('does NOT write when dailyDate is null', () => {
    const session = makeSession({
      status: 'playing',
      attemptsPerRound: 3,
      currentAttempts: [makeAttempt()],
      dailyDate: null,
    })

    renderHook(() => useDailyResumePersistence(session))

    expect(localStorage.getItem(RESUME_KEY)).toBeNull()
  })

  it('re-writes the blob when currentAttempts grows (second attempt)', () => {
    const attempt1 = makeAttempt()
    const session1 = makeSession({
      status: 'playing',
      attemptsPerRound: 3,
      currentAttempts: [attempt1],
      dailyDate: '2026-05-14',
      modeId: 'country-pinning',
    })

    const { rerender } = renderHook(({ s }) => useDailyResumePersistence(s), {
      initialProps: { s: session1 },
    })

    const blobAfterFirst = JSON.parse(localStorage.getItem(RESUME_KEY)!)
    expect(blobAfterFirst.attempts).toHaveLength(1)

    const attempt2 = makeAttempt({ pointsEarned: 50 })
    const session2 = makeSession({
      status: 'playing',
      attemptsPerRound: 3,
      currentAttempts: [attempt1, attempt2],
      dailyDate: '2026-05-14',
      modeId: 'country-pinning',
    })

    rerender({ s: session2 })

    const blobAfterSecond = JSON.parse(localStorage.getItem(RESUME_KEY)!)
    expect(blobAfterSecond.attempts).toHaveLength(2)
  })
})
