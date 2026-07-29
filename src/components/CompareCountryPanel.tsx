import type { CountryData, CountriesFile } from '../lib/types'
import { CloseButton } from './CloseButton'
import { CountryColumnHeader, CountryBorders } from './CountryColumn'
import { CompareFieldRow } from './CompareFieldRow'
import { BorderChip } from './BorderChip'
import { COMPARE_FIELDS } from '../lib/compareFields'
import { dispatchToast } from '../lib/toast'
import { TOUCH_TARGET_FROM_36, TOUCH_TARGET_FROM_32 } from '../lib/layoutConstants'
import type { CompareColumn } from '../lib/compareMapClick'
import { computeFieldSourceMarkers } from '../lib/fieldSourceMarkers'
import { SourceMarker } from './SourceMarker'
import { SourceLinkList } from './SourceLinkList'

interface Props {
  country: CountryData
  compareWith: CountryData
  isDesktop: boolean
  onCompareColumnSelect: (column: CompareColumn, cca3: string) => void
  onClose: () => void
  onExitCompare: () => void
  byCca3: Map<string, CountryData>
  sources: CountriesFile['_sources']
}

export function CompareCountryPanel({
  country,
  compareWith,
  isDesktop,
  onCompareColumnSelect,
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

  // C4: consolidated attribution with exception markers, computed across BOTH
  // countries' _fieldSources — a row is marked when either country attributes
  // that field to a non-dominant source. Single owner of the scheme:
  // src/lib/fieldSourceMarkers.ts (D2 adopts the same exports for the single
  // panel).
  const fieldMarkers = computeFieldSourceMarkers(country._fieldSources, compareWith._fieldSources)
  const rowMarker = (sourceField: string): React.ReactNode => {
    const marker = fieldMarkers.markerByField.get(sourceField)
    if (!marker) return null
    return <SourceMarker glyph={marker.glyph} sourceKey={marker.source} sources={sources} />
  }

  const panelClasses = isDesktop
    ? 'fixed right-4 top-16 bottom-4 w-[656px] bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.6)] z-40 rounded-2xl border border-sand-200/50 dark:border-dark-200/20 overflow-hidden'
    : // The sources footer is a fixed flex item OUTSIDE the scrollable
      // middle region (unlike SingleCountryPanel, where the panel root IS
      // the scroll container and the sources block scrolls with everything
      // else) — it always renders flush against this sheet's bottom edge.
      // pb-[env(safe-area-inset-bottom)] on this fixed h-[80dvh] box (not
      // on the inner `compare-mobile-scroll` div, whose own padding never
      // reaches the footer) shrinks the flex column's content height so the
      // footer clears the home indicator on notched iPhones, mirroring the
      // G1 treatment at the element that actually owns the bottom edge here.
      'fixed bottom-0 left-0 right-0 bg-sand-50 dark:bg-dark-400 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 rounded-t-2xl h-[80dvh] overflow-hidden pb-[env(safe-area-inset-bottom)]'

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
            className={`px-3 py-1.5 rounded-xl text-sm font-medium text-ice-accessible dark:text-ice hover:bg-sand-200 dark:hover:bg-dark-300 transition-colors ${TOUCH_TARGET_FROM_32}`}
          >
            Exit compare
          </button>
          <CloseButton onClick={onClose} ariaLabel="Close panel" testId="panel-close" />
        </div>
        {isDesktop ? (
          /* C2/C3 — desktop: ONE scroll of shared rows under paired sticky
             headers. Columns diverge only for the per-country borders lists.
             The header wrappers and the borders wrappers keep the
             compare-column-a/b / compare-borders-a/b testids (the desktop
             layout no longer has a single per-column DOM subtree spanning
             header+fields+borders the way CountryColumn did, so the old
             single-testid scope had to split into these two — see
             task-3-report.md). */
          <div className="flex-1 min-h-0 overflow-y-auto" data-testid="compare-rows">
            <div className="grid grid-cols-2 sticky top-0 z-10">
              <div
                className="border-r border-sand-200/50 dark:border-dark-200/30"
                data-testid="compare-column-a"
              >
                <CountryColumnHeader country={country} badgeLetter="A" badgeColor="a" />
              </div>
              <div data-testid="compare-column-b">
                <CountryColumnHeader country={compareWith} badgeLetter="B" badgeColor="b" />
              </div>
            </div>
            <div className="px-5 py-3 space-y-3">
              {COMPARE_FIELDS.map((f) => (
                <CompareFieldRow
                  key={f.key}
                  field={f}
                  a={country}
                  b={compareWith}
                  marker={rowMarker(f.key)}
                />
              ))}
            </div>
            {/* Borders stay per-country. Both columns keep the plain select
                path here — the per-column replace semantics (the A8-descoped
                border-chip clause) are wired by this plan's compare-entry
                task, not this one. */}
            <div className="grid grid-cols-2 gap-x-4 px-5 pb-4">
              <div data-testid="compare-borders-a">
                <CountryBorders
                  country={country}
                  byCca3={byCca3}
                  onSelect={(cca3) => onCompareColumnSelect('a', cca3)}
                />
              </div>
              <div data-testid="compare-borders-b">
                <CountryBorders
                  country={compareWith}
                  byCca3={byCca3}
                  onSelect={(cca3) => onCompareColumnSelect('b', cca3)}
                />
              </div>
            </div>
          </div>
        ) : (
          /* C6: ONE scroll container — the pre-C6 stacked 35vh halves never
             showed A's population on screen with B's. The compact header is
             sticky INSIDE the scroll so both countries stay identified while
             the shared rows scroll. */
          <div className="flex-1 min-h-0 overflow-y-auto" data-testid="compare-mobile-scroll">
            <div
              data-testid="compare-mobile-header"
              className="sticky top-0 z-10 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-4 py-2.5 border-b border-sand-200/50 dark:border-dark-200/30 space-y-1.5"
            >
              {(
                [
                  { c: country, letter: 'A', color: 'a' },
                  { c: compareWith, letter: 'B', color: 'b' },
                ] as const
              ).map(({ c, letter, color }) => (
                <div key={letter} className="flex items-center gap-2 min-w-0">
                  <span className={`compare-badge compare-badge-${color}`}>{letter}</span>
                  <img
                    data-testid="country-flag"
                    src={c.flag}
                    alt={c.flagAlt || `Flag of ${c.name.common}`}
                    className="w-7 h-5 object-cover rounded-sm shadow-sm shrink-0"
                  />
                  <h2 className="text-sm font-bold text-sand-900 dark:text-dark-50 truncate leading-tight">
                    {c.name.common}
                  </h2>
                  {c.capital.length > 0 && (
                    <span className="text-xs text-ice-accessible dark:text-ice truncate">
                      {c.capital.join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 py-3 space-y-3">
              {COMPARE_FIELDS.map((field) => (
                <CompareFieldRow
                  key={field.key}
                  field={field}
                  a={country}
                  b={compareWith}
                  marker={rowMarker(field.key)}
                />
              ))}
              {(
                [
                  { c: country, column: 'a' as const },
                  { c: compareWith, column: 'b' as const },
                ] as const
              ).map(
                ({ c, column }) =>
                  c.borders.length > 0 && (
                    <div key={c.cca3}>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-1.5">
                        Borders — {c.name.common}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.borders.map((code) => (
                          <BorderChip
                            key={code}
                            code={code}
                            neighbor={byCca3.get(code)}
                            onSelect={(cca3) => onCompareColumnSelect(column, cca3)}
                            size="compare"
                          />
                        ))}
                      </div>
                    </div>
                  ),
              )}
            </div>
          </div>
        )}
        <footer
          className="px-4 py-3 border-t border-sand-200/50 dark:border-dark-200/30 text-xs text-sand-600 dark:text-dark-100"
          data-testid="compare-sources"
        >
          <SourceLinkList sources={sources} markerBySource={fieldMarkers.markerBySource} />
        </footer>
      </div>
    </div>
  )
}
