import { useState } from 'react'
import type { CountryData, CountriesFile } from '../lib/types'
import { CloseButton } from './CloseButton'
import { FieldLabel } from './FieldLabel'

interface Props {
  country: CountryData
  comparePickingMode: boolean
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onEnterCompare: () => void
  byCca3: Map<string, CountryData>
  inGameRound?: boolean
}

function DataCell({
  label,
  children,
  field,
  country,
  sources,
}: {
  label: string
  children: React.ReactNode
  field: string
  country: CountryData
  sources: CountriesFile['_sources']
}) {
  return (
    <div className="py-1.5">
      <FieldLabel label={label} field={field} country={country} sources={sources} />
      <div
        data-testid="data-cell-value"
        className="text-[15px] text-sand-800 dark:text-dark-50 tabular-nums"
      >
        {children}
      </div>
    </div>
  )
}

function formatPopulation(n: number): string {
  return n.toLocaleString('en-US')
}

function formatArea(n: number): string {
  return `${n.toLocaleString('en-US')} km\u00B2`
}

const REGION_BADGE: Record<string, string> = {
  Africa: 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Americas: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Asia: 'bg-rose-100/80 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  Europe: 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Oceania: 'bg-teal-100/80 text-teal-800 dark:bg-teal/20 dark:text-teal-light',
  Antarctic: 'bg-slate-100/80 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
}

export function SingleCountryPanel({
  country,
  comparePickingMode,
  sources,
  isDesktop,
  onSelect,
  onClose,
  onEnterCompare,
  byCca3,
  inGameRound = false,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const showSecondary = isDesktop || expanded

  const onShareLink = () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const hash = `#${country.cca3}`
    const url = base + hash
    const dispatchToast = () =>
      window.dispatchEvent(new CustomEvent('funworldmap:toast', { detail: 'Link copied' }))
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(url)
        .then(dispatchToast)
        .catch(() => window.prompt('Copy this link:', url))
    } else {
      window.prompt('Copy this link:', url)
    }
  }

  const panelClasses = isDesktop
    ? 'fixed right-4 top-16 bottom-4 w-[360px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 overflow-y-auto rounded-2xl border border-sand-200/50 dark:border-dark-200/20'
    : `fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 overflow-y-auto rounded-t-2xl transition-[height] duration-200 ${
        expanded ? 'h-[80vh]' : 'h-[40vh]'
      }`

  return (
    <div
      className={panelClasses}
      role="complementary"
      aria-label="Country information"
      data-testid="country-panel"
      style={isDesktop ? { animation: 'panel-card-in 250ms ease-out' } : undefined}
    >
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
        {comparePickingMode && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-teal/10 dark:bg-teal-light/10 border border-teal/20 dark:border-teal-light/20 text-xs text-teal dark:text-teal-light">
            Pick a country to compare with...
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3.5 min-w-0"
            style={{ animation: 'fade-up 200ms ease-out' }}
          >
            <img
              data-testid="country-flag"
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
              className="w-[72px] h-[50px] object-cover rounded-xl shadow-lg shrink-0"
            />
            <div className="min-w-0 pt-0.5">
              <h2 className="text-2xl font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight">
                {country.name.common}
              </h2>
              {country.name.official !== country.name.common && (
                <p className="text-xs text-sand-600 dark:text-dark-100 truncate mt-0.5">
                  {country.name.official}
                </p>
              )}
              {country.capital.length > 0 && (
                <p className="text-xs text-teal dark:text-teal-light truncate mt-0.5">
                  {country.capital[0]}
                </p>
              )}
              <span
                data-testid="region-badge"
                className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-1.5 ${
                  REGION_BADGE[country.region] ||
                  'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
                }`}
              >
                {country.region}
                {country.subregion && ` / ${country.subregion}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!comparePickingMode && !inGameRound && (
              <button
                onClick={onEnterCompare}
                className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-teal dark:text-teal-light transition-colors"
                aria-label="Compare with another country"
                title="Compare"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
                  <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
                </svg>
              </button>
            )}

            {!inGameRound && (
              <button
                onClick={onShareLink}
                className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors"
                aria-label="Copy link to this country"
                title="Copy link"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </button>
            )}

            {!isDesktop && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors"
                aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
              >
                <svg
                  className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
            {inGameRound ? (
              <button
                type="button"
                onClick={onClose}
                data-testid="game-continue"
                className="px-4 py-2 rounded-xl bg-teal-accessible text-white font-semibold text-sm hover:bg-teal-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-accessible/60"
              >
                Continue
              </button>
            ) : (
              <CloseButton onClick={onClose} ariaLabel="Close panel" testId="panel-close" />
            )}
          </div>
        </div>
      </div>

      <div className="mx-5 h-px bg-teal/10 dark:bg-teal-light/10" />

      <div className="px-5 py-3">
        <div
          className="grid grid-cols-2 gap-x-4"
          style={{ animation: 'panel-field-in 200ms ease-out 50ms both' }}
        >
          <DataCell label="Capital" field="capital" country={country} sources={sources}>
            {country.capital.length > 0 ? country.capital.join(', ') : '\u2014'}
          </DataCell>
          <DataCell label="Population" field="population" country={country} sources={sources}>
            {formatPopulation(country.population)}
          </DataCell>
          <DataCell label="Area" field="area" country={country} sources={sources}>
            {formatArea(country.area)}
          </DataCell>
          <DataCell label="Region" field="region" country={country} sources={sources}>
            {country.region}
          </DataCell>
        </div>

        {showSecondary && (
          <>
            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />

            <div style={{ animation: 'panel-field-in 200ms ease-out 100ms both' }}>
              {country.governmentType && (
                <DataCell
                  label="Government"
                  field="governmentType"
                  country={country}
                  sources={sources}
                >
                  {country.governmentType}
                </DataCell>
              )}
              <div className="grid grid-cols-2 gap-x-4">
                <DataCell label="UN Member" field="unMember" country={country} sources={sources}>
                  {country.unMember ? 'Yes' : 'No'}
                </DataCell>
                <DataCell
                  label="Independent"
                  field="independent"
                  country={country}
                  sources={sources}
                >
                  {country.independent ? 'Yes' : 'No'}
                </DataCell>
              </div>
            </div>

            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />

            <div style={{ animation: 'panel-field-in 200ms ease-out 150ms both' }}>
              <div className="grid grid-cols-2 gap-x-4">
                {Object.keys(country.languages).length > 0 && (
                  <DataCell label="Languages" field="languages" country={country} sources={sources}>
                    {Object.values(country.languages).join(', ')}
                  </DataCell>
                )}
                {Object.keys(country.currencies).length > 0 && (
                  <DataCell
                    label="Currencies"
                    field="currencies"
                    country={country}
                    sources={sources}
                  >
                    {Object.values(country.currencies)
                      .map((c) => `${c.name} (${c.symbol})`)
                      .join(', ')}
                  </DataCell>
                )}
              </div>
              <DataCell label="Timezones" field="timezones" country={country} sources={sources}>
                {country.timezones.join(', ')}
              </DataCell>
            </div>

            {country.borders.length > 0 && (
              <>
                <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />
                <div style={{ animation: 'panel-field-in 200ms ease-out 200ms both' }}>
                  <FieldLabel
                    label="Borders"
                    field="borders"
                    country={country}
                    sources={sources}
                    className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-2 flex items-center gap-1"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {country.borders.map((code) => {
                      const neighbor = byCca3.get(code)
                      if (neighbor) {
                        return (
                          <button
                            key={code}
                            onClick={() => onSelect(code)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full border border-teal/20 dark:border-teal-light/15 bg-teal/5 dark:bg-teal-light/5 text-teal-dim dark:text-teal-light hover:bg-teal/12 dark:hover:bg-teal-light/12 hover:scale-[1.03] active:scale-100 transition-all duration-150"
                          >
                            <img
                              src={neighbor.flag}
                              alt=""
                              className="w-4 h-3 object-cover rounded-sm shrink-0"
                            />
                            {neighbor.name.common}
                          </button>
                        )
                      }
                      return (
                        <span
                          key={code}
                          className="px-2.5 py-1.5 text-xs rounded-full bg-sand-200 dark:bg-dark-300 text-sand-600 dark:text-dark-100"
                        >
                          {code}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
