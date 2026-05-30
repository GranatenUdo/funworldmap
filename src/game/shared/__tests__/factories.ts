import type {
  CityRoundSpec,
  CountryReveal,
  CountryRoundSpec,
  GameSession,
  GuessOutcome,
  PointReveal,
} from '../types'

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
    currentRound: null,
    lastOutcome: null,
    endedEarly: false,
    used: new Set(),
    ...overrides,
  }
}

export function makeCountryRound(overrides: Partial<CountryRoundSpec> = {}): CountryRoundSpec {
  return {
    kind: 'country-pinning',
    targetCca3: 'FRA',
    targetName: 'France',
    targetFlag: 'flags/FR.svg',
    targetCentroid: [2, 46],
    ...overrides,
  }
}

export function makeCityRound(overrides: Partial<CityRoundSpec> = {}): CityRoundSpec {
  return {
    kind: 'city-guessing',
    targetId: 'FRA-paris',
    targetName: 'Paris',
    targetCountryName: 'France',
    targetCountryFlag: 'flags/FR.svg',
    targetCentroid: [2.3522, 48.8566],
    ...overrides,
  }
}

export function makeCountryReveal(overrides: Partial<CountryReveal> = {}): CountryReveal {
  return {
    kind: 'country',
    correct: false,
    targetCca3: 'FRA',
    clickedCca3: 'USA',
    clickedName: 'United States',
    distanceKm: 7000,
    ...overrides,
  }
}

export function makePointReveal(overrides: Partial<PointReveal> = {}): PointReveal {
  return {
    kind: 'point',
    targetCentroid: [2.3522, 48.8566],
    clickedPoint: [-74.006, 40.7128],
    distanceKm: 5800,
    ...overrides,
  }
}

export function makeOutcome(reveal: CountryReveal | PointReveal, endsGame = false): GuessOutcome {
  return { pointsEarned: 0, livesDelta: 0, reveal, endsGame }
}
