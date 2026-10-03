import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountrySearch } from '../useCountrySearch'
import type { CountryData } from '../../lib/types'
import { makeCountryData } from '../../test/countryFixtures'

const makeSearchCountry = (
  cca3: string,
  ccn3: string,
  common: string,
  capital: string[] = [],
): CountryData =>
  makeCountryData({
    cca3,
    ccn3,
    cca2: cca3.slice(0, 2),
    name: { common, official: common },
    capital,
  })

const dataset: CountryData[] = [
  makeSearchCountry('FRA', '250', 'France', ['Paris']),
  makeSearchCountry('DEU', '276', 'Germany', ['Berlin']),
  makeSearchCountry('ESP', '724', 'Spain', ['Madrid']),
  makeSearchCountry('ITA', '380', 'Italy', ['Rome']),
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

  it('matches country names (common)', () => {
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
      makeSearchCountry(`C${i.toString().padStart(2, '0')}`, `${i}`, `Country${i}`),
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

  describe('search-noise regressions (C-9)', () => {
    // Realistic slice around the reported noise: at the old 0.4 threshold,
    // "franc" ranked Iran second ("ran" ⊂ "franc" is 2 errors in 5 chars —
    // raw bitap score exactly 0.4). Fields mirror the real dataset so the
    // official-name and capital keys exert their real influence.
    const noiseDataset: CountryData[] = [
      makeCountryData({
        cca3: 'FRA',
        ccn3: '250',
        cca2: 'FR',
        name: { common: 'France', official: 'French Republic' },
        capital: ['Paris'],
      }),
      makeCountryData({
        cca3: 'IRN',
        ccn3: '364',
        cca2: 'IR',
        name: { common: 'Iran', official: 'Islamic Republic of Iran' },
        capital: ['Tehran'],
        region: 'Asia',
        subregion: 'Southern Asia',
      }),
      makeCountryData({
        cca3: 'DEU',
        ccn3: '276',
        cca2: 'DE',
        name: { common: 'Germany', official: 'Federal Republic of Germany' },
        capital: ['Berlin'],
      }),
      makeCountryData({
        cca3: 'AND',
        ccn3: '020',
        cca2: 'AD',
        name: { common: 'Andorra', official: 'Principality of Andorra' },
        capital: ['Andorra la Vella'],
        subregion: 'Southern Europe',
      }),
      makeCountryData({
        cca3: 'LIE',
        ccn3: '438',
        cca2: 'LI',
        name: { common: 'Liechtenstein', official: 'Principality of Liechtenstein' },
        capital: ['Vaduz'],
        subregion: 'Central Europe',
      }),
      makeCountryData({
        cca3: 'MCO',
        ccn3: '492',
        cca2: 'MC',
        name: { common: 'Monaco', official: 'Principality of Monaco' },
        capital: ['Monaco'],
      }),
    ]

    const searchFor = (query: string) => {
      const { result, rerender } = renderHook(
        ({ q }: { q: string }) => useCountrySearch(noiseDataset, q),
        { initialProps: { q: '' } },
      )
      rerender({ q: query })
      act(() => {
        vi.advanceTimersByTime(150)
      })
      return result.current.results
    }

    it("'franc' puts France first and keeps Iran out of the top 3", () => {
      const results = searchFor('franc')
      expect(results[0]?.cca3).toBe('FRA')
      expect(results.slice(0, 3).map((c) => c.cca3)).not.toContain('IRN')
    })

    it("typo forgiveness survives the tuning: 'Germani' finds Germany first", () => {
      const results = searchFor('Germani')
      expect(results[0]?.cca3).toBe('DEU')
    })
  })
})
