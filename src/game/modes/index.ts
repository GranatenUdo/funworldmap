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

/** Launcher card order — derived from a Record over ModeId so adding a mode
 *  to the union without registering it here is a COMPILE error (a plain
 *  ModeId[] accepts any subset and silently drops the launcher card). */
const MODE_REGISTRY = {
  'country-pinning': 0,
  'city-guessing': 0,
} as const satisfies Record<ModeId, 0>

export const MODE_IDS = Object.keys(MODE_REGISTRY) as readonly ModeId[]
