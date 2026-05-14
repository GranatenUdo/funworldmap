import type { AttemptRecord, GameSession } from '../types'

export function makeAttempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    pointsEarned: 0,
    input: { kind: 'country', cca3: 'USA', name: 'United States', centroid: [-97, 38] },
    reveal: { kind: 'country', correct: false, targetCca3: 'FRA', clickedCca3: 'USA', clickedName: 'United States', distanceKm: 7000 },
    ...overrides,
  }
}

export function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    modeId: 'country-pinning',
    status: 'idle',
    lives: 3,
    score: 0,
    streak: 0,
    bestStreak: 0,
    roundIndex: 0,
    maxRounds: null,
    attemptsPerRound: 1,
    attemptsRemaining: 1,
    currentAttempts: [],
    currentRound: null,
    lastOutcome: null,
    dailyDate: null,
    endedEarly: false,
    used: new Set(),
    ...overrides,
  }
}
