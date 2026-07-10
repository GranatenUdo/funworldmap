/**
 * The hover/selection/compare fill-extrusion layers must carry a maxzoom:
 * without it the fixed 60–80 km column projects as a wall crossing the
 * viewport at the zooms tiny countries fly to (Vatican smear — 2026-07-10
 * review, batch-1 spec item 4).
 */
import { describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import { addHoverLayers, addSelectionLayers, addCompareLayers } from '../mapLayers'

function captureAddedLayers(add: (map: maplibregl.Map) => void) {
  const specs: maplibregl.LayerSpecification[] = []
  const map = {
    addLayer: vi.fn((spec: maplibregl.LayerSpecification) => specs.push(spec)),
  } as unknown as maplibregl.Map
  add(map)
  return specs
}

describe('highlight extrusion layers', () => {
  it.each([
    ['hover', addHoverLayers],
    ['selection', addSelectionLayers],
    ['compare', addCompareLayers],
  ])('%s stack caps its fill-extrusion at a maxzoom', (_name, add) => {
    const specs = captureAddedLayers(add)
    const extrusions = specs.filter((s) => s.type === 'fill-extrusion')
    expect(extrusions.length).toBeGreaterThan(0)
    for (const spec of extrusions) {
      expect(spec.maxzoom).toBe(6)
    }
  })

  it('non-extrusion highlight layers stay unbounded (highlight must never vanish)', () => {
    for (const add of [addHoverLayers, addSelectionLayers, addCompareLayers]) {
      const others = captureAddedLayers(add).filter((s) => s.type !== 'fill-extrusion')
      expect(others.length).toBeGreaterThan(0)
      for (const spec of others) {
        expect(spec.maxzoom).toBeUndefined()
      }
    }
  })
})
