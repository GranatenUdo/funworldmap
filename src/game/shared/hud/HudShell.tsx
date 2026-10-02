import { useEffect, useRef, type ReactNode } from 'react'
import { LivesIndicator } from './LivesIndicator'
import { ScoreBadge } from './ScoreBadge'
import { ScoreDelta } from './ScoreDelta'
import { StreakBadge } from './StreakBadge'
import { RoundCounter } from './RoundCounter'
import type { GameSession } from '../types'
import { TOUCH_TARGET_FROM_32, TOUCH_TARGET_TEXT_XS } from '../../../lib/layoutConstants'

interface Props {
  session: GameSession
  onEndGame: () => void
  onOpenHelp: () => void
  children: ReactNode
}

export function HudShell({ session, onEndGame, onOpenHelp, children }: Props) {
  const fixedRounds = session.maxRounds !== null && session.maxRounds > 1
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Move focus to the HUD region on mount (C-3a) — game starts (launcher
    // Play and deep links alike) otherwise strand focus on whatever chrome
    // launched the game, which has since unmounted. Same rAF-deferred house
    // pattern as SingleCountryPanel's heading focus: defer until after the
    // first commit so the screen-reader announcement is meaningful.
    const rafId = window.requestAnimationFrame(() => {
      rootRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [])

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label="Game HUD"
      tabIndex={-1}
      className={`play-hud fixed top-16 sm:top-20 ${session.status === "playing" ? "left-1/2 -translate-x-1/2" : ""} z-40 pointer-events-auto max-w-[95vw] focus:outline-none`}
      data-testid="game-hud"
      data-game-status={session.status}
      data-game-mode={session.modeId}
    >
      <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-300/50 dark:border-dark-200/30 shadow-2xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {fixedRounds ? (
            <RoundCounter
              current={Math.min(session.roundIndex + 1, session.maxRounds!)}
              total={session.maxRounds!}
            />
          ) : (
            <LivesIndicator lives={session.lives} />
          )}
          <div className="flex items-center gap-2">
            <div className="relative">
              <ScoreBadge score={session.score} />
              <ScoreDelta
                score={session.score}
                pointsEarned={session.lastOutcome?.pointsEarned ?? 0}
              />
            </div>
            {fixedRounds ? null : <StreakBadge streak={session.streak} />}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenHelp}
              aria-label="How to play"
              data-testid="game-help"
              className={`p-2 rounded-lg border border-sand-300/65 dark:border-dark-200/70 text-sand-600 dark:text-dark-100 hover:bg-sand-200/60 dark:hover:bg-dark-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ice/50 ${TOUCH_TARGET_FROM_32}`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={onEndGame}
              className={`text-xs text-sand-600 dark:text-dark-100 hover:text-sand-700 dark:hover:text-dark-50 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice/50 rounded px-1 ${TOUCH_TARGET_TEXT_XS}`}
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
