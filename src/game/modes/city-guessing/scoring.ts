import type {
  CityRoundSpec,
  GuessInput,
  ModeGuessResult,
  PointReveal,
} from '../../shared/types'
import { haversineKm } from '../../shared/distance'

export const DECAY_KM = 500
export const MAX_DISTANCE_KM = 20_015

export function scoreCityGuess(
  input: GuessInput,
  round: CityRoundSpec,
): ModeGuessResult {
  if (input.kind === 'skip') {
    const reveal: PointReveal = {
      kind: 'point',
      targetCentroid: round.targetCentroid,
      clickedPoint: null,
      distanceKm: MAX_DISTANCE_KM,
    }
    return { pointsEarned: 0, livesDelta: 0, reveal }
  }
  if (input.kind !== 'point') {
    // Defensive: city mode should never receive a country click.
    const reveal: PointReveal = {
      kind: 'point',
      targetCentroid: round.targetCentroid,
      clickedPoint: null,
      distanceKm: 0,
    }
    return { pointsEarned: 0, livesDelta: 0, reveal }
  }
  const distanceKm = haversineKm(round.targetCentroid, input.lngLat)
  const pointsEarned = Math.round(100 * Math.exp(-distanceKm / DECAY_KM))
  const reveal: PointReveal = {
    kind: 'point',
    targetCentroid: round.targetCentroid,
    clickedPoint: input.lngLat,
    distanceKm,
  }
  return { pointsEarned, livesDelta: 0, reveal }
}
