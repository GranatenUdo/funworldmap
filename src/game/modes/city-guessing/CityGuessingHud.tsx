import { useMemo } from 'react'
import type { GameSession } from '../../shared/types'
import { MESSAGES } from './messages'

interface Props {
  session: GameSession
  onSkip: () => void
}

function CityGuessingHud({ session, onSkip }: Props) {
  const round = session.currentRound
  const outcome = session.lastOutcome

  const revealLine = useMemo(() => {
    if (session.status !== 'round-ended' || !outcome) return null
    if (outcome.reveal.kind !== 'point') return null
    const d = outcome.reveal.distanceKm
    const pts = outcome.pointsEarned
    const name =
      round && round.kind === 'city-guessing' ? round.targetName : 'that city'
    if (outcome.reveal.clickedPoint === null) return MESSAGES.revealSkipped(name)
    if (d < 1) return MESSAGES.revealCorrect(name)
    if (d < 1000) return MESSAGES.revealNear(d, pts, name)
    return MESSAGES.revealFar(d, pts, name)
  }, [session.status, outcome, round])

  if (!round || round.kind !== 'city-guessing') return null

  return (
    <div className="flex flex-col items-center gap-2 min-w-[240px]">
      <div className="flex items-center gap-3">
        <img
          src={round.targetCountryFlag}
          alt=""
          className="w-10 h-7 sm:w-12 sm:h-8 object-cover rounded shadow-sm shrink-0"
          data-testid="game-prompt-flag"
        />
        <div className="flex flex-col items-start">
          <div
            className="text-base sm:text-lg font-semibold text-sand-900 dark:text-dark-50 leading-tight"
            data-testid="game-prompt-name"
          >
            {round.targetName}
          </div>
          <div className="text-xs text-sand-500 dark:text-dark-100 leading-tight">
            {round.targetCountryName}
          </div>
        </div>
      </div>

      {session.status === 'playing' && session.attemptsPerRound === 1 && (
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
          data-testid="city-skip"
        >
          {MESSAGES.skipButton}
        </button>
      )}

      {revealLine && (
        <div
          className="text-xs sm:text-sm text-sand-700 dark:text-dark-100 text-center"
          data-testid="game-reveal"
          role="status"
        >
          {revealLine}
        </div>
      )}
    </div>
  )
}

export default CityGuessingHud
