import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCityData } from '../useCityData'

describe('useCityData', () => {
  it('returns cities only in canonical-195 host countries', () => {
    const { result } = renderHook(() => useCityData())
    // 499 raw entries minus 6 orphans (HKG, TWN×2, PRI, BMU, GRL) = 493.
    expect(result.current.cities.length).toBe(493)
  })

  it('excludes cities whose host country is dropped from the canonical set', () => {
    const { result } = renderHook(() => useCityData())
    const { cities } = result.current
    expect(cities.every((c) => c.countryCca3 !== 'TWN')).toBe(true)
    expect(cities.every((c) => c.countryCca3 !== 'HKG')).toBe(true)
    expect(cities.every((c) => c.countryCca3 !== 'PRI')).toBe(true)
    expect(cities.every((c) => c.countryCca3 !== 'BMU')).toBe(true)
    expect(cities.every((c) => c.countryCca3 !== 'GRL')).toBe(true)
  })

  it('still includes a representative canonical-195 host country', () => {
    const { result } = renderHook(() => useCityData())
    const { cities } = result.current
    // France (canonical UN member) should still have at least one city.
    expect(cities.some((c) => c.countryCca3 === 'FRA')).toBe(true)
  })

  it('is stable across rerenders (memoized)', () => {
    const { result, rerender } = renderHook(() => useCityData())
    const first = result.current.cities
    rerender()
    expect(result.current.cities).toBe(first)
  })
})
