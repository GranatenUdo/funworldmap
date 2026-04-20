import { useEffect, useRef } from 'react'
import type { GameSession, PersonalBest } from '../types'

interface Props {
  session: GameSession
  personalBest: PersonalBest
  beatPersonalBest: boolean
  onPlayAgain: () => void
  onBackToMap: () => void
}

export function GameOverOverlay({
  session, personalBest, beatPersonalBest, onPlayAgain, onBackToMap,
}: Props) {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const playAgain = document.querySelector<HTMLButtonElement>(
      '[data-testid="game-over-play-again"]',
    )
    playAgain?.focus({ preventScroll: true })
    return () => {
      const target = previousFocusRef.current
      const canRestore =
        target &&
        target !== document.body &&
        document.body.contains(target) &&
        typeof target.focus === 'function'
      if (canRestore) {
        target.focus({ preventScroll: true })
      } else {
        document
          .querySelector<HTMLElement>('[role="application"]')
          ?.focus({ preventScroll: true })
      }
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center sm:items-center items-end justify-center p-4 bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
      data-testid="game-over"
    >
      <div className="w-full max-w-sm rounded-2xl bg-sand-50 dark:bg-dark-400 border border-sand-300/50 dark:border-dark-200/30 shadow-2xl p-6">
        <h2
          id="game-over-title"
          className="text-xl font-bold text-sand-900 dark:text-dark-50 mb-1"
        >
          Game over
        </h2>
        <p className="text-sm text-sand-500 dark:text-dark-100 mb-4">
          {session.maxRounds === null
            ? 'Three wrong guesses.'
            : `${session.maxRounds} rounds complete.`}
        </p>

        <dl
          className={`grid ${
            session.maxRounds === null ? 'grid-cols-2' : 'grid-cols-1'
          } gap-3 mb-6`}
        >
          <div>
            <dt className="text-xs uppercase text-sand-500 dark:text-dark-100">Score</dt>
            <dd
              className="text-2xl font-bold text-sand-900 dark:text-dark-50 tabular-nums"
              data-testid="game-over-score"
            >
              {session.score}
            </dd>
          </div>
          {session.maxRounds === null && (
            <div>
              <dt className="text-xs uppercase text-sand-500 dark:text-dark-100">Longest streak</dt>
              <dd
                className="text-2xl font-bold text-sand-900 dark:text-dark-50 tabular-nums"
                data-testid="game-over-best-streak"
              >
                {session.bestStreak}
              </dd>
            </div>
          )}
        </dl>

        <div className="text-xs text-sand-500 dark:text-dark-100 mb-5" data-testid="game-over-pb">
          {beatPersonalBest ? (
            <span className="font-semibold text-teal dark:text-teal-light">New personal best!</span>
          ) : (
            <>Best: {personalBest.bestScore} pts · {personalBest.bestStreak} streak</>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 px-4 py-2 rounded-xl bg-teal text-white font-medium hover:bg-teal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
            data-testid="game-over-play-again"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onBackToMap}
            className="flex-1 px-4 py-2 rounded-xl bg-sand-200 dark:bg-dark-300 text-sand-900 dark:text-dark-50 font-medium hover:bg-sand-300 dark:hover:bg-dark-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
            data-testid="game-over-back"
          >
            Back to map
          </button>
        </div>
      </div>
    </div>
  )
}
