import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountrySearch } from '../useCountrySearch'
import type { CountryData } from '../../lib/types'
import { makeCountryData } from '../../test/countryFixtures'

const c = (cca3: string, ccn3: string, common: string, capital: string[] = []): CountryData =>
  makeCountryData({
    cca3,
    ccn3,
    cca2: cca3.slice(0, 2),
    name: { common, official: common },
    capital,
  })

const dataset: CountryData[] = [
  c('FRA', '250', 'France', ['Paris']),
  c('DEU', '276', 'Germany', ['Berlin']),
  c('ESP', '724', 'Spain', ['Madrid']),
  c('ITA', '380', 'Italy', ['Rome']),
]

describe('useCountrySearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty results for empty query', () => {
    const { result } = renderHook(() => useCountrySearch(dataset, ''))
    expect(result.current.results).toEqual([])
  })

  it('debounces by 150ms before producing results', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'Fra' })
    expect(result.current.results).toEqual([])
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(result.current.results).toEqual([])
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.results.length).toBeGreaterThan(0)
  })

  it('matches country names (common) above 0.4 threshold', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'France' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.results[0]?.cca3).toBe('FRA')
  })

  it('matches capitals', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'Madrid' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.results[0]?.cca3).toBe('ESP')
  })

  it('matches cca3 codes', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'ITA' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.results[0]?.cca3).toBe('ITA')
  })

  it('caps results at 8', () => {
    const large: CountryData[] = Array.from({ length: 20 }, (_, i) =>
      c(`C${i.toString().padStart(2, '0')}`, `${i}`, `Country${i}`),
    )
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(large, query),
      { initialProps: { query: '' } },
    )
    rerender({ query: 'Country' })
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.results.length).toBeLessThanOrEqual(8)
  })

  it('clears results when query becomes empty', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: 'France' } },
    )
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.results.length).toBeGreaterThan(0)
    rerender({ query: '' })
    expect(result.current.results).toEqual([])
  })

  it('flags results as stale while the debounce for a changed query is pending', () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCountrySearch(dataset, query),
      { initialProps: { query: 'France' } },
    )
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.isStale).toBe(false)
    expect(result.current.results[0]?.cca3).toBe('FRA')

    // Retype: the old France results are still returned but marked stale
    // until the debounce fires for the new query.
    rerender({ query: 'Germany' })
    expect(result.current.results[0]?.cca3).toBe('FRA')
    expect(result.current.isStale).toBe(true)

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.isStale).toBe(false)
    expect(result.current.results[0]?.cca3).toBe('DEU')
  })

  it('is fresh (not stale) for the empty query', () => {
    const { result } = renderHook(() => useCountrySearch(dataset, ''))
    expect(result.current.isStale).toBe(false)
  })
})
