import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../useMap'
import { useCompareViewDimming } from '../useCompareViewDimming'

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

describe('useCompareViewDimming', () => {
  it('dims country-fill and country-borders when compareWith is present', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewDimming({
          loaded: true,
          compareWith: { ccn3: '276' },
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const fillCall = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-fill' && c[1] === 'fill-opacity',
    )
    expect(fillCall?.[2]).toBe(0.05)
    const borderCall = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-borders' && c[1] === 'line-opacity',
    )
    expect(borderCall?.[2]).toBe(0.15)
  })

  it('restores default fill + border paint when compareWith clears (non-satellite)', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewDimming({
          loaded: true,
          compareWith: null,
          satellite: false,
          resolvedTheme: 'dark',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const fillCall = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-fill' && c[1] === 'fill-opacity',
    )
    // DEFAULT_FILL_OPACITY is the case-expression, not a number.
    expect(fillCall?.[2]).toBeDefined()
    expect(Array.isArray(fillCall?.[2])).toBe(true)
    // Dark-mode default is 0.5.
    const borderOpacity = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-borders' && c[1] === 'line-opacity',
    )
    expect(borderOpacity?.[2]).toBe(0.5)
  })

  it('restores satellite border paint when compareWith clears in satellite mode', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewDimming({
          loaded: true,
          compareWith: null,
          satellite: true,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const borderOpacity = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-borders' && c[1] === 'line-opacity',
    )
    expect(borderOpacity?.[2]).toBe(0.6)
    const borderColor = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-borders' && c[1] === 'line-color',
    )
    expect(borderColor?.[2]).toBe('rgba(255,255,255,0.35)')
  })

  it('does nothing when loaded is false', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewDimming({
          loaded: false,
          compareWith: { ccn3: '276' },
          satellite: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    expect(fake.setFilter).not.toHaveBeenCalled()
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
