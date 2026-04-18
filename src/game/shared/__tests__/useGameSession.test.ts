import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameSession } from '../useGameSession'
import type { GuessOutcome, RoundSpec } from '../types'

const round = (cca3: string): RoundSpec => ({
  targetCca3: cca3, targetName: cca3, targetFlag: `flags/${cca3}.svg`, targetCentroid: [0, 0],
})
const exact = (cca3: string): GuessOutcome => ({
  correct: true, pointsEarned: 100, livesDelta: 0,
  reveal: { targetCca3: cca3, clickedCca3: cca3, distanceKm: 0 },
})
const miss = (target: string, clicked: string, pts = 20): GuessOutcome => ({
  correct: false, pointsEarned: pts, livesDelta: -1,
  reveal: { targetCca3: target, clickedCca3: clicked, distanceKm: 1000 },
})

describe('useGameSession', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useGameSession())
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.lives).toBe(3)
  })

  it('start() enters playing with the first round', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.currentRound?.targetCca3).toBe('FRA')
    expect(result.current.session.used.has('FRA')).toBe(true)
  })

  it('submitGuess(correct) increments score and streak, no life lost, status round-ended', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(exact('FRA')) })
    expect(result.current.session.score).toBe(100)
    expect(result.current.session.streak).toBe(1)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.lives).toBe(3)
    expect(result.current.session.status).toBe('round-ended')
  })

  it('submitGuess(wrong) decrements lives and resets streak', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(exact('FRA')) })
    act(() => { result.current.advance(round('DEU')) })
    act(() => { result.current.submitGuess(miss('DEU', 'FRA', 20)) })
    expect(result.current.session.lives).toBe(2)
    expect(result.current.session.streak).toBe(0)
    expect(result.current.session.bestStreak).toBe(1)
    expect(result.current.session.score).toBe(120)
  })

  it('three wrong guesses in a row ends the game', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(miss('FRA', 'DEU', 5)) })
    act(() => { result.current.advance(round('DEU')) })
    act(() => { result.current.submitGuess(miss('DEU', 'FRA', 5)) })
    act(() => { result.current.advance(round('JPN')) })
    act(() => { result.current.submitGuess(miss('JPN', 'FRA', 5)) })
    expect(result.current.session.status).toBe('game-over')
    expect(result.current.session.lives).toBe(0)
  })

  it('advance() moves from round-ended to playing with the next round', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(exact('FRA')) })
    act(() => { result.current.advance(round('DEU')) })
    expect(result.current.session.status).toBe('playing')
    expect(result.current.session.currentRound?.targetCca3).toBe('DEU')
    expect(result.current.session.used.has('DEU')).toBe(true)
    expect(result.current.session.roundIndex).toBe(1)
  })

  it('endGame() returns to idle with empty state', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => { result.current.start('country-pinning', round('FRA')) })
    act(() => { result.current.submitGuess(exact('FRA')) })
    act(() => { result.current.endGame() })
    expect(result.current.session.status).toBe('idle')
    expect(result.current.session.score).toBe(0)
    expect(result.current.session.used.size).toBe(0)
  })
})
