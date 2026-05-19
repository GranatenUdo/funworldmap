import { useMemo, type ReactNode } from 'react'
import type { AttemptRecord, GameSession, PointReveal, RoundSpec } from '../../shared/types'
import { MESSAGES } from './messages'

interface Props {
  session: GameSession
  onSkip: () => void
}

function revealLineFor(
  reveal: PointReveal,
  pts: number,
  round: RoundSpec | null,
): ReactNode | null {
  const name = round && round.kind === 'city-guessing' ? round.targetName : 'that city'
  if (reveal.clickedPoint === null) return MESSAGES.revealSkipped(name)
  const d = reveal.distanceKm
  if (d < 1) return MESSAGES.revealCorrect(name)
  if (d < 1000) return MESSAGES.revealNear(d, pts, name)
  return MESSAGES.revealFar(d, pts, name)
}

function latestPointAttempt(
  attempts: readonly AttemptRecord[],
): { reveal: PointReveal; pointsEarned: number } | null {
  if (attempts.length === 0) return null
  const last = attempts[attempts.length - 1]
  if (last.reveal.kind !== 'point') return null
  return { reveal: last.reveal, pointsEarned: last.pointsEarned }
}

function CityGuessingHud({ session, onSkip }: Props) {
  const round = session.currentRound
  const outcome = session.lastOutcome

  const revealLine = useMemo<ReactNode | null>(() => {
    // Round-ended: read from the outcome's best/only attempt reveal.
    if (session.status === 'round-ended' && outcome && outcome.reveal.kind === 'point') {
      return revealLineFor(outcome.reveal, outcome.pointsEarned, round)
    }
    // Playing + best-of-N + ≥1 attempt: read from the latest attempt so each
    // click produces legible feedback before round-ended.
    if (session.status === 'playing' && session.attemptsPerRound > 1) {
      const latest = latestPointAttempt(session.currentAttempts)
      if (latest) return revealLineFor(latest.reveal, latest.pointsEarned, round)
    }
    return null
  }, [session.status, session.attemptsPerRound, session.currentAttempts, outcome, round])

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
