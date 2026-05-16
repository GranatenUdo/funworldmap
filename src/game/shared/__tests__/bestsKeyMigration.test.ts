import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePersonalBests } from '../usePersonalBests'
import { __resetForTests as resetPbStore } from '../personalBestsStore'
import type { PersonalBest } from '../types'

describe('usePersonalBests v1→v2 migration', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPbStore()
  })

  it('removes v1 key and returns ZERO when v2 is absent', () => {
    localStorage.setItem(
      'funworldmap-game-country-pinning-bests',
      JSON.stringify({ bestScore: 999, bestStreak: 99, gamesPlayed: 9 }),
    )
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 0, bestStreak: 0, gamesPlayed: 0 })
    expect(localStorage.getItem('funworldmap-game-country-pinning-bests')).toBeNull()
  })

  it('reads v2 on subsequent loads', () => {
    localStorage.setItem(
      'funworldmap-game-country-pinning-bests-v2',
      JSON.stringify({ bestScore: 42, bestStreak: 5, gamesPlayed: 3 }),
    )
    const { result } = renderHook(() => usePersonalBests('country-pinning'))
    expect(result.current.best).toEqual({ bestScore: 42, bestStreak: 5, gamesPlayed: 3 })
  })

  it('record() writes to v2', () => {
    const { result } = renderHook(() => usePersonalBests('city-guessing'))
    act(() => {
      result.current.record(700, 4)
    })
    const v2 = JSON.parse(
      localStorage.getItem('funworldmap-game-city-guessing-bests-v2') ?? 'null',
    ) as PersonalBest | null
    expect(v2?.bestScore).toBe(700)
  })
})
