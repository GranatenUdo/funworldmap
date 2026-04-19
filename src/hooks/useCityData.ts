import { useMemo } from 'react'
import citiesJson from '../data/cities.json'
import type { CityLike } from '../game/shared/types'

/** Loads the bundled city dataset as a typed array. Size: ~75 KB raw / ~25 KB gzip. */
export function useCityData(): { cities: CityLike[] } {
  const cities = useMemo<CityLike[]>(
    () =>
      (citiesJson as CityLike[]).map((c) => ({
        id: c.id,
        name: c.name,
        countryCca3: c.countryCca3,
        countryName: c.countryName,
        countryFlag: c.countryFlag,
        latlng: c.latlng as [number, number],
        scalerank: c.scalerank,
      })),
    [],
  )
  return { cities }
}
