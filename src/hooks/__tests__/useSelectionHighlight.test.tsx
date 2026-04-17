import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../useMap'
import { useSelectionHighlight } from '../useSelectionHighlight'
import type { CountryData } from '../../lib/types'

vi.mock('../../lib/flyToCountry', () => ({
  flyToCountry: vi.fn(),
}))

function makeCountry(ccn3: string): CountryData {
  return {
    cca3: 'FRA',
    ccn3,
    name: { common: 'France', official: 'France' },
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

function makeFakeMap() {
  const calls: Record<string, unknown[][]> = { setFilter: [], setPaintProperty: [] }
  return {
    setFilter: vi.fn((...args: unknown[]) => calls.setFilter.push(args)),
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    calls,
  }
}

function Injector({ children, map }: { children: ReactNode; map: unknown }) {
  const refs = useMap()
  refs.mapRef.current = map as never
  return <>{children}</>
}

function makeWrapper(map: unknown) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MapProvider>
        <Injector map={map}>{children}</Injector>
      </MapProvider>
    )
  }
}

describe('useSelectionHighlight', () => {
  it('sets selection filter with ccn3 when a country is selected', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: makeCountry('250'),
          compareWith: null,
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const call = fake.calls.setFilter.find((c) => c[0] === 'country-selected')
    expect(call?.[1]).toEqual(['==', ['get', 'id'], '250'])
  })

  it('sets empty selection filters when nothing is selected', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: null,
          compareWith: null,
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const call = fake.calls.setFilter.find((c) => c[0] === 'country-selected')
    expect(call?.[1]).toEqual(['==', ['get', 'id'], ''])
  })

  it('dims base fill when compareWith is present', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: makeCountry('250'),
          compareWith: makeCountry('276'),
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const call = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-fill' && c[1] === 'fill-opacity',
    )
    expect(call?.[2]).toBe(0.05)
  })

  it('does nothing when loaded is false', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: false,
          selected: makeCountry('250'),
          compareWith: null,
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    expect(fake.setFilter).not.toHaveBeenCalled()
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
