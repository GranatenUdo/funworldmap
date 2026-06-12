import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../useMap'
import { useCompareViewDimming } from '../useCompareViewDimming'
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

  it('dims with the satellite base when compareWith is present in satellite mode', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewDimming({
          loaded: true,
          compareWith: { ccn3: '276' },
          satellite: true,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const fillCall = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-fill' && c[1] === 'fill-opacity',
    )
    // Satellite base is 0.03; the vector dim scalar 0.05 would BRIGHTEN the
    // fill over imagery instead of dimming it.
    expect(fillCall?.[2]).toBe(0.03)
  })

  it('pins A (selection) to CORAL and B (compare) to TEAL_DIM when compareWith is present', () => {
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
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(CORAL)
    const cmpFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-compare-fill' && c[1] === 'fill-color',
    )
    expect(cmpFill?.[2]).toBe(TEAL_DIM)
  })

  it('pins A to CORAL (not CORAL_LIGHT) in dark mode when compareWith is present', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCompareViewDimming({
          loaded: true,
          compareWith: { ccn3: '276' },
          satellite: false,
          resolvedTheme: 'dark',
        }),
      { wrapper: makeWrapper(fake) },
    )
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    // In compare mode the badge colour (#f43f5e = CORAL) is always used,
    // not the dark-theme variant CORAL_LIGHT.
    expect(selFill?.[2]).toBe(CORAL)
    expect(selFill?.[2]).not.toBe(CORAL_LIGHT)
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
    // The vector default — distinct from SATELLITE_FILL_OPACITY (0.32/0.03).
    expect(fillCall?.[2]).toEqual([
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      0.28,
      0.05,
    ])
    // Dark-mode default is 0.5.
    const borderOpacity = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-borders' && c[1] === 'line-opacity',
    )
    expect(borderOpacity?.[2]).toBe(0.5)
    // On exit from compare, selection layers restore to the theme-adjusted coral.
    const selFill = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-selected' && c[1] === 'fill-color',
    )
    expect(selFill?.[2]).toBe(CORAL_LIGHT)
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

  it('restores the satellite fill opacity when compareWith clears in satellite mode', () => {
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
    const fillCall = fake.calls.setPaintProperty.find(
      (c) => c[0] === 'country-fill' && c[1] === 'fill-opacity',
    )
    // Satellite keeps the base fill nearly transparent (0.03) so imagery shows
    // through — not the vector default (0.05).
    expect(fillCall?.[2]).toEqual([
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      0.32,
      0.03,
    ])
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
