import { describe, it, expect } from 'vitest'
import { validatePools } from '../validate-pools'

describe('validatePools', () => {
  it('returns ok when every pool entry resolves in data files', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }, { cca3: 'PER' }],
      cities: [{ id: 'per-lima' }, { id: 'fra-paris' }],
      countryPool: { version: 1, cca3: ['FRA', 'PER'] },
      cityPool: { version: 1, ids: ['per-lima'] },
    })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('reports country-pool entries missing from countries.json', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }],
      cities: [{ id: 'fra-paris' }],
      countryPool: { version: 1, cca3: ['FRA', 'XXX'] },
      cityPool: { version: 1, ids: ['fra-paris'] },
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: 'missing-country', id: 'XXX' }),
    )
  })

  it('reports city-pool entries missing from cities.json', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }],
      cities: [{ id: 'fra-paris' }],
      countryPool: { version: 1, cca3: ['FRA'] },
      cityPool: { version: 1, ids: ['fra-paris', 'nope-nope'] },
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: 'missing-city', id: 'nope-nope' }),
    )
  })

  it('reports duplicate entries in a pool', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }],
      cities: [{ id: 'fra-paris' }],
      countryPool: { version: 1, cca3: ['FRA', 'FRA'] },
      cityPool: { version: 1, ids: ['fra-paris'] },
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: 'duplicate-country', id: 'FRA' }),
    )
  })

  it('reports unknown pool version', () => {
    const result = validatePools({
      countries: [{ cca3: 'FRA' }],
      cities: [{ id: 'fra-paris' }],
      countryPool: { version: 999, cca3: ['FRA'] },
      cityPool: { version: 1, ids: ['fra-paris'] },
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: 'bad-version', file: 'country-pool' }),
    )
  })
})
