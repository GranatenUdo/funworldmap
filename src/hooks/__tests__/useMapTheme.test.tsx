import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { makeMapWrapper } from '../../test/fakeMapHooks'
import { useMapTheme } from '../useMapTheme'
import { ICE, ICE_DEEP } from '../../lib/mapPalette'

function makeThemeFakeMap(layers: Array<{ id: string; type: string }>) {
  const calls: Record<string, unknown[][]> = { setPaintProperty: [], setSky: [] }
  return {
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    setSky: vi.fn((...args: unknown[]) => calls.setSky.push(args)),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    getStyle: () => ({ layers }),
    calls,
  }
}

const LAYERS = [
  { id: 'background', type: 'background' },
  { id: 'water', type: 'fill' },
  { id: 'place-label', type: 'symbol' },
  { id: 'country-fill', type: 'fill' },
]

describe('useMapTheme', () => {
  it('dark: applies dark overrides, recolors symbol text/halo, sets dark sky, ice accents', () => {
    const fake = makeThemeFakeMap(LAYERS)
    renderHook(() => useMapTheme({ loaded: true, resolvedTheme: 'dark' }), {
      wrapper: makeMapWrapper(fake),
    })
    // applyMapTheme: DARK_OVERRIDES for background
    expect(fake.calls.setPaintProperty).toContainEqual([
      'background',
      'background-color',
      '#10141a',
    ])
    // applyMapTheme: DARK_OVERRIDES for water
    expect(fake.calls.setPaintProperty).toContainEqual(['water', 'fill-color', '#060a12'])
    // applyMapTheme: symbol loop recolors place-label text
    expect(fake.calls.setPaintProperty).toContainEqual(['place-label', 'text-color', '#64748b'])
    // useMapTheme: LAYER.fill gets ICE in dark mode
    expect(fake.calls.setPaintProperty).toContainEqual(['country-fill', 'fill-color', ICE])
    // E4: the selection stack takes the SAME theme ice (coral is retired)
    expect(fake.calls.setPaintProperty).toContainEqual(['country-selected', 'fill-color', ICE])
    // useMapTheme: setSky called exactly once
    expect(fake.setSky).toHaveBeenCalledTimes(1)
  })

  it('light: light overrides and deep-ice accents', () => {
    const fake = makeThemeFakeMap(LAYERS)
    renderHook(() => useMapTheme({ loaded: true, resolvedTheme: 'light' }), {
      wrapper: makeMapWrapper(fake),
    })
    // applyMapTheme: LIGHT_OVERRIDES for background
    expect(fake.calls.setPaintProperty).toContainEqual([
      'background',
      'background-color',
      '#e8e3da',
    ])
    // useMapTheme: LAYER.fill gets deep ice in light mode
    expect(fake.calls.setPaintProperty).toContainEqual(['country-fill', 'fill-color', ICE_DEEP])
    expect(fake.calls.setPaintProperty).toContainEqual(['country-selected', 'fill-color', ICE_DEEP])
  })

  it('survives setPaintProperty throwing (fast toggle before layers commit)', () => {
    // applyMapTheme's per-layer and per-symbol loops each have their own
    // try/catch, and useMapTheme's LAYER.fill / setSky block has an outer
    // try/catch — so a throwing setPaintProperty must never propagate to the
    // caller.
    const fake = makeThemeFakeMap(LAYERS)
    fake.setPaintProperty.mockImplementation(() => {
      throw new Error('layer not ready')
    })
    expect(() =>
      renderHook(() => useMapTheme({ loaded: true, resolvedTheme: 'dark' }), {
        wrapper: makeMapWrapper(fake),
      }),
    ).not.toThrow()
  })
})
