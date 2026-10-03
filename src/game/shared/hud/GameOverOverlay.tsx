import { useRef } from 'react'
import type { GameSession, PersonalBest } from '../types'
import type { ResultReceipt } from '../personalBestsStore'
import { summarizeRounds } from '../summarizeRounds'
import { useModalLayer } from '../../../hooks/useModalLayer'
import type { ReactNode } from 'react'

interface Props {
  session: GameSession
  personalBest: PersonalBest
  beatPersonalBest: boolean
  receipt?: ResultReceipt | null
  mapReady?: boolean
  onRetryMap?: () => void
  onPlayAgain: () => void
  onBackToMap: () => void
  onChooseGame?: () => void
  reviewIndex?: number | null
  onReview?: (index: number | null) => void
  children?: ReactNode
}

export function GameOverOverlay({
  session,
  personalBest,
  receipt,
  mapReady = true,
  onRetryMap,
  onPlayAgain,
  onBackToMap,
  onChooseGame,
  reviewIndex = null,
  onReview,
  children,
}: Props) {
  const root = useRef<HTMLDivElement>(null)
  const reviewing = reviewIndex !== null
  useModalLayer(root, !reviewing)
  const summary = summarizeRounds(session.completedRounds)
  const country = session.modeId === 'country-pinning'
  return (
    <div
      ref={root}
      className={reviewing ? 'review-panel' : 'results-backdrop safe-results'}
      role={reviewing ? 'region' : 'dialog'}
      aria-modal={reviewing ? undefined : true}
      aria-labelledby="game-over-title"
      data-testid="game-over"
    >
      <div className="results-card">
        <p className="eyebrow">{reviewing ? 'Keep exploring' : 'Your world, a little bigger'}</p>
        <h2 id="game-over-title" data-testid="game-over-title" className="text-3xl font-bold mt-2">
          {reviewing ? 'Review your answers' : 'Game over'}
        </h2>
        <p className="text-sm mt-2">
          {session.endedEarly
            ? 'Game ended early.'
            : country
              ? 'Three wrong guesses.'
              : '10 rounds complete.'}
        </p>
        {!mapReady && (
          <div className="map-recovery" role="status">
            <p>The map is unavailable. Your results are still here.</p>
            {onRetryMap && (
              <button className="game-secondary mt-2" onClick={onRetryMap}>
                Retry map
              </button>
            )}
          </div>
        )}
        {!reviewing && (
          <>
            <div className="score-hero">
              <span data-testid="game-over-score">{session.score}</span>
              <span>points</span>
            </div>
            <dl className="results-stats">
              <div>
                <dt>Answered</dt>
                <dd>
                  {summary.answered}
                  {country ? ` · ${summary.correct} correct` : ''}
                </dd>
              </div>
              {country ? (
                <>
                  <div>
                    <dt>Accuracy</dt>
                    <dd>
                      {summary.accuracy === null ? 'No guesses made' : `${summary.accuracy}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>Longest streak</dt>
                    <dd data-testid="game-over-best-streak">{session.bestStreak}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt>Skipped</dt>
                    <dd>{summary.skipped}</dd>
                  </div>
                  <div>
                    <dt>Average distance</dt>
                    <dd>
                      {summary.averageDistance === null
                        ? 'No guesses made'
                        : `${Math.round(summary.averageDistance).toLocaleString()} km`}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <p className="text-sm my-4" data-testid="game-over-pb">
              {receipt?.firstResult
                ? 'Your first result!'
                : receipt?.newBest
                  ? 'New personal best!'
                  : `Best: ${personalBest.bestScore} pts`}{' '}
              {receipt
                ? receipt.saved
                  ? 'Saved in this browser.'
                  : 'Could not save in this browser; this result is available until you leave.'
                : 'Recording this result…'}
            </p>
          </>
        )}
        {reviewing && (
          <>
            <button className="game-secondary mt-3" onClick={() => onReview?.(null)}>
              Back to results
            </button>
            <label className="block text-sm mt-4" htmlFor="review-round">
              Choose a round
            </label>
            <select
              id="review-round"
              className="review-select"
              value={reviewIndex}
              onChange={(e) => onReview?.(Number(e.target.value))}
            >
              {session.completedRounds.map((record, index) => (
                <option key={index} value={index}>
                  Round {index + 1}: {record.round.targetName} · {record.outcome.pointsEarned} pts
                </option>
              ))}
            </select>
            {children}
            <div className="flex gap-2 mt-3">
              <button
                className="game-secondary flex-1"
                disabled={reviewIndex === 0}
                onClick={() => onReview?.(reviewIndex - 1)}
              >
                Previous
              </button>
              <button
                className="game-secondary flex-1"
                disabled={reviewIndex === session.completedRounds.length - 1}
                onClick={() => onReview?.(reviewIndex + 1)}
              >
                Next answer
              </button>
            </div>
          </>
        )}
        {!reviewing && session.completedRounds.length > 0 && onReview && (
          <button
            className="game-secondary w-full mb-3"
            disabled={!mapReady}
            onClick={() => onReview(0)}
          >
            Review answers on the map
          </button>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            className="game-primary flex-1"
            data-autofocus
            disabled={!mapReady}
            data-testid="game-over-play-again"
            onClick={onPlayAgain}
          >
            Play again
          </button>
          <button
            className="game-secondary flex-1"
            data-testid="game-over-back"
            onClick={onBackToMap}
          >
            Explore the map
          </button>
        </div>
        {onChooseGame && (
          <button className="game-text w-full mt-2" onClick={onChooseGame}>
            Choose another game
          </button>
        )}
      </div>
    </div>
  )
}
