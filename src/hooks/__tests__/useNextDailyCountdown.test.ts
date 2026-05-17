import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNextDailyCountdown } from '../useNextDailyCountdown'

describe('useNextDailyCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Fix the clock to 2026-05-17T20:37:00 local time
    vi.setSystemTime(new Date(2026, 4, 17, 20, 37, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns hours and minutes until next local midnight', () => {
    const { result } = renderHook(() => useNextDailyCountdown())
    expect(result.current).toEqual({ hours: 3, minutes: 23 })
  })

  it('updates after 60 seconds tick', () => {
    const { result } = renderHook(() => useNextDailyCountdown())
    expect(result.current.minutes).toBe(23)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.minutes).toBe(22)
  })

  it('returns {hours: 24, minutes: 0} when called exactly at midnight (rollover boundary)', () => {
    vi.setSystemTime(new Date(2026, 4, 18, 0, 0, 0))
    const { result } = renderHook(() => useNextDailyCountdown())
    expect(result.current).toEqual({ hours: 24, minutes: 0 })
  })
})
