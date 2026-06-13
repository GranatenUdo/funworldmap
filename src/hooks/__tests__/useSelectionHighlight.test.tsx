import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSelectionHighlight } from '../useSelectionHighlight'
import { makeCountryData } from '../../test/countryFixtures'
import { makeFakeMap, makeMapWrapper } from '../../test/fakeMapHooks'

vi.mock('../../lib/flyToCountry', () => ({
  flyToCountry: vi.fn(),
}))

function makeCountry(ccn3: string) {
  return makeCountryData({ ccn3 })
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
        }),
      { wrapper: makeMapWrapper(fake) },
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
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    const call = fake.calls.setFilter.find((c) => c[0] === 'country-selected')
    expect(call?.[1]).toEqual(['==', ['get', 'id'], ''])
  })

  it('does nothing when loaded is false', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: false,
          selected: makeCountry('250'),
          compareWith: null,
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(fake.setFilter).not.toHaveBeenCalled()
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
