import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameSession } from '../useGameSession'
import type { GuessOutcome, RoundSpec } from '../types'

const round = (cca3: string): RoundSpec => ({
  kind: 'country-pinning',
  targetCca3: cca3,
  targetName: cca3,
  targetFlag: `flags/${cca3}.svg`,
  targetCentroid: [0, 0],
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
    act(() => { result.current.submitGuess(exact('FRA', false)) })
    expect(result.current.session.score).toBe(100)
    expect(result.current.session.streak).toBe(1)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.status).toBe('round-ended')
  })

  it('submitGuess(wrong) decrements lives and resets streak', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(exact('FRA', false)) })
    act(() => { result.current.advance(round('DEU')) })
    act(() => { result.current.submitGuess(miss('DEU', 'FRA', 20, false)) })
    expect(result.current.session.lives).toBe(2)
    expect(result.current.session.streak).toBe(0)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.score).toBe(120)
  })

  it('endsGame flag routes to game-over regardless of lives', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('city-guessing', round('FRA'), 10) })
    // Simulate the 10th round's guess with endsGame=true
    act(() => { result.current.submitGuess({ ...exact('FRA'), endsGame: true }) })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.lives).toBe(3) // lives untouched for city mode
  })

  it('advance() moves from round-ended to playing with the next round', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA'), null) })
    act(() => { result.current.submitGuess(exact('FRA', false)) })
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
    act(() => { result.current.submitGuess(miss('FRA', 'DEU', 0, false)) })
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
    act(() => { result.current.submitGuess(exact('FRA', false)) })
    act(() => { result.current.endGame() })
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.score).toBe(0)
    expect(result.current.session.maxRounds).toBeNull()
  })
})
