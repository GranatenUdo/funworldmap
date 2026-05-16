import { vi } from 'vitest'
import type { MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

export function createFakeMapRef() {
  const setData = vi.fn()
  const map = {
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
    getSource: vi.fn(() => ({ setData })),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    flyTo: vi.fn(),
    jumpTo: vi.fn(),
  } as unknown as maplibregl.Map
  const ref: MutableRefObject<maplibregl.Map | null> = { current: map }
  return {
    ref,
    calls: {
      setFilter: map.setFilter as ReturnType<typeof vi.fn>,
      setPaintProperty: map.setPaintProperty as ReturnType<typeof vi.fn>,
      getSource: map.getSource as ReturnType<typeof vi.fn>,
      addSource: map.addSource as ReturnType<typeof vi.fn>,
      addLayer: map.addLayer as ReturnType<typeof vi.fn>,
      on: map.on as ReturnType<typeof vi.fn>,
      off: map.off as ReturnType<typeof vi.fn>,
      flyTo: map.flyTo as ReturnType<typeof vi.fn>,
      jumpTo: map.jumpTo as ReturnType<typeof vi.fn>,
      setData,
    },
  }
}
