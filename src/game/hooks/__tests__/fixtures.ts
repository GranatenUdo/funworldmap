import type { CountryLike, CityLike } from '../../shared/types'

export const countriesFixture: CountryLike[] = [
  { cca3: 'USA', name: { common: 'United States' }, latlng: [38, -97], flag: 'flags/US.svg', independent: true },
  { cca3: 'FRA', name: { common: 'France' }, latlng: [46, 2], flag: 'flags/FR.svg', independent: true },
]

export const citiesFixture: CityLike[] = [
  { id: 'USA-new-york', name: 'New York', countryCca3: 'USA', countryName: 'United States', countryFlag: 'flags/US.svg', latlng: [40.7128, -74.0060], scalerank: 0 },
  { id: 'FRA-paris', name: 'Paris', countryCca3: 'FRA', countryName: 'France', countryFlag: 'flags/FR.svg', latlng: [48.8566, 2.3522], scalerank: 0 },
]

export const byCca3Fixture: Map<string, CountryLike> = new Map([
  ['USA', countriesFixture[0]],
  ['FRA', countriesFixture[1]],
])
