import { describe, it, expect, beforeEach } from 'vitest'
import {
  subscribe,
  getSnapshot,
  record,
  __resetForTests,
} from '../personalBestsStore'

const ZERO = { bestScore: 0, bestStreak: 0, gamesPlayed: 0 }

describe('personalBestsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetForTests()
  })

  it('returns zeros for an unknown modeId', () => {
    expect(getSnapshot('country-pinning')).toEqual(ZERO)
    expect(getSnapshot('city-guessing')).toEqual(ZERO)
  })

  it('record() writes to the v2 key for that mode and not the other', () => {
    record('country-pinning', 87, 4)

    expect(getSnapshot('country-pinning')).toEqual({ bestScore: 87, bestStreak: 4, gamesPlayed: 1 })
    expect(getSnapshot('city-guessing')).toEqual(ZERO)

    expect(localStorage.getItem('funworldmap-game-country-pinning-bests-v2')).not.toBeNull()
    expect(localStorage.getItem('funworldmap-game-city-guessing-bests-v2')).toBeNull()
  })

  it('record() keeps the higher score and streak per mode', () => {
    record('country-pinning', 50, 2)
    record('country-pinning', 30, 5)
    expect(getSnapshot('country-pinning')).toEqual({ bestScore: 50, bestStreak: 5, gamesPlayed: 2 })
  })

  it('cross-mode isolation: recording in one mode does not change the other', () => {
    record('country-pinning', 100, 7)
    record('city-guessing', 0, 0)
    expect(getSnapshot('country-pinning').bestScore).toBe(100)
    expect(getSnapshot('city-guessing').bestScore).toBe(0)
    expect(getSnapshot('city-guessing').gamesPlayed).toBe(1)
  })

  it('subscribe receives notifications only for the registered mode', () => {
    let countCountry = 0
    let countCity = 0
    const unC = subscribe('country-pinning', () => { countCountry++ })
    const unG = subscribe('city-guessing', () => { countCity++ })

    record('country-pinning', 50, 0)
    expect(countCountry).toBe(1)
    expect(countCity).toBe(0)

    record('city-guessing', 200, 1)
    expect(countCountry).toBe(1)
    expect(countCity).toBe(1)

    unC(); unG()
  })

  it('reads v2 on first access and removes the legacy v1 key for the same mode', () => {
    localStorage.setItem(
      'funworldmap-game-country-pinning-bests',
      JSON.stringify({ bestScore: 999, bestStreak: 99, gamesPlayed: 9 }),
    )
    localStorage.setItem(
      'funworldmap-game-country-pinning-bests-v2',
      JSON.stringify({ bestScore: 42, bestStreak: 5, gamesPlayed: 3 }),
    )
    __resetForTests()

    expect(getSnapshot('country-pinning')).toEqual({ bestScore: 42, bestStreak: 5, gamesPlayed: 3 })
    expect(localStorage.getItem('funworldmap-game-country-pinning-bests')).toBeNull()
  })
})
