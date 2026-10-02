import { useRef } from 'react'
import { useModalLayer } from '../../../hooks/useModalLayer'
import type { GameSession } from '../types'

/**
 * C-4 trivial-run gate: on round 1 with no points there is nothing worth a
 * confirmation — GameController's requestEnd ends these runs immediately
 * instead of opening the dialog.
 */
// eslint-disable-next-line react-refresh/only-export-components -- WHY: the gate belongs with the dialog it guards (GameSessionProvider precedent); fast refresh of this rarely-edited pair is an acceptable trade.
export function isTrivialRun(session: Pick<GameSession, 'roundIndex' | 'score'>): boolean {
  return session.roundIndex === 0 && session.score === 0
}

interface Props {
  /** End the run (finishFree — score recorded, game-over overlay shows). */
  onConfirm: () => void
  /** Close the dialog and resume — the safe default action. */
  onKeepPlaying: () => void
}

/**
 * Run-safety confirm (C-4): Escape-while-playing and the HUD End-game button
 * route here (via GameController's requestEnd) instead of ending a non-trivial
 * run outright. "Keep playing" is primary and initially focused; Escape inside
 * the dialog keeps playing. Focus restore on close follows the GameOverOverlay
 * house pattern.
 */
export function EndGameConfirm({ onConfirm, onKeepPlaying }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  useModalLayer(rootRef)

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-game-confirm-title"
      data-testid="end-game-confirm"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        // Escape means "keep playing" here, and it MUST NOT bubble on to the
        // window-level useEscapeExit listener — that would re-run the
        // end-the-run routing this dialog exists to confirm.
        e.stopPropagation()
        e.preventDefault()
        onKeepPlaying()
      }}
    >
      <div className="my-auto w-full max-w-sm rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl border border-sand-200/50 dark:border-dark-200/30 shadow-2xl p-6">
        <h2
          id="end-game-confirm-title"
          className="text-display text-xl text-sand-900 dark:text-dark-50 mb-1"
        >
          End game?
        </h2>
        <p className="text-sm text-sand-600 dark:text-dark-100 mb-5">Your personal best is saved in this browser when storage is available.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onKeepPlaying}
            className="flex-1 px-4 py-2 rounded-xl bg-ice-accessible text-white font-medium hover:bg-ice-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-accessible/50"
            data-testid="end-keep-playing"
          >
            Keep playing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-xl bg-sand-200 dark:bg-dark-300 text-sand-900 dark:text-dark-50 font-medium hover:bg-sand-300 dark:hover:bg-dark-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ice/50"
            data-testid="end-confirm"
          >
            End game
          </button>
        </div>
      </div>
    </div>
  )
}
