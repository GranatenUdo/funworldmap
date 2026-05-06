import type { CountryData, CountriesFile } from '../lib/types'
import { CountryColumn } from './CountryColumn'

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
  const panelClasses = isDesktop
    ? 'fixed right-4 top-16 bottom-4 w-[656px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 rounded-2xl border border-sand-200/50 dark:border-dark-200/20 overflow-hidden'
    : 'fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 rounded-t-2xl h-[80vh] overflow-hidden'

  return (
    <div
      className={panelClasses}
      role="complementary"
      aria-label="Country comparison"
      data-testid="country-panel"
      style={isDesktop ? { animation: 'panel-card-in 250ms cubic-bezier(0.34, 1.3, 0.64, 1)' } : undefined}
    >
      <div className={isDesktop ? 'grid grid-cols-2 h-full' : 'flex flex-col h-full'}>
        <div
          className={
            isDesktop
              ? 'border-r border-sand-200/50 dark:border-dark-200/30'
              : 'flex-1 border-b-2 border-dashed border-sand-300/50 dark:border-dark-200/30 min-h-0'
          }
        >
          <CountryColumn
            country={country}
            byCca3={byCca3}
            onSelect={onSelect}
            onClose={onClose}
            badgeLetter="A"
            badgeColor="a"
            showColumnClose={false}
          />
        </div>
        <div className={isDesktop ? '' : 'flex-1 min-h-0'}>
          <CountryColumn
            country={compareWith}
            byCca3={byCca3}
            onSelect={onSelect}
            onClose={onExitCompare}
            badgeLetter="B"
            badgeColor="b"
            showColumnClose={true}
          />
        </div>
      </div>
      <footer
        className="px-4 py-3 border-t border-sand-200/50 dark:border-dark-200/30 text-xs text-sand-600 dark:text-dark-100"
        data-testid="compare-sources"
      >
        <span className="uppercase tracking-wider text-teal dark:text-teal-light font-medium">Sources:</span>{' '}
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
  )
}
