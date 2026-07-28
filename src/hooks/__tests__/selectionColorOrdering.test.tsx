import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../useMap'
import { useMapTheme } from '../useMapTheme'
import { useCompareViewHighlight } from '../useCompareViewHighlight'
import { ICE, SIGNAL } from '../../lib/mapPalette'

// Cross-hook ordering regression lock.
//
// useMapTheme and useCompareViewHighlight BOTH write the country-selected*
// colours via applySelectionColor. While comparing, useMapTheme writes the
// theme ice (ICE in dark, ICE_DEEP in light) and useCompareViewHighlight
// must run AFTER it to pin SIGNAL (the A-badge colour) — a guarantee that
// rests entirely on WorldMap calling the hooks in that order (the "must run
// AFTER useMapTheme" comment in useCompareViewHighlight). Under E4 the pin
// is load-bearing in BOTH themes; the compare e2e covers light, so this
// test renders both hooks in WorldMap's order in dark and fails if the pin
// is ever lost (e.g. a hook reorder).

// Local fake: useMapTheme needs getLayer/getStyle (applyMapTheme) + setSky,
// useCompareViewHighlight needs setFilter; both write via setPaintProperty.
function makeThemeAwareFakeMap() {
  const layers = [
    { id: 'background', type: 'background' },
    { id: 'water', type: 'fill' },
    { id: 'place-label', type: 'symbol' },
    { id: 'country-fill', type: 'fill' },
  ]
  const calls: Record<string, unknown[][]> = { setPaintProperty: [], setFilter: [], setSky: [] }
  return {
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    setFilter: vi.fn((...args: unknown[]) => calls.setFilter.push(args)),
    setSky: vi.fn((...args: unknown[]) => calls.setSky.push(args)),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    getStyle: () => ({ layers }),
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

function selectionFillWrites(fake: ReturnType<typeof makeThemeAwareFakeMap>) {
  return fake.calls.setPaintProperty
    .filter((c) => c[0] === 'country-selected' && c[1] === 'fill-color')
    .map((c) => c[2])
}

describe('selection colour ordering (useMapTheme → useCompareViewHighlight)', () => {
  it('dark + compare: the selected-country fill pins SIGNAL, not the theme ice', () => {
    const fake = makeThemeAwareFakeMap()
    renderHook(
      () => {
        // SAME ORDER as WorldMap.tsx: theme first, compare-highlight after.
        useMapTheme({ loaded: true, resolvedTheme: 'dark' })
        useCompareViewHighlight({
          loaded: true,
          compareWith: { ccn3: '276' },
          resolvedTheme: 'dark',
        })
      },
      { wrapper: makeWrapper(fake) },
    )

    const writes = selectionFillWrites(fake)
    // useMapTheme really wrote the dark theme ice first — so this test would
    // catch a reorder, not silently pass because the theme write never ran.
    expect(writes).toContain(ICE)
    // ...and the compare pin (running after) wins: the final colour is SIGNAL.
    expect(writes.at(-1)).toBe(SIGNAL)
  })
})
