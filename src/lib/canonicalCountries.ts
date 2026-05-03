import countriesData from '../data/countries.json'

/**
 * Canonical 195-country allowlist.
 *
 * The country dataset (`src/data/countries.json`) ships 249 entries from
 * restcountries, but funworldmap intentionally renders only the 195 widely-
 * recognised sovereign states: 193 UN members plus the two UN observer states
 * (Vatican City and Palestine). Disputed territories, dependencies, and
 * non-member observers like Taiwan, Hong Kong, Greenland, and Western Sahara
 * are excluded from gameplay and the rendered map.
 *
 * This module is the single source of truth used by:
 *   - `useCountryData` — filters the in-memory country lookup
 *   - `loadCountryGeojson` — filters the rendered geometry
 *   - `dailyPool` — bounds daily-puzzle eligibility
 *
 * Adding a country to this list means it shows on the map, can be guessed,
 * and is eligible for the daily. Be deliberate.
 *
 * NOTE: the `ReadonlySet` typing is type-only. At runtime these are regular
 * `Set` instances. Consumers MUST treat them as read-only — only call `.has()`
 * / `.size`. Mutating them (`(.. as Set).add(...)`) would corrupt the global
 * canonical state for every consumer in the same JS realm.
 */
export const CANONICAL_OBSERVER_CCA3: ReadonlySet<string> = new Set(['VAT', 'PSE'])

export const CANONICAL_CCA3: ReadonlySet<string> = new Set(
  countriesData.countries
    .filter((c) => c.unMember === true || CANONICAL_OBSERVER_CCA3.has(c.cca3))
    .map((c) => c.cca3),
)

export const CANONICAL_NUMERIC_IDS: ReadonlySet<number> = new Set(
  countriesData.countries
    .filter((c) => c.unMember === true || CANONICAL_OBSERVER_CCA3.has(c.cca3))
    .map((c) => parseInt(c.ccn3, 10)),
)
