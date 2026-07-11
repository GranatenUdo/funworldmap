import { describe, expect, it, vi } from 'vitest'
import {
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  applyBasemapLayerVisibility,
  applyCountryBaselinePaint,
  EXTRUSION_MAX_ZOOM,
  extrusionHeightExpression,
} from '../mapLayers'
import { createFakeMapRef } from '../../test/fakeMapRef'

describe('highlight extrusion layers', () => {
  it.each([
    ['hover', addHoverLayers, 60000],
    ['selection', addSelectionLayers, 80000],
    ['compare', addCompareLayers, 80000],
  ])('%s extrusion fades with zoom and keeps a maxzoom backstop', (_n, add, peak) => {
    const fake = createFakeMapRef()
    add(fake.map)
    const specs = fake.addedLayers
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
      const fake = createFakeMapRef()
      add(fake.map)
      const specs = fake.addedLayers
      const others = specs.filter((s) => s.type !== 'fill-extrusion')
      expect(others.length).toBeGreaterThan(0)
      for (const spec of others) expect(spec.maxzoom).toBeUndefined()
    }
  })
})

describe('applyBasemapLayerVisibility', () => {
  const styleLayers = [
    { id: 'water', type: 'fill' },
    { id: 'place-labels', type: 'symbol' },
    { id: 'country-fill', type: 'fill' },
    { id: 'satellite-layer', type: 'raster' },
  ]
  function makeMapWithStyle() {
    const fake = createFakeMapRef()
    ;(fake.map.getStyle as ReturnType<typeof vi.fn>).mockReturnValue({ layers: styleLayers })
    return fake
  }
  const visibilityOf = (
    fake: ReturnType<typeof createFakeMapRef>,
    id: string,
  ): string | undefined =>
    fake.calls.setLayoutProperty.mock.calls.filter((c) => c[0] === id).at(-1)?.[2] as
      | string
      | undefined

  it('map view during play: symbol layers hidden, others visible, custom untouched', () => {
    const fake = makeMapWithStyle()
    applyBasemapLayerVisibility(fake.map, { satellite: false, hideLabels: true })
    expect(visibilityOf(fake, 'water')).toBe('visible')
    expect(visibilityOf(fake, 'place-labels')).toBe('none')
    expect(visibilityOf(fake, 'country-fill')).toBeUndefined()
    expect(visibilityOf(fake, 'satellite-layer')).toBeUndefined()
  })

  it('map view idle: everything non-custom visible', () => {
    const fake = makeMapWithStyle()
    applyBasemapLayerVisibility(fake.map, { satellite: false, hideLabels: false })
    expect(visibilityOf(fake, 'place-labels')).toBe('visible')
  })

  it('satellite: all non-custom hidden regardless of hideLabels', () => {
    const fake = makeMapWithStyle()
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: true })
    expect(visibilityOf(fake, 'water')).toBe('none')
    expect(visibilityOf(fake, 'place-labels')).toBe('none')
  })
})

describe('applyCountryBaselinePaint game emphasis', () => {
  const paintOf = (fake: ReturnType<typeof createFakeMapRef>, prop: string): unknown =>
    fake.calls.setPaintProperty.mock.calls.filter((c) => c[1] === prop).at(-1)?.[2]

  it('satellite + playing: borders 1.6px @ 0.9', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, {
      satellite: true,
      inCompareView: false,
      isDark: false,
      gameActive: true,
    })
    expect(paintOf(fake, 'line-width')).toBe(1.6)
    expect(paintOf(fake, 'line-opacity')).toBe(0.9)
  })

  it('satellite idle: baseline 0.5px @ 0.6 restored', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, {
      satellite: true,
      inCompareView: false,
      isDark: false,
      gameActive: false,
    })
    expect(paintOf(fake, 'line-width')).toBe(0.5)
    expect(paintOf(fake, 'line-opacity')).toBe(0.6)
  })

  it('map view + playing: vector border paint unchanged by the game', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, {
      satellite: false,
      inCompareView: false,
      isDark: false,
      gameActive: true,
    })
    expect(paintOf(fake, 'line-width')).toBe(0.5)
    expect(paintOf(fake, 'line-opacity')).toBe(0.35)
  })

  it('compare view resets line-width even after game emphasis', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, {
      satellite: true,
      inCompareView: false,
      isDark: false,
      gameActive: true,
    })
    applyCountryBaselinePaint(fake.map, {
      satellite: true,
      inCompareView: true,
      isDark: false,
      gameActive: false,
    })
    expect(paintOf(fake, 'line-width')).toBe(0.5)
    expect(paintOf(fake, 'line-opacity')).toBe(0.15)
  })
})
