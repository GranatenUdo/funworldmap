interface Props {
  streak: number
}

export function StreakBadge({ streak }: Props) {
  if (streak === 0) return null
  return (
    <div
      className="px-2.5 py-1 rounded-full bg-teal/15 dark:bg-teal-light/15 border border-teal/30 dark:border-teal-light/30 text-xs font-medium text-teal dark:text-teal-light tabular-nums"
      data-testid="hud-streak"
      aria-label={`Current streak ${streak}`}
    >
      🔥 {streak}
    </div>
  )
}
