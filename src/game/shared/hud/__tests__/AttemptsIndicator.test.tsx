import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttemptsIndicator } from '../AttemptsIndicator'
import type { GameSession } from '../../types'

const baseSession: GameSession = {
  modeId: 'country-pinning', status: 'playing', lives: 3, score: 0, streak: 0, bestStreak: 0,
  roundIndex: 0, maxRounds: 1, attemptsPerRound: 3, attemptsRemaining: 2,
  currentAttempts: [], currentRound: null, lastOutcome: null, dailyDate: '2026-05-02',
  used: new Set(), endedEarly: false,
}

describe('AttemptsIndicator', () => {
  it('renders +pts toast when last attempt scored > 0', () => {
    const sess: GameSession = { ...baseSession, currentAttempts: [{ pointsEarned: 42, input: { kind: 'skip' } as const, reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: null, clickedName: null, distanceKm: null } as const }] }
    render(<AttemptsIndicator session={sess} />)
    expect(screen.getByText('+42')).toBeTruthy()
  })

  it('does NOT render toast when last attempt scored 0', () => {
    const sess: GameSession = { ...baseSession, currentAttempts: [{ pointsEarned: 0, input: { kind: 'skip' } as const, reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: null, clickedName: null, distanceKm: null } as const }] }
    render(<AttemptsIndicator session={sess} />)
    expect(screen.queryByText('+0')).toBeNull()
  })
})
