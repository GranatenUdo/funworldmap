import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePersonalBests } from '../usePersonalBests'
import { __resetForTests as resetPbStore } from '../personalBestsStore'
import type { PersonalBest } from '../types'

describe('usePersonalBests', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPbStore()
  })

  it('returns zeros on first use', () => {
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
  })

  it('record() keeps the higher score and streak and increments gamesPlayed', () => {
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    act(() => {
      result.current.record(200, 5)
    })
    expect(result.current.best).toEqual({ bestScore: 200, bestStreak: 5, gamesPlayed: 1 })
    act(() => {
      result.current.record(150, 8)
    })
    expect(result.current.best).toEqual({ bestScore: 200, bestStreak: 8, gamesPlayed: 2 })
  })

  it('persists across hook unmount/remount via localStorage', () => {
    const first = renderHook(() => usePersonalBests('country-pinning'))
    act(() => {
      first.result.current.record(300, 7)
    })
    first.unmount()

    const second = renderHook(() => usePersonalBests('country-pinning'))
    expect(second.result.current.best).toEqual({ bestScore: 300, bestStreak: 7, gamesPlayed: 1 })
  })

  it('ignores corrupt localStorage content', () => {
    localStorage.setItem('funworldmap-game-country-pinning-bests', 'not-json')
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
  })

  it('two hook instances of the same mode stay in sync', () => {
    const a = renderHook(() => usePersonalBests('country-pinning'))
    const b = renderHook(() => usePersonalBests('country-pinning'))
    act(() => {
      a.result.current.record(120, 3)
    })
    expect(b.result.current.best).toEqual({ bestScore: 120, bestStreak: 3, gamesPlayed: 1 })
  })

  it('does not contaminate across modes — recording in one mode leaves the other at zero', () => {
    const country = renderHook(() => usePersonalBests('country-pinning'))
    const city = renderHook(() => usePersonalBests('city-guessing'))

    act(() => {
      country.result.current.record(14, 0)
    })
    act(() => {
      city.result.current.record(0, 0)
    })

    expect(country.result.current.best).toEqual({ bestScore: 14, bestStreak: 0, gamesPlayed: 1 })
    expect(city.result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 1 })

    const cityStored = JSON.parse(
      localStorage.getItem('funworldmap-game-city-guessing-bests-v2') ?? 'null',
    ) as PersonalBest | null
    expect(cityStored?.bestScore).toBe(0)
    expect(cityStored?.gamesPlayed).toBe(1)
  })

  it('hook re-keyed mid-life returns the new mode value, not the stale one', () => {
    let modeId: 'country-pinning' | 'city-guessing' = 'country-pinning'
    const { result, rerender } = renderHook(() => usePersonalBests(modeId))
    act(() => {
      result.current.record(50, 0)
    })
    expect(result.current.best.bestScore).toBe(50)

    modeId = 'city-guessing'
    rerender()
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
  })
})
