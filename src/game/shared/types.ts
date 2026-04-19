import type React from 'react'

export type GameStatus = 'idle' | 'playing' | 'round-ended' | 'game-over'

export type ModeId = 'country-pinning' | 'city-guessing'

// ---- Country pool (existing, unchanged shape) ----
export type CountryLike = {
  cca3: string
  name: { common: string }
  flag: string
  latlng: [number, number]   // [lat, lng] — matches countries.json
  independent: boolean
}

// ---- City pool (new) ----
export type CityLike = {
  id: string                  // `${countryCca3}-${slug(name)}`, unique
  name: string
  countryCca3: string
  countryName: string
  countryFlag: string         // path like "flags/FR.svg"
  latlng: [number, number]    // [lat, lng]
  scalerank: number
}

// ---- Round specs (discriminated union) ----
export type CountryRoundSpec = {
  kind: 'country-pinning'
  targetCca3: string
  targetName: string
  targetFlag: string
  targetCentroid: [number, number]   // [lng, lat] — MapLibre order
}

export type CityRoundSpec = {
  kind: 'city-guessing'
  targetId: string                    // city record id, used for 'used' set
  targetName: string                  // "Paris"
  targetCountryName: string           // "France"
  targetCountryFlag: string           // "flags/FR.svg"
  targetCentroid: [number, number]    // [lng, lat]
}

export type RoundSpec = CountryRoundSpec | CityRoundSpec

// ---- Guess input (discriminated union) ----
export type GuessInput =
  | { kind: 'country'; cca3: string; centroid: [number, number] }
  | { kind: 'point'; lngLat: [number, number] }
  | { kind: 'skip' }

// ---- Reveal (discriminated union) ----
export type CountryReveal = {
  kind: 'country'
  correct: boolean
  targetCca3: string
  clickedCca3: string | null
  distanceKm: number | null
}

export type PointReveal = {
  kind: 'point'
  targetCentroid: [number, number]
  clickedPoint: [number, number] | null
  distanceKm: number
}

// ---- Outcome (mode result vs controller-augmented) ----
export type ModeGuessResult = {
  pointsEarned: number
  livesDelta: -1 | 0
  reveal: CountryReveal | PointReveal
}

export type GuessOutcome = ModeGuessResult & { endsGame: boolean }

// ---- Session state ----
export type GameSession = {
  modeId: ModeId
  status: GameStatus
  lives: 0 | 1 | 2 | 3
  score: number
  streak: number
  bestStreak: number
  roundIndex: number
  maxRounds: number | null           // null = endless (Country Pinning); 10 = City Guessing
  currentRound: RoundSpec | null
  lastOutcome: GuessOutcome | null
  used: Set<string>
}

export type PersonalBest = {
  bestScore: number
  bestStreak: number
  gamesPlayed: number
}

// ---- Mode contract ----
export type GameMode = {
  id: ModeId
  title: string
  description: string
  hashSegment: string
  maxRounds: number | null
  initialCameraView: 'world' | 'preserve'
  HudComponent: React.FC<{ session: GameSession }>
  nextRound(used: Set<string>): RoundSpec
  onGuess(input: GuessInput, round: RoundSpec): ModeGuessResult
}
