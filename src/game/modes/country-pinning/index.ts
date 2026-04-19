import type { CountryLike, GameMode } from '../../shared/types'
import { scoreGuess } from './scoring'
import { nextRound as pickNextRound } from './roundGenerator'
import { centroidFromLatLng } from '../../shared/distance'
import { MESSAGES } from './messages'

type HudComponent = GameMode['HudComponent']

let attachedHud: HudComponent | null = null

export function registerCountryPinningHud(c: HudComponent): void {
  attachedHud = c
}

export function getCountryPinningMode(pool: CountryLike[]): GameMode {
  if (!attachedHud) {
    throw new Error('country-pinning HUD not registered — import the HUD module before using the mode')
  }
  return {
    id: 'country-pinning',
    title: MESSAGES.title,
    description: MESSAGES.description,
    hashSegment: 'country-pinning',
    maxRounds: null,
    initialCameraView: 'preserve',
    HudComponent: attachedHud,
    nextRound: (used) => pickNextRound(used, pool),
    onGuess: (input, round) => {
      if (round.kind !== 'country-pinning') {
        // Defensive: controller won't dispatch city rounds here.
        return {
          pointsEarned: 0,
          livesDelta: 0,
          reveal: { kind: 'country', correct: false, targetCca3: '', clickedCca3: null, distanceKm: null },
        }
      }
      const clickedCentroid = input.kind === 'country' ? input.centroid : null
      return scoreGuess(round, input, clickedCentroid)
    },
  }
}

export { centroidFromLatLng }
