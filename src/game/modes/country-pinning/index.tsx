import type { CountryLike, GameMode } from '../../shared/types'
import { scoreGuess } from './scoring'
import { nextRound as pickNextRound } from './roundGenerator'
import { MESSAGES } from './messages'
import CountryPinningHud from './CountryPinningHud'

export function getCountryPinningMode(pool: CountryLike[]): GameMode {
  return {
    id: 'country-pinning',
    title: MESSAGES.title,
    description: MESSAGES.description,
    hashSegment: 'country-pinning',
    maxRounds: null,
    initialCameraView: 'preserve',
    HudComponent: CountryPinningHud,
    nextRound: (used) => pickNextRound(used, pool),
    onGuess: (input, round) => {
      if (round.kind !== 'country-pinning') {
        // Defensive: controller won't dispatch city rounds here.
        return {
          pointsEarned: 0,
          livesDelta: 0,
          reveal: { kind: 'country', correct: false, targetCca3: '', clickedCca3: null, clickedName: null, distanceKm: null },
        }
      }
      const clickedCentroid = input.kind === 'country' ? input.centroid : null
      return scoreGuess(round, input, clickedCentroid)
    },
  }
}

