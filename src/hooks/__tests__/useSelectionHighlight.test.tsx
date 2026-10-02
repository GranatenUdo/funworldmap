import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { useSelectionHighlight } from '../useSelectionHighlight'
import type { SelectionOrigin } from '../useSelectedCountry'
import type { CountryData } from '../../lib/types'
import { flyToCountry } from '../../lib/flyToCountry'
import { flyToComparePair } from '../../lib/flyToComparePair'
import { makeCountryData } from '../../test/countryFixtures'
import { makeFakeMap, makeMapWrapper } from '../../test/fakeMapHooks'
import { stubMatchMediaWithChange } from '../../test/matchMediaStub'

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

// The hook subscribes to DESKTOP_MEDIA_QUERY whenever a single selection is
// active (B-1), so every test needs a matchMedia (jsdom has none). The
// controllable variant lets the B-1 tests drive a breakpoint flip.
let mm: ReturnType<typeof stubMatchMediaWithChange>

beforeEach(() => {
  vi.clearAllMocks()
  mm = stubMatchMediaWithChange()
})

afterEach(() => mm.restore())

describe('useSelectionHighlight', () => {
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

  it('replacing B reframes the pair and never re-flies the single-selection camera (A8 camera decision)', () => {
    const fake = makeFakeMap()
    const selected = makeCountry('250')
    const germany = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
    const spain = makeCountryData({ cca3: 'ESP', ccn3: '724', latlng: [40, -4] })
    // Stable ref across rerenders (like the real hook's useRef). 'click'
    // simulates a consumed click-origin mark: even then the compare path must
    // ignore preserveZoom — the batch-2 §3 framing contract wins on replace-B.
    const origin = originRef('click')
    const { rerender } = renderHook<void, { compareWith: CountryData | null }>(
      (props) =>
        useSelectionHighlight({
          loaded: true,
          selected,
          selectionOriginRef: origin,
          compareWith: props.compareWith,
        }),
      { wrapper: makeMapWrapper(fake), initialProps: { compareWith: germany } },
    )
    expect(flyToCountry).toHaveBeenCalledTimes(1) // mount only

    rerender({ compareWith: spain })

    expect(flyToComparePair).toHaveBeenCalledTimes(2)
    expect(flyToComparePair).toHaveBeenLastCalledWith(expect.anything(), selected, spain)
    expect(flyToCountry).toHaveBeenCalledTimes(1) // replace-B never re-flies the single camera
  })

  it('B4: selection sets the country-dim filter to everything-except-selection', () => {
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
    const call = fake.calls.setFilter.find((c) => c[0] === 'country-dim')
    expect(call?.[1]).toEqual(['!=', ['get', 'id'], '250'])
  })

  it('B4: compare excludes BOTH countries from the country-dim filter', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: makeCountry('250'),
          selectionOriginRef: originRef(),
          compareWith: makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] }),
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    const call = fake.calls.setFilter.filter((c) => c[0] === 'country-dim').at(-1)
    expect(call?.[1]).toEqual(['all', ['!=', ['get', 'id'], '250'], ['!=', ['get', 'id'], '276']])
  })

  it('B4: no selection leaves country-dim matching nothing (games stay scrim-free)', () => {
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
    const call = fake.calls.setFilter.find((c) => c[0] === 'country-dim')
    expect(call?.[1]).toEqual(['==', ['get', 'id'], ''])
  })

  it('writes A/B centroid markers while comparing and clears them when compare ends (B6)', () => {
    const fake = makeFakeMap()
    const selected = makeCountry('250') // France, latlng [46, 2]
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
    const written = fake.calls.setData.at(-1)?.[0] as GeoJSON.FeatureCollection
    expect(written.features.map((f) => f.properties?.label as string | undefined)).toEqual([
      'A',
      'B',
    ])
    // country.latlng is [lat, lng]; GeoJSON points are [lng, lat]
    expect((written.features[0].geometry as GeoJSON.Point).coordinates).toEqual([2, 46])
    expect(fake.calls.setLayoutProperty.at(-1)).toEqual([
      'country-compare-markers',
      'visibility',
      'visible',
    ])

    rerender({ compareWith: null })
    const cleared = fake.calls.setData.at(-1)?.[0] as GeoJSON.FeatureCollection
    expect(cleared.features).toEqual([])
    expect(fake.calls.setLayoutProperty.at(-1)).toEqual([
      'country-compare-markers',
      'visibility',
      'none',
    ])
  })
})

describe('useSelectionHighlight — B-1 breakpoint re-center', () => {
  it('re-centers once via the recenter jump when the breakpoint changes while selected', () => {
    const fake = makeFakeMap()
    const country = makeCountry('250')
    renderHook(
      () =>
        useSelectionHighlight({
          loaded: true,
          selected: country,
          selectionOriginRef: originRef(),
          compareWith: null,
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(flyToCountry).toHaveBeenCalledTimes(1) // the mount fly

    mm.fireChange(false) // desktop → mobile

    // recenter keeps the current zoom/pitch and recomputes only the offset —
    // that contract is pinned in flyToCountry.test.ts; here we pin that the
    // hook routes through the SAME single camera owner with the flag.
    expect(flyToCountry).toHaveBeenCalledTimes(2)
    expect(flyToCountry).toHaveBeenLastCalledWith(expect.anything(), country, { recenter: true })
  })

  it('does not re-center when nothing is selected', () => {
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

    mm.fireChange(true)

    expect(flyToCountry).not.toHaveBeenCalled()
  })

  it("does not re-center while comparing — compare framing is flyToComparePair's job", () => {
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
    expect(flyToCountry).toHaveBeenCalledTimes(1) // mount fly only
    expect(flyToComparePair).toHaveBeenCalledTimes(1)
    // The gate is the subscription's lifetime: no listener exists while a
    // compare pair is active.
    expect(mm.listenerCount()).toBe(0)

    mm.fireChange(false)

    expect(flyToCountry).toHaveBeenCalledTimes(1)
    expect(flyToComparePair).toHaveBeenCalledTimes(1)
  })

  it('stops re-centering once the selection is cleared', () => {
    const fake = makeFakeMap()
    const country = makeCountry('250')
    const { rerender } = renderHook<void, { selected: CountryData | null }>(
      (props) =>
        useSelectionHighlight({
          loaded: true,
          selected: props.selected,
          selectionOriginRef: originRef(),
          compareWith: null,
        }),
      { wrapper: makeMapWrapper(fake), initialProps: { selected: country } },
    )
    expect(mm.listenerCount()).toBe(1)

    rerender({ selected: null })
    expect(mm.listenerCount()).toBe(0)

    mm.fireChange(false)

    expect(flyToCountry).toHaveBeenCalledTimes(1) // mount fly only, no re-center
  })
})
