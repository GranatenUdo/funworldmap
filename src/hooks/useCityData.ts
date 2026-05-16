import { useMemo } from 'react'
import citiesJson from '../data/cities.json'
import { CANONICAL_CCA3 } from '../lib/canonicalCountries'
import type { CityLike } from '../game/shared/types'

/**
 * Loads the bundled city dataset as a typed array. Size: ~75 KB raw / ~25 KB gzip.
 *
 * Filters cities down to those whose host country is in the canonical 195
 * allowlist (see `canonicalCountries.ts`). Cities in dropped territories
 * (e.g. Hong Kong, Taipei, San Juan) are removed at the source so the
 * city-guessing game can never land on a city whose host country is absent
 * from the rendered map.
 */
export function useCityData(): { cities: CityLike[] } {
  const cities = useMemo<CityLike[]>(
    () =>
      (citiesJson as CityLike[])
        .filter((c) => CANONICAL_CCA3.has(c.countryCca3))
        .map((c) => ({
          id: c.id,
          name: c.name,
          countryCca3: c.countryCca3,
          countryName: c.countryName,
          countryFlag: c.countryFlag,
          latlng: c.latlng,
          scalerank: c.scalerank,
        })),
    [],
  )
  return { cities }
}
