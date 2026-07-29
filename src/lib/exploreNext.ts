import type { CountryData } from './types'

/** D3 — "Explore next" suggestions for the single country panel.
 *
 * Pure derivation over the canonical 195-country set (the panel passes
 * `byCca3.values()`), zero data cost. Deterministic regardless of input
 * order:
 *   - subregion peers: population descending, ties by cca3 ascending
 *   - similar population: smallest |Δ population| excluding self, borders,
 *     and the already-suggested peers; ties by cca3 ascending
 * No telemetry.
 *
 * Compact-numeral formatting for the similar-population chip's detail suffix
 * is NOT owned here — `countryStats.ts`'s `formatCompact` (landed with D1's
 * hero stats) is the single Intl-compact owner; the panel imports it
 * directly for the chip detail. Two compact formatters would drift.
 */

export const MAX_SUBREGION_PEERS = 4

export interface ExploreNextSuggestions {
  /** Landlocked/coastal fact — rendered as an inert (non-clickable) chip. */
  fact: 'Landlocked' | 'Coastal'
  /** Up to MAX_SUBREGION_PEERS same-subregion countries (never self/borders). */
  subregionPeers: CountryData[]
  /** Closest-population pick, or null when no candidate exists. */
  similarPopulation: CountryData | null
}

// Plain code-point comparison, NOT localeCompare — locale-independent
// determinism for A–Z cca3 codes.
const byCca3Asc = (a: CountryData, b: CountryData) =>
  a.cca3 < b.cca3 ? -1 : a.cca3 > b.cca3 ? 1 : 0

export function exploreNext(
  country: CountryData,
  all: readonly CountryData[],
): ExploreNextSuggestions {
  const borders = new Set(country.borders)
  const excluded = (c: CountryData) => c.cca3 === country.cca3 || borders.has(c.cca3)

  // Guard: an empty subregion must not match other empty-subregion entries.
  // (Every canonical country carries a subregion today — belt-and-braces.)
  const subregionPeers = !country.subregion
    ? []
    : all
        .filter((c) => !excluded(c) && c.subregion === country.subregion)
        .sort((a, b) => b.population - a.population || byCca3Asc(a, b))
        .slice(0, MAX_SUBREGION_PEERS)

  const suggested = new Set(subregionPeers.map((c) => c.cca3))
  let similarPopulation: CountryData | null = null
  let bestDelta = Infinity
  for (const c of all) {
    if (excluded(c) || suggested.has(c.cca3) || !(c.population > 0)) continue
    const delta = Math.abs(c.population - country.population)
    if (
      delta < bestDelta ||
      (delta === bestDelta && similarPopulation !== null && byCca3Asc(c, similarPopulation) < 0)
    ) {
      bestDelta = delta
      similarPopulation = c
    }
  }

  return {
    fact: country.landlocked ? 'Landlocked' : 'Coastal',
    subregionPeers,
    similarPopulation,
  }
}
