interface Props {
  score: number
  pending?: boolean
}

export function ScoreBadge({ score, pending = false }: Props) {
  return (
    <div
      className={`px-2.5 py-1 rounded-full bg-sand-100/90 dark:bg-dark-400/80 border text-sm font-semibold tabular-nums ${
        pending
          ? 'border-teal-accessible/60 text-teal-accessible dark:text-teal-light'
          : 'border-sand-300/50 dark:border-dark-200/30 text-sand-900 dark:text-dark-50'
      }`}
      data-testid="hud-score"
      data-pending={pending ? 'true' : undefined}
      title={pending ? 'Best so far this round' : undefined}
    >
      {score}
    </div>
  )
}
