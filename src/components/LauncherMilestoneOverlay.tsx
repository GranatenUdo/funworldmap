import { useEffect } from 'react'
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
  useEffect(() => {
    track('streak_reached_milestone', { days })
    const t = window.setTimeout(onDismiss, 2500)
    return () => { window.clearTimeout(t) }
  }, [days, onDismiss])

  return (
    <button
      type="button"
      onClick={onDismiss}
      data-testid="launcher-milestone"
      className="fixed inset-x-0 top-16 z-[220] mx-auto max-w-md px-6 py-3 rounded-xl bg-teal text-white shadow-2xl text-center text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-light/80"
      style={{ animation: 'launcher-milestone-in 260ms ease-out both' }}
      aria-live="polite"
    >
      <span aria-hidden="true">🔥 </span>{COPY[days]}
    </button>
  )
}
