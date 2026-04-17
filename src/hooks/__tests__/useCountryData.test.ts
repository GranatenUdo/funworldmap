import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCountryData } from '../useCountryData'

describe('useCountryData', () => {
  it('returns a non-empty countries array', () => {
    const { result } = renderHook(() => useCountryData())
    expect(result.current.countries.length).toBeGreaterThan(100)
  })

  it('byNumeric maps ccn3 to country', () => {
    const { result } = renderHook(() => useCountryData())
    const france = result.current.byNumeric.get('250')
    expect(france).toBeDefined()
    expect(france?.cca3).toBe('FRA')
  })

  it('byCca3 maps cca3 to country', () => {
    const { result } = renderHook(() => useCountryData())
    const germany = result.current.byCca3.get('DEU')
    expect(germany).toBeDefined()
    expect(germany?.name.common).toBe('Germany')
  })

  it('byNumeric and byCca3 have identical sizes', () => {
    const { result } = renderHook(() => useCountryData())
    expect(result.current.byNumeric.size).toBe(result.current.byCca3.size)
  })

  it('sources registry is present and populated', () => {
    const { result } = renderHook(() => useCountryData())
    expect(result.current.sources).toBeDefined()
    expect(Object.keys(result.current.sources).length).toBeGreaterThan(0)
  })

  it('is stable across rerenders (memoized)', () => {
    const { result, rerender } = renderHook(() => useCountryData())
    const first = result.current
    rerender()
    expect(result.current.countries).toBe(first.countries)
    expect(result.current.byCca3).toBe(first.byCca3)
  })
})
