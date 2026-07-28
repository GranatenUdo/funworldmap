import { describe, expect, it, vi } from 'vitest'
import {
  addBaseCountryLayers,
  addCountryLabelLayer,
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  applyBasemapLayerVisibility,
  applyCountryBaselinePaint,
  COUNTRY_LABEL_SOURCE,
  EXTRUSION_MAX_ZOOM,
  extrusionHeightExpression,
  LAYER,
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
    { id: 'country-labels', type: 'symbol' },
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

  // B1: the app-owned label layer is the ONE country-* layer this owner does
  // write — the explicit rule (visible iff satellite && !hideLabels) runs
  // before the customPrefixes skip.
  it.each([
    [true, false, 'visible'],
    [true, true, 'none'],
    [false, false, 'none'],
    [false, true, 'none'],
  ])('country-labels: satellite=%s hideLabels=%s → %s', (satellite, hideLabels, expected) => {
    const fake = makeMapWithStyle()
    applyBasemapLayerVisibility(fake.map, { satellite, hideLabels })
    expect(visibilityOf(fake, 'country-labels')).toBe(expected)
  })

  it('the country-labels rule does not leak to other custom layers', () => {
    const fake = makeMapWithStyle()
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: false })
    expect(visibilityOf(fake, 'country-fill')).toBeUndefined()
    expect(visibilityOf(fake, 'satellite-layer')).toBeUndefined()
  })

  it('toggle-satellite-mid-game ordering: hidden through both toggles, restored only when the game ends', () => {
    const fake = makeMapWithStyle()
    // Playing in satellite → hidden.
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: true })
    expect(visibilityOf(fake, 'country-labels')).toBe('none')
    // Player toggles to vector mid-game → still hidden.
    applyBasemapLayerVisibility(fake.map, { satellite: false, hideLabels: true })
    expect(visibilityOf(fake, 'country-labels')).toBe('none')
    // Back to satellite while STILL playing → satellite alone must not reveal.
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: true })
    expect(visibilityOf(fake, 'country-labels')).toBe('none')
    // Game ends in satellite → labels return.
    applyBasemapLayerVisibility(fake.map, { satellite: true, hideLabels: false })
    expect(visibilityOf(fake, 'country-labels')).toBe('visible')
  })
})

describe('cased country borders (B2)', () => {
  const paintOf = (
    fake: ReturnType<typeof createFakeMapRef>,
    layer: string,
    prop: string,
  ): unknown =>
    fake.calls.setPaintProperty.mock.calls
      .filter((c) => c[0] === layer && c[1] === prop)
      .at(-1)?.[2]

  const CASING_WIDTH = ['interpolate', ['linear'], ['zoom'], 1, 1.2, 5, 1.6, 10, 2.6]
  const CASED_WIDTH = ['interpolate', ['linear'], ['zoom'], 1, 0.7, 5, 0.9, 10, 1.5]

  it('addBaseCountryLayers adds the casing directly under the light border line', () => {
    const fake = createFakeMapRef()
    addBaseCountryLayers(fake.map)
    const ids = fake.addedLayers.map((l) => l.id)
    expect(ids.indexOf(LAYER.bordersCasing)).toBeGreaterThanOrEqual(0)
    expect(ids.indexOf(LAYER.bordersCasing)).toBe(ids.indexOf(LAYER.borders) - 1)
  })

  it('satellite: light line at 0.9 opacity over a dark casing, both zoom-interpolated', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, { satellite: true, inCompareView: false, isDark: false })
    expect(paintOf(fake, LAYER.borders, 'line-width')).toEqual(CASED_WIDTH)
    expect(paintOf(fake, LAYER.borders, 'line-opacity')).toBe(0.9)
    expect(paintOf(fake, LAYER.bordersCasing, 'line-color')).toBe('#0f172a')
    expect(paintOf(fake, LAYER.bordersCasing, 'line-width')).toEqual(CASING_WIDTH)
    expect(paintOf(fake, LAYER.bordersCasing, 'line-opacity')).toBe(0.85)
  })

  it('vector: hairline baseline unchanged, casing hidden', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, { satellite: false, inCompareView: false, isDark: false })
    expect(paintOf(fake, LAYER.borders, 'line-width')).toBe(0.5)
    expect(paintOf(fake, LAYER.borders, 'line-opacity')).toBe(0.35)
    expect(paintOf(fake, LAYER.bordersCasing, 'line-opacity')).toBe(0)
  })

  it('compare view: flat dim hairline, casing hidden (even arriving from satellite)', () => {
    const fake = createFakeMapRef()
    applyCountryBaselinePaint(fake.map, { satellite: true, inCompareView: false, isDark: false })
    applyCountryBaselinePaint(fake.map, { satellite: true, inCompareView: true, isDark: false })
    expect(paintOf(fake, LAYER.borders, 'line-width')).toBe(0.5)
    expect(paintOf(fake, LAYER.borders, 'line-opacity')).toBe(0.15)
    expect(paintOf(fake, LAYER.bordersCasing, 'line-opacity')).toBe(0)
  })
})

describe('addCountryLabelLayer', () => {
  const labelFixture: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [2, 46] },
        properties: { cca3: 'FRA', name: 'France', areaRank: 48 },
      },
    ],
  }

  function addAndGetLayer() {
    const fake = createFakeMapRef()
    addCountryLabelLayer(fake.map, labelFixture)
    const layer = fake.addedLayers.find((l) => l.id === LAYER.countryLabels)
    if (layer?.type !== 'symbol') throw new Error('country-labels must be a symbol layer')
    return { fake, layer }
  }

  it('adds the geojson source and a symbol layer registered as LAYER.countryLabels', () => {
    const { fake, layer } = addAndGetLayer()
    expect(fake.calls.addSource).toHaveBeenCalledWith(COUNTRY_LABEL_SOURCE, {
      type: 'geojson',
      data: labelFixture,
    })
    expect(layer.source).toBe(COUNTRY_LABEL_SOURCE)
  })

  it('uses the endpoint-verified Noto Sans Bold font (the default stack 404s on the positron glyphs endpoint)', () => {
    const { layer } = addAndGetLayer()
    expect(layer.layout?.['text-font']).toEqual(['Noto Sans Bold'])
    expect(layer.layout?.['text-field']).toEqual(['get', 'name'])
  })

  it('sorts collisions by areaRank and starts hidden until the visibility owner runs', () => {
    const { layer } = addAndGetLayer()
    expect(layer.layout?.['symbol-sort-key']).toEqual(['get', 'areaRank'])
    expect(layer.layout?.visibility).toBe('none')
  })

  it('zoom-stepped areaRank admission: a top-level step on zoom ending in admit-all', () => {
    const { layer } = addAndGetLayer()
    const filter = layer.filter as unknown[]
    expect(filter[0]).toBe('step')
    expect(filter[1]).toEqual(['zoom'])
    expect(filter.at(-1)).toBe(true) // final branch admits all 195
  })

  it('white text with a dark halo inside the 1–2.5px legibility band', () => {
    const { layer } = addAndGetLayer()
    expect(layer.paint?.['text-color']).toBe('#ffffff')
    expect(layer.paint?.['text-halo-color']).toBe('#0f172a')
    const halo = layer.paint?.['text-halo-width'] as number
    expect(halo).toBeGreaterThanOrEqual(1)
    expect(halo).toBeLessThanOrEqual(2.5)
  })
})
