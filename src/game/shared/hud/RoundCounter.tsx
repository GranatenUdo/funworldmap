interface Props {
  current: number  // 1-based
  total: number
}

export function RoundCounter({ current, total }: Props) {
  return (
    <div
      className="flex items-center gap-1 text-xs font-medium text-sand-700 dark:text-dark-100 tabular-nums"
      role="status"
      aria-label={`Round ${current} of ${total}`}
      data-testid="hud-round-counter"
    >
      <span>Round</span>
      <span className="text-sand-900 dark:text-dark-50">{current}</span>
      <span className="text-sand-400 dark:text-dark-200">/</span>
      <span className="text-sand-500 dark:text-dark-100">{total}</span>
    </div>
  )
}
