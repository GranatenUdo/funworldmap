import type { CountryData, CountriesFile } from '../lib/types'
import { CloseButton } from './CloseButton'
import { CountryColumn } from './CountryColumn'
import { dispatchToast } from '../lib/toast'
import { TOUCH_TARGET_FROM_36, TOUCH_TARGET_FROM_32 } from '../lib/layoutConstants'

interface Props {
  country: CountryData
  compareWith: CountryData
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onExitCompare: () => void
  byCca3: Map<string, CountryData>
  sources: CountriesFile['_sources']
}

export function CompareCountryPanel({
  country,
  compareWith,
  isDesktop,
  onSelect,
  onClose,
  onExitCompare,
  byCca3,
  sources,
}: Props) {
  // Same clipboard → toast → window.prompt fallback chain as the single
  // panel's onShareLink — the #FRA,DEU hash already round-trips as a deep link.
  const onShareLink = () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const url = `${base}#${country.cca3},${compareWith.cca3}`
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(url)
        .then(() => dispatchToast('Link copied'))
        .catch(() => window.prompt('Copy this link:', url))
    } else {
      window.prompt('Copy this link:', url)
    }
  }

  const panelClasses = isDesktop
    ? 'fixed right-4 top-16 bottom-4 w-[656px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 rounded-2xl border border-sand-200/50 dark:border-dark-200/20 overflow-hidden'
    : 'fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 rounded-t-2xl h-[80vh] overflow-hidden'

  return (
    <div
      className={panelClasses}
      role="complementary"
      aria-label="Country comparison"
      data-testid="country-panel"
      style={
        isDesktop
          ? { animation: 'panel-card-in 250ms cubic-bezier(0.34, 1.3, 0.64, 1)' }
          : undefined
      }
    >
      {/* flex column: header / columns (flex-1 + min-h-0 so each column's
          overflow-y-auto engages) / sources footer — the footer is part of the
          fixed-height layout instead of overflowing past an h-full grid. */}
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-end gap-1 px-3 py-2 border-b border-sand-200/50 dark:border-dark-200/30">
          <button
            type="button"
            onClick={onShareLink}
            className={`p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors ${TOUCH_TARGET_FROM_36}`}
            aria-label="Copy link to this comparison"
            title="Copy link"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
              />
            </svg>
          </button>
          {/* Compare→single must stay reachable without a keyboard — this
              labeled control is the touch counterpart of Escape's staged exit
              (A15). The × beside it closes the WHOLE panel, matching its
              top-right position's convention. */}
          <button
            type="button"
            onClick={onExitCompare}
            data-testid="exit-compare"
            className={`px-3 py-1.5 rounded-xl text-sm font-medium text-teal-accessible dark:text-teal-light hover:bg-sand-200 dark:hover:bg-dark-300 transition-colors ${TOUCH_TARGET_FROM_32}`}
          >
            Exit compare
          </button>
          <CloseButton onClick={onClose} ariaLabel="Close panel" testId="panel-close" />
        </div>
        <div
          className={
            isDesktop
              ? 'grid grid-cols-2 grid-rows-1 flex-1 min-h-0'
              : 'flex flex-col flex-1 min-h-0'
          }
        >
          <div
            className={
              isDesktop
                ? 'border-r border-sand-200/50 dark:border-dark-200/30 min-h-0'
                : 'flex-1 border-b-2 border-dashed border-sand-300/50 dark:border-dark-200/30 min-h-0'
            }
          >
            <CountryColumn
              country={country}
              byCca3={byCca3}
              onSelect={onSelect}
              badgeLetter="A"
              badgeColor="a"
            />
          </div>
          <div className={isDesktop ? 'min-h-0' : 'flex-1 min-h-0'}>
            <CountryColumn
              country={compareWith}
              byCca3={byCca3}
              onSelect={onSelect}
              badgeLetter="B"
              badgeColor="b"
            />
          </div>
        </div>
        <footer
          className="px-4 py-3 border-t border-sand-200/50 dark:border-dark-200/30 text-xs text-sand-600 dark:text-dark-100"
          data-testid="compare-sources"
        >
          <span className="uppercase tracking-wider text-teal dark:text-teal-light font-medium">
            Sources:
          </span>{' '}
          {Object.values(sources).map((s, i) => (
            <span key={s.name}>
              {i > 0 && ' · '}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-accessible dark:text-teal-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/60 rounded"
              >
                {s.name}
              </a>
            </span>
          ))}
        </footer>
      </div>
    </div>
  )
}
