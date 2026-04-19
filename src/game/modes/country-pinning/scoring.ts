import type { CountryRoundSpec, CountryReveal, GuessInput, ModeGuessResult } from '../../shared/types'
import { haversineKm } from '../../shared/distance'

export const EXACT_POINTS = 100
export const DECAY_KM = 3000

export function scoreGuess(
  round: CountryRoundSpec,
  input: GuessInput,
  clickedCentroid: [number, number] | null,
): ModeGuessResult {
  // Country Pinning only cares about country clicks; other kinds are
  // treated as no-ops (defensive — controller won't actually dispatch them).
  if (input.kind === 'skip' || input.kind === 'point') {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: round.targetCca3,
      clickedCca3: null,
      distanceKm: null,
    }
    return { pointsEarned: 0, livesDelta: 0, reveal }
  }
  // input.kind === 'country'
  const clickedCca3 = input.cca3
  if (clickedCca3 === round.targetCca3) {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: true,
      targetCca3: round.targetCca3,
      clickedCca3,
      distanceKm: 0,
    }
    return { pointsEarned: EXACT_POINTS, livesDelta: 0, reveal }
  }
  if (!clickedCentroid) {
    const reveal: CountryReveal = {
      kind: 'country',
      correct: false,
      targetCca3: round.targetCca3,
      clickedCca3,
      distanceKm: null,
    }
    return { pointsEarned: 0, livesDelta: -1, reveal }
  }
  const distanceKm = haversineKm(round.targetCentroid, clickedCentroid)
  const pointsEarned = Math.round(EXACT_POINTS * Math.exp(-distanceKm / DECAY_KM))
  const reveal: CountryReveal = {
    kind: 'country',
    correct: false,
    targetCca3: round.targetCca3,
    clickedCca3,
    distanceKm,
  }
  return { pointsEarned, livesDelta: -1, reveal }
}
