import type { GameSession } from '../types'

export function AttemptsIndicator({ session }: { session: GameSession }) {
  const used = session.currentAttempts.length
  const total = session.attemptsPerRound
  return (
    <div data-testid="attempts-indicator" className="text-sm text-sand-700 dark:text-dark-100 tabular-nums">
      Attempt {Math.min(used + (session.status === 'playing' ? 1 : 0), total)}/{total}
    </div>
  )
}
