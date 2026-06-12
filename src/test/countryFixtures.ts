import type { CountryData } from '../lib/types'

/** Fully-typed CountryData factory for tests — no `as unknown as` casts.
 *  Defaults model France; override per test. */
export function makeCountryData(overrides: Partial<CountryData> = {}): CountryData {
  return {
    cca3: 'FRA',
    ccn3: '250',
    cca2: 'FR',
    name: { common: 'France', official: 'French Republic' },
    capital: ['Paris'],
    region: 'Europe',
    subregion: 'Western Europe',
    population: 67_000_000,
    area: 551_695,
    governmentType: 'Republic',
    languages: { fra: 'French' },
    currencies: { EUR: { name: 'Euro', symbol: '€' } },
    flag: '',
    flagAlt: '',
    latlng: [46, 2],
    borders: [],
    independent: true,
    unMember: true,
    landlocked: false,
    timezones: ['UTC+01:00'],
    continents: ['Europe'],
    _fieldSources: {},
    ...overrides,
  }
}
