import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCompareViewHighlight } from '../useCompareViewHighlight'
import { ICE, ICE_DEEP, ICE_DIM, SIGNAL } from '../../lib/mapPalette'
import { makeFakeMap, makeMapWrapper } from '../../test/fakeMapHooks'

describe('useCompareViewHighlight', () => {
  it('suppresses hover layers and pins A/B colours when compareWith is present', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewHighlight({
          loaded: true,
          compareWith: { ccn3: '276' },
          resolvedTheme: 'light',
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(
      fake.calls.setFilter.filter(
        (c) => c[0] === 'country-hover-border' || c[0] === 'country-extrusion',
      ),
    ).toHaveLength(2)
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(SIGNAL)
    const cmpFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-compare-fill' && c[1] === 'fill-color',
    )
    expect(cmpFill?.[2]).toBe(ICE_DIM)
  })

  it('pins A to SIGNAL (not the theme ice) in dark mode while comparing', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewHighlight({
          loaded: true,
          compareWith: { ccn3: '276' },
          resolvedTheme: 'dark',
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(SIGNAL)
  })

  it('restores theme-appropriate ice on exit (dark)', () => {
    const fake = makeFakeMap()
    renderHook(
      () => useCompareViewHighlight({ loaded: true, compareWith: null, resolvedTheme: 'dark' }),
      { wrapper: makeMapWrapper(fake) },
    )
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(ICE)
  })

  it('restores deep ice on exit in light mode', () => {
    const fake = makeFakeMap()
    renderHook(
      () => useCompareViewHighlight({ loaded: true, compareWith: null, resolvedTheme: 'light' }),
      { wrapper: makeMapWrapper(fake) },
    )
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(ICE_DEEP)
  })

  it('does nothing when loaded is false', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewHighlight({
          loaded: false,
          compareWith: { ccn3: '276' },
          resolvedTheme: 'light',
        }),
      { wrapper: makeMapWrapper(fake) },
    )
    expect(fake.setFilter).not.toHaveBeenCalled()
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
