import { describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import {
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  EXTRUSION_MAX_ZOOM,
  extrusionHeightExpression,
} from '../mapLayers'

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
    ['hover', addHoverLayers, 60000],
    ['selection', addSelectionLayers, 80000],
    ['compare', addCompareLayers, 80000],
  ])('%s extrusion fades with zoom and keeps a maxzoom backstop', (_n, add, peak) => {
    const specs = captureAddedLayers(add)
    const extrusions = specs.filter((s) => s.type === 'fill-extrusion')
    expect(extrusions.length).toBeGreaterThan(0)
    for (const spec of extrusions) {
      expect(spec.maxzoom).toBe(EXTRUSION_MAX_ZOOM)
      expect(spec.paint?.['fill-extrusion-height']).toEqual(extrusionHeightExpression(peak))
    }
  })

  it('fade expression interpolates peak → 0 across the fade band', () => {
    expect(extrusionHeightExpression(80000)).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      4.5,
      80000,
      6.5,
      0,
    ])
  })

  it('non-extrusion highlight layers stay unbounded (highlight must never vanish)', () => {
    for (const add of [addHoverLayers, addSelectionLayers, addCompareLayers]) {
      const others = captureAddedLayers(add).filter((s) => s.type !== 'fill-extrusion')
      expect(others.length).toBeGreaterThan(0)
      for (const spec of others) expect(spec.maxzoom).toBeUndefined()
    }
  })
})
