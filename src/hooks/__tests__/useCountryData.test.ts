import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCountryData } from '../useCountryData'

describe('useCountryData', () => {
  it('returns the canonical 195-country array', () => {
    const { result } = renderHook(() => useCountryData())
    expect(result.current.countries.length).toBe(195)
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

  it('excludes non-canonical entries and includes UN observers / canonical edge-cases', () => {
    const { result } = renderHook(() => useCountryData())
    const { byCca3 } = result.current
    // Taiwan is excluded (not a UN member, not in observer allowlist)
    expect(byCca3.has('TWN')).toBe(false)
    // Palestine is included (UN observer state)
    expect(byCca3.has('PSE')).toBe(true)
    // Guinea-Bissau is included (UN member; regression guard for the unMember fix)
    expect(byCca3.has('GNB')).toBe(true)
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
