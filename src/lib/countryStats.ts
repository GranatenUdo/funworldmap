import countriesFile from '../data/countries.json'
import { CANONICAL_CCA3 } from './canonicalCountries'
import { densityOf } from './compareFields'
import type { CountriesFile, CountryData } from './types'

/** Comparator: descending by `value`, cca3 tiebreak. Extracted from
 *  countryLabelFeatures' areaRank sort as the single owner of the
 *  deterministic dense-ranking rule (the B1 label module now imports it).
 *  The tiebreak keeps ranks deterministic should a future data refresh
 *  introduce an exact tie (none exist today). */
export function byValueDescThenCca3<T extends { cca3: string }>(
  value: (item: T) => number,
): (a: T, b: T) => number {
  return (a, b) => value(b) - value(a) || a.cca3.localeCompare(b.cca3)
}

/** Dense 1..N descending ranks keyed by cca3 (1 = largest value). */
export function denseRanksDesc<T extends { cca3: string }>(
  items: readonly T[],
  value: (item: T) => number,
): Map<string, number> {
  return new Map([...items].sort(byValueDescThenCca3(value)).map((c, i) => [c.cca3, i + 1]))
}

const canonical = (countriesFile as unknown as CountriesFile).countries.filter((c) =>
  CANONICAL_CCA3.has(c.cca3),
)

/** 195 — the denominator of every "#N of 195" rank line (D1). Derived from
 *  the canonical set, never hardcoded. */
export const RANK_TOTAL = canonical.length

/** World ranks over the canonical 195, built once at module load (the
 *  COUNTRY_LABEL_COLLECTION pattern). Keyed by cca3; lookups for
 *  non-canonical codes return undefined and callers omit the rank line. */
export const POPULATION_RANKS: ReadonlyMap<string, number> = denseRanksDesc(
  canonical,
  (c) => c.population,
)
export const AREA_RANKS: ReadonlyMap<string, number> = denseRanksDesc(canonical, (c) => c.area)

export function formatRank(rank: number): string {
  return `#${rank} of ${RANK_TOTAL}`
}

/** Compact numeral rules (D1 hero stats): en-US compact notation (K/M/B
 *  suffixes), 3 significant digits, half-expand rounding, sub-1000 plain.
 *  66,351,959 → "66.4M"; 543,908 → "544K"; 999,999 → "1M"; 451 → "451".
 *  Exact-value formatters stay in compareFields.ts (compare rows + hero
 *  `title` attributes) — a deliberate exact/compact ownership split. */
const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumSignificantDigits: 3,
})

export function formatCompact(n: number): string {
  return COMPACT.format(n)
}

export function formatCompactArea(n: number): string {
  return `${formatCompact(n)} km²`
}

/** Compact density readout ("122/km²"). The derivation (densityOf) is owned
 *  by compareFields (C3) — imported, never duplicated. null → caller renders
 *  EM_DASH. */
export function formatCompactDensity(c: CountryData): string | null {
  const d = densityOf(c)
  return d === null ? null : `${formatCompact(d)}/km²`
}
