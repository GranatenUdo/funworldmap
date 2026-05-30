import { createContext, useContext } from 'react'
import type { CityLike, GameMode } from '../../shared/types'
import { scoreCityGuess } from './scoring'
import { nextRound as pickNextRound } from './roundGenerator'
import { MESSAGES } from './messages'
import CityGuessingHud from './CityGuessingHud'

export const CITY_GUESSING_MAX_ROUNDS = 10

// Controller injects onSkip; the HUD consumes it. Keeps the
// shared GameMode.HudComponent signature simple.
export const CityGuessingHudActionsContext = createContext<{ onSkip: () => void }>({
  onSkip: () => {},
})

export function useCityGuessingHudActions() {
  return useContext(CityGuessingHudActionsContext)
}

// eslint-disable-next-line react-refresh/only-export-components
const CityGuessingHudWrapper: GameMode['HudComponent'] = ({ session }) => {
  const { onSkip } = useCityGuessingHudActions()
  return <CityGuessingHud session={session} onSkip={onSkip} />
}

export function getCityGuessingMode(pool: CityLike[]): GameMode {
  return {
    id: 'city-guessing',
    title: MESSAGES.title,
    description: MESSAGES.description,
    hashSegment: 'city-guessing',
    maxRounds: CITY_GUESSING_MAX_ROUNDS,
    HudComponent: CityGuessingHudWrapper,
    nextRound: (used) => pickNextRound(used, pool),
    onGuess: (input, round) => {
      if (round.kind !== 'city-guessing') {
        return {
          pointsEarned: 0,
          livesDelta: 0,
          reveal: {
            kind: 'point',
            targetCentroid: round.targetCentroid,
            clickedPoint: null,
            distanceKm: 0,
          },
        }
      }
      return scoreCityGuess(input, round)
    },
  }
}
