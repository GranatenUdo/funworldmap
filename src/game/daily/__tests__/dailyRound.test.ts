import { describe, it, expect } from 'vitest'
import { buildCountryDailyRound, buildCityDailyRound } from '../dailyRound'
import type { CountryLike, CityLike } from '../../shared/types'

const FRA: CountryLike = {
  cca3: 'FRA',
  name: { common: 'France' },
  flag: 'flags/FR.svg',
  latlng: [46, 2],
  independent: true,
}

const PARIS: CityLike = {
  id: 'FRA-paris',
  name: 'Paris',
  countryCca3: 'FRA',
  countryName: 'France',
  countryFlag: 'flags/FR.svg',
  latlng: [48.857, 2.352],
  scalerank: 0,
}

describe('buildCountryDailyRound', () => {
  it('returns a country-pinning RoundSpec for the given cca3', () => {
    const r = buildCountryDailyRound('FRA', [FRA])
    expect(r).toEqual({
      kind: 'country-pinning',
      targetCca3: 'FRA',
      targetName: 'France',
      targetFlag: 'flags/FR.svg',
      targetCentroid: [2, 46],
    })
  })

  it('throws when cca3 is not in the pool', () => {
    expect(() => buildCountryDailyRound('XXX', [FRA])).toThrow(/not found/i)
  })
})

describe('buildCityDailyRound', () => {
  it('returns a city-guessing RoundSpec for the given id', () => {
    const r = buildCityDailyRound('FRA-paris', [PARIS])
    expect(r).toEqual({
      kind: 'city-guessing',
      targetId: 'FRA-paris',
      targetName: 'Paris',
      targetCountryName: 'France',
      targetCountryFlag: 'flags/FR.svg',
      targetCentroid: [2.352, 48.857],
    })
  })

  it('throws when id is not in the pool', () => {
    expect(() => buildCityDailyRound('nope', [PARIS])).toThrow(/not found/i)
  })
})
