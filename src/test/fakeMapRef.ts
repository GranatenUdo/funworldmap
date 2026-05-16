import { vi } from 'vitest'
import type { MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

export function createFakeMapRef() {
  const setData = vi.fn()
  const setFilter = vi.fn()
  const setPaintProperty = vi.fn()
  const getSource = vi.fn(() => ({ setData }))
  const addSource = vi.fn()
  const addLayer = vi.fn()
  const on = vi.fn()
  const off = vi.fn()
  const flyTo = vi.fn()
  const jumpTo = vi.fn()
  const map = {
    setFilter,
    setPaintProperty,
    getSource,
    addSource,
    addLayer,
    on,
    off,
    flyTo,
    jumpTo,
  } as unknown as maplibregl.Map
  const ref: MutableRefObject<maplibregl.Map | null> = { current: map }
  return {
    ref,
    calls: {
      setFilter,
      setPaintProperty,
      getSource,
      addSource,
      addLayer,
      on,
      off,
      flyTo,
      jumpTo,
      setData,
    },
  }
}
