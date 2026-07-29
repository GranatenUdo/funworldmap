import { useEffect, useMemo, useRef, useState } from 'react'
import type { CountryData, CountriesFile } from '../lib/types'
import { BorderChip, INERT_CHIP_CLASSES } from './BorderChip'
import { exploreNext } from '../lib/exploreNext'
import { CloseButton } from './CloseButton'
import { TimezoneList } from './TimezoneList'
import { dispatchToast } from '../lib/toast'
import {
  TOUCH_TARGET_FROM_36,
  TOUCH_TARGET_FROM_22,
  TOUCH_TARGET_FROM_20,
  TOUCH_TARGET_TEXT_XS,
} from '../lib/layoutConstants'
import {
  EM_DASH,
  densityOf,
  formatArea,
  formatDensity,
  formatPopulation,
} from '../lib/compareFields'
import {
  AREA_RANKS,
  POPULATION_RANKS,
  formatCompact,
  formatCompactArea,
  formatCompactDensity,
  formatRank,
} from '../lib/countryStats'
import { EXCEPTION_BADGE, activeExceptionBadges } from './exceptionBadge'
import { computeFieldSourceMarkers } from '../lib/fieldSourceMarkers'
import { SourceMarker } from './SourceMarker'
import { SourceLinkList } from './SourceLinkList'

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
  field,
  marker,
  children,
}: {
  label: string
  field: string
  /** rowMarker(field) — the C4/D2 exception marker, or null. */
  marker: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="py-1.5">
      <div
        data-field={field}
        className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-0.5 flex items-center gap-1"
      >
        {label}
        {marker}
      </div>
      <div
        data-testid="data-cell-value"
        className="text-[15px] text-sand-800 dark:text-dark-50 tabular-nums"
      >
        {children}
      </div>
    </div>
  )
}

/** D1 hero stat: compact primary numeral (.text-readout, E2 type role) with
 *  the exact value in `title` and an optional "#N of 195" rank sub-line.
 *  The label carries the data-field anchor + the C4/D2 exception marker
 *  (attribution constitution) — D2 retired the per-field FieldLabel/
 *  SourceTooltip rings in favor of the consolidated footer + marker scheme.
 *  No whitespace-nowrap: at 360px "17.1M km²" may wrap its unit — fine.
 *  A11y: compact text is aria-hidden; sr-only span carries exact for AT. */
function HeroStat({
  label,
  field,
  marker,
  value,
  exact,
  rank,
}: {
  label: string
  field: string
  /** rowMarker(field) — the C4/D2 exception marker, or null. */
  marker: React.ReactNode
  value: string
  exact?: string
  rank?: number
}) {
  return (
    <div className="py-1.5">
      <div
        data-field={field}
        className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-0.5 flex items-center gap-1"
      >
        {label}
        {marker}
      </div>
      <div
        data-testid={`hero-stat-${field}`}
        title={exact}
        className="text-readout text-xl font-semibold text-sand-900 dark:text-dark-50"
      >
        <span aria-hidden="true">{value}</span>
        {exact !== undefined && <span className="sr-only">{exact}</span>}
      </div>
      {rank !== undefined && (
        <div
          data-testid={`hero-rank-${field}`}
          className="text-readout text-[11px] text-sand-600 dark:text-dark-100 mt-0.5"
        >
          {formatRank(rank)}
        </div>
      )}
    </div>
  )
}

const REGION_BADGE: Record<string, string> = {
  Africa: 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Americas: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Asia: 'bg-rose-100/80 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  Europe: 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Oceania: 'bg-teal-100/80 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  Antarctic: 'bg-slate-100/80 text-slate-800 dark:bg-slate-800/30 dark:text-slate-300',
}

/** Display names for `_fieldSources` keys in the footer's field → source
 *  table (D2). Unknown keys render as-is — an honest fallback for fields
 *  the data pipeline adds before this map learns them. */
const FIELD_TABLE_LABELS: Record<string, string> = {
  name: 'Name',
  capital: 'Capital',
  region: 'Region',
  subregion: 'Subregion',
  population: 'Population',
  area: 'Area',
  languages: 'Languages',
  currencies: 'Currencies',
  latlng: 'Coordinates',
  borders: 'Borders',
  independent: 'Independent',
  unMember: 'UN member',
  landlocked: 'Landlocked',
  timezones: 'Timezones',
  continents: 'Continents',
  governmentType: 'Government',
}

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

  // D3: derived purely from the bundled canonical set (byCca3 is the
  // canonical-195 lookup the panel already receives) — zero data cost.
  const suggestions = useMemo(
    () => exploreNext(country, Array.from(byCca3.values())),
    [country, byCca3],
  )
  const panelRootRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [animationState, setAnimationState] = useState<'entering' | 'idle'>('entering')
  const [sourcesExpanded, setSourcesExpanded] = useState(false)

  // D2: consolidated attribution — one footer, exceptions inline. Single
  // owner of the dominance/marker math: src/lib/fieldSourceMarkers.ts
  // (shipped with C4; compare computes the same markers across BOTH
  // countries' _fieldSources, this panel across one).
  const fieldMarkers = computeFieldSourceMarkers(country._fieldSources)
  const rowMarker = (field: string): React.ReactNode => {
    const marker = fieldMarkers.markerByField.get(field)
    if (!marker) return null
    return <SourceMarker glyph={marker.glyph} sourceKey={marker.source} sources={sources} />
  }

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
    : // G1: dvh (not vh) so the sheet tracks the visual viewport as mobile
      // browser toolbars collapse — same rule as the compare sheet (C6) and
      // the innerHeight-based camera math in layoutConstants. The panel root
      // IS the scroll container, so the safe-area padding lands here:
      // content scrolls clear of the iOS home indicator (requires
      // viewport-fit=cover in index.html).
      `fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)] transition-[height] duration-200 ${
        expanded ? 'h-[80dvh]' : 'h-[40dvh]'
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
        {!isDesktop && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            data-testid="sheet-grabber"
            // G1: pointer-only expand affordance — the chevron stays the
            // labeled control (aria-label + aria-expanded). aria-hidden on a
            // focusable element violates axe's aria-hidden-focus rule, hence
            // tabIndex={-1}. Visual box: py-2 (2·8px) + h-1 bar (4px) = 20px;
            // TOUCH_TARGET_FROM_20 grows the coarse-pointer hit area to 44px.
            // Bar contrast (3:1 non-text floor, both themes): sand-500
            // #8c8578 on sand-50 #fefdfb = 3.6:1; dark-100 #94a3b8 on
            // dark-400 #161a22 = 6.8:1.
            aria-hidden="true"
            tabIndex={-1}
            className={`w-full flex justify-center py-2 -mt-2 mb-1 ${TOUCH_TARGET_FROM_20}`}
          >
            <span className="h-1 w-9 rounded-full bg-sand-500 dark:bg-dark-100" />
          </button>
        )}
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
        {/* D4: one inline header row on every viewport — flag + name left,
            actions right. The old mobile branch stacked a full actions row
            (flex-col), spending a row of the 40dvh peek sheet that D1's
            hero stats now use. */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
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
                  {/* D2: the A4 interim SourceTooltip is retired — capital
                      carries an exception marker only when its source differs
                      from the panel's dominant source; the footer's field
                      table has the full answer either way. */}
                  {rowMarker('capital')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isDesktop && !comparePickingMode && !inGameRound && (
              <button
                onClick={onEnterCompare}
                data-testid="compare-entry"
                // C5 desktop pill (the 20px hover-title-only icon was the
                // least discoverable control in the audit); D4 moved the
                // mobile entry to a labeled chip below the prime grid.
                // Pill box: py-2 (2·8px) + 20px icon/text-sm line = 36px →
                // TOUCH_TARGET_FROM_36 keeps the A13 44px math honest.
                // Text contrast (4.5:1 floor): ice-dim #0369a1 on sand-50
                // #fefdfb = 5.84:1; ice #7dd3fc on dark-400 #161a22 = 10.4:1.
                // aria-label preserved — it overrides content, so existing
                // e2e locators and WCAG 2.5.3 both hold.
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border border-ice-dim/30 dark:border-ice/30 text-sm font-medium hover:bg-sand-200 dark:hover:bg-dark-300 text-ice-dim dark:text-ice transition-colors ${TOUCH_TARGET_FROM_36}`}
                aria-label="Compare with another country"
                title="Compare"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
                  <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
                </svg>
                <span>Compare</span>
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
                aria-expanded={expanded}
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
            {rowMarker('region')}
          </span>
          {activeExceptionBadges(country).map((b) => (
            <span key={b.field} data-testid={b.testId} className={EXCEPTION_BADGE}>
              {b.label}
              {/* Field-level attribution is a constitution item (never silently
                  regress) — non-dominant badge fields carry the C4/D2 marker
                  link; dominant ones resolve in the footer's field table. */}
              {rowMarker(b.field)}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-5 h-px bg-ice-dim/10 dark:bg-ice/10" />

      <div className="px-5 py-3">
        {/* D1 hero row \u2014 sits at the top of the scroll content, so the
            collapsed 40vh mobile sheet answers population/area/density
            without expanding. D4 repositions this row when it restructures
            the sheet header; this task deliberately keeps the layout seam. */}
        <div data-testid="hero-stats" className="grid grid-cols-3 gap-x-3 panel-field-in-1">
          <HeroStat
            label="Population"
            field="population"
            marker={rowMarker('population')}
            value={formatCompact(country.population)}
            exact={formatPopulation(country.population)}
            rank={POPULATION_RANKS.get(country.cca3)}
          />
          <HeroStat
            label="Area"
            field="area"
            marker={rowMarker('area')}
            value={formatCompactArea(country.area)}
            exact={formatArea(country.area)}
            rank={AREA_RANKS.get(country.cca3)}
          />
          <HeroStat
            label="Density"
            field="density"
            marker={rowMarker('density')}
            value={formatCompactDensity(country) ?? EM_DASH}
            exact={densityOf(country) !== null ? formatDensity(country) : undefined}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-4 panel-field-in-1">
          <DataCell label="Government" field="governmentType" marker={rowMarker('governmentType')}>
            {country.governmentType || '\u2014'}
          </DataCell>
          <DataCell label="Languages" field="languages" marker={rowMarker('languages')}>
            {Object.keys(country.languages).length > 0
              ? Object.values(country.languages).join(', ')
              : '\u2014'}
          </DataCell>
        </div>

        {!isDesktop && !comparePickingMode && !inGameRound && (
          <button
            onClick={onEnterCompare}
            data-testid="compare-entry"
            aria-label="Compare with another country"
            // D4: the mobile labeled compare chip (C5's scope split). Same
            // accessible name, testid, contrast math, and A13 constant as
            // the desktop pill \u2014 exactly one of the two renders (isDesktop).
            className={`mt-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-ice-dim/30 dark:border-ice/30 text-sm font-medium hover:bg-sand-200 dark:hover:bg-dark-300 text-ice-dim dark:text-ice transition-colors ${TOUCH_TARGET_FROM_36}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="12" r="6" strokeWidth="1.75" />
              <circle cx="15" cy="12" r="6" strokeWidth="1.75" />
            </svg>
            <span>Compare</span>
          </button>
        )}

        {showSecondary && (
          <>
            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />

            <div className="panel-field-in-2">
              {Object.keys(country.currencies).length > 0 && (
                <DataCell label="Currencies" field="currencies" marker={rowMarker('currencies')}>
                  {Object.values(country.currencies)
                    .map((c) => `${c.name} (${c.symbol})`)
                    .join(', ')}
                </DataCell>
              )}
              <DataCell label="Timezones" field="timezones" marker={rowMarker('timezones')}>
                <TimezoneList timezones={country.timezones} />
              </DataCell>
            </div>

            {country.borders.length > 0 && (
              <>
                <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />
                <div className="panel-field-in-3">
                  <div
                    data-field="borders"
                    className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-2 flex items-center gap-1"
                  >
                    Borders
                    {rowMarker('borders')}
                  </div>
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

            <div className="my-2 border-t border-dotted border-sand-300/50 dark:border-dark-200/30" />
            {/* D3 — Explore next: landlocked/coastal fact + same-subregion
                peers + closest-population pick. Suggestions are derived data
                (no single source field), so no per-chip attribution; the
                `landlocked` field's source stays reachable via the
                consolidated footer's field → source table (D2). Unlike
                Borders, this renders for every country (Japan has no borders
                but still gets peers + similar-population). */}
            <div className="panel-field-in-3" data-testid="explore-next">
              {/* Mirrors the Borders label styling minus the source
                  affordance (derived data); migrates to .text-label whenever
                  the rest of the panel does. */}
              <div className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-2">
                Explore next
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span data-testid="explore-fact-chip" className={INERT_CHIP_CLASSES.panel}>
                  {suggestions.fact}
                </span>
                {suggestions.subregionPeers.map((c) => (
                  <BorderChip
                    key={c.cca3}
                    code={c.cca3}
                    neighbor={c}
                    onSelect={onSelect}
                    size="panel"
                  />
                ))}
                {suggestions.similarPopulation && (
                  <BorderChip
                    code={suggestions.similarPopulation.cca3}
                    neighbor={suggestions.similarPopulation}
                    onSelect={onSelect}
                    size="panel"
                    detail={`similar population · ${formatCompact(
                      suggestions.similarPopulation.population,
                    )}`}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {/* D2: consolidated linked sources footer (compare's pattern via the
            shared SourceLinkList), always rendered — attribution must not
            hide behind the mobile expand toggle. The disclosure exposes the
            complete field → source table so full granularity stays one
            interaction away for every country. aria-controls is set only
            while the table exists — axe's aria-valid-attr-value flags
            references to absent ids. NO analytics events here.
            A plain div, not <footer>: a <footer> here maps to an implicit
            contentinfo landmark nested inside this panel's own
            role="complementary" landmark — axe's
            landmark-contentinfo-is-top-level flags that nesting (verified
            via e2e/axe-snapshot.spec.ts "country panel open"). */}
        <div
          data-testid="panel-sources"
          className="mt-4 pt-3 border-t border-sand-200/50 dark:border-dark-200/30 text-xs text-sand-600 dark:text-dark-100"
        >
          <SourceLinkList sources={sources} markerBySource={fieldMarkers.markerBySource} />
          <button
            type="button"
            data-testid="panel-sources-toggle"
            aria-expanded={sourcesExpanded}
            {...(sourcesExpanded ? { 'aria-controls': 'panel-sources-detail' } : {})}
            onClick={() => setSourcesExpanded((v) => !v)}
            className={`mt-1.5 flex items-center gap-1 font-medium text-ice-accessible dark:text-ice hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/60 dark:focus-visible:ring-ice/60 rounded ${TOUCH_TARGET_TEXT_XS}`}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${sourcesExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            Source by field
          </button>
          {sourcesExpanded && (
            <table
              id="panel-sources-detail"
              data-testid="panel-sources-detail"
              className="mt-2 w-full border-collapse"
            >
              <caption className="sr-only">Data source for each field</caption>
              <tbody>
                {Object.entries(country._fieldSources).map(([field, key]) => (
                  <tr
                    key={field}
                    className="border-t border-sand-200/50 dark:border-dark-200/30 first:border-t-0"
                  >
                    <th
                      scope="row"
                      className="py-1 pr-3 text-left font-normal text-sand-800 dark:text-dark-50"
                    >
                      {FIELD_TABLE_LABELS[field] ?? field}
                    </th>
                    {/* _sources can lack a key ('manual-override' on GNB's
                        unMember) — show the raw key rather than inventing a
                        registry entry; SourceMarker skips such keys too. */}
                    <td className="py-1">{sources[key]?.name ?? key}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
