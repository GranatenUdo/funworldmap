import type { GuessOutcome, RoundSpec } from '../../shared/types'
import { haversineKm } from '../../shared/distance'

export const EXACT_POINTS = 100
export const DECAY_KM = 3000

export function scoreGuess(
  round: RoundSpec,
  clickedCca3: string | null,
  clickedCentroid: [number, number] | null,
): GuessOutcome {
  if (clickedCca3 === null) {
    return {
      correct: false,
      pointsEarned: 0,
      livesDelta: 0,
      reveal: { targetCca3: round.targetCca3, clickedCca3: null, distanceKm: null },
    }
  }

  if (clickedCca3 === round.targetCca3) {
    return {
      correct: true,
      pointsEarned: EXACT_POINTS,
      livesDelta: 0,
      reveal: { targetCca3: round.targetCca3, clickedCca3, distanceKm: 0 },
    }
  }

  if (!clickedCentroid) {
    return {
      correct: false,
      pointsEarned: 0,
      livesDelta: -1,
      reveal: { targetCca3: round.targetCca3, clickedCca3, distanceKm: null },
    }
  }

  const distanceKm = haversineKm(round.targetCentroid, clickedCentroid)
  const pointsEarned = Math.round(EXACT_POINTS * Math.exp(-distanceKm / DECAY_KM))
  return {
    correct: false,
    pointsEarned,
    livesDelta: -1,
    reveal: { targetCca3: round.targetCca3, clickedCca3, distanceKm },
  }
}
