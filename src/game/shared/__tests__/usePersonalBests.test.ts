import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePersonalBests } from '../usePersonalBests'

describe('usePersonalBests', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns zeros on first use', () => {
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
  })

  it('record() keeps the higher score and streak and increments gamesPlayed', () => {
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    act(() => { result.current.record(200, 5) })
    expect(result.current.best).toEqual({ bestScore: 200, bestStreak: 5, gamesPlayed: 1 })
    act(() => { result.current.record(150, 8) })
    expect(result.current.best).toEqual({ bestScore: 200, bestStreak: 8, gamesPlayed: 2 })
  })

  it('persists across hook unmount/remount via localStorage', () => {
    const first = renderHook(() => usePersonalBests('country-pinning'))
    act(() => { first.result.current.record(300, 7) })
    first.unmount()

    const second = renderHook(() => usePersonalBests('country-pinning'))
    expect(second.result.current.best).toEqual({ bestScore: 300, bestStreak: 7, gamesPlayed: 1 })
  })

  it('ignores corrupt localStorage content', () => {
    localStorage.setItem('funworldmap-game-country-pinning-bests', 'not-json')
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
  })
})
