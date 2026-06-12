import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../useMap'
import { useCompareViewHighlight } from '../useCompareViewHighlight'
import { CORAL, CORAL_LIGHT, TEAL_DIM } from '../../lib/mapPalette'

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
      { wrapper: makeWrapper(fake) },
    )
    expect(
      fake.calls.setFilter.filter(
        (c) => c[0] === 'country-hover-border' || c[0] === 'country-extrusion',
      ),
    ).toHaveLength(2)
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(CORAL)
    const cmpFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-compare-fill' && c[1] === 'fill-color',
    )
    expect(cmpFill?.[2]).toBe(TEAL_DIM)
  })

  it('pins A to CORAL (not CORAL_LIGHT) in dark mode while comparing', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewHighlight({
          loaded: true,
          compareWith: { ccn3: '276' },
          resolvedTheme: 'dark',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(CORAL)
  })

  it('restores theme-appropriate coral on exit', () => {
    const fake = makeFakeMap()
    renderHook(
      () => useCompareViewHighlight({ loaded: true, compareWith: null, resolvedTheme: 'dark' }),
      { wrapper: makeWrapper(fake) },
    )
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(CORAL_LIGHT)
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
      { wrapper: makeWrapper(fake) },
    )
    expect(fake.setFilter).not.toHaveBeenCalled()
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
