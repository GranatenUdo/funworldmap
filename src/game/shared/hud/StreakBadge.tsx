interface Props {
  streak: number
}

export function StreakBadge({ streak }: Props) {
  if (streak === 0) return null
  return (
    <div
      className="px-2.5 py-1 rounded-full bg-signal/15 border border-signal/30 text-xs font-medium text-signal-accessible dark:text-signal tabular-nums"
      data-testid="hud-streak"
      aria-label={`Current streak ${streak}`}
    >
      🔥 {streak}
    </div>
  )
}
