import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSelectedCountry } from '../useSelectedCountry'
import type { CountryData } from '../../lib/types'

function makeCountry(cca3: string, ccn3: string, name: string): CountryData {
  return {
    cca3,
    ccn3,
    cca2: cca3.slice(0, 2),
    name: { common: name, official: name },
    capital: [],
    region: 'Europe',
    subregion: '',
    languages: {},
    currencies: {},
    timezones: [],
    borders: [],
    flag: '',
    flagAlt: '',
    population: 0,
    area: 0,
    unMember: true,
    independent: true,
    governmentType: '',
    _fieldSources: {},
  } as unknown as CountryData
}

const FRA = makeCountry('FRA', '250', 'France')
const DEU = makeCountry('DEU', '276', 'Germany')

function makeByCca3() {
  const m = new Map<string, CountryData>()
  m.set('FRA', FRA)
  m.set('DEU', DEU)
  return m
}

describe('useSelectedCountry', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('returns null selected and null compareWith when hash is empty', () => {
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.selected).toBeNull()
    expect(result.current.compareWith).toBeNull()
  })

  it('resolves selected from an initial hash', () => {
    window.location.hash = '#FRA'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.selected).toBe(FRA)
    expect(result.current.compareWith).toBeNull()
  })

  it('resolves selected + compareWith from a two-code hash', () => {
    window.location.hash = '#FRA,DEU'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.selected).toBe(FRA)
    expect(result.current.compareWith).toBe(DEU)
  })

  it('silently clears an invalid selected code and resets the hash', () => {
    window.location.hash = '#ZZZ'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.selected).toBeNull()
    expect(result.current.compareWith).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('select() writes uppercased code to hash and updates selected on hashchange', async () => {
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.select('fra')
    })
    expect(window.location.hash).toBe('#FRA')
    await waitFor(() => expect(result.current.selected).toBe(FRA))
  })

  it('select() clears any existing compareWith', async () => {
    window.location.hash = '#FRA,DEU'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    expect(result.current.compareWith).toBe(DEU)
    act(() => {
      result.current.select('DEU')
    })
    await waitFor(() => {
      expect(result.current.selected).toBe(DEU)
      expect(result.current.compareWith).toBeNull()
    })
  })

  it('compareSelect() is a no-op when nothing is selected', () => {
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.compareSelect('FRA')
    })
    expect(window.location.hash).toBe('')
    expect(result.current.selected).toBeNull()
  })

  it('compareSelect() pairs the new code with the existing selected', async () => {
    window.location.hash = '#FRA'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.compareSelect('deu')
    })
    expect(window.location.hash).toBe('#FRA,DEU')
    await waitFor(() => expect(result.current.compareWith).toBe(DEU))
  })

  it('clearCompare() drops compareWith and leaves selected intact', async () => {
    window.location.hash = '#FRA,DEU'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.clearCompare()
    })
    await waitFor(() => {
      expect(result.current.selected).toBe(FRA)
      expect(result.current.compareWith).toBeNull()
    })
    expect(window.location.hash).toBe('#FRA')
  })

  it('deselect() clears both and empties the hash', () => {
    window.location.hash = '#FRA,DEU'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.deselect()
    })
    expect(result.current.selected).toBeNull()
    expect(result.current.compareWith).toBeNull()
    expect(window.location.hash).toBe('')
  })
})
