import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameSession } from '../useGameSession'
import type { CountryRoundSpec, GuessInput, GuessOutcome, RoundSpec } from '../types'

const round = (cca3: string): RoundSpec => ({
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
const exact = (cca3: string, endsGame = false): GuessOutcome => ({
  pointsEarned: 100,
  livesDelta: 0,
  endsGame,
  reveal: {
    kind: 'country',
    correct: true,
    targetCca3: cca3,
    clickedCca3: cca3,
    clickedName: cca3,
    distanceKm: 0,
  },
})
const miss = (target: string, clicked: string, pts = 20, endsGame = false): GuessOutcome => ({
  pointsEarned: pts,
  livesDelta: -1,
  endsGame,
  reveal: {
    kind: 'country',
    correct: false,
    targetCca3: target,
    clickedCca3: clicked,
    clickedName: clicked,
    distanceKm: 1000,
  },
})

describe('useGameSession', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useGameSession())
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.maxRounds).toBeNull()
  })

  it('start() with null maxRounds enters endless mode', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.maxRounds).toBeNull()
    expect(result.current.session.currentRound?.kind).toBe('country-pinning')
  })

  it('start() with maxRounds=10 sets round cap', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('city-guessing', round('FRA'), 10) })
    expect(result.current.session.maxRounds).toBe(10)
  })

  it('submitGuess(correct, endsGame=false) moves to round-ended with score and streak', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(countryInput('FRA'), exact('FRA', false)) })
    expect(result.current.session.score).toBe(100)
    expect(result.current.session.streak).toBe(1)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.status).toBe('round-ended')
  })

  it('submitGuess(wrong) decrements lives and resets streak', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(countryInput('FRA'), exact('FRA', false)) })
    act(() => { result.current.advance(round('DEU')) })
    act(() => { result.current.submitGuess(countryInput('FRA'), miss('DEU', 'FRA', 20, false)) })
    expect(result.current.session.lives).toBe(2)
    expect(result.current.session.streak).toBe(0)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.score).toBe(120)
  })

  it('endsGame flag routes to game-over regardless of lives', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('city-guessing', round('FRA'), 10) })
    // Simulate the 10th round's guess with endsGame=true
    act(() => { result.current.submitGuess(countryInput('FRA'), { ...exact('FRA'), endsGame: true }) })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.lives).toBe(3) // lives untouched for city mode
  })

  it('advance() moves from round-ended to playing with the next round', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(countryInput('FRA'), exact('FRA', false)) })
    act(() => { result.current.advance(round('DEU')) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.currentRound?.kind).toBe('country-pinning')
    expect(result.current.session.roundIndex).toBe(1)
  })

  it('overrideRound from round-ended advances roundIndex', () => {
    // Ensures test-hook setRound flows simulate round progression correctly
    // for fixed-round modes (city-guessing) where endsGame is round-count-based.
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('city-guessing', round('FRA'), 10) })
    act(() => { result.current.submitGuess(countryInput('DEU'), miss('FRA', 'DEU', 0, false)) })
    expect(result.current.session.status).toBe('round-ended')
    expect(result.current.session.roundIndex).toBe(0)
    act(() => { result.current.overrideRound(round('DEU')) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.roundIndex).toBe(1)
  })

  it('overrideRound from playing does not advance roundIndex', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    expect(result.current.session.roundIndex).toBe(0)
    act(() => { result.current.overrideRound(round('DEU')) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.roundIndex).toBe(0)
  })

  it('endGame() returns to idle with empty state', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(countryInput('FRA'), exact('FRA', false)) })
    act(() => { result.current.endGame() })
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.score).toBe(0)
    expect(result.current.session.maxRounds).toBeNull()
  })
})

const CPR: CountryRoundSpec = {
  kind: 'country-pinning',
  targetCca3: 'FRA',
  targetName: 'France',
  targetFlag: 'flags/FR.svg',
  targetCentroid: [2, 46],
}

describe('useGameSession — attempts per round', () => {
  it('start with attemptsPerRound=1 keeps existing free-mode behavior', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, null, 1) })
    expect(result.current.session.attemptsPerRound).toBe(1)
    expect(result.current.session.attemptsRemaining).toBe(1)
    expect(result.current.session.currentAttempts).toEqual([])
  })

  it('start with attemptsPerRound=3 initializes three attempts', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    expect(result.current.session.attemptsPerRound).toBe(3)
    expect(result.current.session.attemptsRemaining).toBe(3)
  })

  it('recordAttempt decrements remaining + records attempt, stays playing', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 40,
        input: { kind: 'country', cca3: 'ESP', name: 'Spain', centroid: [-3, 40] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'ESP', clickedName: 'Spain', distanceKm: 800 },
      })
    })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.attemptsRemaining).toBe(2)
    expect(result.current.session.currentAttempts).toHaveLength(1)
    expect(result.current.session.currentAttempts[0].pointsEarned).toBe(40)
  })

  it('submitGuess carries the input into the final attempt record (best-of-3)', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 30,
        input: { kind: 'country', cca3: 'ESP', name: 'Spain', centroid: [-3, 40] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'ESP', clickedName: 'Spain', distanceKm: 800 },
      })
    })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 70,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    act(() => {
      result.current.submitGuess(
        { kind: 'country', cca3: 'FRA', name: 'France', centroid: [2, 46] },
        {
          pointsEarned: 100,
          livesDelta: 0,
          endsGame: true,
          reveal: { kind: 'country', correct: true, targetCca3: 'FRA', clickedCca3: 'FRA', clickedName: 'France', distanceKm: 0 },
        },
      )
    })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.score).toBe(100)
    expect(result.current.session.currentAttempts).toHaveLength(3)
    const final = result.current.session.currentAttempts[2]
    expect(final.input.kind).toBe('country')
    if (final.input.kind === 'country') {
      expect(final.input.cca3).toBe('FRA')
      expect(final.input.centroid).toEqual([2, 46])
    }
  })

  it('submitGuess with attemptsRemaining > 1 is a no-op (defensive guard)', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.submitGuess(
        { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        {
          pointsEarned: 60,
          livesDelta: 0,
          endsGame: true,
          reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
        },
      )
    })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.attemptsRemaining).toBe(3)
    expect(result.current.session.currentAttempts).toEqual([])
  })

  it('revealEarly ends the round using best-of-current-attempts', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 60,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    act(() => { result.current.revealEarly() })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.score).toBe(60)
    expect(result.current.session.attemptsRemaining).toBe(0)
  })

  it('revealEarly is a no-op when no attempts recorded', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, 1, 3) })
    act(() => { result.current.revealEarly() })
    expect(result.current.session.status).toBe('playing')
  })

  it('advance resets attemptsRemaining to attemptsPerRound', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, null, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 50,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 40,
        input: { kind: 'country', cca3: 'ESP', name: 'Spain', centroid: [-3, 40] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'ESP', clickedName: 'Spain', distanceKm: 800 },
      })
    })
    act(() => {
      result.current.submitGuess(
        { kind: 'country', cca3: 'FRA', name: 'France', centroid: [2, 46] },
        {
          pointsEarned: 100,
          livesDelta: 0,
          endsGame: false,
          reveal: { kind: 'country', correct: true, targetCca3: 'FRA', clickedCca3: 'FRA', clickedName: 'France', distanceKm: 0 },
        },
      )
    })
    const next: CountryRoundSpec = { ...CPR, targetCca3: 'DEU', targetName: 'Germany', targetFlag: 'flags/DE.svg' }
    act(() => { result.current.advance(next) })
    expect(result.current.session.attemptsRemaining).toBe(3)
    expect(result.current.session.currentAttempts).toEqual([])
  })

  it('overrideRound also resets attemptsRemaining + currentAttempts', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', CPR, null, 3) })
    act(() => {
      result.current.recordAttempt({
        pointsEarned: 50,
        input: { kind: 'country', cca3: 'DEU', name: 'Germany', centroid: [10, 51] },
        reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'DEU', clickedName: 'Germany', distanceKm: 500 },
      })
    })
    expect(result.current.session.attemptsRemaining).toBe(2)
    expect(result.current.session.currentAttempts).toHaveLength(1)
    const next: CountryRoundSpec = { ...CPR, targetCca3: 'DEU', targetName: 'Germany', targetFlag: 'flags/DE.svg' }
    act(() => { result.current.overrideRound(next) })
    expect(result.current.session.attemptsRemaining).toBe(3)
    expect(result.current.session.currentAttempts).toEqual([])
  })
})
