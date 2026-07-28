import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSelectedCountry } from '../useSelectedCountry'
import type { CountryData } from '../../lib/types'
import { makeCountryData } from '../../test/countryFixtures'

const FRA = makeCountryData({
  cca3: 'FRA',
  ccn3: '250',
  cca2: 'FR',
  name: { common: 'France', official: 'France' },
})
const DEU = makeCountryData({
  cca3: 'DEU',
  ccn3: '276',
  cca2: 'DE',
  name: { common: 'Germany', official: 'Germany' },
})
const ESP = makeCountryData({
  cca3: 'ESP',
  ccn3: '724',
  cca2: 'ES',
  name: { common: 'Spain', official: 'Kingdom of Spain' },
})

function makeByCca3() {
  const m = new Map<string, CountryData>()
  m.set('FRA', FRA)
  m.set('DEU', DEU)
  m.set('ESP', ESP)
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

  it('compareReplaceA() replaces the selected country and keeps the compare partner', async () => {
    window.location.hash = '#FRA,DEU'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.compareReplaceA('esp')
    })
    expect(window.location.hash).toBe('#ESP,DEU')
    await waitFor(() => {
      expect(result.current.selected).toBe(ESP)
      expect(result.current.compareWith).toBe(DEU)
    })
  })

  it('compareReplaceA() is a no-op without an active compare pair', () => {
    window.location.hash = '#FRA'
    const { result } = renderHook(() => useSelectedCountry(makeByCca3()))
    act(() => {
      result.current.compareReplaceA('ESP')
    })
    expect(window.location.hash).toBe('#FRA')
  })
})
