import type { ModeId, PersonalBest } from '../game/shared/types'

export type LauncherCardState = 'unplayed' | 'played' | 'unavailable'

const ICONS: Record<ModeId, React.ReactNode> = {
  'country-pinning': (
    <svg className="w-8 h-8 text-teal dark:text-teal-light" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s-7-7.58-7-13a7 7 0 1 1 14 0c0 5.42-7 13-7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  'city-guessing': (
    <svg className="w-8 h-8 text-teal dark:text-teal-light" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V10l4-2 4 2 4-3 4 2v12H4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-6M12 21v-6M16 21v-6" />
    </svg>
  ),
}

const TITLE: Record<ModeId, string> = {
  'country-pinning': 'Country Pinning',
  'city-guessing': 'City Guessing',
}

const HEADER_LABEL: Record<ModeId, string> = {
  'country-pinning': 'TODAY · COUNTRY',
  'city-guessing': 'TODAY · CITY',
}

interface PlayedResult {
  countryName?: string
  score: number
}

interface Props {
  modeId: ModeId
  state: LauncherCardState
  played?: PlayedResult
  freeBest: PersonalBest
  onStartDaily: () => void
  onStartFree: () => void
}

export function LauncherModeCard({ modeId, state, played, freeBest, onStartDaily, onStartFree }: Props) {
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
          <div className="text-[10px] font-semibold uppercase tracking-widest text-teal dark:text-teal-light">
            {HEADER_LABEL[modeId]}
          </div>
          <div className="text-lg font-bold text-sand-900 dark:text-dark-50 leading-tight">
            {TITLE[modeId]}
          </div>
        </div>
      </div>

      {state === 'unplayed' && (
        <button
          type="button"
          onClick={onStartDaily}
          data-testid={`${testIdBase}-daily-cta`}
          className="w-full px-4 py-2 rounded-xl bg-teal text-white font-semibold hover:bg-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
        >
          Play · 3 attempts
        </button>
      )}

      {state === 'played' && (
        <div className="text-sand-900 dark:text-dark-50 text-sm" data-testid={`${testIdBase}-played-result`}>
          ✓ {played?.countryName ?? 'Played'} · <span className="tabular-nums font-semibold">{played?.score ?? 0}</span>/100
        </div>
      )}

      {state === 'unavailable' && (
        <div className="text-sand-600 dark:text-dark-100 text-sm mb-3" data-testid={`${testIdBase}-unavailable`}>
          Today's daily is syncing.
        </div>
      )}

      <button
        type="button"
        onClick={onStartFree}
        data-testid={`${testIdBase}-free-link`}
        className="mt-3 text-[13px] text-teal dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded px-1"
      >
        Play free mode →
      </button>

      <div className="mt-4 pt-3 border-t border-sand-200/70 dark:border-dark-200/30 text-[11px] text-sand-600 dark:text-dark-100">
        <span className="uppercase tracking-wider text-teal dark:text-teal-light font-medium">Best (free)</span>{' '}
        <span data-testid={`${testIdBase}-free-best`} className="tabular-nums">
          {freeBest.gamesPlayed > 0 ? `${freeBest.bestScore} / 1000` : '— / 1000'}
        </span>
      </div>
    </div>
  )
}
