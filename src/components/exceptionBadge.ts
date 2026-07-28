import type { CountryData } from '../lib/types'

/** A5: near-constant booleans render as exceptions only. Muted amber is a
 *  data encoding (like the region badge), not a chrome accent — kept
 *  through E4. inline-flex + items-center (not inline-block): the single
 *  panel's badges carry a SourceTooltip affordance and need to align it
 *  with the label text; the compare column headers render the badge bare
 *  (C4 keeps compare attribution consolidated in the footer — no per-field
 *  "i" rings). Canonical owner: extracted from SingleCountryPanel for C1 so
 *  both panels share one definition. */
export const EXCEPTION_BADGE =
  'inline-flex items-center whitespace-nowrap text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'

export interface ExceptionBadgeSpec {
  /** CountryData boolean driving the badge — the flags diverge in the
   *  source data (Vatican is independent: true), so each drives its own. */
  field: 'unMember' | 'independent'
  testId: string
  label: string
}

/** The exception badges a country actually earns (empty for 193 of 195). */
export function activeExceptionBadges(country: CountryData): ExceptionBadgeSpec[] {
  const badges: ExceptionBadgeSpec[] = []
  if (country.unMember === false)
    badges.push({
      field: 'unMember',
      testId: 'exception-badge-un-member',
      label: 'UN observer state',
    })
  if (country.independent === false)
    badges.push({
      field: 'independent',
      testId: 'exception-badge-independent',
      label: 'Not independent',
    })
  return badges
}
