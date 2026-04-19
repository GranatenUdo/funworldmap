import type { CityLike, CountryLike, GameMode, ModeId } from '../shared/types'
import { getCountryPinningMode } from './country-pinning'
import { getCityGuessingMode } from './city-guessing'

export function getMode(
  id: ModeId,
  pools: { countries: CountryLike[]; cities: CityLike[] },
): GameMode {
  switch (id) {
    case 'country-pinning':
      return getCountryPinningMode(pools.countries)
    case 'city-guessing':
      return getCityGuessingMode(pools.cities)
  }
}

export function listModes(): { id: ModeId; title: string; description: string }[] {
  return [
    { id: 'country-pinning', title: 'Country Pinning', description: 'Click the country from the flag + name prompt.' },
    { id: 'city-guessing', title: 'City Guessing', description: 'Click the location of the city shown. 10 rounds per game.' },
  ]
}
