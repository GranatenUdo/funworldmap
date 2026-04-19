import type { GameMode, CountryLike } from '../../shared/types'
import { scoreGuess } from './scoring'
import { nextRound as pickNextRound } from './roundGenerator'
import { centroidFromLatLng } from '../../shared/distance'
import { MESSAGES } from './messages'

type HudComponent = GameMode['HudComponent']

// HudComponent is attached in Task 12 via registerCountryPinningHud.
// Keeping the definition in one place avoids a circular import between
// the mode file and the HUD file.
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
    HudComponent: attachedHud,
    nextRound: (used) => pickNextRound(used, pool),
    onGuess: (clickedCca3, clickedCentroidRaw, round) => {
      return scoreGuess(round, clickedCca3, clickedCentroidRaw)
    },
  }
}

export { centroidFromLatLng }
