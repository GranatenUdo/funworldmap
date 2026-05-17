import SearchBar from './SearchBar'
import ThemeToggle from './ThemeToggle'
import type { CountryData } from '../lib/types'
import type { Theme } from '../hooks/useTheme'
import { track } from '../lib/analytics'

interface Props {
  countries: CountryData[]
  theme: Theme
  satellite: boolean
  comparePickingMode: boolean
  gameActive: boolean
  launcherVisible: boolean
  ctaState: 'unplayed' | 'partial' | 'done'
  streakCurrent: number
  streakActive: boolean
  onSelect: (cca3: string) => void
  onThemeCycle: () => void
  onSatelliteToggle: () => void
  onOpenLauncher: () => void
  onOpenLauncherHistory: () => void
  onLauncherDismiss: () => void
}

export default function Header({
  countries,
  theme,
  satellite,
  comparePickingMode,
  gameActive,
  launcherVisible,
  ctaState,
  streakCurrent,
  streakActive,
  onSelect,
  onThemeCycle,
  onSatelliteToggle,
  onOpenLauncher,
  onOpenLauncherHistory,
  onLauncherDismiss,
}: Props) {
  if (launcherVisible) return null

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto hidden lg:flex items-baseline mr-4 shrink-0">
          <span className="text-lg font-bold tracking-wide text-teal dark:text-teal-light drop-shadow-sm">
            funworldmap
          </span>
        </div>

        {!gameActive && (
          <div className="pointer-events-auto flex-1 max-w-md mx-auto lg:mx-0">
            <SearchBar
              countries={countries}
              comparePickingMode={comparePickingMode}
              onSelect={onSelect}
              onNonEmptyChange={onLauncherDismiss}
            />
          </div>
        )}

        <div className="pointer-events-auto ml-3 flex items-center gap-2">
          {!gameActive && streakActive && streakCurrent > 0 && (
            <button
              type="button"
              onClick={onOpenLauncherHistory}
              aria-label={`Streak ${streakCurrent} days — open history`}
              data-testid="header-streak-chip"
              className="hidden sm:flex h-10 px-2.5 rounded-xl backdrop-blur-sm border bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-sm tabular-nums items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50"
            >
              <span aria-hidden="true">🔥</span>
              <span className="font-semibold text-teal dark:text-teal-light">{streakCurrent}</span>
            </button>
          )}

          {!gameActive && (
            <button
              onClick={() => {
                track('header_cta_clicked', { state: ctaState })
                onOpenLauncher()
              }}
              aria-label={
                ctaState === 'done'
                  ? 'Today’s puzzle complete'
                  : ctaState === 'partial'
                    ? 'Play today (1 mode remaining)'
                    : 'Play today'
              }
              data-testid="header-play"
              data-state={ctaState}
              className={`h-10 px-3 rounded-xl backdrop-blur-sm border flex items-center gap-2 font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
                ctaState === 'done'
                  ? 'bg-sand-100/60 dark:bg-dark-400/60 border-sand-300/40 dark:border-dark-200/30 text-sand-700 dark:text-dark-100'
                  : 'bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-teal dark:text-teal-light hover:bg-sand-200/90 dark:hover:bg-dark-300/80'
              }`}
            >
              {streakActive && streakCurrent > 0 && (
                <span className="sm:hidden flex items-center gap-1 mr-1 text-teal dark:text-teal-light tabular-nums">
                  <span aria-hidden="true">🔥</span>
                  <span className="font-semibold">{streakCurrent}</span>
                </span>
              )}
              {ctaState === 'done' ? (
                <>
                  <span aria-hidden="true">&#x2713;</span>
                  <span className="hidden sm:inline">Today done</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="hidden sm:inline">Play today</span>
                  <span
                    aria-hidden="true"
                    className={`w-2 h-2 rounded-full ${
                      ctaState === 'partial' ? 'border-2 border-teal bg-transparent' : 'bg-teal'
                    }`}
                  />
                </>
              )}
            </button>
          )}

          <button
            onClick={onSatelliteToggle}
            aria-label={satellite ? 'Switch to map view' : 'Switch to satellite view'}
            aria-pressed={satellite}
            className={`w-10 h-10 rounded-xl backdrop-blur-sm border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 ${
              satellite
                ? 'bg-teal/20 dark:bg-teal-light/20 border-teal/40 dark:border-teal-light/30 text-teal dark:text-teal-light'
                : 'bg-sand-100/90 dark:bg-dark-400/80 border-sand-300/50 dark:border-dark-200/30 text-sand-500 dark:text-dark-100 hover:bg-sand-200/90 dark:hover:bg-dark-300/80'
            }`}
            data-testid="satellite-toggle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M3.6 9h16.8M3.6 15h16.8"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9Z"
              />
            </svg>
          </button>

          <ThemeToggle theme={theme} onCycle={onThemeCycle} />
        </div>
      </div>
    </header>
  )
}
