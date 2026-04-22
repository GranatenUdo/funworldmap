export type StreakMode = 'active' | 'broken' | 'first'

interface Props {
  current: number
  longest: number
  totalDays: number
  streakMode: StreakMode
  onOpenHistory: () => void
}

export function LauncherStreakPill({ current, longest, totalDays, streakMode, onOpenHistory }: Props) {
  return (
    <div
      data-testid="launcher-streak"
      data-streak-mode={streakMode}
      className="flex items-center justify-center gap-3 text-[13px] text-sand-50/90 dark:text-dark-100"
      style={{ animation: 'launcher-streak-in 180ms ease-out 30ms both' }}
    >
      {streakMode === 'active' && (
        <span>
          <span aria-hidden="true">🔥 </span>
          <span className="tabular-nums font-semibold">{current}-day streak</span>
        </span>
      )}
      {streakMode === 'broken' && (
        <span>Start your streak — play today's daily.</span>
      )}
      {streakMode === 'first' && (
        <span>Play today's daily.</span>
      )}

      {totalDays > 0 && (
        <button
          type="button"
          onClick={onOpenHistory}
          data-testid="launcher-history-link"
          className="text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-1"
          aria-label={`Open calendar: current ${current} longest ${longest} days played ${totalDays}`}
        >
          Past 30 days →
        </button>
      )}
    </div>
  )
}
