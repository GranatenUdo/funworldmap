import { useEffect, useRef, useState } from 'react'
import type { CountryData, CountriesFile } from '../lib/types'
import { BorderChip } from './BorderChip'
import { CloseButton } from './CloseButton'
import { FieldLabel } from './FieldLabel'
import { TimezoneList } from './TimezoneList'
import SourceTooltip from './SourceTooltip'
import { dispatchToast } from '../lib/toast'
import { TOUCH_TARGET_FROM_36, TOUCH_TARGET_FROM_22 } from '../lib/layoutConstants'

interface Props {
  country: CountryData
  comparePickingMode: boolean
  sources: CountriesFile['_sources']
  isDesktop: boolean
  onSelect: (cca3: string) => void
  onClose: () => void
  onEnterCompare: () => void
  onCancelCompare: () => void
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

// A5: near-constant booleans render as exceptions only. Muted amber is a data
// encoding (like the region badge), not a chrome accent — kept through E4.
// inline-flex + items-center (not inline-block): each badge carries a
// SourceTooltip affordance and needs to align it with the label text.
const EXCEPTION_BADGE =
  'inline-flex items-center whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'

export function SingleCountryPanel({
  country,
  comparePickingMode,
  sources,
  isDesktop,
  onSelect,
  onClose,
  onEnterCompare,
  onCancelCompare,
  byCca3,
  inGameRound = false,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const showSecondary = isDesktop || expanded
  const panelRootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')

  useEffect(() => {
    const root = panelRootRef.current
    if (!root) {
      setAnimationState('idle')
      return
    }
    let cancelled = false
    let resolved = false
    const flipToIdle = () => {
      if (cancelled || resolved) return
      resolved = true
      setAnimationState('idle')
    }
    // Primary: wait for animations to finish (precise on local).
    // Fallback: 1s cap (covers CI cases where getAnimations doesn't observe
    // CSS transitions, or .finished promises don't resolve).
    const rafId = window.requestAnimationFrame(() => {
      if (cancelled) return
      const animations = root.getAnimations({ subtree: true })
      if (animations.length === 0) {
        flipToIdle()
        return
      }
      Promise.all(animations.map((a) => a.finished))
        .then(flipToIdle)
        .catch(flipToIdle)
    })
    const timeoutId = window.setTimeout(flipToIdle, 1000)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    // Move focus to the heading on mount.
    // requestAnimationFrame defers focus until after the panel's first
    // commit so the screen-reader announcement is meaningful, and so
    // it composes with the panel's entrance animation cleanly.
    const rafId = window.requestAnimationFrame(() => {
      headingRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [])

  const onShareLink = () => {
    const base = `${window.location.origin}${window.location.pathname}`
    const hash = `#${country.cca3}`
    const url = base + hash
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
    ? 'fixed right-4 top-16 bottom-4 w-[360px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 overflow-y-auto rounded-2xl border border-sand-200/50 dark:border-dark-200/20 panel-card-in'
    : `fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 overflow-y-auto rounded-t-2xl transition-[height] duration-200 ${
        expanded ? 'h-[80vh]' : 'h-[40vh]'
      }`

  return (
    <div
      ref={panelRootRef}
      className={panelClasses}
      role="complementary"
      aria-label="Country information"
      data-testid="country-panel"
      data-animation-state={animationState}
    >
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
        {comparePickingMode && (
          <div
            role="status"
            className="mb-3 px-3 py-2 rounded-lg bg-ice-dim/10 dark:bg-ice/10 border border-ice-dim/20 dark:border-ice/20 text-xs text-ice-accessible dark:text-ice flex items-center justify-between gap-2"
          >
            <span>Pick a country to compare with...</span>
            {/* A7: the only touch-reachable exit from picking mode (Escape is
                keyboard-only). Calls the same exit path as Escape. */}
            <button
              type="button"
              onClick={onCancelCompare}
              data-testid="compare-picking-cancel"
              aria-label="Cancel compare"
              className={`shrink-0 p-1 -m-1 rounded-md hover:bg-ice-dim/20 dark:hover:bg-ice/20 transition-colors ${TOUCH_TARGET_FROM_22}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
        <div
          className={
            isDesktop
              ? 'flex items-start justify-between gap-3'
              : 'flex flex-col items-stretch gap-2'
          }
        >
          <div className="flex items-start gap-3.5 min-w-0 panel-fade-up">
            <img
              data-testid="country-flag"
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
              className="w-[72px] h-[50px] object-cover rounded-xl shadow-lg shrink-0"
            />
            <div className="min-w-0 pt-0.5">
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-sand-900 dark:text-dark-50 line-clamp-2 break-words tracking-tight leading-tight focus:outline-none rounded"
              >
                {country.name.common}
              </h2>
              {country.name.official !== country.name.common && (
                <p className="text-xs text-sand-600 dark:text-dark-100 line-clamp-2 break-words mt-0.5">
                  {country.name.official}
                </p>
              )}
              {country.capital.length > 0 && (
                <p
                  data-testid="capital-caption"
                  className="text-xs text-ice-accessible dark:text-ice mt-0.5 flex items-center min-w-0"
                >
                  <span className="truncate">{country.capital.join(', ')}</span>
                  {/* Interim attribution (A4): the caption absorbed the deleted
                      Capital DataCell; the region badge shares this source.
                      Superseded by D2's consolidated footer. */}
                  <SourceTooltip
                    field="capital"
                    fieldSources={country._fieldSources}
                    sources={sources}
                  />
                </p>
              )}
            </div>
          </div>

          <div className={`flex items-center gap-1 ${isDesktop ? 'shrink-0' : 'flex-wrap'}`}>
            {!comparePickingMode && !inGameRound && (
              <button
                onClick={onEnterCompare}
                className={`p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-ice-dim dark:text-ice transition-colors ${TOUCH_TARGET_FROM_36}`}
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
                className={`p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors ${TOUCH_TARGET_FROM_36}`}
                aria-label="Copy link to this country"
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
            )}

            {!isDesktop && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`p-2 rounded-xl hover:bg-sand-200 dark:hover:bg-dark-300 text-sand-600 dark:text-dark-100 transition-colors ${TOUCH_TARGET_FROM_36}`}
                aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
              >
                <svg
                  className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </button>
            )}
            {inGameRound ? (
              <button
                type="button"
                onClick={onClose}
                data-testid="game-continue"
                className={`px-4 py-2 rounded-xl bg-ice-accessible text-white font-semibold text-sm hover:bg-ice-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-accessible/60 ${TOUCH_TARGET_FROM_36}`}
              >
                Continue
              </button>
            ) : (
              <CloseButton onClick={onClose} ariaLabel="Close panel" testId="panel-close" />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span
            data-testid="region-badge"
            className={`inline-block whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full ${
              REGION_BADGE[country.region] ||
              'bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100'
            }`}
          >
            {country.region}
            {country.subregion && ` / ${country.subregion}`}
          </span>
          {country.unMember === false && (
            <span data-testid="exception-badge-un-member" className={EXCEPTION_BADGE}>
              UN observer state
              {/* Field-level attribution is a constitution item (never silently
                  regress) — mirrors the capital caption's SourceTooltip (A4). */}
              <SourceTooltip
                field="unMember"
                fieldSources={country._fieldSources}
                sources={sources}
              />
            </span>
          )}
          {country.independent === false && (
            <span data-testid="exception-badge-independent" className={EXCEPTION_BADGE}>
              Not independent
              <SourceTooltip
                field="independent"
                fieldSources={country._fieldSources}
                sources={sources}
              />
            </span>
          )}
        </div>
      </div>

      <div className="mx-5 h-px bg-ice-dim/10 dark:bg-ice/10" />

      <div className="px-5 py-3">
        <div className="grid grid-cols-2 gap-x-4 panel-field-in-1">
          <DataCell label="Population" field="population" country={country} sources={sources}>
            {formatPopulation(country.population)}
          </DataCell>
          <DataCell label="Area" field="area" country={country} sources={sources}>
            {formatArea(country.area)}
          </DataCell>
          <DataCell label="Government" field="governmentType" country={country} sources={sources}>
            {country.governmentType || '\u2014'}
          </DataCell>
          <DataCell label="Languages" field="languages" country={country} sources={sources}>
            {Object.keys(country.languages).length > 0
              ? Object.values(country.languages).join(', ')
              : '\u2014'}
          </DataCell>
        </div>

        {showSecondary && (
          <>
            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />

            <div className="panel-field-in-2">
              {Object.keys(country.currencies).length > 0 && (
                <DataCell label="Currencies" field="currencies" country={country} sources={sources}>
                  {Object.values(country.currencies)
                    .map((c) => `${c.name} (${c.symbol})`)
                    .join(', ')}
                </DataCell>
              )}
              <DataCell label="Timezones" field="timezones" country={country} sources={sources}>
                <TimezoneList timezones={country.timezones} />
              </DataCell>
            </div>

            {country.borders.length > 0 && (
              <>
                <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />
                <div className="panel-field-in-3">
                  <FieldLabel
                    label="Borders"
                    field="borders"
                    country={country}
                    sources={sources}
                    className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-2 flex items-center gap-1"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {country.borders.map((code) => (
                      <BorderChip
                        key={code}
                        code={code}
                        neighbor={byCca3.get(code)}
                        onSelect={onSelect}
                        size="panel"
                      />
                    ))}
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
