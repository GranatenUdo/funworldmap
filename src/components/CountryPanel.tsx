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
      <span className="text-ground-500 dark:text-void-100 text-sm min-w-[100px] shrink-0">
        {label}
      </span>
      <span className="text-sm text-ground-900 dark:text-void-50 flex items-center flex-wrap gap-1">
        {children}
        <SourceTooltip field={field} fieldSources={country._fieldSources} sources={sources} />
      </span>
    </div>
  )
}

function FieldSection({
  children,
  delay,
}: {
  children: React.ReactNode
  delay: number
}) {
  return (
    <div
      className="border-l-2 border-accent/20 dark:border-accent-light/20 pl-3 py-1"
      style={{ animation: `panel-field-in 250ms ease-out ${delay}ms both` }}
    >
      {children}
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
  Oceania: 'bg-cyan-100/80 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  Antarctic: 'bg-slate-100/80 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
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
    ? 'fixed top-0 right-0 h-full w-[380px] bg-white/[0.92] dark:bg-void-400/[0.92] backdrop-blur-sm shadow-2xl z-40 overflow-y-auto transition-transform duration-200'
    : `fixed bottom-0 left-0 right-0 bg-white dark:bg-void-400 shadow-2xl z-40 overflow-y-auto transition-[height] duration-200 rounded-t-2xl ${
        expanded ? 'h-[80vh]' : 'h-[40vh]'
      }`

  return (
    <div className={panelClasses} role="complementary" aria-label="Country information" data-testid="country-panel">
      {/* Header */}
      <div className="sticky top-0 bg-white/95 dark:bg-void-400/95 backdrop-blur-md border-b border-ground-200/50 dark:border-void-200/30 px-5 py-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3.5 min-w-0"
            style={{ animation: 'fade-up 200ms ease-out' }}
          >
            {/* Flag — larger */}
            <img
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
              className="w-[72px] h-[50px] object-cover rounded-lg shadow-md shrink-0"
            />
            {/* Name */}
            <div className="min-w-0 pt-0.5">
              <h2 className="font-display text-xl text-ground-900 dark:text-void-50 truncate tracking-tight">
                {country.name.common}
              </h2>
              {country.name.official !== country.name.common && (
                <p className="text-xs text-ground-500 dark:text-void-100 truncate mt-0.5">
                  {country.name.official}
                </p>
              )}
              {/* Region badge */}
              <span
                className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1.5 ${
                  REGION_BADGE[country.region] || 'bg-ground-100 text-ground-600 dark:bg-void-200 dark:text-void-100'
                }`}
              >
                {country.region}
                {country.subregion && ` / ${country.subregion}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Expand/collapse on mobile */}
            {!isDesktop && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-2 rounded-lg hover:bg-ground-100 dark:hover:bg-void-300 text-ground-500 dark:text-void-100 transition-colors"
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
              className="p-2 rounded-lg hover:bg-ground-100 dark:hover:bg-void-300 text-ground-500 dark:text-void-100 transition-colors"
              aria-label="Close panel"
              data-testid="panel-close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-3">
        {/* Primary fields — always visible */}
        <FieldSection delay={0}>
          <Field label="Capital" field="capital" country={country} sources={sources}>
            {country.capital.length > 0 ? country.capital.join(', ') : '\u2014'}
          </Field>
          <Field label="Population" field="population" country={country} sources={sources}>
            {formatPopulation(country.population)}
          </Field>
          <Field label="Area" field="area" country={country} sources={sources}>
            {formatArea(country.area)}
          </Field>
        </FieldSection>

        {/* Secondary fields — visible on desktop or when expanded on mobile */}
        {showSecondary && (
          <>
            <FieldSection delay={60}>
              {country.governmentType && (
                <Field label="Government" field="governmentType" country={country} sources={sources}>
                  {country.governmentType}
                </Field>
              )}
              <Field label="UN Member" field="unMember" country={country} sources={sources}>
                {country.unMember ? 'Yes' : 'No'}
              </Field>
              <Field label="Independent" field="independent" country={country} sources={sources}>
                {country.independent ? 'Yes' : 'No'}
              </Field>
            </FieldSection>

            <FieldSection delay={120}>
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
            </FieldSection>

            {/* Neighbor chips */}
            {country.borders.length > 0 && (
              <div
                className="pt-1"
                style={{ animation: 'panel-field-in 250ms ease-out 180ms both' }}
              >
                <div className="text-ground-500 dark:text-void-100 text-sm mb-2 flex items-center">
                  Borders
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
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-accent/8 dark:bg-accent-light/10 text-accent dark:text-accent-light hover:bg-accent/15 dark:hover:bg-accent-light/20 transition-all duration-150 hover:-translate-y-px hover:shadow-sm"
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
                        className="px-2.5 py-1 text-xs rounded-full bg-ground-100 dark:bg-void-300 text-ground-400 dark:text-void-100"
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
