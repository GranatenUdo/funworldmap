import type { CountryLike, GameMode, ModeId } from '../shared/types'
import { getCountryPinningMode } from './country-pinning'

export function getMode(id: ModeId, pool: CountryLike[]): GameMode {
  switch (id) {
    case 'country-pinning':
      return getCountryPinningMode(pool)
  }
}

export function listModes(): { id: ModeId; title: string; description: string }[] {
  return [
    { id: 'country-pinning', title: 'Country Pinning', description: 'Click the country from the flag + name prompt.' },
  ]
}
