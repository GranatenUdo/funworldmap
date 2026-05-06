import { type ReactNode, useEffect, useState } from 'react'
import { LivesIndicator } from './LivesIndicator'
import { ScoreBadge } from './ScoreBadge'
import { StreakBadge } from './StreakBadge'
import { RoundCounter } from './RoundCounter'
import { AttemptsIndicator } from './AttemptsIndicator'
import { deriveBest } from '../useGameSession'
import type { GameSession } from '../types'
import { track } from '../../../lib/analytics'

/**
 * Score threshold below which we surface a one-time "Use remaining attempts?"
 * confirm before honouring Done. At 30+ the user is meaningfully placed;
 * below it they may have fat-fingered a bad click.
 */
const LOW_SCORE_THRESHOLD = 30

interface Props {
  session: GameSession
  onEndGame: () => void
  onDone: () => void
  children: ReactNode
}

export function HudShell({ session, onEndGame, onDone, children }: Props) {
  const bestOfN = session.attemptsPerRound > 1
  const fixedRounds = session.maxRounds !== null && session.maxRounds > 1
  const showDone = bestOfN && session.status === 'playing' && session.currentAttempts.length > 0

  // For best-of-N rounds the cumulative `session.score` is updated only on
  // round-end, so it stays at 0 throughout the round. Surface the running
  // best instead — and tag it so the badge can style it as provisional.
  const runningBest =
    bestOfN && session.status === 'playing' && session.currentAttempts.length > 0
      ? deriveBest(session.currentAttempts).pointsEarned
      : null
  const displayScore = runningBest ?? session.score
  const scorePending = runningBest !== null

  // Inline confirm state.
  // `confirmAsked` — true while the prompt is currently visible.
  // `promptShownThisRound` — latching flag: true once the prompt has been
  //   surfaced for this round. Prevents re-prompting if the user dismisses
  //   with "Use attempts" and then clicks Done again (no-nag guarantee).
  //   Both flags reset when the round resets (currentAttempts cleared).
  const [confirmAsked, setConfirmAsked] = useState(false)
  const [promptShownThisRound, setPromptShownThisRound] = useState(false)

  // `session.currentAttempts.length === 0` covers both the advance case
  // (reducer clears currentAttempts on advance/restart) and a brand-new game.
  useEffect(() => {
    if (session.currentAttempts.length === 0) {
      setConfirmAsked(false)
      setPromptShownThisRound(false)
    }
  }, [session.currentAttempts.length])

  const bestSoFar = runningBest ?? 0
  const lowScoreRemaining =
    bestSoFar < LOW_SCORE_THRESHOLD && session.attemptsRemaining >= 1

  const handleDoneClick = () => {
    // Show the prompt only if: score is low, attempts remain, AND we haven't
    // already shown the prompt this round (no-nag: honor the second click).
    if (lowScoreRemaining && !promptShownThisRound) {
      setConfirmAsked(true)
      setPromptShownThisRound(true)
      track('daily_done_low_score_prompt', {
        mode: session.modeId,
        bestScore: bestSoFar,
        attemptsRemaining: session.attemptsRemaining,
      })
      return
    }
    onDone()
  }

  return (
    <div
      role="region"
      aria-label="Game HUD"
      className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[95vw]"
      data-testid="game-hud"
      data-game-status={session.status}
      data-game-mode={session.modeId}
    >
      <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 shadow-2xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {bestOfN ? (
            <AttemptsIndicator session={session} />
          ) : fixedRounds ? (
            <RoundCounter
              current={Math.min(session.roundIndex + 1, session.maxRounds!)}
              total={session.maxRounds!}
            />
          ) : (
            <LivesIndicator lives={session.lives} />
          )}
          <div className="flex items-center gap-2">
            <ScoreBadge score={displayScore} pending={scorePending} />
            {bestOfN || fixedRounds ? null : <StreakBadge streak={session.streak} />}
          </div>
          <div className="flex items-center gap-2">
            {showDone && (
              confirmAsked ? (
                <div
                  data-testid="done-confirm"
                  className="flex items-center gap-2 flex-wrap"
                >
                  <span className="text-xs text-sand-700 dark:text-dark-100">
                    Use your remaining {session.attemptsRemaining}{' '}
                    {session.attemptsRemaining === 1 ? 'attempt' : 'attempts'}?
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmAsked(false)}
                    className="px-3 py-1.5 rounded-lg bg-teal-accessible text-white text-sm font-semibold hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/50"
                    data-testid="done-confirm-use-attempts"
                  >
                    Use attempts
                  </button>
                  <button
                    type="button"
                    onClick={onDone}
                    className="px-3 py-1.5 rounded-lg bg-sand-200 dark:bg-dark-300 text-sand-800 dark:text-dark-50 text-sm font-semibold hover:bg-sand-300 dark:hover:bg-dark-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
                    data-testid="done-confirm-anyway"
                  >
                    Done anyway
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDoneClick}
                  className="px-3 py-1.5 rounded-lg bg-teal-accessible text-white text-sm font-semibold hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/50"
                  data-testid="game-done"
                >
                  Done
                </button>
              )
            )}
            <button
              type="button"
              onClick={onEndGame}
              className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
              data-testid="game-end"
            >
              End game
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
