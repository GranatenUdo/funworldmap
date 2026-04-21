import { renderHook, act } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { useDailyHistory } from '../useDailyHistory'

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
