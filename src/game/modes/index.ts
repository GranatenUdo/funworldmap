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

/** Launcher card order. */
export const MODE_IDS: readonly ModeId[] = ['country-pinning', 'city-guessing']
