import type React from 'react'

export type GameStatus = 'idle' | 'playing' | 'round-ended' | 'game-over'

export type ModeId = 'country-pinning'

export type CountryLike = {
  cca3: string
  name: { common: string }
  flag: string
  latlng: [number, number]   // [lat, lng] — matches countries.json
  independent: boolean
}

export type RoundSpec = {
  targetCca3: string
  targetName: string
  targetFlag: string
  targetCentroid: [number, number]   // [lng, lat] — MapLibre order
}

export type GuessOutcome = {
  correct: boolean
  pointsEarned: number
  livesDelta: -1 | 0
  reveal: {
    targetCca3: string
    clickedCca3: string | null
    distanceKm: number | null
  }
}

export type GameSession = {
  modeId: ModeId
  status: GameStatus
  lives: 0 | 1 | 2 | 3
  score: number
  streak: number
  bestStreak: number
  roundIndex: number
  currentRound: RoundSpec | null
  lastOutcome: GuessOutcome | null
  used: Set<string>
}

export type PersonalBest = {
  bestScore: number
  bestStreak: number
  gamesPlayed: number
}

export type GameMode = {
  id: ModeId
  title: string
  description: string
  hashSegment: string
  HudComponent: React.FC<{ session: GameSession }>
  nextRound(used: Set<string>, pool: CountryLike[]): RoundSpec
  onGuess(
    clickedCca3: string | null,
    clickedCentroid: [number, number] | null,
    round: RoundSpec,
  ): GuessOutcome
}
