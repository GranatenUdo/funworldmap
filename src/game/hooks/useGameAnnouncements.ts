import { useEffect, useRef } from 'react'
import type { CountryLike, GameMode, GameSession } from '../shared/types'
import { computeRevealAnimationPlan } from '../shared/revealAnimation'
import { isCountryPinning } from '../shared/modePredicates'
import { prefersReducedMotion } from '../../lib/motion'

const REVEAL_MS_CITY = 2000

function dispatchAnnouncement(text: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:announce', { detail: text }))
}

// Used by the country-pinning round-end branches (correct + wrong-endsGame) which
// share an identical "wait for reveal, advance on timer or Enter/Esc/Space" shape.
function holdThenAdvance(durationMs: number, advanceNow: () => void): () => void {
  const t = window.setTimeout(advanceNow, durationMs)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      advanceNow()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => {
    window.clearTimeout(t)
    window.removeEventListener('keydown', onKey)
  }
}

export interface UseGameAnnouncementsArgs {
  session: GameSession
  mode: GameMode | null
  byCca3: Map<string, CountryLike>
  advance: (nextRound: ReturnType<GameMode['nextRound']>) => void
  finalize: () => void
  record: (score: number, bestStreak: number) => void
}

/**
 * Coordinates the three reducer-state-driven side-effects of game flow:
 *
 * 1. Screen-reader announcements via the `funworldmap:announce` custom event —
 *    "Pin: <country>" / "Where is <city>, <country>?" on round entry and
 *    "Game over. Final score N." on terminal transition. Deduped by round key
 *    so re-renders that touch unrelated session fields don't re-announce.
 * 2. Auto-advance timing from `round-ended` → `playing` (or `game-over` when
 *    the outcome ends the game). Six branches: country-pinning non-final,
 *    city-mode, country-pinning final + correct, country-pinning final +
 *    wrong + intra-game (Esc-only), country-pinning final + wrong +
 *    end-of-game, and the reveal-animation override for any of those.
 * 3. Game-over recording: personal best for free play, daily-history (with
 *    resume cleanup) for daily play. Deduped via a `recordedRef` so a
 *    rerender while still game-over doesn't double-record.
 */
export function useGameAnnouncements({
  session,
  mode,
  byCca3,
  advance,
  finalize,
  record,
}: UseGameAnnouncementsArgs): void {
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
      const inCountryMode = isCountryPinning(session.modeId)
      const isCorrect =
        session.lastOutcome.reveal?.kind === 'country' ? session.lastOutcome.reveal.correct : false

      const advanceNow = () => {
        if (session.lastOutcome?.endsGame) {
          finalize()
          return
        }
        const next = mode.nextRound(session.used)
        advance(next)
      }

      // Auto-advance timing: derived from the animation duration when a line
      // animation is firing; otherwise the existing per-mode constant.
      const plan = session.lastOutcome
        ? computeRevealAnimationPlan(session.lastOutcome.reveal, byCca3, prefersReducedMotion())
        : null
      const animatedMs = plan ? Math.max(plan.durationMs + 300, 1800) : null

      if (!inCountryMode) {
        const ms = animatedMs ?? REVEAL_MS_CITY
        const t = window.setTimeout(advanceNow, ms)
        return () => window.clearTimeout(t)
      }

      // Country-pinning final outcome + correct → 3000ms auto-advance, scoped keyboard early-skip.
      if (isCorrect) {
        return holdThenAdvance(3000, advanceNow)
      }

      // Country-pinning final outcome + wrong:
      // - intra-game (free, lives>0): no timer; Esc advances (Continue button is the primary path).
      // - end-of-game: auto-advance after the reveal animation finishes; Esc / Enter / Space skip early.
      if (session.lastOutcome.endsGame) {
        return holdThenAdvance(Math.max(animatedMs ?? 0, 3000), advanceNow)
      }
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') advanceNow()
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
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
  }, [
    session,
    session.status,
    session.roundIndex,
    session.lastOutcome,
    session.score,
    session.bestStreak,
    session.lives,
    session.used,
    session.currentRound,
    session.modeId,
    advance,
    mode,
    record,
    byCca3,
    finalize,
  ])
}
