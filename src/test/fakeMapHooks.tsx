import { vi } from 'vitest'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../hooks/useMap'

/** Spy-backed stand-in for a MapLibre map, for hook tests that assert
 *  setFilter/setPaintProperty/setLayoutProperty/GeoJSON-setData calls. */
export function makeFakeMap() {
  const calls: Record<string, unknown[][]> = {
    setFilter: [],
    setPaintProperty: [],
    setLayoutProperty: [],
    setData: [],
  }
  const setData = vi.fn((...args: unknown[]) => calls.setData.push(args))
  return {
    setFilter: vi.fn((...args: unknown[]) => calls.setFilter.push(args)),
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    setLayoutProperty: vi.fn((...args: unknown[]) => calls.setLayoutProperty.push(args)),
    getSource: vi.fn(() => ({ setData })),
    setData,
    calls,
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- WHY: test-only helper file; fast-refresh concerns don't apply here.
function Injector({ children, map }: { children: ReactNode; map: unknown }) {
  const refs = useMap()
  refs.mapRef.current = map as never
  return <>{children}</>
}

/** renderHook wrapper that provides MapProvider with `map` pre-injected. */
export function makeMapWrapper(map: unknown) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MapProvider>
        <Injector map={map}>{children}</Injector>
      </MapProvider>
    )
  }
}
