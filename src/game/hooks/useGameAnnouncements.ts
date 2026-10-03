import { useEffect, useRef } from 'react'
import type { CountryLike, GameMode, GameSession } from '../shared/types'

function dispatchAnnouncement(text: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: text }))
}

export interface UseGameAnnouncementsArgs {
  session: GameSession
  mode: GameMode | null
  byCca3: Map<string, CountryLike>
  advance: (nextRound: ReturnType<GameMode['nextRound']>) => void
  finalize: () => void
  record: (score: number, bestStreak: number) => void
}

/** Announce rounds and record results once; progression belongs to the controller. */
export function useGameAnnouncements({ session, mode, record }: UseGameAnnouncementsArgs): void {
  const recordedRef = useRef(false)
  const announcedGameOverRef = useRef(false)
  const lastAnnouncedRoundKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!mode) return
    if (session.status === 'playing' && session.currentRound) {
      if (session.roundIndex === 0) {
        recordedRef.current = false
        announcedGameOverRef.current = false
      }
      const key =
        session.currentRound.kind === 'country-pinning'
          ? session.currentRound.targetCca3
          : session.currentRound.targetId
      if (lastAnnouncedRoundKeyRef.current !== key) {
        lastAnnouncedRoundKeyRef.current = key
        if (session.currentRound.kind === 'country-pinning') {
          dispatchAnnouncement(`Pin: ${session.currentRound.targetName}`)
        } else {
          const r = session.currentRound
          dispatchAnnouncement(
            `Round ${session.roundIndex + 1}. Where is ${r.targetName}, ${r.targetCountryName}? Click anywhere on the map.`,
          )
        }
      }
    }
    if (session.status === 'round-ended' && session.lastOutcome) {
      return
    }
    if (session.status === 'game-over') {
      if (!recordedRef.current) {
        recordedRef.current = true
        record(session.score, session.bestStreak)
      }
      if (!announcedGameOverRef.current) {
        announcedGameOverRef.current = true
        lastAnnouncedRoundKeyRef.current = null
        dispatchAnnouncement(`Game over. Final score ${session.score}.`)
      }
    }
    // `session` (whole) is the load-bearing dep — a new reference on every
    // reducer update covers every field the effect reads. The individual
    // `session.X` projections it superseded are intentionally omitted.
  }, [session, mode, record])
}
