import type { CountryLike, CityLike, RoundSpec } from '../shared/types'
import { centroidFromLatLng } from '../shared/distance'

export function buildCountryDailyRound(cca3: string, pool: CountryLike[]): RoundSpec | null {
  const c = pool.find((x) => x.cca3 === cca3)
  if (!c) return null
  return {
    kind: 'country-pinning',
    targetCca3: c.cca3,
    targetName: c.name.common,
    targetFlag: c.flag,
    targetCentroid: centroidFromLatLng(c.latlng),
  }
}

export function buildCityDailyRound(id: string, pool: CityLike[]): RoundSpec | null {
  const c = pool.find((x) => x.id === id)
  if (!c) return null
  return {
    kind: 'city-guessing',
    targetId: c.id,
    targetName: c.name,
    targetCountryName: c.countryName,
    targetCountryFlag: c.countryFlag,
    targetCentroid: centroidFromLatLng(c.latlng),
  }
}
