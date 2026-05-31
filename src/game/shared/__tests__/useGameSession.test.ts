import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameSession } from '../useGameSession'
import type { CityRoundSpec, CountryRoundSpec, GuessInput, ModeGuessResult } from '../types'

const round = (cca3: string): CountryRoundSpec => ({
  kind: 'country-pinning',
  targetCca3: cca3,
  targetName: cca3,
  targetFlag: `flags/${cca3}.svg`,
  targetCentroid: [0, 0],
})
const countryInput = (cca3: string): GuessInput => ({
  kind: 'country',
  cca3,
  name: cca3,
  centroid: [0, 0],
})
const exact = (cca3: string): ModeGuessResult => ({
  pointsEarned: 100,
  livesDelta: 0,
  reveal: {
    kind: 'country',
    correct: true,
    targetCca3: cca3,
    clickedCca3: cca3,
    clickedName: cca3,
    distanceKm: 0,
  },
})
const miss = (target: string, clicked: string, pts = 20): ModeGuessResult => ({
  pointsEarned: pts,
  livesDelta: -1,
  reveal: {
    kind: 'country',
    correct: false,
    targetCca3: target,
    clickedCca3: clicked,
    clickedName: clicked,
    distanceKm: 1000,
  },
})

describe('useGameSession (single-attempt free-play)', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useGameSession())
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.maxRounds).toBeNull()
  })

  describe('start', () => {
    it('enters playing with correct maxRounds and currentRound', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.maxRounds).toBeNull()
      expect(result.current.session.currentRound).toEqual(round('FRA'))
      expect(result.current.session.modeId).toBe('country-pinning')
    })

    it('sets fixed maxRounds for city-guessing', () => {
      const { result } = renderHook(() => useGameSession())
      const cityRound: CityRoundSpec = {
        kind: 'city-guessing',
        targetId: 'FRA-paris',
        targetName: 'Paris',
        targetCountryName: 'France',
        targetCountryFlag: 'flags/FRA.svg',
        targetCentroid: [2.35, 48.85],
      }
      act(() => {
        result.current.start('city-guessing', cityRound, 10)
      })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.maxRounds).toBe(10)
    })
  })

  describe('attempt — single attempt ends round immediately', () => {
    it('correct guess ends the round with full points, streak +1', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('FRA'), exact('FRA'))
      })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.score).toBe(100)
      expect(result.current.session.lives).toBe(3)
      expect(result.current.session.streak).toBe(1)
      expect(result.current.session.bestStreak).toBe(1)
      expect(result.current.session.lastOutcome?.reveal.kind).toBe('country')
      if (result.current.session.lastOutcome?.reveal.kind === 'country') {
        expect(result.current.session.lastOutcome.reveal.correct).toBe(true)
      }
    })

    it('single country guess of 100 pts → score === 100, streak === 1, bestStreak === 1', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('FRA'), exact('FRA'))
      })
      expect(result.current.session.score).toBe(100)
      expect(result.current.session.streak).toBe(1)
      expect(result.current.session.bestStreak).toBe(1)
    })

    it('wrong guess decrements lives and resets streak to 0', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20))
      })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lives).toBe(2)
      expect(result.current.session.streak).toBe(0)
      expect(result.current.session.score).toBe(20)
    })

    it('adds pointsEarned to score', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 47))
      })
      expect(result.current.session.score).toBe(47)
    })

    it('livesDelta -1 decrements lives by 1 on wrong country guess', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU'))
      })
      expect(result.current.session.lives).toBe(2)
    })

    it('bestStreak tracks the highest streak seen', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('FRA'), exact('FRA'))
      })
      act(() => {
        result.current.advance(round('DEU'))
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), exact('DEU'))
      })
      act(() => {
        result.current.advance(round('GBR'))
      })
      act(() => {
        result.current.attempt(countryInput('ESP'), miss('GBR', 'ESP', 20))
      })
      // streak reset to 0 but bestStreak stays at 2
      expect(result.current.session.streak).toBe(0)
      expect(result.current.session.bestStreak).toBe(2)
    })
  })

  describe('advance', () => {
    it('increments roundIndex and sets next round, clears lastOutcome', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 20))
      })
      expect(result.current.session.roundIndex).toBe(0)
      act(() => {
        result.current.advance(round('GBR'))
      })
      expect(result.current.session.roundIndex).toBe(1)
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.currentRound).toEqual(round('GBR'))
      expect(result.current.session.lastOutcome).toBeNull()
    })
  })

  describe('finishFree', () => {
    it('transitions playing → game-over endedEarly=true', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.finishFree()
      })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.endedEarly).toBe(true)
    })

    it('transitions round-ended → game-over endedEarly=true, preserving score', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('USA'), miss('FRA', 'USA', 14))
      })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.score).toBe(14)
      act(() => {
        result.current.finishFree()
      })
      expect(result.current.session.status).toBe('game-over')
      expect(result.current.session.score).toBe(14)
      expect(result.current.session.endedEarly).toBe(true)
    })

    it('refuses on idle (no-op)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.finishFree()
      })
      expect(result.current.session.status).toBe('idle')
    })

    it('refuses on game-over (no-op)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('USA'), miss('FRA', 'USA'))
      })
      act(() => {
        result.current.advance(round('ESP'))
      })
      act(() => {
        result.current.attempt(countryInput('USA'), miss('ESP', 'USA'))
      })
      act(() => {
        result.current.advance(round('DEU'))
      })
      act(() => {
        result.current.attempt(countryInput('USA'), miss('DEU', 'USA'))
      })
      act(() => {
        result.current.finalize()
      })
      expect(result.current.session.status).toBe('game-over')
      const before = result.current.session
      act(() => {
        result.current.finishFree()
      })
      expect(result.current.session).toBe(before)
    })
  })

  describe('lives reaching zero ends the game', () => {
    it('lives 0 → endsGame=true on round-ended, finalize → game-over', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU', 0))
      })
      act(() => {
        result.current.advance(round('GBR'))
      })
      act(() => {
        result.current.attempt(countryInput('ESP'), miss('GBR', 'ESP', 0))
      })
      act(() => {
        result.current.advance(round('ITA'))
      })
      act(() => {
        result.current.attempt(countryInput('PRT'), miss('ITA', 'PRT', 0))
      })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lives).toBe(0)
      expect(result.current.session.lastOutcome?.endsGame).toBe(true)
      act(() => {
        result.current.finalize()
      })
      expect(result.current.session.status).toBe('game-over')
    })
  })

  describe('finalize', () => {
    it('transitions round-ended → game-over when lastOutcome.endsGame is true', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU'))
      })
      act(() => {
        result.current.advance(round('ITA'))
      })
      act(() => {
        result.current.attempt(countryInput('ESP'), miss('ITA', 'ESP'))
      })
      act(() => {
        result.current.advance(round('PRT'))
      })
      act(() => {
        result.current.attempt(countryInput('GBR'), miss('PRT', 'GBR'))
      })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lastOutcome?.endsGame).toBe(true)
      act(() => {
        result.current.finalize()
      })
      expect(result.current.session.status).toBe('game-over')
    })

    it('is a no-op when lastOutcome.endsGame is false', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU'))
      })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lastOutcome?.endsGame).toBe(false)
      act(() => {
        result.current.finalize()
      })
      expect(result.current.session.status).toBe('round-ended')
    })

    it('is a no-op when status !== round-ended', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      expect(result.current.session.status).toBe('playing')
      act(() => {
        result.current.finalize()
      })
      expect(result.current.session.status).toBe('playing')
    })
  })

  describe('endedEarly flag', () => {
    it('start sets endedEarly false', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      expect(result.current.session.endedEarly).toBe(false)
    })

    it('finishFree sets endedEarly true', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.finishFree()
      })
      expect(result.current.session.endedEarly).toBe(true)
    })

    it('natural lives-out game leaves endedEarly false', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU'))
      })
      act(() => {
        result.current.advance(round('ITA'))
      })
      act(() => {
        result.current.attempt(countryInput('ESP'), miss('ITA', 'ESP'))
      })
      act(() => {
        result.current.advance(round('PRT'))
      })
      act(() => {
        result.current.attempt(countryInput('GBR'), miss('PRT', 'GBR'))
      })
      expect(result.current.session.lives).toBe(0)
      expect(result.current.session.endedEarly).toBe(false)
    })
  })

  // Bug #32 — atomic restart for game-over → hash-mode-switch.
  describe('restart', () => {
    it('game-over → restart transitions atomically to playing in the new mode', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('USA'), miss('FRA', 'USA'))
      })
      act(() => {
        result.current.advance(round('ESP'))
      })
      act(() => {
        result.current.attempt(countryInput('USA'), miss('ESP', 'USA'))
      })
      act(() => {
        result.current.advance(round('DEU'))
      })
      act(() => {
        result.current.attempt(countryInput('USA'), miss('DEU', 'USA'))
      })
      act(() => {
        result.current.finalize()
      })
      expect(result.current.session.status).toBe('game-over')

      const cityRound: CityRoundSpec = {
        kind: 'city-guessing',
        targetId: 'paris',
        targetName: 'Paris',
        targetCountryName: 'France',
        targetCountryFlag: 'flags/FRA.svg',
        targetCentroid: [2.35, 48.85],
      }
      act(() => {
        result.current.restart('city-guessing', cityRound, 10)
      })
      expect(result.current.session.modeId).toBe('city-guessing')
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.score).toBe(0)
      expect(result.current.session.lives).toBe(3)
      expect(result.current.session.maxRounds).toBe(10)
      expect(result.current.session.currentRound).toEqual(cityRound)
      expect(result.current.session.endedEarly).toBe(false)
    })

    it('restart from idle behaves like start', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.restart('country-pinning', round('FRA'), 10)
      })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.modeId).toBe('country-pinning')
      expect(result.current.session.maxRounds).toBe(10)
    })

    it('restart from playing collapses into a fresh playing session', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('USA'), miss('FRA', 'USA', 30))
      })
      expect(result.current.session.score).toBe(30)

      const cityRound: CityRoundSpec = {
        kind: 'city-guessing',
        targetId: 'tokyo',
        targetName: 'Tokyo',
        targetCountryName: 'Japan',
        targetCountryFlag: 'flags/JPN.svg',
        targetCentroid: [139.69, 35.68],
      }
      act(() => {
        result.current.restart('city-guessing', cityRound, 10)
      })
      expect(result.current.session.status).toBe('playing')
      expect(result.current.session.modeId).toBe('city-guessing')
      expect(result.current.session.score).toBe(0)
      expect(result.current.session.lives).toBe(3)
    })
  })

  describe('endOfRound transitions to round-ended (even when endsGame=true)', () => {
    it('free country lives-out attempt sets status round-ended with endsGame=true', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU'))
      })
      act(() => {
        result.current.advance(round('ITA'))
      })
      act(() => {
        result.current.attempt(countryInput('ESP'), miss('ITA', 'ESP'))
      })
      act(() => {
        result.current.advance(round('PRT'))
      })
      act(() => {
        result.current.attempt(countryInput('GBR'), miss('PRT', 'GBR'))
      })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lives).toBe(0)
      expect(result.current.session.lastOutcome?.endsGame).toBe(true)
    })

    it('non-final round still returns round-ended (regression)', () => {
      const { result } = renderHook(() => useGameSession())
      act(() => {
        result.current.start('country-pinning', round('FRA'), null)
      })
      act(() => {
        result.current.attempt(countryInput('DEU'), miss('FRA', 'DEU'))
      })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lastOutcome?.endsGame).toBe(false)
    })

    it('city mode: final round (roundIndex+1 >= maxRounds) ends game', () => {
      const { result } = renderHook(() => useGameSession())
      const cityRound: CityRoundSpec = {
        kind: 'city-guessing',
        targetId: 'FRA-paris',
        targetName: 'Paris',
        targetCountryName: 'France',
        targetCountryFlag: 'flags/FRA.svg',
        targetCentroid: [2.35, 48.85],
      }
      act(() => {
        result.current.start('city-guessing', cityRound, 1)
      })
      act(() => {
        result.current.attempt(
          { kind: 'point', lngLat: [2.35, 48.85] },
          {
            pointsEarned: 950,
            livesDelta: 0,
            reveal: {
              kind: 'point',
              targetCentroid: [2.35, 48.85],
              clickedPoint: [2.35, 48.85],
              distanceKm: 0,
            },
          },
        )
      })
      expect(result.current.session.status).toBe('round-ended')
      expect(result.current.session.lastOutcome?.endsGame).toBe(true)
    })
  })
})
