import type { CountryData } from '../lib/types'
import { BorderChip } from './BorderChip'
import { EXCEPTION_BADGE, activeExceptionBadges } from './exceptionBadge'

/** Sticky per-country header: flag, name, capital(s), region badge, and the
 *  A5 exception badges. Extracted from the (now-deleted) composed
 *  CountryColumn (C2/C3) so the desktop shared-row layout (CompareCountryPanel)
 *  can pair two headers over one shared-row scroll. Mobile (C6) renders its
 *  own compact header inline in CompareCountryPanel instead of reusing this. */
export function CountryColumnHeader({
  country,
  badgeLetter,
  badgeColor,
}: {
  country: CountryData
  badgeLetter: 'A' | 'B'
  badgeColor: 'a' | 'b'
}) {
  return (
    <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex items-start gap-3 min-w-0"
          style={{ animation: 'fade-up 200ms ease-out' }}
        >
          <span className={`compare-badge compare-badge-${badgeColor} mt-1`}>{badgeLetter}</span>
          <img
            data-testid="country-flag"
            src={country.flag}
            alt={country.flagAlt || `Flag of ${country.name.common}`}
            className="w-[56px] h-[38px] object-cover rounded-lg shadow-md shrink-0"
          />
          <div className="min-w-0 pt-0.5">
            <h2 className="text-lg font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight">
              {country.name.common}
            </h2>
            {country.capital.length > 0 && (
              <p className="text-xs text-ice-accessible dark:text-ice truncate mt-0.5">
                {country.capital.join(', ')}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span
                data-testid="region-badge"
                className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100"
              >
                {country.region}
              </span>
              {/* C4: compare attribution stays consolidated in the footer,
                  so the badges render bare — no per-badge SourceTooltip. */}
              {activeExceptionBadges(country).map((b) => (
                <span key={b.field} data-testid={b.testId} className={EXCEPTION_BADGE}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Per-country border-chip list (C2/C3): stays column-scoped even after the
 *  desktop fields collapsed into shared rows — replacing a country only
 *  changes ITS OWN neighbours, so this can't be merged into a shared row. */
export function CountryBorders({
  country,
  byCca3,
  onSelect,
}: {
  country: CountryData
  byCca3: Map<string, CountryData>
  onSelect: (cca3: string) => void
}) {
  if (country.borders.length === 0) return null
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-ice-accessible dark:text-ice mb-1.5">
        Borders
      </div>
      <div className="flex flex-wrap gap-1">
        {country.borders.map((code) => (
          <BorderChip
            key={code}
            code={code}
            neighbor={byCca3.get(code)}
            onSelect={onSelect}
            size="compare"
          />
        ))}
      </div>
    </div>
  )
}
