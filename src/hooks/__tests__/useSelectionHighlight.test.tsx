import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { useSelectionHighlight } from '../useSelectionHighlight'
import type { SelectionOrigin } from '../useSelectedCountry'
import type { CountryData } from '../../lib/types'
import { flyToCountry } from '../../lib/flyToCountry'
import { flyToComparePair } from '../../lib/flyToComparePair'
import { makeCountryData } from '../../test/countryFixtures'
import { makeFakeMap, makeMapWrapper } from '../../test/fakeMapHooks'

vi.mock('../../lib/flyToCountry', () => ({
  flyToCountry: vi.fn(),
}))

vi.mock('../../lib/flyToComparePair', () => ({
  flyToComparePair: vi.fn(),
}))

function makeCountry(ccn3: string) {
  return makeCountryData({ ccn3 })
}

function originRef(origin: SelectionOrigin = 'auto'): MutableRefObject<SelectionOrigin> {
  return { current: origin }
}

describe('useSelectionHighlight', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets selection filter with ccn3 when a country is selected', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: makeCountry('250'),
          selectionOriginRef: originRef(),
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
          selectionOriginRef: originRef(),
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
          selectionOriginRef: originRef(),
          compareWith: null,
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(fake.setFilter).not.toHaveBeenCalled()
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })

  it('flies with preserveZoom when the selection came from a map click', () => {
    const fake = makeFakeMap()
    const country = makeCountry('250')
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: country,
          selectionOriginRef: originRef('click'),
          compareWith: null,
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(flyToCountry).toHaveBeenCalledWith(expect.anything(), country, { preserveZoom: true })
  })

  it('flies without preserveZoom for auto selections (search, chips, deep link)', () => {
    const fake = makeFakeMap()
    const country = makeCountry('250')
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: country,
          selectionOriginRef: originRef('auto'),
          compareWith: null,
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(flyToCountry).toHaveBeenCalledWith(expect.anything(), country, { preserveZoom: false })
  })

  it('flies to frame both countries when compare is set', () => {
    const fake = makeFakeMap()
    const selected = makeCountry('250')
    const compareWith = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected,
          selectionOriginRef: originRef(),
          compareWith,
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(flyToComparePair).toHaveBeenCalledTimes(1)
    expect(flyToComparePair).toHaveBeenCalledWith(expect.anything(), selected, compareWith)
  })

  it('does not fly again when compare is cleared', () => {
    const fake = makeFakeMap()
    const selected = makeCountry('250')
    const compareWith = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
    const { rerender } = renderHook<void, { compareWith: CountryData | null }>(
      (props) =>
        useSelectionHighlight({
          loaded: true,
          selected,
          selectionOriginRef: originRef(),
          compareWith: props.compareWith,
        }),
      { wrapper: makeMapWrapper(fake), initialProps: { compareWith } },
    )
    expect(flyToComparePair).toHaveBeenCalledTimes(1)
    rerender({ compareWith: null })
    expect(flyToComparePair).toHaveBeenCalledTimes(1)
  })
})
