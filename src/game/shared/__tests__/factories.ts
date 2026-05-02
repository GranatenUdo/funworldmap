import type { GameSession } from '../types'

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
