import { describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import type { FillLayerSpecification } from 'maplibre-gl'
import {
  addBaseCountryLayers,
  addCountryLabelLayer,
  addHoverLayers,
  addSelectionLayers,
  addCompareLayers,
  addSpotlightDimLayer,
  applyBasemapLayerVisibility,
  applyCountryBaselinePaint,
  ensureRevealFillLayer,
  spotlightDimFilter,
  COUNTRY_LABEL_SOURCE,
  EXTRUSION_MAX_ZOOM,
  extrusionHeightExpression,
  LAYER,
  addCompareMarkerLayer,
  applyCompareMarkers,
} from '../mapLayers'
import { ICE_DEEP, ICE_MID, SIGNAL, SPOTLIGHT_DIM } from '../mapPalette'
import { createFakeMapRef } from '../../test/fakeMapRef'
import { makeCountryData } from '../../test/countryFixtures'

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

describe('B4 spotlight dim layer', () => {
  it('adds country-dim as a fill scrim that starts matching nothing', () => {
    const fake = createFakeMapRef()
    addSpotlightDimLayer(fake.map)
    expect(fake.addedLayers).toHaveLength(1)
    expect(fake.addedLayers[0]).toMatchObject({
      id: 'country-dim',
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': SPOTLIGHT_DIM, 'fill-opacity': 0.25 },
      filter: ['==', ['get', 'id'], ''],
    })
  })

  it('no selection matches nothing — games never show the scrim (game start deselects)', () => {
    expect(spotlightDimFilter(null, null)).toEqual(['==', ['get', 'id'], ''])
  })

  it('selection dims everything except the selected country', () => {
    expect(spotlightDimFilter('250', null)).toEqual(['!=', ['get', 'id'], '250'])
  })

  it('compare dims everything except BOTH countries', () => {
    expect(spotlightDimFilter('250', '276')).toEqual([
      'all',
      ['!=', ['get', 'id'], '250'],
      ['!=', ['get', 'id'], '276'],
    ])
  })
})

describe('B4 spotlight highlight-stack quieting', () => {
  it.each([
    ['selection', addSelectionLayers, 'country-selected', 'country-selected-glow'],
    ['compare', addCompareLayers, 'country-compare-fill', 'country-compare-glow'],
  ] as const)(
    '%s fill drops to 0.10 and the glow tightens to 4px/blur 2',
    (_n, add, fillId, glowId) => {
      const fake = createFakeMapRef()
      add(fake.map)
      const fill = fake.addedLayers.find((s) => s.id === fillId)
      expect(fill).toMatchObject({ paint: { 'fill-opacity': 0.1 } })
      const glow = fake.addedLayers.find((s) => s.id === glowId)
      expect(glow).toMatchObject({
        paint: { 'line-width': 4, 'line-blur': 2, 'line-opacity': 0.3 },
      })
    },
  )
})

describe('ensureRevealFillLayer', () => {
  it('adds the dedicated country-reveal-fill layer, transparent and unfiltered', () => {
    const fake = createFakeMapRef()
    ensureRevealFillLayer(fake.map)
    const spec = fake.addedLayers.find((l) => l.id === LAYER.revealFill)
    expect(spec?.type).toBe('fill')
    const fill = spec as FillLayerSpecification
    expect(fill.source).toBe('countries')
    expect(fill.paint?.['fill-opacity']).toBe(0)
    expect(fill.filter).toEqual(['==', ['get', 'id'], ''])
  })

  it('is idempotent — no addLayer when the layer already exists', () => {
    const fake = createFakeMapRef()
    ;(fake.map.getLayer as ReturnType<typeof vi.fn>).mockReturnValue({ id: LAYER.revealFill })
    ensureRevealFillLayer(fake.map)
    expect(fake.calls.addLayer).not.toHaveBeenCalled()
  })
})

describe("compare A/B centroid markers (B6 — rides on B1's glyph pattern)", () => {
  it('adds a country- prefixed symbol layer with explicit Noto Sans Bold, hidden by default', () => {
    const fake = createFakeMapRef()
    addCompareMarkerLayer(fake.map)
    expect(fake.calls.addSource).toHaveBeenCalledWith('compare-markers', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })
    const spec = fake.addedLayers.find((s) => s.id === 'country-compare-markers') as
      | maplibregl.SymbolLayerSpecification
      | undefined
    expect(spec?.type).toBe('symbol')
    // The positron glyphs endpoint 404s MapLibre's default font stack — the
    // explicit Noto Sans Bold is B1's live-verified glyph decision.
    expect(spec?.layout?.['text-font']).toEqual(['Noto Sans Bold'])
    // Hidden until applyCompareMarkers shows it; the country- prefix keeps
    // applyBasemapLayerVisibility's custom-layer skip in force.
    expect(spec?.layout?.visibility).toBe('none')
  })

  it('applyCompareMarkers writes [lng, lat]-swapped A/B points and toggles visibility', () => {
    const fake = createFakeMapRef()
    const a = makeCountryData() // France, latlng [46, 2]
    const b = makeCountryData({ cca3: 'DEU', ccn3: '276', latlng: [51, 9] })
    applyCompareMarkers(fake.map, { a, b })
    expect(fake.calls.setData).toHaveBeenCalledWith({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [2, 46] },
          properties: { label: 'A' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [9, 51] },
          properties: { label: 'B' },
        },
      ],
    })
    expect(fake.calls.setLayoutProperty).toHaveBeenLastCalledWith(
      'country-compare-markers',
      'visibility',
      'visible',
    )
    applyCompareMarkers(fake.map, null)
    expect(fake.calls.setData).toHaveBeenLastCalledWith({
      type: 'FeatureCollection',
      features: [],
    })
    expect(fake.calls.setLayoutProperty).toHaveBeenLastCalledWith(
      'country-compare-markers',
      'visibility',
      'none',
    )
  })
})

describe('E4 two-accent highlight paint', () => {
  it.each([
    ['selection', addSelectionLayers, ICE_DEEP],
    ['compare', addCompareLayers, ICE_MID],
  ] as const)('%s stack initializes every layer with its E4 accent', (_n, add, color) => {
    const fake = createFakeMapRef()
    add(fake.map)
    expect(fake.addedLayers).toHaveLength(4)
    for (const spec of fake.addedLayers) {
      if (spec.type === 'fill') expect(spec.paint?.['fill-color']).toBe(color)
      else if (spec.type === 'line') expect(spec.paint?.['line-color']).toBe(color)
      else if (spec.type === 'fill-extrusion')
        expect(spec.paint?.['fill-extrusion-color']).toBe(color)
      else throw new Error(`unexpected layer type ${spec.type}`)
    }
  })

  it('compare markers colour A signal / B ice-mid over a dark halo (A matches the panel badge; see mapPalette ICE_MID doc for the B mismatch note)', () => {
    const fake = createFakeMapRef()
    addCompareMarkerLayer(fake.map)
    const spec = fake.addedLayers.find((s) => s.id === 'country-compare-markers') as
      | maplibregl.SymbolLayerSpecification
      | undefined
    expect(spec?.paint?.['text-color']).toEqual(['match', ['get', 'label'], 'A', SIGNAL, ICE_MID])
    // Dark halo: SIGNAL is ~2.3:1 against white but ~7.3:1 against #0f172a
    // (B1's label halo) — one halo treatment for labels and markers.
    expect(spec?.paint?.['text-halo-color']).toBe('#0f172a')
  })
})
