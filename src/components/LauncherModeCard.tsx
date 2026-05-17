import type { ModeId } from '../game/shared/types'
import { parseLocalDate } from '../game/daily/dates'

export type LauncherCardState =
  | 'unplayed'
  | 'played'
  | 'past-unplayed'
  | 'loading' // index still fetching
  | 'unavailable-error' // fetch failed
  | 'no-puzzle-today' // index loaded, but no entry for today's date

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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 22s-7-7.58-7-13a7 7 0 1 1 14 0c0 5.42-7 13-7 13z"
      />
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

const TITLE: Record<ModeId, string> = {
  'country-pinning': 'Country',
  'city-guessing': 'City',
}

const SUBTITLE: Record<ModeId, string> = {
  'country-pinning': 'Click the right country on the map',
  'city-guessing': 'Pin where the city is',
}

function headerLabel(anchorDate: string | undefined, today: string): string | null {
  const isToday = !anchorDate || anchorDate === today
  if (isToday) return null
  const md = parseLocalDate(anchorDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return md.toUpperCase()
}

interface PlayedResult {
  targetName?: string
  score: number
}

interface Props {
  modeId: ModeId
  anchorDate?: string // 'YYYY-MM-DD'; absent = today
  todayDate: string // 'YYYY-MM-DD'
  state: LauncherCardState
  played?: PlayedResult
  latestAvailableDate?: string | null // most recent past date with a daily; for 'no-puzzle-today'
  onStartDaily: () => void
  onStartFree: () => void
  onSeeReveal?: () => void
  onRetry?: () => void
}

export function LauncherModeCard({
  modeId,
  anchorDate,
  todayDate,
  state,
  played,
  latestAvailableDate,
  onStartDaily,
  onStartFree,
  onSeeReveal,
  onRetry,
}: Props) {
  // onStartFree kept for API compatibility; Task 3.4 will use for parent-level shared link
  void onStartFree
  const testIdBase = `launcher-card-${modeId}`
  return (
    <div
      data-testid={testIdBase}
      data-state={state}
      className={`p-5 rounded-2xl bg-sand-50/95 dark:bg-dark-400/95 border shadow-lg transition-all duration-150 ${
        state === 'played'
          ? 'border-emerald-400/60 dark:border-emerald-500/40'
          : 'border-sand-300/50 dark:border-dark-200/30'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        {ICONS[modeId]}
        <div className="min-w-0 flex-1">
          {headerLabel(anchorDate, todayDate) && (
            <div className="text-[10px] font-semibold uppercase tracking-widest text-teal dark:text-teal-light">
              {headerLabel(anchorDate, todayDate)}
            </div>
          )}
          <div className="text-lg font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {TITLE[modeId]}
          </div>
          <div className="text-xs text-sand-600 dark:text-dark-100 mt-0.5">{SUBTITLE[modeId]}</div>
        </div>
      </div>

      {state === 'unplayed' && (
        <>
          <button
            type="button"
            onClick={onStartDaily}
            data-testid={`${testIdBase}-daily-cta`}
            className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
          >
            Play
          </button>
          <div className="text-xs text-sand-600 dark:text-dark-100 mt-1.5 text-center">
            3 tries · best one counts
          </div>
        </>
      )}

      {state === 'past-unplayed' && onSeeReveal && (
        <button
          type="button"
          onClick={onSeeReveal}
          data-testid={`${testIdBase}-see-reveal`}
          className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 dark:focus-visible:ring-teal-light/60"
        >
          See reveal
        </button>
      )}

      {state === 'played' && (
        <div data-testid={`${testIdBase}-played-result`}>
          <div className="text-sand-900 dark:text-dark-50 text-sm mb-2">
            ✓ {played?.targetName ?? 'Played'} ·{' '}
            <span className="tabular-nums font-semibold">{played?.score ?? 0}</span>/100
          </div>
          {onSeeReveal && (
            <button
              type="button"
              onClick={onSeeReveal}
              data-testid={`${testIdBase}-see-reveal`}
              className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 dark:focus-visible:ring-teal-light/60"
            >
              See reveal
            </button>
          )}
        </div>
      )}

      {state === 'loading' && (
        <div
          className="text-sand-600 dark:text-dark-100 text-sm mb-3"
          data-testid={`${testIdBase}-loading`}
        >
          Loading…
        </div>
      )}

      {state === 'unavailable-error' && (
        <div data-testid={`${testIdBase}-error`}>
          <div className="text-sand-600 dark:text-dark-100 text-sm mb-3">
            Couldn’t load today’s puzzle.
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              data-testid={`${testIdBase}-retry`}
              className="px-3 py-1.5 rounded-lg bg-teal text-white text-sm font-medium hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {state === 'no-puzzle-today' && (
        <div
          className="text-sand-600 dark:text-dark-100 text-sm mb-3"
          data-testid={`${testIdBase}-no-puzzle`}
        >
          {!anchorDate || anchorDate === todayDate
            ? "Today's puzzle isn't ready yet."
            : "That day's puzzle is no longer available."}{' '}
          {latestAvailableDate && (
            <a
              href={`#daily/${latestAvailableDate}/reveal`}
              data-testid={`${testIdBase}-no-puzzle-link`}
              className="text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded"
            >
              Try{' '}
              {parseLocalDate(latestAvailableDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
              's daily →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
