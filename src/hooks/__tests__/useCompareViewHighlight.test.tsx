import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCompareViewHighlight } from '../useCompareViewHighlight'
import { setHoverOverlay } from '../../lib/mapLayers'
import { ICE, ICE_DEEP, ICE_MID, SIGNAL } from '../../lib/mapPalette'
import { makeFakeMap, makeMapWrapper } from '../../test/fakeMapHooks'

// setHoverOverlay is unit-tested in mapLayers.test.ts; here only that the hook drives it.
vi.mock('../../lib/mapLayers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/mapLayers')>()),
  setHoverOverlay: vi.fn(),
}))

describe('useCompareViewHighlight', () => {
  beforeEach(() => {
    vi.mocked(setHoverOverlay).mockClear()
  })

  it('clears the hover overlay and pins A/B colours when compareWith is present', () => {
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
    expect(setHoverOverlay).toHaveBeenCalledTimes(1)
    expect(setHoverOverlay).toHaveBeenCalledWith(fake, null)
    // The overlay lives on its own source now — no setFilter on the hover layers.
    expect(
      fake.calls.setFilter.filter(
        (c) => c[0] === 'country-hover-border' || c[0] === 'country-extrusion',
      ),
    ).toHaveLength(0)
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(SIGNAL)
    const cmpFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-compare-fill' && c[1] === 'fill-color',
    )
    expect(cmpFill?.[2]).toBe(ICE_MID)
  })

  it('clears the overlay AFTER the colour pins, so it can never skip them', () => {
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
    const overlayOrder = vi.mocked(setHoverOverlay).mock.invocationCallOrder[0]
    const lastPaintOrder = Math.max(...fake.setPaintProperty.mock.invocationCallOrder)
    expect(overlayOrder).toBeGreaterThan(lastPaintOrder)
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
    // Leaving compare restores colours only; hover simply resumes on the next crossing.
    expect(setHoverOverlay).not.toHaveBeenCalled()
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
