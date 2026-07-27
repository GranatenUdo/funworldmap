import { useEffect, useRef } from 'react'
import type { GameStatus, ModeId } from '../shared/types'
import { isCountryPinning } from '../shared/modePredicates'

export interface UseEscapeExitArgs {
  status: GameStatus
  modeId: ModeId
  /** Ends the run with a recorded score — game-over overlay shows (matches the HUD End-game button). */
  finishFree: () => void
  /** Full exit to the idle map: endGame() + game-hash reset. */
  exitToIdle: () => void
}

/**
 * Escape exits, per status:
 * - idle: no handler.
 * - country-pinning round-ended: not handled here — Escape is owned by the
 *   round-end effect in useGameAnnouncements (advance, not exit).
 * - playing (both modes) and city-guessing round-ended: finishFree() — the
 *   score is shown and the personal best recorded via the game-over overlay
 *   instead of being silently discarded (2026-07 UX audit item A1).
 * - game-over: exitToIdle() — finishFree would be a reducer no-op there and
 *   the #game hash must reset.
 *
 * Callbacks are read via refs so the window listener re-registers only on
 * status/modeId changes, not on every render (same pattern as
 * useMapInteractions).
 */
export function useEscapeExit({ status, modeId, finishFree, exitToIdle }: UseEscapeExitArgs): void {
  const finishFreeRef = useRef(finishFree)
  finishFreeRef.current = finishFree
  const exitToIdleRef = useRef(exitToIdle)
  exitToIdleRef.current = exitToIdle

  useEffect(() => {
    if (status === 'idle') return
    if (status === 'round-ended' && isCountryPinning(modeId)) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const tgt = e.target as HTMLElement | null
      if (tgt && tgt.matches('input, textarea, [contenteditable]')) return
      e.preventDefault()
      if (status === 'game-over') {
        exitToIdleRef.current()
      } else {
        finishFreeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, modeId])
}
