import type { ReactNode } from 'react'
import { LivesIndicator } from './LivesIndicator'
import { ScoreBadge } from './ScoreBadge'
import { StreakBadge } from './StreakBadge'
import type { GameSession } from '../types'

interface Props {
  session: GameSession
  onEndGame: () => void
  children: ReactNode
}

export function HudShell({ session, onEndGame, children }: Props) {
  return (
    <div
      className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[95vw]"
      data-testid="game-hud"
      data-game-status={session.status}
    >
      <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <LivesIndicator lives={session.lives} />
          <div className="flex items-center gap-2">
            <ScoreBadge score={session.score} />
            <StreakBadge streak={session.streak} />
          </div>
          <button
            type="button"
            onClick={onEndGame}
            className="text-xs text-sand-500 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded px-1"
            data-testid="game-end"
          >
            End game
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
