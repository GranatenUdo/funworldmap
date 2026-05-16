import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import type { Milestone } from '../game/daily/types'

const COPY: Record<Milestone, string> = {
  3: '3 days — off to a strong start',
  7: '7 days — a full week',
  14: '14 days — two weeks',
  30: '30 days — a full month',
  100: '100 days — a hundred days',
}

interface Props {
  days: Milestone
  onDismiss: () => void
}

export function LauncherMilestoneOverlay({ days, onDismiss }: Props) {
  const firedRef = useRef(false)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')

  useEffect(() => {
    if (!firedRef.current) {
      firedRef.current = true
      track('streak_reached_milestone', { days })
    }
    // Read via ref so parent-re-render-induced onDismiss identity changes
    // don't reset the 2500ms dismiss clock (see issue #60). Under 4-shard
    // CI load this otherwise resets multiple times within the 2500ms
    // window, blowing past the test's not.toBeAttached budget.
    const t = window.setTimeout(() => {
      onDismissRef.current()
    }, 2500)
    return () => {
      window.clearTimeout(t)
    }
     
  }, [days])

  return (
    <button
      type="button"
      onClick={onDismiss}
      data-testid="launcher-milestone"
      data-animation-state={animationState}
      onAnimationEnd={() => {
        setAnimationState('idle')
      }}
      className="fixed inset-x-0 top-16 z-[220] mx-auto max-w-md px-6 py-3 rounded-xl shadow-2xl text-center text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-light/80 bg-teal-accessible text-white"
      style={{ animation: 'launcher-milestone-in 260ms ease-out both' }}
      aria-live="polite"
    >
      <span aria-hidden="true">🔥 </span>
      {COPY[days]}
    </button>
  )
}
