interface Props {
  score: number
}

export function ScoreBadge({ score }: Props) {
  return (
    <div
      className="px-2.5 py-1 rounded-full bg-sand-100/90 dark:bg-dark-400/80 border border-sand-300/50 dark:border-dark-200/30 text-sm font-semibold text-sand-900 dark:text-dark-50 tabular-nums"
      data-testid="hud-score"
    >
      {score}
    </div>
  )
}
