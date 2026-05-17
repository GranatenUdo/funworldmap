import { useNextDailyCountdown } from '../hooks/useNextDailyCountdown'

export function LauncherCountdown() {
  const { hours, minutes } = useNextDailyCountdown()
  return (
    <div
      data-testid="launcher-countdown"
      className="mt-3 text-center text-[12px] text-sand-50/90 dark:text-dark-100"
    >
      <span>✓ All played today</span>
      <span aria-hidden="true"> · </span>
      <span className="tabular-nums">
        Next puzzle in {hours}h {minutes}m
      </span>
    </div>
  )
}
