import { describe, it, expect } from 'vitest'
import { nextRound } from '../roundGenerator'
import type { CityLike } from '../../../shared/types'

const pool: CityLike[] = [
  { id: 'FRA-paris', name: 'Paris', countryCca3: 'FRA', countryName: 'France', countryFlag: 'flags/FR.svg', latlng: [48.8566, 2.3522], scalerank: 1 },
  { id: 'DEU-berlin', name: 'Berlin', countryCca3: 'DEU', countryName: 'Germany', countryFlag: 'flags/DE.svg', latlng: [52.52, 13.405], scalerank: 2 },
  { id: 'JPN-tokyo', name: 'Tokyo', countryCca3: 'JPN', countryName: 'Japan', countryFlag: 'flags/JP.svg', latlng: [35.68, 139.76], scalerank: 0 },
]

describe('nextRound (city-guessing)', () => {
  it('picks a city not in the used set', () => {
    const used = new Set(['FRA-paris', 'DEU-berlin'])
    const r = nextRound(used, pool, () => 0)
    expect(r.kind).toBe('city-guessing')
    expect(r.targetId).toBe('JPN-tokyo')
  })

  it('returns a CityRoundSpec with correctly swapped centroid [lng, lat]', () => {
    const r = nextRound(new Set(), pool, () => 0)
    expect(r.kind).toBe('city-guessing')
    expect(r.targetName).toBe('Paris')
    expect(r.targetCountryName).toBe('France')
    expect(r.targetCountryFlag).toBe('flags/FR.svg')
    expect(r.targetCentroid).toEqual([2.3522, 48.8566])
  })

  it('resets to full pool when used covers everything', () => {
    const used = new Set(['FRA-paris', 'DEU-berlin', 'JPN-tokyo'])
    const r = nextRound(used, pool, () => 1)
    expect(r.kind).toBe('city-guessing')
  })

  it('uses the injected picker to choose the index', () => {
    const r = nextRound(new Set(), pool, () => 1)
    expect(r.targetId).toBe('DEU-berlin')
  })
})
