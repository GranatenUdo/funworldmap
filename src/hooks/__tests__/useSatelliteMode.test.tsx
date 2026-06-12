import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { makeMapWrapper } from '../../test/fakeMapHooks'
import { useSatelliteMode } from '../useSatelliteMode'

function makeSatelliteFakeMap(layers: Array<{ id: string }>) {
  const calls: Record<string, unknown[][]> = { setLayoutProperty: [], setTerrain: [] }
  return {
    setLayoutProperty: vi.fn((...args: unknown[]) => calls.setLayoutProperty.push(args)),
    setTerrain: vi.fn((...args: unknown[]) => calls.setTerrain.push(args)),
    getStyle: () => ({ layers }),
    calls,
  }
}

const STYLE_LAYERS = [
  { id: 'background' },
  { id: 'water' },
  { id: 'country-fill' },
  { id: 'satellite-layer' },
]

describe('useSatelliteMode', () => {
  it('satellite ON: shows the satellite layer, sets terrain, hides basemap layers', () => {
    const fake = makeSatelliteFakeMap(STYLE_LAYERS)
    renderHook(() => useSatelliteMode({ loaded: true, satellite: true }), {
      wrapper: makeMapWrapper(fake),
    })
    // The satellite- prefixed layer is shown
    expect(fake.calls.setLayoutProperty).toContainEqual([
      'satellite-layer',
      'visibility',
      'visible',
    ])
    // Terrain is enabled with the correct source + exaggeration
    expect(fake.calls.setTerrain).toContainEqual([{ source: 'terrain-dem', exaggeration: 1.5 }])
    // Non-custom basemap layers are hidden (no country-/satellite- prefix)
    expect(fake.calls.setLayoutProperty).toContainEqual(['background', 'visibility', 'none'])
    expect(fake.calls.setLayoutProperty).toContainEqual(['water', 'visibility', 'none'])
    // country-fill has 'country-' prefix → skipped by the base-layer loop
    expect(fake.calls.setLayoutProperty.filter((c) => c[0] === 'country-fill')).toHaveLength(0)
  })

  it('satellite OFF: hides the satellite layer, removes terrain, restores basemap layers', () => {
    const fake = makeSatelliteFakeMap(STYLE_LAYERS)
    renderHook(() => useSatelliteMode({ loaded: true, satellite: false }), {
      wrapper: makeMapWrapper(fake),
    })
    // The satellite- prefixed layer is hidden
    expect(fake.calls.setLayoutProperty).toContainEqual(['satellite-layer', 'visibility', 'none'])
    // Terrain is removed by passing null
    expect(fake.calls.setTerrain).toContainEqual([null])
    // Basemap layers are restored to visible
    expect(fake.calls.setLayoutProperty).toContainEqual(['water', 'visibility', 'visible'])
  })

  it('does nothing before loaded', () => {
    const fake = makeSatelliteFakeMap(STYLE_LAYERS)
    renderHook(() => useSatelliteMode({ loaded: false, satellite: true }), {
      wrapper: makeMapWrapper(fake),
    })
    expect(fake.setLayoutProperty).not.toHaveBeenCalled()
    expect(fake.setTerrain).not.toHaveBeenCalled()
  })
})
