import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../../lib/motion'

interface Props {
  /** Running session score — a burst fires when this increases. */
  score: number
  /** `lastOutcome.pointsEarned` of the round that just committed (0 when none). */
  pointsEarned: number
}

interface Burst {
  id: number
  points: number
  reduced: boolean
}

/** How long the static (reduced-motion) chip stays up — matches the keyframe. */
const STATIC_MS = 900
/** Removal fallback for when animationend never fires (unreliable on CI). */
const FALLBACK_MS = 1200

/**
 * A-1: transient "+N" chip that drifts up from the ScoreBadge whenever the
 * score increases. Rendered inside a `relative` wrapper around the badge
 * (HudShell). Purely celebratory — aria-hidden, because useGameAnnouncements
 * already narrates round outcomes for screen readers.
 *
 * CLAUDE.md animation contract: the chip UNMOUNTS when done, so e2e can wait
 * with `expect(chip).not.toBeAttached()` — no `data-animation-state` needed.
 * Removal is animationend-driven with a timeout fallback. The listener is a
 * NATIVE `animationend` listener, not React's `onAnimationEnd`: jsdom has no
 * `AnimationEvent`, which makes React register a vendor-prefixed event name
 * there, so the synthetic prop never fires in unit tests (verified against
 * React 19); the native name is what every supported browser dispatches.
 * Under reduced motion the global CSS kill-switch collapses the animation
 * (animationend would fire instantly and eat the information), so the chip
 * renders statically — no animation class — and only the timeout removes it.
 */
export function ScoreDelta({ score, pointsEarned }: Props) {
  const prevScoreRef = useRef(score)
  const idRef = useRef(0)
  const chipRef = useRef<HTMLDivElement>(null)
  const [burst, setBurst] = useState<Burst | null>(null)

  useEffect(() => {
    const prev = prevScoreRef.current
    prevScoreRef.current = score
    if (score > prev && pointsEarned > 0) {
      idRef.current += 1
      setBurst({ id: idRef.current, points: pointsEarned, reduced: prefersReducedMotion() })
    }
  }, [score, pointsEarned])

  useEffect(() => {
    if (!burst) return
    const clear = () => setBurst((current) => (current?.id === burst.id ? null : current))
    const timeoutId = window.setTimeout(clear, burst.reduced ? STATIC_MS : FALLBACK_MS)
    const node = chipRef.current
    if (!burst.reduced) node?.addEventListener('animationend', clear)
    return () => {
      window.clearTimeout(timeoutId)
      if (!burst.reduced) node?.removeEventListener('animationend', clear)
    }
  }, [burst])

  if (!burst) return null
  return (
    <div
      // Remount per burst so back-to-back score increases restart the drift.
      key={burst.id}
      ref={chipRef}
      className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-0.5 pointer-events-none whitespace-nowrap text-readout text-xs font-semibold text-signal-accessible dark:text-signal${
        burst.reduced ? '' : ' score-delta-drift'
      }`}
      data-testid="hud-score-delta"
      aria-hidden="true"
    >
      +{burst.points}
    </div>
  )
}
