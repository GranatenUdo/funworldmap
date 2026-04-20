import type { ModeId, PersonalBest } from '../game/shared/types'

const ICONS: Record<ModeId, React.ReactNode> = {
  'country-pinning': (
    <svg
      className="w-8 h-8 text-teal dark:text-teal-light"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s-7-7.58-7-13a7 7 0 1 1 14 0c0 5.42-7 13-7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  'city-guessing': (
    <svg
      className="w-8 h-8 text-teal dark:text-teal-light"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V10l4-2 4 2 4-3 4 2v12H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-6M12 21v-6M16 21v-6" />
    </svg>
  ),
}

interface Props {
  modeId: ModeId
  title: string
  tagline: string
  best: PersonalBest
  onStart: () => void
}

export function LauncherModeCard({ modeId, title, tagline, best, onStart }: Props) {
  const hasPlayed = best.gamesPlayed > 0
  return (
    <button
      type="button"
      onClick={onStart}
      data-testid={`launcher-mode-${modeId}`}
      className="group text-left p-5 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 border border-sand-300/50 dark:border-dark-200/30 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-100 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 dark:focus-visible:ring-teal-light/60"
    >
      <div className="flex items-start gap-3 mb-3">
        {ICONS[modeId]}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {title}
          </div>
          <p className="text-[13px] text-sand-600 dark:text-dark-100 mt-1 leading-snug">
            {tagline}
          </p>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-sand-200/70 dark:border-dark-200/30">
        <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light">
          Best
        </div>
        <div
          className="mt-0.5 text-sand-900 dark:text-dark-50 tabular-nums"
          data-testid={`launcher-best-${modeId}`}
        >
          {hasPlayed ? (
            <>
              <span className="text-2xl font-bold">{best.bestScore}</span>
              <span className="text-[13px] text-sand-600 dark:text-dark-100 ml-1">/ 1000</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold">—</span>
              <span className="text-[13px] text-sand-600 dark:text-dark-100 ml-1">/ 1000</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}
