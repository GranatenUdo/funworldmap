import { renderHook, act } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { useDailyHistory } from '../useDailyHistory'
import { MILESTONES } from '../types'

describe('useDailyHistory', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('starts empty when no prior storage', () => {
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.streak.current).toBe(0)
    expect(result.current.get('2026-04-21', 'country-pinning')).toBeNull()
  })

  it('record merges a day, updates streak, and persists', () => {
    const { result } = renderHook(() => useDailyHistory())
    act(() => {
      result.current.record('2026-04-21', 'country-pinning', {
        score: 87, attempts: [], completedAt: 1,
      })
    })
    expect(result.current.get('2026-04-21', 'country-pinning')?.score).toBe(87)
    expect(result.current.streak.current).toBe(1)
    expect(result.current.streak.lastActiveDate).toBe('2026-04-21')
    const stored = JSON.parse(localStorage.getItem('funworldmap-daily-history') ?? '{}')
    expect(stored.days['2026-04-21']['country-pinning'].score).toBe(87)
  })

  it('same-day second mode does NOT bump streak', () => {
    const { result } = renderHook(() => useDailyHistory())
    act(() => {
      result.current.record('2026-04-21', 'country-pinning', { score: 80, attempts: [], completedAt: 1 })
    })
    act(() => {
      result.current.record('2026-04-21', 'city-guessing', { score: 70, attempts: [], completedAt: 2 })
    })
    expect(result.current.streak.current).toBe(1)
    expect(result.current.get('2026-04-21', 'city-guessing')?.score).toBe(70)
    expect(result.current.get('2026-04-21', 'country-pinning')?.score).toBe(80)
  })

  it('yesterday → today increments streak to 2', () => {
    const { result } = renderHook(() => useDailyHistory())
    act(() => {
      result.current.record('2026-04-20', 'country-pinning', { score: 80, attempts: [], completedAt: 1 })
    })
    act(() => {
      result.current.record('2026-04-21', 'country-pinning', { score: 87, attempts: [], completedAt: 2 })
    })
    expect(result.current.streak.current).toBe(2)
    expect(result.current.streak.longest).toBe(2)
  })

  it('gap resets streak to 1, longest preserved', () => {
    const { result } = renderHook(() => useDailyHistory())
    for (const d of ['2026-04-18', '2026-04-19', '2026-04-20', '2026-04-21']) {
      act(() => {
        result.current.record(d, 'country-pinning', { score: 87, attempts: [], completedAt: 1 })
      })
    }
    act(() => {
      result.current.record('2026-04-25', 'country-pinning', { score: 87, attempts: [], completedAt: 2 })
    })
    expect(result.current.streak.current).toBe(1)
    expect(result.current.streak.longest).toBe(4)
  })
})

describe('useDailyHistory — milestones', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('pendingMilestone is null when streak is not at a threshold', () => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({
      version: 1,
      streak: { current: 2, longest: 2, lastActiveDate: '2026-04-22', lastMilestoneShown: 0 },
      days: {},
    }))
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBeNull()
  })

  it('pendingMilestone returns 3 when streak is 3 and never shown', () => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({
      version: 1,
      streak: { current: 3, longest: 3, lastActiveDate: '2026-04-22', lastMilestoneShown: 0 },
      days: {},
    }))
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBe(3)
  })

  it('pendingMilestone is null after markMilestoneShown', () => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({
      version: 1,
      streak: { current: 3, longest: 3, lastActiveDate: '2026-04-22', lastMilestoneShown: 0 },
      days: {},
    }))
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBe(3)
    act(() => { result.current.markMilestoneShown() })
    expect(result.current.pendingMilestone).toBeNull()
  })

  it('markMilestoneShown persists to localStorage', () => {
    localStorage.setItem('funworldmap-daily-history', JSON.stringify({
      version: 1,
      streak: { current: 7, longest: 7, lastActiveDate: '2026-04-22', lastMilestoneShown: 3 },
      days: {},
    }))
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBe(7)
    act(() => { result.current.markMilestoneShown() })
    const stored = JSON.parse(localStorage.getItem('funworldmap-daily-history') ?? '{}')
    expect(stored.streak.lastMilestoneShown).toBe(7)
  })

  it('markMilestoneShown is a no-op when no pending milestone', () => {
    const { result } = renderHook(() => useDailyHistory())
    expect(result.current.pendingMilestone).toBeNull()
    act(() => { result.current.markMilestoneShown() })
    const stored = localStorage.getItem('funworldmap-daily-history')
    // Either unchanged or still matches empty-history shape.
    expect(JSON.parse(stored ?? 'null')?.streak?.lastMilestoneShown ?? 0).toBe(0)
  })

  it('MILESTONES export is [3, 7, 14, 30, 100]', () => {
    expect([...MILESTONES]).toEqual([3, 7, 14, 30, 100])
  })
})
