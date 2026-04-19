import { describe, it, expect } from 'vitest'
import { nextRound } from '../roundGenerator'
import type { CountryLike } from '../../../shared/types'

const pool: CountryLike[] = [
  { cca3: 'FRA', name: { common: 'France' }, flag: 'flags/FR.svg', latlng: [46, 2], independent: true },
  { cca3: 'DEU', name: { common: 'Germany' }, flag: 'flags/DE.svg', latlng: [51, 9], independent: true },
  { cca3: 'JPN', name: { common: 'Japan' }, flag: 'flags/JP.svg', latlng: [36, 138], independent: true },
]

describe('nextRound', () => {
  it('picks a country not in the used set', () => {
    const used = new Set(['FRA', 'DEU'])
    const r = nextRound(used, pool, () => 0)
    expect(r.kind).toBe('country-pinning')
    expect(r.targetCca3).toBe('JPN')
  })

  it('returns a CountryRoundSpec with swapped centroid [lng, lat]', () => {
    const r = nextRound(new Set(), pool, () => 0)
    expect(r.kind).toBe('country-pinning')
    expect(r.targetCca3).toBe('FRA')
    expect(r.targetName).toBe('France')
    expect(r.targetCentroid).toEqual([2, 46])
    expect(r.targetFlag).toBe('flags/FR.svg')
  })

  it('resets and picks from full pool when used covers everything', () => {
    const used = new Set(['FRA', 'DEU', 'JPN'])
    const r = nextRound(used, pool, () => 2)
    expect(['FRA', 'DEU', 'JPN']).toContain(r.targetCca3)
  })

  it('uses the injected picker to choose the index', () => {
    const r = nextRound(new Set(), pool, () => 1)
    expect(r.targetCca3).toBe('DEU')
  })
})
