import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCityData } from '../useCityData'

describe('useCityData', () => {
  it('returns a non-trivial pool after the canonical-195 filter', () => {
    // Don't pin the exact count — the cities pipeline regenerates periodically.
    // The semantic guarantees are locked in by the next test (TWN/HKG/PRI/BMU/GRL
    // exclusions); here we just verify the pool is still usable for play.
    const { result } = renderHook(() => useCityData())
    expect(result.current.cities.length).toBeGreaterThan(400)
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
