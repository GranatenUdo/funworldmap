import { useState } from 'react'
import type { CountryData, CountriesFile } from '../lib/types'
import SourceTooltip from './SourceTooltip'

interface Props {
  country: CountryData
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  byCca3: Map<string, CountryData>
}

function Field({
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
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-slate-500 dark:text-slate-400 text-sm min-w-[100px] shrink-0">
        {label}
      </span>
      <span className="text-sm text-slate-800 dark:text-slate-200 flex items-center flex-wrap gap-1">
        {children}
        <SourceTooltip field={field} fieldSources={country._fieldSources} sources={sources} />
      </span>
    </div>
  )
}

function formatPopulation(n: number): string {
  return n.toLocaleString('en-US')
}

function formatArea(n: number): string {
  return `${n.toLocaleString('en-US')} km²`
}

export default function CountryPanel({
  country,
  sources,
  isDesktop,
  onSelect,
  onClose,
  byCca3,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const showSecondary = isDesktop || expanded

  // Sidebar on desktop, bottom sheet on mobile
  const panelClasses = isDesktop
    ? 'fixed top-0 right-0 h-full w-[380px] bg-white dark:bg-slate-900 shadow-xl z-40 overflow-y-auto transition-transform duration-200'
    : `fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 shadow-xl z-40 overflow-y-auto transition-[height] duration-200 rounded-t-2xl ${
        expanded ? 'h-[80vh]' : 'h-[40vh]'
      }`

  return (
    <div className={panelClasses} role="complementary" aria-label="Country information" data-testid="country-panel">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Flag */}
          <img
            src={country.flag}
            alt={country.flagAlt || `Flag of ${country.name.common}`}
            className="w-10 h-7 object-cover rounded shadow-sm shrink-0"
          />
          {/* Name */}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
              {country.name.common}
            </h2>
            {country.name.official !== country.name.common && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {country.name.official}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Expand/collapse on mobile */}
          {!isDesktop && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
            >
              <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            aria-label="Close panel"
            data-testid="panel-close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-0.5">
        {/* Primary fields — always visible */}
        <Field label="Capital" field="capital" country={country} sources={sources}>
          {country.capital.length > 0 ? country.capital.join(', ') : '—'}
        </Field>

        <Field label="Region" field="region" country={country} sources={sources}>
          {country.region}
          {country.subregion && ` / ${country.subregion}`}
        </Field>

        {/* Secondary fields — visible on desktop or when expanded on mobile */}
        {showSecondary && (
          <>
            <div className="border-t border-slate-100 dark:border-slate-800 my-2" />

            <Field label="Population" field="population" country={country} sources={sources}>
              {formatPopulation(country.population)}
            </Field>

            <Field label="Area" field="area" country={country} sources={sources}>
              {formatArea(country.area)}
            </Field>

            {country.governmentType && (
              <Field label="Government" field="governmentType" country={country} sources={sources}>
                {country.governmentType}
              </Field>
            )}

            {Object.keys(country.languages).length > 0 && (
              <Field label="Languages" field="languages" country={country} sources={sources}>
                {Object.values(country.languages).join(', ')}
              </Field>
            )}

            {Object.keys(country.currencies).length > 0 && (
              <Field label="Currencies" field="currencies" country={country} sources={sources}>
                {Object.values(country.currencies)
                  .map((c) => `${c.name} (${c.symbol})`)
                  .join(', ')}
              </Field>
            )}

            <Field label="Timezones" field="timezones" country={country} sources={sources}>
              {country.timezones.join(', ')}
            </Field>

            <Field label="UN Member" field="unMember" country={country} sources={sources}>
              {country.unMember ? 'Yes' : 'No'}
            </Field>

            <Field label="Independent" field="independent" country={country} sources={sources}>
              {country.independent ? 'Yes' : 'No'}
            </Field>

            {/* Border chips */}
            {country.borders.length > 0 && (
              <div className="pt-2">
                <div className="text-slate-500 dark:text-slate-400 text-sm mb-2 flex items-center">
                  Neighbors
                  <SourceTooltip
                    field="borders"
                    fieldSources={country._fieldSources}
                    sources={sources}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {country.borders.map((code) => {
                    const neighbor = byCca3.get(code)
                    if (neighbor) {
                      return (
                        <button
                          key={code}
                          onClick={() => onSelect(code)}
                          className="px-2.5 py-1 text-xs rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                          {neighbor.name.common}
                        </button>
                      )
                    }
                    return (
                      <span
                        key={code}
                        className="px-2.5 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400"
                      >
                        {code}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
